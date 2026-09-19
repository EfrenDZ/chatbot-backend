import { ConversationSession } from '@prisma/client';
import { Account, prisma } from './types';
import { AiService } from '../ai.service';
import { ChatwootService } from '../chatwoot.service';
import { FlowRouter } from './flow.router';

export class AiOrchestrator {
  static buildSystemPrompt(config: any): string {
    if (config.aiPromptMode === 'FREE') {
      return config.systemPrompt || '';
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

    promptParts.push(`INSTRUCCIONES GENERALES:\nBásate estrictamente en la información proporcionada arriba. Si el usuario pregunta algo que no está en tu conocimiento o catálogo, indícale amablemente que no tienes esa información y utiliza la herramienta "transferir_a_humano".\n\nINSTRUCCIÓN DE AUTO-CIERRE:\nSi el usuario se despide explícitamente (ej. "gracias adios", "eso es todo"), despídete de él de forma cordial y OBLIGATORIAMENTE utiliza la herramienta "resolver_conversacion" para cerrar el chat.`);

    return promptParts.join('\n\n------------------------\n\n');
  }

  static async processAiMessage(account: Account, session: ConversationSession, cwConvId: number, content: string) {
    const config = account.botConfig!;

    await prisma.messageLog.create({
      data: { conversationSessionId: session.id, senderType: 'USER', content }
    });

    const newAiCount = session.aiMessagesCount + 1;
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { aiMessagesCount: newAiCount },
    });

    if (newAiCount > config.maxAiMessages) {
      await FlowRouter.executeHandoff(account, session, cwConvId);
      return;
    }

    const recentLogs = await prisma.messageLog.findMany({
      where: { conversationSessionId: session.id, senderType: { in: ['USER', 'BOT_AI'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    const history = recentLogs.reverse().map(log => ({
      role: log.senderType === 'USER' ? 'user' : 'assistant',
      content: log.content,
    })) as any[];

    let finalSystemPrompt = this.buildSystemPrompt(config);
    const messagesLeft = config.maxAiMessages - newAiCount;
    
    if (messagesLeft <= config.aiWrapUpMessages) {
      finalSystemPrompt += `\n\n[IMPORTANTE]: Te quedan ${messagesLeft} mensajes con el usuario antes de que el sistema fuerce una transferencia. Intenta cerrar la duda ahora o indícale amablemente que lo vas a transferir a un asesor humano utilizando la herramienta correspondiente.`;
    }

    const aiResult = await AiService.getReply(
      config.aiProvider,
      config.aiModel,
      finalSystemPrompt,
      history
    );

    if (aiResult.text.includes('[ERROR_IA]')) {
      console.log(`[BotEngine] Falla en IA detectada en la sesión ${session.id}.`);
      const emergencyMsg = "En este momento te comunicaré con uno de nuestros asesores para que te atienda personalmente. Dame un momento.";
      await FlowRouter.executeHandoff(account, session, cwConvId, emergencyMsg);
      return;
    }

    // Si la IA responde texto, lo guardamos y enviamos
    if (aiResult.text.trim().length > 0) {
      await prisma.messageLog.create({
        data: { conversationSessionId: session.id, senderType: 'BOT_AI', content: aiResult.text }
      });

      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          aiResult.text
        );
      }
    }

    if (aiResult.isHandoff) {
      console.log(`[BotEngine] La IA decidió transferir a humano (Tool Call) en sesión ${session.id}`);
      // Ejecutamos handoff pero SIN el mensaje custom de la IA, a menos que queramos usar el texto que haya dicho
      // Si la IA ya dijo algo ("Te transfiero"), se envió arriba. Si no dijo nada, pasamos undefined para que use el default.
      const handoffMsg = aiResult.text.trim().length > 0 ? aiResult.text : undefined;
      await FlowRouter.executeHandoff(account, session, cwConvId, handoffMsg);
      return;
    }

    if (aiResult.isResolved && account.chatwootAccessToken) {
      console.log(`[BotEngine] La IA decidió auto-resolver (Tool Call) en sesión ${session.id}`);
      await ChatwootService.resolveConversation(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId
      );
      await prisma.conversationSession.update({ where: { id: session.id }, data: { status: 'RESOLVED' } });
    }
  }
}
