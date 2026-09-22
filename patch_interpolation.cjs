const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let code = fs.readFileSync(path, 'utf8');

const oldMsg = `const finalMessageText = messages[messages.length - 1];`;
const newMsg = `let finalMessageText = messages[messages.length - 1];
    
    // Interpolación de variables {{variable}} desde sessionMetadata
    const metadata = typeof session?.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session?.sessionMetadata || {});
    finalMessageText = finalMessageText.replace(/\\{\\{([^}]+)\\}\\}/g, (match, key) => {
      const val = metadata[key.trim()];
      return val !== undefined && val !== null ? String(val) : match;
    });`;

if (!code.includes('Interpolación de variables')) {
    code = code.replace(oldMsg, newMsg);
    fs.writeFileSync(path, code, 'utf8');
}
