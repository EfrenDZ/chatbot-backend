const fs = require('fs');

const botPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let botCode = fs.readFileSync(botPath, 'utf8');

const oldInteractive = `        if (account.chatwootAccessToken) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText,
            {
              contentType: 'input_select',
              contentAttributes: { items },
            }
          );
        }
        return;`;

const newInteractive = `        if (account.chatwootAccessToken) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText,
            {
              contentType: 'input_select',
              contentAttributes: { items },
            }
          );
          // Retraso crucial: damos tiempo a WhatsApp de procesar el mensaje interactivo
          // antes de que la cola (queue) libere el siguiente mensaje.
          await delay(2500);
        }
        return;`;

botCode = botCode.replace(oldInteractive, newInteractive);


const oldPlainEnd = `    // Si es un mensaje de texto plano normal
    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        finalMessageText
      );
    }
  }`;

const newPlainEnd = `    // Si es un mensaje de texto plano normal
    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        finalMessageText
      );
      // Retraso final para evitar colisiones con el siguiente mensaje de la cola
      await delay(2000);
    }
  }`;

botCode = botCode.replace(oldPlainEnd, newPlainEnd);

// También agregar delay en processMenuError
const oldMenuError = `      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        config.fallbackMessage
      );
      await this.sendCurrentNode(account, config, session.id, cwConvId);`;

const newMenuError = `      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        config.fallbackMessage
      );
      await delay(2000); // Dar espacio antes de reenviar el menú
      await this.sendCurrentNode(account, config, session.id, cwConvId);`;

botCode = botCode.replace(oldMenuError, newMenuError);


fs.writeFileSync(botPath, botCode, 'utf8');
console.log("Delays applied");
