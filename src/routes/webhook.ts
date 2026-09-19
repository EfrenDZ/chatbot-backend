import { Router, Request, Response } from 'express';
import { BotEngine } from '../services/bot.service';

// --- Cola de Concurrencia en Memoria ---
// Garantiza que los mensajes de la misma conversación se procesen uno tras otro
// para evitar race conditions (muy común si el usuario manda varios mensajes rápidos en WhatsApp).
const conversationQueues = new Map<number, Promise<void>>();

function enqueueConversationTask(conversationId: number, task: () => Promise<void>) {
  const prevPromise = conversationQueues.get(conversationId) || Promise.resolve();
  const nextPromise = prevPromise.then(() => task()).catch(err => {
    console.error(`[Webhook Queue] Error en conversación ${conversationId}:`, err);
  });
  
  conversationQueues.set(conversationId, nextPromise);
  
  nextPromise.finally(() => {
    if (conversationQueues.get(conversationId) === nextPromise) {
      conversationQueues.delete(conversationId);
    }
  });
}

export const webhookRouter = Router();

// Chatwoot Webhook Endpoint
webhookRouter.post('/chatwoot', async (req: Request, res: Response) => {
  // Chatwoot requires a fast 200 OK response to prevent retries/timeouts
  res.status(200).json({ status: 'received' });

  try {
    const payload = req.body;
    
    if (payload.event === 'conversation_status_changed') {
      if (payload.status === 'resolved') {
        BotEngine.handleConversationResolved(payload).catch((err) => {
          console.error('[Webhook Error - Resolved]', err);
        });
      }
      return;
    }

    // Solo procesar si es un mensaje creado
    if (payload.event !== 'message_created') return;
    
    // Ignorar los mensajes salientes (enviados por nuestro bot o un agente humano)
    // para evitar el temido bucle infinito de webhooks
    if (payload.message_type !== 'incoming') return;
    
    const { account, conversation, sender, content } = payload;
    
    console.log(`[Webhook] Mensaje entrante - Cuenta: ${account.id}, Conversación: ${conversation.id}`);
    console.log(`[Mensaje] ${sender.name}: ${content}`);

    // Delegar a la cola secuencial (background) para evitar race conditions
    // No usamos 'await' principal para no bloquear la respuesta HTTP 200 de Chatwoot
    enqueueConversationTask(conversation.id, async () => {
      try {
        await BotEngine.handleIncomingMessage(payload);
      } catch (err) {
        console.error('[Webhook Error en Cola]', err);
      }
    });
    
  } catch (error) {
    console.error('Error procesando webhook asíncrono:', error);
  }
});
