import { ChatwootService } from '../chatwoot.service';
import { prisma, delay } from './types';
import { SessionManager } from './session.manager';
import { FlowRouter } from './flow.router';
import { AiOrchestrator } from './ai.orchestrator';

export class BotEngine {
  static async handleIncomingMessage(payload: any): Promise<void> {
    const { account: cwAccount, conversation: cwConversation, sender, content } = payload;
    const userMessage = (content || '').trim().toLowerCase();

    const account = await prisma.account.findUnique({
      where: { chatwootAccountId: cwAccount.id },
      include: { botConfig: true },
    });

    if (!account || !account.isActive || !account.botConfig) {
      console.log(`[BotEngine] Cuenta ${cwAccount.id} inactiva o sin configuración.`);
      return;
    }

    const [session, isNew] = await SessionManager.getOrCreateSession(account.id, cwConversation.id, sender.phone_number || sender.email);

    const hoursInactive = (Date.now() - session.updatedAt.getTime()) / (1000 * 60 * 60);
    const timeoutHours = account.botConfig.sessionTimeoutHours || 24;
    
    if (hoursInactive > timeoutHours) {
      console.log(`[BotEngine] Sesión ${session.id} expirada (>${timeoutHours}h). Reiniciando.`);
      await SessionManager.resetSession(session.id, account.botConfig);
      session.currentNodeId = (account.botConfig.flowGraph as any).rootNodeId;
      session.status = 'BOT_HANDLING';
      
      if (account.botConfig.welcomeMessage && account.chatwootAccessToken) {
        await ChatwootService.sendMessage(account.chatwootApiUrl, account.chatwootAccessToken, account.chatwootAccountId, cwConversation.id, account.botConfig.welcomeMessage);
        await delay(2500);
      }
      await FlowRouter.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }

    if (session.status === 'RESOLVED') {
      console.log(`[BotEngine] Mensaje en sesión resuelta. Reactivando bot.`);
      await SessionManager.resetSession(session.id, account.botConfig);
      await prisma.conversationSession.update({ where: { id: session.id }, data: { status: 'BOT_HANDLING' } });
      
      if (account.botConfig.welcomeMessage && account.chatwootAccessToken) {
        await ChatwootService.sendMessage(account.chatwootApiUrl, account.chatwootAccessToken, account.chatwootAccountId, cwConversation.id, account.botConfig.welcomeMessage);
        await delay(2500);
      }
      await FlowRouter.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }

    if (session.status !== 'BOT_HANDLING') return;

    if (payload.attachments && payload.attachments.length > 0) {
      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(account.chatwootApiUrl, account.chatwootAccessToken, account.chatwootAccountId, cwConversation.id, "Soy un asistente virtual y por el momento solo puedo procesar texto. Por favor, escríbeme tu consulta.");
      }
      return;
    }

    if (isNew) {
      if (account.botConfig.welcomeMessage && account.chatwootAccessToken) {
        await ChatwootService.sendMessage(account.chatwootApiUrl, account.chatwootAccessToken, account.chatwootAccountId, cwConversation.id, account.botConfig.welcomeMessage);
        await delay(2500);
      }
      await FlowRouter.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }

    if (account.botConfig.resetKeywords.includes(userMessage)) {
      await SessionManager.resetSession(session.id, account.botConfig);
      await FlowRouter.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);
      return;
    }
    
    if (account.botConfig.handoffKeywords.includes(userMessage)) {
      await FlowRouter.executeHandoff(account, session, cwConversation.id);
      return;
    }

    if (account.botConfig.botMode === 'AI') {
      await AiOrchestrator.processAiMessage(account, session, cwConversation.id, content);
    } else if (account.botConfig.botMode === 'OPTIONS') {
      await FlowRouter.processMenuOption(account, session, cwConversation.id, userMessage);
    } else {
      const wasValidOption = await FlowRouter.tryProcessMenuOption(account, session, cwConversation.id, userMessage);
      if (!wasValidOption) {
        if (session.consecutiveErrors >= account.botConfig.maxConsecutiveErrors) {
          await prisma.conversationSession.update({ where: { id: session.id }, data: { consecutiveErrors: 0 } });
          await AiOrchestrator.processAiMessage(account, session, cwConversation.id, content);
        } else {
          await FlowRouter.processMenuError(account, session, cwConversation.id);
        }
      }
    }
  }

  static async handleConversationResolved(payload: any): Promise<void> {
    const { account: cwAccount, conversation: cwConversation } = payload;
    const account = await prisma.account.findUnique({ where: { chatwootAccountId: cwAccount.id } });
    if (!account) return;

    await prisma.conversationSession.updateMany({
      where: { accountId: account.id, chatwootConversationId: cwConversation.id },
      data: { status: 'RESOLVED', currentNodeId: null, consecutiveErrors: 0, aiMessagesCount: 0 },
    });
  }
}
