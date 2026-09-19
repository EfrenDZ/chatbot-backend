const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const oldHandoff = `    // Si el nodo es de transferencia a humano (Handoff)
    if (node.type === 'HANDOFF') {
      await this.executeHandoff(account, session!, cwConvId, finalMessageText);
      return;
    }`;

const newHandoff = `    // Nuevos tipos de nodos terminales
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
    }`;

code = code.replace(oldHandoff, newHandoff);

fs.writeFileSync(path, code, 'utf8');
console.log("bot.service.ts patched for new nodes");
