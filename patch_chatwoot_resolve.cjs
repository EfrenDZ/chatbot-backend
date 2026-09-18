const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/chatwoot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const resolveFn = `
  static async resolveConversation(
    apiUrl: string,
    accessToken: string,
    accountId: number,
    conversationId: number
  ): Promise<void> {
    const url = \`\${apiUrl}/api/v1/accounts/\${accountId}/conversations/\${conversationId}/toggle_status\`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': accessToken,
        },
        body: JSON.stringify({
          status: 'resolved',
        }),
      });

      if (!response.ok) {
        console.error(\`[ChatwootService] Error resolviendo conv: \${await response.text()}\`);
      }
    } catch (error) {
      console.error(\`[ChatwootService] Excepción en resolve:\`, error);
    }
  }
}
`;

code = code.replace("  }\n}\n", "  }\n" + resolveFn);

fs.writeFileSync(path, code, 'utf8');
console.log("Chatwoot service resolve patched");
