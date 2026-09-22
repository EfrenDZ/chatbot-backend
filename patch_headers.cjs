const fs = require('fs');
const flowPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let flowCode = fs.readFileSync(flowPath, 'utf8');

const oldFetch = `        // Ejecutar petición HTTP
        const response = await fetch(node.url, {
          method: node.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata)
        });`;

const newFetch = `        // Ejecutar petición HTTP
        const customHeaders = node.headers || {};
        const response = await fetch(node.url, {
          method: node.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...customHeaders },
          body: JSON.stringify(metadata)
        });`;

flowCode = flowCode.replace(oldFetch, newFetch);
fs.writeFileSync(flowPath, flowCode, 'utf8');
