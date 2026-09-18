const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const replacement = `  static async handleIncomingMessage(payload: any): Promise<void> {
    const { account: cwAccount, conversation: cwConversation, sender, content } = payload;
    const userMessage = (content || '').trim().toLowerCase();

    // 1. Validar que la cuenta exista en nuestro SaaS
    const account = await prisma.account.findUnique({
      where: { chatwootAccountId: cwAccount.id },
      include: { botConfig: true },
    });

    if (!account || !account.isActive || !account.botConfig) {
      console.log(\`[BotEngine] Cuenta \${cwAccount.id} inactiva o sin configuración.\`);
      return;
    }

    // 2. Obtener o crear la sesión de esta conversación
    const [session, isNew] = await this.getOrCreateSession(account.id, cwConversation.id, sender.phone_number || sender.email);

    // Si un humano ya tomó el control, el bot hace silencio absoluto.
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
    }`;

code = code.replace(
  /  static async handleIncomingMessage\(payload: any\): Promise<void> {[\s\S]*?if \(session.status !== 'BOT_HANDLING'\) {\n      return;\n    }/,
  replacement
);

fs.writeFileSync(path, code, 'utf8');
console.log("Patched media fallback");
