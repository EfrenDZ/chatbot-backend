const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const timeoutCheck = `
    // Si la sesión expiró por inactividad, reiniciarla pasivamente
    const hoursInactive = (Date.now() - session.updatedAt.getTime()) / (1000 * 60 * 60);
    const timeoutHours = account.botConfig.sessionTimeoutHours || 24;
    
    if (hoursInactive > timeoutHours) {
      console.log(\`[BotEngine] Sesión \${session.id} expirada (>\${timeoutHours}h). Reiniciando.\`);
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
      }
      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }

    // Si un humano ya tomó el control (y no expiró), el bot hace silencio absoluto.
`;

code = code.replace(
  "    // Si un humano ya tomó el control, el bot hace silencio absoluto.",
  timeoutCheck
);

// We must also handle if session is RESOLVED but they send a new message.
// If it's RESOLVED, it means Chatwoot auto-resolved or agent resolved. We should let the bot take over again!
const handleResolved = `
    if (session.status === 'RESOLVED') {
      console.log(\`[BotEngine] Mensaje en sesión resuelta. Reactivando bot.\`);
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
      }
      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }

    if (session.status !== 'BOT_HANDLING') {
`;
code = code.replace(
  "    if (session.status !== 'BOT_HANDLING') {",
  handleResolved
);

fs.writeFileSync(path, code, 'utf8');
console.log("Timeout implemented");
