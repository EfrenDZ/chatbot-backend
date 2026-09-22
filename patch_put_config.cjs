const fs = require('fs');
const routerPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/routes/config.ts';
let code = fs.readFileSync(routerPath, 'utf8');

const oldUpdateData = `    const botConfigUpdateData: any = {
      botMode: data.botMode,
      aiPromptMode: data.aiPromptMode,
      aiKnowledge: data.aiKnowledge,
      systemPrompt: data.systemPrompt,
      maxConsecutiveErrors: data.maxConsecutiveErrors,
      sessionTimeoutHours: data.sessionTimeoutHours,
      maxAiMessages: data.maxAiMessages,
      welcomeMessage: data.welcomeMessage,
      farewellMessage: data.farewellMessage,
      fallbackMessage: data.fallbackMessage,
      handoffMessage: data.handoffMessage,
    };`;

const newUpdateData = `    const botConfigUpdateData: any = {
      botMode: data.botMode,
      aiPromptMode: data.aiPromptMode,
      aiKnowledge: data.aiKnowledge,
      systemPrompt: data.systemPrompt,
      maxConsecutiveErrors: data.maxConsecutiveErrors,
      sessionTimeoutHours: data.sessionTimeoutHours,
      maxAiMessages: data.maxAiMessages,
      welcomeMessage: data.welcomeMessage,
      farewellMessage: data.farewellMessage,
      fallbackMessage: data.fallbackMessage,
      handoffMessage: data.handoffMessage,
      apiBaseUrl: data.apiBaseUrl,
      apiHeaders: data.apiHeaders,
      aiTools: data.aiTools,
    };`;

code = code.replace(oldUpdateData, newUpdateData);
fs.writeFileSync(routerPath, code, 'utf8');
