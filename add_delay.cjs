const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const delayFn = `const delay = (ms: number) => new Promise(res => setTimeout(res, ms));\n\nexport class BotEngine {`;

code = code.replace("export class BotEngine {", delayFn);

// Delay after Welcome Message in timeout
code = code.replace(
  "account.botConfig.welcomeMessage\n        );\n      }\n      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);",
  "account.botConfig.welcomeMessage\n        );\n        await delay(1000);\n      }\n      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);"
);

// Delay after Welcome Message in isNew
code = code.replace(
  "account.botConfig.welcomeMessage\n        );\n      }\n      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);",
  "account.botConfig.welcomeMessage\n        );\n        await delay(1000);\n      }\n      await this.sendCurrentNode(account, account.botConfig, session.id, cwConversation.id);"
);

// Delay in the sendCurrentNode loop
const oldLoop = `        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          messages[i]
        );
      }
    }`;
const newLoop = `        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          messages[i]
        );
        await delay(1000);
      }
    }`;
code = code.replace(oldLoop, newLoop);

fs.writeFileSync(path, code, 'utf8');
console.log("Delay added");
