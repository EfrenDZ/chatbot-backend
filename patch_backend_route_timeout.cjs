const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/routes/config.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "fallbackMessage: 'No he entendido tu respuesta. Por favor escribe una opción válida o \"Menú\" para reiniciar.',",
  "fallbackMessage: 'No he entendido tu respuesta. Por favor escribe una opción válida o \"Menú\" para reiniciar.',\n              sessionTimeoutHours: 24,"
);

code = code.replace(
  "maxConsecutiveErrors: data.maxConsecutiveErrors,",
  "maxConsecutiveErrors: data.maxConsecutiveErrors,\n      sessionTimeoutHours: data.sessionTimeoutHours,"
);

fs.writeFileSync(path, code, 'utf8');
console.log("Config route patched");
