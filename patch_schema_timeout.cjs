const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/prisma/schema.prisma';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'maxConsecutiveErrors   Int      @default(2) @map("max_consecutive_errors")',
  'maxConsecutiveErrors   Int      @default(2) @map("max_consecutive_errors")\n  sessionTimeoutHours    Int      @default(24) @map("session_timeout_hours")'
);

fs.writeFileSync(path, code, 'utf8');
console.log("Schema patched");
