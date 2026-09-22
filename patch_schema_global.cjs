const fs = require('fs');
const schemaPath = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/prisma/schema.prisma';
let code = fs.readFileSync(schemaPath, 'utf8');

if (!code.includes('apiBaseUrl')) {
  code = code.replace(
    'fallbackMessage        String   @map("fallback_message")',
    'apiBaseUrl             String?  @map("api_base_url")\n  apiHeaders             Json?    @map("api_headers")\n  fallbackMessage        String   @map("fallback_message")'
  );
  fs.writeFileSync(schemaPath, code, 'utf8');
}
