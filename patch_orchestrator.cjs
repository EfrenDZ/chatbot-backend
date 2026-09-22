const fs = require('fs');
const orchestratorPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/ai.orchestrator.ts';
let code = fs.readFileSync(orchestratorPath, 'utf8');

const callOld = `    const aiResult = await AiService.getReply(
      config.aiProvider,
      config.aiModel,
      finalSystemPrompt,
      history
    );`;

const callNew = `    const aiResult = await AiService.getReply(
      config.aiProvider,
      config.aiModel,
      finalSystemPrompt,
      history,
      (config as any).aiTools || []
    );`;

code = code.replace(callOld, callNew);
fs.writeFileSync(orchestratorPath, code, 'utf8');
