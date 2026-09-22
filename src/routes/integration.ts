import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ChatwootService } from '../services/chatwoot.service';

const router = Router();
const prisma = new PrismaClient();

// Middleware de seguridad
router.use((req: Request, res: Response, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.INTEGRATION_API_KEY;
  
  if (!validKey) {
    console.warn('[Integration] INTEGRATION_API_KEY no configurado en el servidor.');
  }

  if (validKey && apiKey !== validKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Helper para encontrar la sesión activa buscando por los últimos 10 dígitos del teléfono
async function findSessionByPhone(accountId: string, phone: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const last10 = cleanPhone.slice(-10);

  // Buscar la sesión más reciente en esa cuenta cuyo identifier termine en esos 10 dígitos
  const sessions = await prisma.conversationSession.findMany({
    where: {
      accountId,
      contactIdentifier: {
        endsWith: last10
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: 1
  });

  return sessions[0] || null;
}

// 1. Endpoint de Alertas (Notificaciones Salientes)
router.post('/tenant-alerts', async (req: Request, res: Response): Promise<any> => {
  try {
    const { accountId, phone, message } = req.body;
    if (!accountId || !phone || !message) {
      return res.status(400).json({ error: 'Faltan parámetros: accountId, phone, message' });
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || !account.chatwootAccessToken) {
      return res.status(404).json({ error: 'Cuenta no encontrada o sin acceso a Chatwoot' });
    }

    const session = await findSessionByPhone(accountId, phone);
    if (!session) {
      return res.status(404).json({ error: 'No se encontró una sesión activa para este teléfono' });
    }

    await ChatwootService.sendMessage(
      account.chatwootApiUrl,
      account.chatwootAccessToken,
      account.chatwootAccountId,
      session.chatwootConversationId,
      message
    );

    return res.json({ success: true, message: 'Alerta enviada' });
  } catch (error) {
    console.error('[Integration] Error enviando alerta:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 2. Endpoint del Webview Callback
router.post('/webview-callback', async (req: Request, res: Response): Promise<any> => {
  try {
    const { accountId, phone, orderData } = req.body;
    if (!accountId || !phone) {
      return res.status(400).json({ error: 'Faltan parámetros: accountId, phone' });
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || !account.chatwootAccessToken) {
      return res.status(404).json({ error: 'Cuenta no encontrada o sin acceso a Chatwoot' });
    }

    const session = await findSessionByPhone(accountId, phone);
    if (!session) {
      return res.status(404).json({ error: 'No se encontró sesión para inyectar orden' });
    }

    // Opcional: Mandar mensaje de confirmación automático (si no lo manda AguaCero)
    const confirmMessage = "¡Recibido! Tu pedido va en camino.";
    await ChatwootService.sendMessage(
      account.chatwootApiUrl,
      account.chatwootAccessToken,
      account.chatwootAccountId,
      session.chatwootConversationId,
      confirmMessage
    );

    // Inyectar el orderData a AguaCero (Ejemplo de delegación, o si el webview ya lo hizo, esto solo era para el mensaje)
    // En la propuesta el bot le contesta "Recibido" y luego le inyecta la orden a AguaCero.
    if (orderData && process.env.AGUACERO_API_URL) {
      await fetch(`${process.env.AGUACERO_API_URL}/api/webhooks/bot/pedidos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.AGUACERO_API_KEY || ''
        },
        body: JSON.stringify({ phone, orderData })
      }).catch(err => console.error('[Integration] Error inyectando a AguaCero:', err));
    }

    // Marcar sesión como resuelta para que inicie limpio la próxima vez
    await ChatwootService.resolveConversation(
      account.chatwootApiUrl,
      account.chatwootAccessToken,
      account.chatwootAccountId,
      session.chatwootConversationId
    );
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { status: 'RESOLVED' }
    });

    return res.json({ success: true, message: 'Pedido procesado por el bot' });
  } catch (error) {
    console.error('[Integration] Error en webview callback:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
