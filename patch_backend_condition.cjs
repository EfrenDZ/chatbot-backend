const fs = require('fs');
const appPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let code = fs.readFileSync(appPath, 'utf8');

const webhookRegex = /if \(node\.type === 'WEBHOOK'\) \{\s*try \{/;

const conditionLogic = `
    if (node.type === 'CONDITION') {
      try {
        const metadata = typeof session!.sessionMetadata === 'string' ? JSON.parse(session!.sessionMetadata) : (session!.sessionMetadata || {});
        
        // Helper para extraer variables anidadas (ej. "cliente.direccion")
        const getValue = (obj: any, path: string) => {
          if (!path) return undefined;
          return path.split('.').reduce((acc, part) => acc && acc[part], obj);
        };

        const val = getValue(metadata, node.conditionVariable || '');
        let isTrue = false;

        if (node.conditionOperator === 'equals') {
          isTrue = String(val) === String(node.conditionValue || '');
        } else {
          // Default: 'exists'
          isTrue = val !== undefined && val !== null && val !== '';
        }

        const nextNodeId = isTrue ? node.successNodeId : node.errorNodeId;

        await prisma.conversationSession.update({
          where: { id: sessionId },
          data: { currentNodeId: nextNodeId, consecutiveErrors: 0 }
        });

        const newSession = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
        if (newSession) {
          await this.sendCurrentNode(account, config, newSession.id, cwConvId);
        }
      } catch (err) {
        console.error('[FlowRouter] Condition evaluation error:', err);
      }
      return;
    }

    if (node.type === 'WEBHOOK') {
      try {`;

code = code.replace(webhookRegex, conditionLogic);

fs.writeFileSync(appPath, code, 'utf8');
