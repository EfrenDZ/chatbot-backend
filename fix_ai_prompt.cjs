const fs = require('fs');

const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot/ai.orchestrator.ts';
let code = fs.readFileSync(path, 'utf8');

const oldInst = `promptParts.push(\`INSTRUCCIONES GENERALES:\\nBásate estrictamente en la información proporcionada arriba. Si el usuario pregunta algo que no está en tu conocimiento o catálogo, indícale amablemente que no tienes esa información y utiliza la herramienta "transferir_a_humano".\\n\\nINSTRUCCIÓN DE AUTO-CIERRE:\\nSi el usuario se despide explícitamente (ej. "gracias adios", "eso es todo"), despídete de él de forma cordial y OBLIGATORIAMENTE utiliza la herramienta "resolver_conversacion" para cerrar el chat.\`);`;

const newInst = `promptParts.push(\`INSTRUCCIONES GENERALES:\\nBásate estrictamente en la información proporcionada arriba. Si el usuario pregunta algo que no está en tu conocimiento o catálogo, indícale amablemente que no tienes esa información y PREGÚNTALE si desea ser atendido por un asesor humano. Utiliza la herramienta "transferir_a_humano" ÚNICAMENTE si el usuario acepta tu oferta de transferencia, o si el usuario solicita un humano directamente desde el principio.\\n\\nINSTRUCCIÓN DE AUTO-CIERRE:\\nSi el usuario se despide explícitamente (ej. "gracias adios", "eso es todo"), despídete de él de forma cordial y OBLIGATORIAMENTE utiliza la herramienta "resolver_conversacion" para cerrar el chat.\`);`;

code = code.replace(oldInst, newInst);
fs.writeFileSync(path, code, 'utf8');

console.log("System Prompt updated for softer handoff");
