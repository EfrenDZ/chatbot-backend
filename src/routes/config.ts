import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const configRouter = Router();
const prisma = new PrismaClient();

// GET /api/config/:accountId
configRouter.get('/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const account = await prisma.account.findUnique({
      where: { chatwootAccountId: accountId },
      include: { botConfig: true }
    });

    if (!account || !account.botConfig) {
      return res.status(404).json({ error: 'Configuración no encontrada para esta cuenta' });
    }

    res.json(account.botConfig);
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

    const updatedConfig = await prisma.botConfig.update({
      where: { accountId: account.id },
      data: {
        botMode: data.botMode,
        systemPrompt: data.systemPrompt,
        maxConsecutiveErrors: data.maxConsecutiveErrors,
        maxAiMessages: data.maxAiMessages,
        fallbackMessage: data.fallbackMessage,
        handoffMessage: data.handoffMessage,
        // Si más adelante implementamos React Flow, aquí guardaríamos data.flowGraph
      }
    });

    res.json(updatedConfig);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error actualizando configuración' });
  }
});
