const fs = require('fs');

const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/routes/webhook.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Agregar la estructura de la cola de Promesas arriba, después de los imports
const importsRegex = /import \{ BotEngine \} from '\.\.\/services\/bot\.service';\n/;
const queueCode = `
// --- Cola de Concurrencia en Memoria ---
// Garantiza que los mensajes de la misma conversación se procesen uno tras otro
// para evitar race conditions (muy común si el usuario manda varios mensajes rápidos en WhatsApp).
const conversationQueues = new Map<number, Promise<void>>();

function enqueueConversationTask(conversationId: number, task: () => Promise<void>) {
  const prevPromise = conversationQueues.get(conversationId) || Promise.resolve();
  const nextPromise = prevPromise.then(() => task()).catch(err => {
    console.error(\`[Webhook Queue] Error en conversación \${conversationId}:\`, err);
  });
  
  conversationQueues.set(conversationId, nextPromise);
  
  nextPromise.finally(() => {
    if (conversationQueues.get(conversationId) === nextPromise) {
      conversationQueues.delete(conversationId);
    }
  });
}
`;

code = code.replace(importsRegex, "import { BotEngine } from '../services/bot.service';\n" + queueCode);

// 2. Envolver BotEngine.handleIncomingMessage(payload) dentro del enqueue
const oldCall = `    // Delegar todo el trabajo pesado al motor en segundo plano
    // No usamos 'await' para no bloquear la respuesta HTTP 200 de Chatwoot
    BotEngine.handleIncomingMessage(payload).catch((err) => {
      console.error('[Webhook Error]', err);
    });`;

const newCall = `    // Delegar a la cola secuencial (background) para evitar race conditions
    // No usamos 'await' principal para no bloquear la respuesta HTTP 200 de Chatwoot
    enqueueConversationTask(conversation.id, async () => {
      try {
        await BotEngine.handleIncomingMessage(payload);
      } catch (err) {
        console.error('[Webhook Error en Cola]', err);
      }
    });`;

code = code.replace(oldCall, newCall);

fs.writeFileSync(path, code, 'utf8');
console.log("Queue implementation applied to webhook.ts");
