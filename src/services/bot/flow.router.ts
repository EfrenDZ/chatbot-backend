import { ConversationSession, BotConfig } from '@prisma/client';
import { Account, prisma, delay } from './types';
import { ChatwootService } from '../chatwoot.service';
import { SessionManager } from './session.manager';

export class FlowRouter {
  static async sendCurrentNode(account: Account, config: BotConfig, sessionId: string, cwConvId: number) {
    const flowGraph = config.flowGraph as any;
    
    const session = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
    const nodeId = session?.currentNodeId || flowGraph.rootNodeId;
    
    const node = flowGraph.nodes.find((n: any) => n.id === nodeId);
    if (!node) return;

    const messages: string[] = (node.messages && Array.isArray(node.messages) && node.messages.length > 0)
      ? node.messages
      : [node.text];

    for (let i = 0; i < messages.length - 1; i++) {
      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          messages[i]
        );
        await delay(2500);
      }
    }

    const finalMessageText = messages[messages.length - 1];

    if (node.type === 'RESTART') {
      await SessionManager.resetSession(sessionId, config);
      const newSession = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
      if (newSession) {
        await this.sendCurrentNode(account, config, newSession.id, cwConvId);
      }
      return;
    }

    if (node.type === 'RESOLVE') {
      if (account.chatwootAccessToken) {
        await ChatwootService.resolveConversation(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId
        );
      }
      await prisma.conversationSession.update({ where: { id: sessionId }, data: { status: 'RESOLVED' } });
      return;
    }

    if (node.type === 'HANDOFF') {
      await this.executeHandoff(account, session!, cwConvId, finalMessageText);
      return;
    }

    if (node.type === 'MENU' && node.options && node.options.length > 0) {
      if (node.options.length <= 10) {
        const maxTitleLen = node.options.length <= 3 ? 20 : 24;
        const items = node.options.map((opt: any, index: number) => {
          let title = opt.label.trim();
          if (title.length > maxTitleLen) title = title.substring(0, maxTitleLen);
          return { title, value: (index + 1).toString() };
        });

        if (account.chatwootAccessToken) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText,
            { contentType: 'input_select', contentAttributes: { items } }
          );
          await delay(2500);
        }
        return;
      }
      
      let textMenu = finalMessageText + '\n\n';
      node.options.forEach((opt: any, index: number) => {
        textMenu += `${index + 1}. ${opt.label}\n`;
      });

      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          textMenu
        );
        await delay(2000);
      }
      return;
    }

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        finalMessageText
      );
      await delay(2000);
    }
  }

  static async executeHandoff(account: Account, session: ConversationSession, cwConvId: number, customMessage?: string) {
    const msg = customMessage || account.botConfig!.handoffMessage;
    
    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        msg
      );
      await ChatwootService.handoffToHuman(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId
      );
    }

    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { status: 'HANDED_OFF_TO_HUMAN' },
    });
  }

  static async processMenuOption(account: Account, session: ConversationSession, cwConvId: number, userMessage: string) {
    const wasValid = await this.tryProcessMenuOption(account, session, cwConvId, userMessage);
    if (!wasValid) {
      await this.processMenuError(account, session, cwConvId);
    }
  }

  static async tryProcessMenuOption(account: Account, session: ConversationSession, cwConvId: number, userMessage: string): Promise<boolean> {
    const config = account.botConfig!;
    const flowGraph = config.flowGraph as any;
    const nodeId = session.currentNodeId || flowGraph.rootNodeId;
    const node = flowGraph.nodes.find((n: any) => n.id === nodeId);

    if (!node || node.type !== 'MENU' || !node.options) return false;

    const cleanUserMsg = userMessage.toLowerCase().trim();
    const cleanUserMsgNoNum = cleanUserMsg.replace(/^[0-9]+[\.\-\)\s]*/, '').trim();

    const selectedOption = node.options.find((opt: any, index: number) => {
      const optNumber = (index + 1).toString();
      if (cleanUserMsg === optNumber) return true;
      const cleanLabel = opt.label.toLowerCase().trim();
      if (cleanUserMsg === cleanLabel) return true;
      if (cleanUserMsgNoNum === cleanLabel) return true;
      const isPartial = cleanLabel.includes(cleanUserMsg) || cleanUserMsg.includes(cleanLabel);
      return isPartial;
    });

    if (selectedOption) {
      await prisma.conversationSession.update({
        where: { id: session.id },
        data: { currentNodeId: selectedOption.targetNodeId, consecutiveErrors: 0 },
      });
      await this.sendCurrentNode(account, config, session.id, cwConvId);
      return true;
    }
    return false;
  }

  static async processMenuError(account: Account, session: ConversationSession, cwConvId: number) {
    const config = account.botConfig!;
    const newErrors = session.consecutiveErrors + 1;
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { consecutiveErrors: newErrors },
    });

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        config.fallbackMessage
      );
      await delay(2000);
      await this.sendCurrentNode(account, config, session.id, cwConvId);
    }
  }
}
