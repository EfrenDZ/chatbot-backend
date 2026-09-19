const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const oldInstructions = `INSTRUCCIÓN DE AUTO-CIERRE:
Si el usuario se despide explícitamente (ej. "gracias adios", "eso es todo"), despídete de él de forma cordial Y OBLIGATORIAMENTE incluye la palabra exacta [RESOLVER] al final de tu respuesta secreta. Esto activará el sistema para cerrar el chat.\`);`;

const newInstructions = `INSTRUCCIÓN DE AUTO-CIERRE Y TRANSFERENCIA:
- Si el usuario se despide explícitamente (ej. "gracias adios", "eso es todo"), despídete de forma cordial e incluye la palabra exacta [RESOLVER] al final de tu respuesta.
- Si el usuario solicita hablar con un humano, agente, persona real, o si hace una pregunta que requiere intervención humana por estar fuera de tu alcance, respóndele que lo transferirás e incluye OBLIGATORIAMENTE la palabra exacta [HUMANO] al final de tu respuesta. Esto activará el sistema para transferir el chat.\`);`;

code = code.replace(oldInstructions, newInstructions);

const oldAiProcess = `    let isResolvedByAi = false;
    if (/\\[RESOLVER\\]/i.test(aiReply) || /\\[resolver\\]/i.test(aiReply)) {
      isResolvedByAi = true;
      aiReply = aiReply.replace(/\\[RESOLVER\\]/gi, '').trim();
    }`;

const newAiProcess = `    let isResolvedByAi = false;
    let isHandoffByAi = false;

    if (/\\[RESOLVER\\]/i.test(aiReply) || /\\[resolver\\]/i.test(aiReply)) {
      isResolvedByAi = true;
      aiReply = aiReply.replace(/\\[RESOLVER\\]/gi, '').trim();
    }
    
    if (/\\[HUMANO\\]/i.test(aiReply) || /\\[humano\\]/i.test(aiReply)) {
      isHandoffByAi = true;
      aiReply = aiReply.replace(/\\[HUMANO\\]/gi, '').trim();
    }`;

code = code.replace(oldAiProcess, newAiProcess);

const oldAiSend = `    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        aiReply
      );
    }

    if (isResolvedByAi && account.chatwootAccessToken) {`;

const newAiSend = `    if (isHandoffByAi) {
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

    if (isResolvedByAi && account.chatwootAccessToken) {`;

code = code.replace(oldAiSend, newAiSend);

fs.writeFileSync(path, code, 'utf8');
console.log("AI handoff patched");
