const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const oldPrompt = "INSTRUCCIÓN CRÍTICA DE AUTO-CIERRE:\\nSi el usuario se despide, da las gracias para terminar, o indica que ya no necesita ayuda, DEBES obligatoriamente escribir la etiqueta secreta [RESOLVER] al mero final de tu mensaje. EJEMPLO DE RESPUESTA: \\\"De nada, ¡que tengas buen día! [RESOLVER]\\\".";

const newPrompt = "INSTRUCCIÓN CRÍTICA DE AUTO-CIERRE:\\nSi el usuario dice \\\"gracias\\\" o parece haber resuelto su duda, PRIMERO pregúntale cortésmente si puedes ayudarle en algo más. SOLO si el usuario responde expresamente que \\\"no\\\", que \\\"eso es todo\\\", o se despide definitivamente (ej. \\\"adiós\\\"), ENTONCES DEBES obligatoriamente escribir la etiqueta secreta [RESOLVER] al mero final de tu mensaje para cerrar el chat. EJEMPLO DE CIERRE FINAL: \\\"De nada, ¡que tengas buen día! [RESOLVER]\\\".";

code = code.replace(oldPrompt, newPrompt);

const oldFreePrompt = "[INSTRUCCIÓN CRÍTICA]: Si el usuario se despide o termina la conversación, DEBES escribir la etiqueta secreta [RESOLVER] al final de tu mensaje. Ejemplo: \\\"Adiós! [RESOLVER]\\\"";

const newFreePrompt = "[INSTRUCCIÓN CRÍTICA]: Si el usuario dice \\\"gracias\\\", primero pregúntale si necesita algo más. SOLO si dice que NO o se despide definitivamente, DEBES escribir la etiqueta secreta [RESOLVER] al final de tu mensaje. Ejemplo: \\\"Adiós! [RESOLVER]\\\"";

code = code.replace(oldFreePrompt, newFreePrompt);

fs.writeFileSync(path, code, 'utf8');
console.log("UX prompt updated");
