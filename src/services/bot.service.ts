import { PrismaClient, ConversationSession, BotConfig, Account as PrismaAccount } from '@prisma/client';
import { ChatwootService } from './chatwoot.service';
import { AiService } from './ai.service';

const prisma = new PrismaClient();

// Tipo extendido para incluir las relaciones
type Account = PrismaAccount & { botConfig?: BotConfig | null };

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class BotEngine {
  /**
   * Punto de entrada principal desde el Webhook
   */
  static async handleIncomingMessage(payload: any): Promise<void> {
    const { account: cwAccount, conversation: cwConversation, sender, content } = payload;
    const userMessage = (content || '').trim().toLowerCase();

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
    const [session, isNew] = await this.getOrCreateSession(account.id, cwConversation.id, sender.phone_number || sender.email);


    // Si la sesión expiró por inactividad, reiniciarla pasivamente
    const hoursInactive = (Date.now() - session.updatedAt.getTime()) / (1000 * 60 * 60);
    const timeoutHours = account.botConfig.sessionTimeoutHours || 24;
    
    if (hoursInactive > timeoutHours) {
      console.log(`[BotEngine] Sesión ${session.id} expirada (>${timeoutHours}h). Reiniciando.`);
      await this.resetSession(session.id, account.botConfig);
      // Actualizamos estado en memoria para que se comporte como nueva si estaba en otro nodo
      session.currentNodeId = (account.botConfig.flowGraph as any).rootNodeId;
      session.status = 'BOT_HANDLING';
      // Refrescamos en BD
      await prisma.conversationSession.update({
        where: { id: session.id },
        data: { status: 'BOT_HANDLING' }
      });
      // Importante: Tratamos como nueva para que lance mensaje de bienvenida y nodo raíz
      if (account.botConfig.welcomeMessage && account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConversation.id,
          account.botConfig.welcomeMessage
        );
        await delay(2500);
      }
      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }

    // Si un humano ya tomó el control (y no expiró), el bot hace silencio absoluto.


    if (session.status === 'RESOLVED') {
      console.log(`[BotEngine] Mensaje en sesión resuelta. Reactivando bot.`);
      await this.resetSession(session.id, account.botConfig);
      await prisma.conversationSession.update({
        where: { id: session.id },
        data: { status: 'BOT_HANDLING' }
      });
      
      if (account.botConfig.welcomeMessage && account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConversation.id,
          account.botConfig.welcomeMessage
        );
        await delay(2500);
      }
      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }

    if (session.status !== 'BOT_HANDLING') {

      return;
    }

    // Rechazar archivos multimedia si los hay
    if (payload.attachments && payload.attachments.length > 0) {
      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConversation.id,
          "Soy un asistente virtual y por el momento solo puedo procesar texto. Por favor, escríbeme tu consulta."
        );
      }
      return;
    }

    // 2.5 Si es una nueva conversación, dar la bienvenida y mostrar el menú principal (ignorando el texto que usó para abrir el chat)
    if (isNew) {
      if (account.botConfig.welcomeMessage && account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConversation.id,
          account.botConfig.welcomeMessage
        );
      }
      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
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
    if (account.botConfig.botMode === 'AI') {
      await this.processAiMessage(account, session, cwConversation.id, content);
    } else if (account.botConfig.botMode === 'OPTIONS') {
      await this.processMenuOption(account, session, cwConversation.id, userMessage);
    } else {
      // MODO HÍBRIDO: Primero intentamos ver si el usuario tecleó una opción de menú válida
      const wasValidOption = await this.tryProcessMenuOption(account, session, cwConversation.id, userMessage);
      
      if (!wasValidOption) {
        // Si no era una opción válida, verificamos si ya superó el límite de errores
        if (session.consecutiveErrors >= account.botConfig.maxConsecutiveErrors) {
          // Entra la IA al rescate
          await this.processAiMessage(account, session, cwConversation.id, content);
        } else {
          // Si aún le quedan intentos, procesamos el error de menú normalmente
          await this.processMenuError(account, session, cwConversation.id);
        }
      }
    }
  }

  static async handleConversationResolved(payload: any): Promise<void> {
    const { account: cwAccount, id: cwConversationId } = payload;
    
    const account = await prisma.account.findUnique({
      where: { chatwootAccountId: cwAccount.id },
      include: { botConfig: true },
    });

    if (!account || !account.isActive || !account.botConfig) return;

    // Send farewell message if configured
    if (account.botConfig.farewellMessage && account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConversationId,
        account.botConfig.farewellMessage
      );
    }
    
    // Mark session as resolved in our DB
    await prisma.conversationSession.updateMany({
      where: { 
        accountId: account.id,
        chatwootConversationId: cwConversationId 
      },
      data: { status: 'RESOLVED' }
    });
  }

  private static async getOrCreateSession(accountId: string, cwConvId: number, identifier: string): Promise<[ConversationSession, boolean]> {
    let session = await prisma.conversationSession.findUnique({
      where: { unique_account_conversation: { accountId, chatwootConversationId: cwConvId } },
    });

    if (session) return [session, false];

    session = await prisma.conversationSession.create({
      data: {
        accountId,
        chatwootConversationId: cwConvId,
        contactIdentifier: identifier,
        status: 'BOT_HANDLING',
      },
    });
    
    return [session, true];
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

    const messages: string[] = (node.messages && Array.isArray(node.messages) && node.messages.length > 0)
      ? node.messages
      : [node.text];

    // Enviar todos los globos previos al último como mensajes de texto plano
    for (let i = 0; i < messages.length - 1; i++) {
      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          messages[i]
        );
        await delay(2500);
      }
    }

    const finalMessageText = messages[messages.length - 1];

    // Nuevos tipos de nodos terminales
    if (node.type === 'RESTART') {
      await this.resetSession(sessionId, config);
      const newSession = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
      if (newSession) {
        await this.sendCurrentNode(account, config, newSession.id, cwConvId);
      }
      return;
    }

    if (node.type === 'RESOLVE') {
      if (account.chatwootAccessToken) {
        await ChatwootService.resolveConversation(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId
        );
      }
      await prisma.conversationSession.update({ where: { id: sessionId }, data: { status: 'RESOLVED' } });
      return;
    }

    // Si el nodo es de transferencia a humano (Handoff)
    if (node.type === 'HANDOFF') {
      await this.executeHandoff(account, session!, cwConvId, finalMessageText);
      return;
    }

    // Si es un menú con opciones
    if (node.type === 'MENU' && node.options && node.options.length > 0) {
      if (node.options.length <= 10) {
        // Enviar como mensaje interactivo nativo (Botones si <= 3, Lista interactiva si <= 10)
        // Meta WhatsApp: botones max 20 caracteres, lista max 24 caracteres.
        const maxTitleLen = node.options.length <= 3 ? 20 : 24;
        const items = node.options.map((opt: any, index: number) => {
          let title = opt.label.trim();
          if (title.length > maxTitleLen) {
            title = title.substring(0, maxTitleLen);
          }
          return {
            title,
            value: (index + 1).toString(),
          };
        });

        if (account.chatwootAccessToken) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText,
            {
              contentType: 'input_select',
              contentAttributes: { items },
            }
          );
          // Retraso crucial: damos tiempo a WhatsApp de procesar el mensaje interactivo
          // antes de que la cola (queue) libere el siguiente mensaje.
          await delay(2500);
        }
        return;
      } else {
        // Más de 10 opciones: WhatsApp no soporta listas de >10 items.
        // Fallback a texto plano numerado legible.
        const optionsText = node.options
          .map((opt: any, index: number) => `${index + 1}. ${opt.label}`)
          .join('\n');
        
        const fullMessage = `${finalMessageText}\n\n${optionsText}`;

        if (account.chatwootAccessToken) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            fullMessage
          );
        }
        return;
      }
    }

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        finalMessageText
      );
    }
  }

  private static async executeHandoff(account: Account, session: ConversationSession, cwConvId: number, customMessage?: string) {
    // 1. Marcar en BD
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { status: 'HANDED_OFF_TO_HUMAN' },
    });

    // 2. Avisar al usuario
    if (account.chatwootAccessToken) {
      const message = (customMessage && customMessage.trim()) ? customMessage : account.botConfig!.handoffMessage;
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        message
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
    const wasValid = await this.tryProcessMenuOption(account, session, cwConvId, userMessage);
    if (!wasValid) {
      await this.processMenuError(account, session, cwConvId);
    }
  }

  private static async tryProcessMenuOption(account: Account, session: ConversationSession, cwConvId: number, userMessage: string): Promise<boolean> {
    const config = account.botConfig!;
    const flowGraph = config.flowGraph as any;
    const nodeId = session.currentNodeId || flowGraph.rootNodeId;
    
    const node = flowGraph.nodes.find((n: any) => n.id === nodeId);

    // Si no es un menú, consideramos que "no es opción válida"
    if (!node || node.type !== 'MENU' || !node.options) return false;

    const cleanUserMsg = userMessage.trim().toLowerCase();

    const selectedOption = node.options.find((opt: any, index: number) => {
      const optionIndexStr = (index + 1).toString();
      const cleanLabel = opt.label.trim().toLowerCase();
      // Remover prefijo numérico como "1. " o "1 - " si existe para comparar con el título limpio
      const labelWithoutNumber = cleanLabel.replace(/^\d+[\.\-\)\s]+/, '').trim();

      // 1. Coincidencia por número directo ("1", "1.")
      const isNumberMatch = cleanUserMsg === optionIndexStr || cleanUserMsg === `${optionIndexStr}.`;
      
      // 2. Coincidencia exacta de etiqueta completa ("1. ver precios")
      const isExactLabel = cleanLabel === cleanUserMsg;
      
      // 3. Coincidencia de texto sin el prefijo ("ver precios")
      const isLabelWithoutNumber = labelWithoutNumber.length > 0 && (
        labelWithoutNumber === cleanUserMsg || cleanUserMsg.includes(labelWithoutNumber) || labelWithoutNumber.includes(cleanUserMsg)
      );

      // 4. Coincidencia parcial (subcadena)
      const isPartial = cleanLabel.includes(cleanUserMsg) || cleanUserMsg.includes(cleanLabel);

      return isNumberMatch || isExactLabel || isLabelWithoutNumber || isPartial;
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
      await this.sendCurrentNode(account, config, session.id, cwConvId);
      return true;
    }
    
    return false;
  }

  private static async processMenuError(account: Account, session: ConversationSession, cwConvId: number) {
    const config = account.botConfig!;
    const newErrors = session.consecutiveErrors + 1;
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { consecutiveErrors: newErrors },
    });

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        config.fallbackMessage
      );
      await delay(2000); // Dar espacio antes de reenviar el menú
      await this.sendCurrentNode(account, config, session.id, cwConvId);
    }
  
  }


  private static buildSystemPrompt(config: any): string {
    if (config.aiPromptMode === 'FREE') {
      let base = config.systemPrompt || '';
      base += '\n\n[INSTRUCCIÓN CRÍTICA]: Si el usuario dice \"gracias\", primero pregúntale si necesita algo más. SOLO si dice que NO o se despide definitivamente, DEBES escribir la etiqueta secreta [RESOLVER] al final de tu mensaje. Ejemplo: \"Adiós! [RESOLVER]\"';
      return base;
    }

    const knowledge = config.aiKnowledge as any || {};
    let promptParts = [];
    
    promptParts.push(`ERES el asistente virtual de: ${knowledge.businessName || 'esta empresa'}.`);
    
    if (knowledge.businessDescription) {
      promptParts.push(`DESCRIPCIÓN DE LA EMPRESA:\n${knowledge.businessDescription}`);
    }
    
    if (knowledge.tone) {
      promptParts.push(`TONO DE CONVERSACIÓN:\nDebes responder con un tono: ${knowledge.tone}.`);
    }

    if (knowledge.rules && knowledge.rules.length > 0) {
      promptParts.push(`REGLAS DE OBLIGATORIO CUMPLIMIENTO:\n${knowledge.rules.map((r: string) => `- ${r}`).join('\n')}`);
    }

    if (knowledge.catalog && knowledge.catalog.length > 0) {
      const catText = knowledge.catalog.map((c: any) => `- Producto/Servicio: ${c.name}\n  Precio: ${c.price}\n  Detalles: ${c.description}`).join('\n\n');
      promptParts.push(`CATÁLOGO DE PRODUCTOS / SERVICIOS:\n${catText}`);
    }

    if (knowledge.faqs && knowledge.faqs.length > 0) {
      const faqText = knowledge.faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
      promptParts.push(`PREGUNTAS FRECUENTES (Utiliza esta información para responder a clientes):\n${faqText}`);
    }

    if (knowledge.branches && knowledge.branches.length > 0) {
      const branchesText = knowledge.branches.map((b: any) => `- Sucursal: ${b.name}\n  Horario: ${b.schedule}\n  Ubicación/Maps: ${b.mapsLink}`).join('\n\n');
      promptParts.push(`NUESTRAS SUCURSALES:\n${branchesText}`);
    }

    if (knowledge.extraContext) {
      promptParts.push(`CONTEXTO ADICIONAL / NOTAS EXTRA:\n${knowledge.extraContext}`);
    }

    promptParts.push(`INSTRUCCIONES GENERALES:\nBásate estrictamente en la información proporcionada arriba. Si el usuario pregunta algo que no está en tu conocimiento o catálogo, indícale amablemente que no tienes esa información y ofrécele transferencia a un humano.\n\nINSTRUCCIÓN DE AUTO-CIERRE:\nSi el usuario se despide explícitamente (ej. "gracias adios", "eso es todo"), despídete de él de forma cordial Y OBLIGATORIAMENTE incluye la palabra exacta [RESOLVER] al final de tu respuesta secreta. Esto activará el sistema para cerrar el chat.`);

    return promptParts.join('\n\n------------------------\n\n');
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
    let finalSystemPrompt = this.buildSystemPrompt(config);
    const messagesLeft = config.maxAiMessages - newAiCount;
    
    if (messagesLeft <= config.aiWrapUpMessages) {
      finalSystemPrompt += `\n\n[IMPORTANTE]: Te quedan ${messagesLeft} mensajes con el usuario antes de que el sistema fuerce una transferencia. Intenta cerrar la duda ahora o indícale amablemente que lo vas a transferir a un asesor humano.`;
    }

    // 5. Llamar a la IA
    let aiReply = await AiService.getReply(
      config.aiProvider,
      config.aiModel,
      finalSystemPrompt,
      history
    );

    // Fallback de Emergencia si la IA se cae o llega al límite de cuota
    if (aiReply.includes('[ERROR_IA]')) {
      console.log(`[BotEngine] Falla en IA detectada en la sesión ${session.id}. Ejecutando transferencia de emergencia.`);
      const emergencyMsg = "En este momento te comunicaré con uno de nuestros asesores para que te atienda personalmente. Dame un momento.";
      await this.executeHandoff(account, session, cwConvId, emergencyMsg);
      return;
    }

    let isResolvedByAi = false;
    let isHandoffByAi = false;

    if (/\[RESOLVER\]/i.test(aiReply) || /\[resolver\]/i.test(aiReply)) {
      isResolvedByAi = true;
      aiReply = aiReply.replace(/\[RESOLVER\]/gi, '').trim();
    }
    
    if (/\[HUMANO\]/i.test(aiReply) || /\[humano\]/i.test(aiReply)) {
      isHandoffByAi = true;
      aiReply = aiReply.replace(/\[HUMANO\]/gi, '').trim();
    }

    // 6. Guardar respuesta en BD y enviarla a Chatwoot
    await prisma.messageLog.create({
      data: {
        conversationSessionId: session.id,
        senderType: 'BOT_AI',
        content: aiReply,
      }
    });

    if (isHandoffByAi) {
      // Si la IA decide transferir, usamos la respuesta de la IA como mensaje de handoff
      await this.executeHandoff(account, session, cwConvId, aiReply);
      return;
    }

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        aiReply
      );
    }

    if (isResolvedByAi && account.chatwootAccessToken) {
      console.log(`[BotEngine] La IA decidió auto-resolver la sesión ${session.id}`);
      await ChatwootService.resolveConversation(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId
      );
    }
  }
}

