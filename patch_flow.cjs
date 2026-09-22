const fs = require('fs');
const routerPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let code = fs.readFileSync(routerPath, 'utf8');

const oldFetch = `        // Ejecutar petición HTTP
        const customHeaders = node.headers || {};
        const response = await fetch(node.url, {
          method: node.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...customHeaders },
          body: JSON.stringify(metadata)
        });`;

const newFetch = `        // Configuración Global API
        const globalHeaders = typeof config.apiHeaders === 'string' ? JSON.parse(config.apiHeaders) : (config.apiHeaders || {});
        const customHeaders = { ...globalHeaders, ...(node.headers || {}) };
        
        let finalUrl = node.url;
        if (node.url && node.url.startsWith('/') && config.apiBaseUrl) {
          // Limpiar slash final del baseUrl si existe
          const base = config.apiBaseUrl.endsWith('/') ? config.apiBaseUrl.slice(0, -1) : config.apiBaseUrl;
          finalUrl = base + node.url;
        }

        // Ejecutar petición HTTP
        const response = await fetch(finalUrl, {
          method: node.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...customHeaders },
          body: JSON.stringify(metadata)
        });`;

code = code.replace(oldFetch, newFetch);
fs.writeFileSync(routerPath, code, 'utf8');
