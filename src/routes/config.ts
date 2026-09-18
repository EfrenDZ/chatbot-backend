import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const configRouter = Router();
const prisma = new PrismaClient();


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

// GET /api/config/:accountId
configRouter.get('/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    let account = await prisma.account.findUnique({
      where: { chatwootAccountId: accountId },
      include: { botConfig: true }
    });

    // Si es un cliente nuevo abriendo la app por primera vez, creamos su cuenta y configuración por defecto
    if (!account) {
      account = await prisma.account.create({
        data: {
          chatwootAccountId: accountId,
          chatwootApiUrl: process.env.CHATWOOT_API_URL || 'https://chat.zabotek.com',
          name: `Cliente Chatwoot #${accountId}`,
          botConfig: {
            create: {
              botMode: 'HYBRID',
              aiPromptMode: 'STRUCTURED',
              aiKnowledge: {
                businessName: '',
                businessDescription: '',
                tone: 'Profesional y amable',
                rules: [],
                faqs: [],
                catalog: [],
                branches: []
              },
              systemPrompt: 'Eres un asistente cordial y profesional de atención al cliente.',
              welcomeMessage: '¡Hola! Bienvenido a nuestro canal de atención.',
              farewellMessage: 'Gracias por comunicarte con nosotros. ¡Hasta luego!',
              fallbackMessage: 'No he entendido tu respuesta. Por favor escribe una opción válida o "Menú" para reiniciar.',
              handoffMessage: 'Te estoy transfiriendo con un asesor humano.',
              maxConsecutiveErrors: 2,
              maxAiMessages: 10,
              aiProvider: 'google',
              aiModel: 'gemini-2.5-flash',
              flowGraph: {
                rootNodeId: 'node-root',
                nodes: [
                  {
                    id: 'node-root',
                    type: 'MENU',
                    text: '¡Hola! Bienvenido. Por favor elige una opción:\n1. Información general\n2. Hablar con un asesor',
                    options: [
                      { id: 'opt-1', label: '1. Información general', targetNodeId: 'node-info' },
                      { id: 'opt-2', label: '2. Hablar con un asesor', targetNodeId: 'node-soporte' }
                    ]
                  },
                  {
                    id: 'node-info',
                    type: 'MESSAGE',
                    text: 'Escribe tu consulta y nuestra IA te atenderá con gusto, o escribe "Menú" para reiniciar.'
                  },
                  {
                    id: 'node-soporte',
                    type: 'MESSAGE',
                    text: 'Un momento por favor, te estamos transfiriendo con un agente del equipo.'
                  }
                ]
              }
            }
          }
        },
        include: { botConfig: true }
      });
    }

    res.json({
      ...account.botConfig,
      isActive: account.isActive
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/config/:accountId
configRouter.put('/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const data = req.body;

    const account = await prisma.account.findUnique({ where: { chatwootAccountId: accountId } });
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }

    if (data.isActive !== undefined) {
      await prisma.account.update({
        where: { id: account.id },
        data: { isActive: Boolean(data.isActive) }
      });
    }

    const botConfigUpdateData: any = {
      botMode: data.botMode,
      aiPromptMode: data.aiPromptMode,
      aiKnowledge: data.aiKnowledge,
      systemPrompt: data.systemPrompt,
      maxConsecutiveErrors: data.maxConsecutiveErrors,
      maxAiMessages: data.maxAiMessages,
      welcomeMessage: data.welcomeMessage,
      farewellMessage: data.farewellMessage,
      fallbackMessage: data.fallbackMessage,
      handoffMessage: data.handoffMessage,
    };

    if (data.flowGraph !== undefined) {
      botConfigUpdateData.flowGraph = data.flowGraph;
    }

    const updatedConfig = await prisma.botConfig.update({
      where: { accountId: account.id },
      data: botConfigUpdateData
    });

    res.json({
      ...updatedConfig,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : account.isActive
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error actualizando configuración' });
  }
});
