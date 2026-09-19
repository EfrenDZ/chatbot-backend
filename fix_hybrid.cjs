const fs = require('fs');

const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/index.ts';
let code = fs.readFileSync(path, 'utf8');

const oldLogic = `        if (session.consecutiveErrors >= account.botConfig.maxConsecutiveErrors) {
          await prisma.conversationSession.update({ where: { id: session.id }, data: { consecutiveErrors: 0 } });
          await AiOrchestrator.processAiMessage(account, session, cwConversation.id, content);
        }`;

const newLogic = `        if (session.consecutiveErrors >= account.botConfig.maxConsecutiveErrors) {
          // Ya superó el límite de errores, la IA toma el control permanentemente
          // NO reseteamos consecutiveErrors a 0 aquí, porque si lo hacemos, 
          // el siguiente mensaje lo regresará al menú estricto.
          await AiOrchestrator.processAiMessage(account, session, cwConversation.id, content);
        }`;

code = code.replace(oldLogic, newLogic);

fs.writeFileSync(path, code, 'utf8');
console.log("Hybrid logic fixed");
