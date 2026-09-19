const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/ai.service.ts';
let code = fs.readFileSync(path, 'utf8');

const oldTools = `        tools: {
          transferir_a_humano: tool({
            description: 'Transfiere inmediatamente la conversación a un agente humano en vivo. Úsala cuando el usuario lo solicite explícitamente o si no puedes resolver su problema.',
            parameters: z.object({}),
          }),
          resolver_conversacion: tool({
            description: 'Cierra la conversación. Úsala SOLO cuando el usuario se despida definitivamente o indique claramente que ya no necesita más ayuda.',
            parameters: z.object({}),
          }),
        },`;

const newTools = `        tools: {
          transferir_a_humano: {
            description: 'Transfiere inmediatamente la conversación a un agente humano en vivo. Úsala cuando el usuario lo solicite explícitamente o si no puedes resolver su problema.',
            parameters: z.object({}),
          },
          resolver_conversacion: {
            description: 'Cierra la conversación. Úsala SOLO cuando el usuario se despida definitivamente o indique claramente que ya no necesita más ayuda.',
            parameters: z.object({}),
          },
        },`;

code = code.replace(oldTools, newTools);
code = code.replace("import { generateText, tool }", "import { generateText }");

fs.writeFileSync(path, code, 'utf8');
