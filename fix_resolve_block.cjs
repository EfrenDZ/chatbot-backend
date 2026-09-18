const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const missingLogic = `

    if (isResolvedByAi && account.chatwootAccessToken) {
      console.log(\`[BotEngine] La IA decidió auto-resolver la sesión \${session.id}\`);
      await ChatwootService.resolveConversation(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId
      );
    }
  }
}
`;

code = code.replace("        aiReply\n      );\n    }\n  }\n}", "        aiReply\n      );\n    }" + missingLogic);

fs.writeFileSync(path, code, 'utf8');
console.log("Resolve logic successfully appended");
