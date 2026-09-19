const fs = require('fs');

// PATCH flow.router.ts
const flowPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let flowCode = fs.readFileSync(flowPath, 'utf8');

const webhookLogic = `
    if (node.type === 'WEBHOOK') {
      try {
        const metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session.sessionMetadata || {});
        
        // Ejecutar petición HTTP
        const response = await fetch(node.url, {
          method: node.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata)
        });

        if (response.ok) {
          await prisma.conversationSession.update({
            where: { id: sessionId },
            data: { currentNodeId: node.successNodeId, consecutiveErrors: 0 }
          });
        } else {
          await prisma.conversationSession.update({
            where: { id: sessionId },
            data: { currentNodeId: node.errorNodeId, consecutiveErrors: 0 }
          });
        }
      } catch (err) {
        console.error('[FlowRouter] Webhook error:', err);
        await prisma.conversationSession.update({
          where: { id: sessionId },
          data: { currentNodeId: node.errorNodeId, consecutiveErrors: 0 }
        });
      }
      
      // Llamada recursiva para procesar el nodo destino (success o error)
      const newSession = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
      if (newSession) {
        await this.sendCurrentNode(account, config, newSession.id, cwConvId);
      }
      return;
    }

    if (node.type === 'INPUT') {
      // Los nodos de INPUT simplemente mandan su mensaje y esperan a que el usuario escriba
      // No tienen opciones
      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          finalMessageText
        );
        await delay(2000);
      }
      return;
    }
`;

// Insert the webhook logic right before "if (node.type === 'MENU' && node.options && node.options.length > 0) {"
flowCode = flowCode.replace(
  "if (node.type === 'MENU' && node.options && node.options.length > 0) {",
  webhookLogic + "\n    if (node.type === 'MENU' && node.options && node.options.length > 0) {"
);

const inputLogic = `
  static async tryProcessInputNode(account: Account, session: ConversationSession, cwConvId: number, userMessage: string, node: any): Promise<boolean> {
    if (node.type !== 'INPUT') return false;
    
    const varName = node.variableName || 'input';
    let metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session.sessionMetadata || {});
    
    // Guardar la variable
    metadata[varName] = userMessage.trim();

    await prisma.conversationSession.update({
      where: { id: session.id },
      data: {
        currentNodeId: node.targetNodeId,
        consecutiveErrors: 0,
        sessionMetadata: metadata
      },
    });

    await this.sendCurrentNode(account, account.botConfig!, session.id, cwConvId);
    return true;
  }
`;

flowCode = flowCode + '\n' + inputLogic;
fs.writeFileSync(flowPath, flowCode, 'utf8');

// PATCH index.ts
const indexPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/index.ts';
let indexCode = fs.readFileSync(indexPath, 'utf8');

const hybridLogicOld = `    if (account.botConfig.botMode === 'AI') {
      await AiOrchestrator.processAiMessage(account, session, cwConversation.id, content);
    } else if (account.botConfig.botMode === 'OPTIONS') {
      await FlowRouter.processMenuOption(account, session, cwConversation.id, userMessage);
    } else {
      const wasValidOption = await FlowRouter.tryProcessMenuOption(account, session, cwConversation.id, userMessage);
      if (!wasValidOption) {
        if (session.consecutiveErrors >= account.botConfig.maxConsecutiveErrors) {
          // Ya superó el límite de errores, la IA toma el control permanentemente
          // NO reseteamos consecutiveErrors a 0 aquí, porque si lo hacemos, 
          // el siguiente mensaje lo regresará al menú estricto.
          await AiOrchestrator.processAiMessage(account, session, cwConversation.id, content);
        } else {
          await FlowRouter.processMenuError(account, session, cwConversation.id);
        }
      }
    }`;

const hybridLogicNew = `
    const flowGraph = account.botConfig.flowGraph as any;
    const currentNodeId = session.currentNodeId || flowGraph.rootNodeId;
    const currentNode = flowGraph.nodes?.find((n: any) => n.id === currentNodeId);

    // Si estamos en un nodo INPUT, procesamos la variable sin importar el modo
    if (currentNode && currentNode.type === 'INPUT') {
      await FlowRouter.tryProcessInputNode(account, session, cwConversation.id, content, currentNode);
      return;
    }

    if (account.botConfig.botMode === 'AI') {
      await AiOrchestrator.processAiMessage(account, session, cwConversation.id, content);
    } else if (account.botConfig.botMode === 'OPTIONS') {
      await FlowRouter.processMenuOption(account, session, cwConversation.id, userMessage);
    } else {
      const wasValidOption = await FlowRouter.tryProcessMenuOption(account, session, cwConversation.id, userMessage);
      if (!wasValidOption) {
        if (session.consecutiveErrors >= account.botConfig.maxConsecutiveErrors) {
          await AiOrchestrator.processAiMessage(account, session, cwConversation.id, content);
        } else {
          await FlowRouter.processMenuError(account, session, cwConversation.id);
        }
      }
    }`;

indexCode = indexCode.replace(hybridLogicOld, hybridLogicNew);
fs.writeFileSync(indexPath, indexCode, 'utf8');

console.log("Nodes added");
