const fs = require('fs');
const schemaPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/prisma/schema.prisma';
let code = fs.readFileSync(schemaPath, 'utf8');

code = code.replace(
  'aiPromptMode  String  @default("STRUCTURED")\n  aiTools       Json?   @default("[]") @map("ai_prompt_mode")',
  'aiPromptMode           String   @default("STRUCTURED") @map("ai_prompt_mode")\n  aiTools                Json?    @default("[]") @map("ai_tools")'
);

fs.writeFileSync(schemaPath, code, 'utf8');
