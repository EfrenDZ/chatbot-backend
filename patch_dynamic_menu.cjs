const fs = require('fs');
const routerPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/flow.router.ts';
let code = fs.readFileSync(routerPath, 'utf8');

// 1. Agregar lógica de envío para DYNAMIC_MENU
const oldSendInput = `if (node.type === 'INPUT') {
      // Los nodos de INPUT simplemente mandan su mensaje y esperan a que el usuario escriba
      // No tienen opciones
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
      return;
    }`;

const newSendInput = `if (node.type === 'INPUT') {
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
      return;
    }

    if (node.type === 'DYNAMIC_MENU') {
      const arr = metadata[node.arrayVariable || ''] || [];
      const items = arr.slice(0, 10).map((item, index) => {
        let title = node.titleTemplate || '{{nombre}}';
        title = title.replace(/\\{\\{([^}]+)\\}\\}/g, (m, k) => {
          const val = item[k.trim()];
          return val !== undefined && val !== null ? String(val) : m;
        });
        const valKey = node.valueKey || 'id';
        const value = item[valKey] !== undefined ? String(item[valKey]) : String(index);
        return { title: title.substring(0, 23), value };
      });

      if (account.chatwootAccessToken) {
        if (items.length > 0) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText,
            { contentType: 'input_select', contentAttributes: { items } }
          );
        } else {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText + '\\n(No hay opciones disponibles)'
          );
        }
        await delay(2500);
      }
      return;
    }`;

code = code.replace(oldSendInput, newSendInput);

// 2. Agregar lógica de procesamiento de respuesta
const oldTryProcess = `static async tryProcessInputNode(account: Account, session: ConversationSession, cwConvId: number, userMessage: string, node: any): Promise<boolean> {
    if (node.type !== 'INPUT') return false;`;

const newTryProcess = `static async tryProcessInputNode(account: Account, session: ConversationSession, cwConvId: number, userMessage: string, node: any): Promise<boolean> {
    if (node.type !== 'INPUT' && node.type !== 'DYNAMIC_MENU') return false;`;

code = code.replace(oldTryProcess, newTryProcess);
fs.writeFileSync(routerPath, code, 'utf8');
