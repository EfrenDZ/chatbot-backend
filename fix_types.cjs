const fs = require('fs');
const routerPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let code = fs.readFileSync(routerPath, 'utf8');

code = code.replace(
  'const items = arr.slice(0, 10).map((item, index) => {',
  'const items = arr.slice(0, 10).map((item: any, index: number) => {'
);

code = code.replace(
  'title = title.replace(/\\{\\{([^}]+)\\}\\}/g, (m, k) => {',
  'title = title.replace(/\\{\\{([^}]+)\\}\\}/g, (m: string, k: string) => {'
);

fs.writeFileSync(routerPath, code, 'utf8');
