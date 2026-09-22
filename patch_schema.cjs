const fs = require('fs');
const schemaPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/prisma/schema.prisma';
let code = fs.readFileSync(schemaPath, 'utf8');

// Find BotConfig model
if (!code.includes('aiTools')) {
  code = code.replace(
    /aiPromptMode\s+String\s+@default\("STRUCTURED"\)/,
    'aiPromptMode  String  @default("STRUCTURED")\n  aiTools       Json?   @default("[]")'
  );
  fs.writeFileSync(schemaPath, code, 'utf8');
  console.log("Schema patched");
}
