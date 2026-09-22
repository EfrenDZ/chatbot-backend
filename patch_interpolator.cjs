const fs = require('fs');
const appPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let code = fs.readFileSync(appPath, 'utf8');

const oldRegex = `finalMessageText = finalMessageText.replace(/\\{\\{([^}]+)\\}\\}/g, (match, key) => {
      const val = metadata[key.trim()];
      return val !== undefined && val !== null ? String(val) : match;
    });`;

const newRegex = `finalMessageText = finalMessageText.replace(/\\{\\{([^}]+)\\}\\}/g, (match, key) => {
      const path = key.trim();
      const val = path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, metadata);
      return val !== undefined && val !== null ? String(val) : match;
    });`;

code = code.replace(oldRegex, newRegex);

fs.writeFileSync(appPath, code, 'utf8');
