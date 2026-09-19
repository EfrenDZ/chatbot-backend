const fs = require('fs');

const flowPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let flowCode = fs.readFileSync(flowPath, 'utf8');

// Remove the inputLogic that was appended at the end
const badInputLogic = `
  static async tryProcessInputNode(account: Account, session: ConversationSession, cwConvId: number, userMessage: string, node: any): Promise<boolean> {
    if (node.type !== 'INPUT') return false;
    
    const varName = node.variableName || 'input';
    let metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session.sessionMetadata || {});
    
    // Guardar la variable
    metadata[varName] = userMessage.trim();

    await prisma.conversationSession.update({
      where: { id: session.id },
      data: {
        currentNodeId: node.targetNodeId,
        consecutiveErrors: 0,
        sessionMetadata: metadata
      },
    });

    await this.sendCurrentNode(account, account.botConfig!, session.id, cwConvId);
    return true;
  }
`;

flowCode = flowCode.replace(badInputLogic, '');

// Inject it right before the last closing brace
const lastBraceIndex = flowCode.lastIndexOf('}');
flowCode = flowCode.slice(0, lastBraceIndex) + badInputLogic + '\n' + '}';

fs.writeFileSync(flowPath, flowCode, 'utf8');
