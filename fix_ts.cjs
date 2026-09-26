const fs = require('fs');
const appPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let code = fs.readFileSync(appPath, 'utf8');

code = code.replace("err.message", "(err as Error).message");

fs.writeFileSync(appPath, code, 'utf8');
console.log("Fixed TS error.");
