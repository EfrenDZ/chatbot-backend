import { Router, Request, Response } from 'express';
import { BotEngine } from '../services/bot.service';

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

    // Delegar todo el trabajo pesado al motor en segundo plano
    // No usamos 'await' para no bloquear la respuesta HTTP 200 de Chatwoot
    BotEngine.handleIncomingMessage(payload).catch((err) => {
      console.error('[Webhook Error]', err);
    });
    
  } catch (error) {
    console.error('Error procesando webhook asíncrono:', error);
  }
});
