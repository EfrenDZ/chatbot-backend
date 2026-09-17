import { PrismaClient, ConversationSession, BotConfig, Account as PrismaAccount } from '@prisma/client';
import { ChatwootService } from './chatwoot.service';
import { AiService } from './ai.service';

const prisma = new PrismaClient();

// Tipo extendido para incluir las relaciones
type Account = PrismaAccount & { botConfig?: BotConfig | null };

export class BotEngine {
  /**
   * Punto de entrada principal desde el Webhook
   */
  static async handleIncomingMessage(payload: any): Promise<void> {
    const { account: cwAccount, conversation: cwConversation, sender, content } = payload;
    const userMessage = content.trim().toLowerCase();

    // 1. Validar que la cuenta exista en nuestro SaaS
    const account = await prisma.account.findUnique({
      where: { chatwootAccountId: cwAccount.id },
      include: { botConfig: true },
    });

    if (!account || !account.isActive || !account.botConfig) {
      console.log(`[BotEngine] Cuenta ${cwAccount.id} inactiva o sin configuración.`);
      return;
    }

    // 2. Obtener o crear la sesión de esta conversación
    const session = await this.getOrCreateSession(account.id, cwConversation.id, sender.phone_number || sender.email);

    // Si un humano ya tomó el control, el bot hace silencio absoluto.
    if (session.status !== 'BOT_HANDLING') {
      return;
    }

    // 3. Evaluar palabras clave de reinicio (ej. "Menú")
    if (account.botConfig.resetKeywords.includes(userMessage)) {
      await this.resetSession(session.id, account.botConfig);
      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }
    
    // 4. Evaluar palabras clave de transferencia a humano (ej. "Agente")
    if (account.botConfig.handoffKeywords.includes(userMessage)) {
      await this.executeHandoff(account, session, cwConversation.id);
      return;
    }

    // 5. Enrutador Principal: ¿Está en modo Opciones o en modo IA?
    const isAiModeActive = this.shouldUseAI(session, account.botConfig);

    if (isAiModeActive) {
      await this.processAiMessage(account, session, cwConversation.id, content);
    } else {
      await this.processMenuOption(account, session, cwConversation.id, userMessage);
    }
  }

  private static async getOrCreateSession(accountId: string, cwConvId: number, identifier: string): Promise<ConversationSession> {
    const session = await prisma.conversationSession.findUnique({
      where: { unique_account_conversation: { accountId, chatwootConversationId: cwConvId } },
    });

    if (session) return session;

    return prisma.conversationSession.create({
      data: {
        accountId,
        chatwootConversationId: cwConvId,
        contactIdentifier: identifier,
        status: 'BOT_HANDLING',
      },
    });
  }

  private static async resetSession(sessionId: string, config: BotConfig) {
    const flowGraph = config.flowGraph as any;
    await prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        currentNodeId: flowGraph.rootNodeId,
        consecutiveErrors: 0,
        aiMessagesCount: 0,
      },
    });
  }

  private static async sendCurrentNode(account: Account, config: BotConfig, sessionId: string, cwConvId: number) {
    const flowGraph = config.flowGraph as any;
    
    // Obtener sesión actualizada para saber en qué nodo estamos
    const session = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
    const nodeId = session?.currentNodeId || flowGraph.rootNodeId;
    
    const node = flowGraph.nodes.find((n: any) => n.id === nodeId);
    if (!node) return;

    let messageText = node.text;

    // Si es un menú, adjuntamos las opciones al texto
    if (node.type === 'MENU' && node.options) {
      const optionsText = node.options.map((opt: any) => opt.label).join('\n');
      messageText += `\n\n${optionsText}`;
    }

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        messageText
      );
    }
  }

  private static async executeHandoff(account: Account, session: ConversationSession, cwConvId: number) {
    // 1. Marcar en BD
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { status: 'HANDED_OFF_TO_HUMAN' },
    });

    // 2. Avisar al usuario
    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        account.botConfig!.handoffMessage
      );

      // 3. Abrir la conversación en Chatwoot
      await ChatwootService.handoffToHuman(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId
      );
    }
  }

  private static shouldUseAI(session: ConversationSession, config: BotConfig): boolean {
    if (config.botMode === 'AI') return true;
    if (config.botMode === 'OPTIONS') return false;
    
    // 1. En HYBRID: Si superó el límite de errores en menú, entra la IA
    if (session.consecutiveErrors >= config.maxConsecutiveErrors) return true;

    // 2. En HYBRID: Si el nodo actual no es un menú de opciones (ej. es texto final informativo o nodo IA), responde la IA
    const flowGraph = config.flowGraph as any;
    const nodeId = session.currentNodeId || flowGraph.rootNodeId;
    const node = flowGraph.nodes?.find((n: any) => n.id === nodeId);
    if (node && (node.type === 'AI' || node.type === 'MESSAGE' || !node.options)) {
      return true;
    }

    return false;
  }

  private static async processMenuOption(account: Account, session: ConversationSession, cwConvId: number, userMessage: string) {
    const config = account.botConfig!;
    const flowGraph = config.flowGraph as any;
    const nodeId = session.currentNodeId || flowGraph.rootNodeId;
    
    const node = flowGraph.nodes.find((n: any) => n.id === nodeId);

    // Si no es un nodo tipo menú, o no se encontró, ignoramos
    if (!node || node.type !== 'MENU' || !node.options) return;

    // Buscar si el usuario escribió el número de la opción o alguna palabra clave
    const selectedOption = node.options.find((opt: any, index: number) => {
      const isNumberMatch = userMessage === (index + 1).toString();
      const isLabelMatch = opt.label.toLowerCase().includes(userMessage);
      return isNumberMatch || isLabelMatch;
    });

    if (selectedOption) {
      // Opción válida -> Avanzar nodo y resetear errores
      await prisma.conversationSession.update({
        where: { id: session.id },
        data: {
          currentNodeId: selectedOption.targetNodeId,
          consecutiveErrors: 0,
        },
      });

      // Enviar el nuevo nodo al que acabamos de saltar
      await this.sendCurrentNode(account, config, session.id, cwConvId);

    } else {
      // Opción inválida -> Sumar error
      const newErrors = session.consecutiveErrors + 1;
      await prisma.conversationSession.update({
        where: { id: session.id },
        data: { consecutiveErrors: newErrors },
      });

      if (account.chatwootAccessToken) {
        // Enviar mensaje de error
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          config.fallbackMessage
        );
        // Volver a enviar el menú actual para que el usuario vea sus opciones
        await this.sendCurrentNode(account, config, session.id, cwConvId);
      }
    }
  }

  private static async processAiMessage(account: Account, session: ConversationSession, cwConvId: number, content: string) {
    const config = account.botConfig!;

    // 1. Guardar el mensaje del usuario en el historial
    await prisma.messageLog.create({
      data: {
        conversationSessionId: session.id,
        senderType: 'USER',
        content,
      }
    });

    // 2. Incrementar contador y verificar el límite duro
    const newAiCount = session.aiMessagesCount + 1;
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { aiMessagesCount: newAiCount },
    });

    if (newAiCount > config.maxAiMessages) {
      await this.executeHandoff(account, session, cwConvId);
      return;
    }

    // 3. Obtener el historial reciente (últimos 10 mensajes) para dar contexto
    const recentLogs = await prisma.messageLog.findMany({
      where: { conversationSessionId: session.id, senderType: { in: ['USER', 'BOT_AI'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    // Invertir para que estén en orden cronológico correcto para la API
    const history = recentLogs.reverse().map(log => ({
      role: log.senderType === 'USER' ? 'user' : 'assistant',
      content: log.content,
    })) as any[]; // CoreMessage[] shape

    // 4. Preparar el Prompt del Sistema (Avisar si estamos en mensajes de cierre)
    let finalSystemPrompt = config.systemPrompt || '';
    const messagesLeft = config.maxAiMessages - newAiCount;
    
    if (messagesLeft <= config.aiWrapUpMessages) {
      finalSystemPrompt += `\n\n[IMPORTANTE]: Te quedan ${messagesLeft} mensajes con el usuario antes de que el sistema fuerce una transferencia. Intenta cerrar la duda ahora o indícale amablemente que lo vas a transferir a un asesor humano.`;
    }

    // 5. Llamar a la IA
    const aiReply = await AiService.getReply(
      config.aiProvider,
      config.aiModel,
      finalSystemPrompt,
      history
    );

    // 6. Guardar respuesta en BD y enviarla a Chatwoot
    await prisma.messageLog.create({
      data: {
        conversationSessionId: session.id,
        senderType: 'BOT_AI',
        content: aiReply,
      }
    });

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        aiReply
      );
    }
  }
}
