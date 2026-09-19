const fs = require('fs');
const path = require('path');

const srcDir = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services';
const botPath = path.join(srcDir, 'bot.service.ts');

const botCode = fs.readFileSync(botPath, 'utf8');

const imports = `import { PrismaClient, ConversationSession, BotConfig, Account as PrismaAccount } from '@prisma/client';
import { ChatwootService } from './chatwoot.service';
import { AiService } from './ai.service';

const prisma = new PrismaClient();
export type Account = PrismaAccount & { botConfig?: BotConfig | null };
export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
`;

// Very basic extraction, just moving the logic into smaller classes.
// To avoid circular dependencies, we'll keep them in bot.service.ts but separated by class,
// OR we can create separate files. Let's create separate files!

const sessionManagerCode = `import { PrismaClient, ConversationSession, BotConfig } from '@prisma/client';
import { Account } from './bot.service'; // We will put types in bot.service or a types file.
const prisma = new PrismaClient();

export class SessionManager {
  static async getOrCreateSession(accountId: string, cwConvId: number, identifier: string): Promise<[ConversationSession, boolean]> {
    let session = await prisma.conversationSession.findUnique({
      where: { unique_account_conversation: { accountId, chatwootConversationId: cwConvId } }
    });
    if (!session) {
      session = await prisma.conversationSession.create({
        data: { accountId, chatwootConversationId: cwConvId, contactIdentifier: identifier }
      });
      return [session, true];
    }
    return [session, false];
  }

  static async resetSession(sessionId: string, config: BotConfig) {
    const flowGraph = config.flowGraph as any;
    await prisma.conversationSession.update({
      where: { id: sessionId },
      data: { currentNodeId: flowGraph.rootNodeId, consecutiveErrors: 0, status: 'BOT_HANDLING', aiMessagesCount: 0 }
    });
  }
}
`;

fs.writeFileSync(path.join(srcDir, 'session.manager.ts'), sessionManagerCode);

// Due to complex circular logic, we will do the refactor cleanly using TypeScript compiler's help, 
// but wait, I can just create a `bot.service.ts` that includes all of them as separate classes inside the same file for now to prove the SRP decoupling, or actually split them.
// Actually, creating a bot/ directory is the best.
