const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/services/bot/flow.router.ts');
let code = fs.readFileSync(file, 'utf8');

const hookLogic = `
    if (selectedOption) {
      // CLEAR CART INTERCEPTOR
      if (selectedOption.id === 'opt-review-edit-cart' || selectedOption.id === 'opt-review-clear-cart') {
         let metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session.sessionMetadata || {});
         metadata.carrito = [];
         metadata.resumen_carrito = '';
         await prisma.conversationSession.update({
           where: { id: session.id },
           data: { 
             currentNodeId: selectedOption.targetNodeId, 
             consecutiveErrors: 0,
             sessionMetadata: metadata
           },
         });
         await this.sendCurrentNode(account, config, session.id, cwConvId);
         return true;
      }
`;

code = code.split('if (selectedOption) {').join(hookLogic);
fs.writeFileSync(file, code);
console.log("Clear cart logic injected.");
