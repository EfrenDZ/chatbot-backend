const fs = require('fs');
const appPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let code = fs.readFileSync(appPath, 'utf8');

code = code.replace(
  "const val = path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, metadata);",
  "const val = path.split('.').reduce((acc: any, part: string) => acc && acc[part] !== undefined ? acc[part] : undefined, metadata);"
);

fs.writeFileSync(appPath, code, 'utf8');
