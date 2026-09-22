const fs = require('fs');

const flowPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let flowCode = fs.readFileSync(flowPath, 'utf8');

const webhookOld = `
        if (response.ok) {
          await prisma.conversationSession.update({
            where: { id: sessionId },
            data: { currentNodeId: node.successNodeId, consecutiveErrors: 0 }
          });
        } else {
          await prisma.conversationSession.update({
            where: { id: sessionId },
            data: { currentNodeId: node.errorNodeId, consecutiveErrors: 0 }
          });
        }`;

const webhookNew = `
        let responseData = {};
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            responseData = await response.json();
          } catch(e) {}
        }
        
        const updatedMetadata = { ...metadata, ...responseData };

        if (response.ok) {
          await prisma.conversationSession.update({
            where: { id: sessionId },
            data: { 
              currentNodeId: node.successNodeId, 
              consecutiveErrors: 0,
              sessionMetadata: updatedMetadata 
            }
          });
        } else {
          await prisma.conversationSession.update({
            where: { id: sessionId },
            data: { 
              currentNodeId: node.errorNodeId, 
              consecutiveErrors: 0,
              sessionMetadata: updatedMetadata 
            }
          });
        }`;

flowCode = flowCode.replace(webhookOld, webhookNew);
fs.writeFileSync(flowPath, flowCode, 'utf8');
console.log("Webhook memory patched");
