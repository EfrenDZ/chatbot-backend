import { ConversationSession, BotConfig } from '@prisma/client';
import { prisma } from './types';

export class SessionManager {
  static async getOrCreateSession(accountId: string, cwConvId: number, identifier: string): Promise<[ConversationSession, boolean]> {
    let session = await prisma.conversationSession.findUnique({
      where: { unique_account_conversation: { accountId, chatwootConversationId: cwConvId } }
    });

    if (!session) {
      session = await prisma.conversationSession.create({
        data: {
          accountId,
          chatwootConversationId: cwConvId,
          contactIdentifier: identifier,
        }
      });
      return [session, true];
    }
    return [session, false];
  }

  static async resetSession(sessionId: string, config: BotConfig) {
    const flowGraph = config.flowGraph as any;
    await prisma.conversationSession.update({
      where: { id: sessionId },
      data: {
        currentNodeId: flowGraph.rootNodeId,
        consecutiveErrors: 0,
        status: 'BOT_HANDLING',
        aiMessagesCount: 0,
      },
    });
  }
}
