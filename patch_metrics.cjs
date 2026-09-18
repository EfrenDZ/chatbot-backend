const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/routes/config.ts';
let code = fs.readFileSync(path, 'utf8');

const metricsEndpoint = `
// GET /api/config/:accountId/metrics
configRouter.get('/:accountId/metrics', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const account = await prisma.account.findUnique({
      where: { chatwootAccountId: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Métricas
    const totalSessions = await prisma.conversationSession.count({
      where: { accountId: account.id, updatedAt: { gte: thirtyDaysAgo } }
    });

    const resolvedSessions = await prisma.conversationSession.count({
      where: { accountId: account.id, status: 'RESOLVED', updatedAt: { gte: thirtyDaysAgo } }
    });

    const handedOffSessions = await prisma.conversationSession.count({
      where: { accountId: account.id, status: 'HANDED_OFF_TO_HUMAN', updatedAt: { gte: thirtyDaysAgo } }
    });

    // Suma de mensajes de IA
    const aiAgg = await prisma.conversationSession.aggregate({
      where: { accountId: account.id, updatedAt: { gte: thirtyDaysAgo } },
      _sum: { aiMessagesCount: true }
    });

    const aiMessagesConsumed = aiAgg._sum.aiMessagesCount || 0;

    res.json({
      period: 'last_30_days',
      totalSessions,
      resolvedSessions,
      handedOffSessions,
      aiMessagesConsumed
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo métricas' });
  }
});
`;

// Insert the endpoint BEFORE GET /:accountId
code = code.replace(
  "// GET /api/config/:accountId",
  metricsEndpoint + "\n// GET /api/config/:accountId"
);

fs.writeFileSync(path, code, 'utf8');
console.log("Metrics route added");
