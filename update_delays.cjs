const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/await delay\(1000\);/g, "await delay(2500);");

fs.writeFileSync(path, code, 'utf8');
console.log("Delays updated to 2500ms");
