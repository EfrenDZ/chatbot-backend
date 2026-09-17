import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const configRouter = Router();
const prisma = new PrismaClient();

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
              systemPrompt: 'Eres un asistente cordial y profesional de atención al cliente.',
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
