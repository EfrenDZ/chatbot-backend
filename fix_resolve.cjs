const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

// Hacer la comprobación insensible a mayúsculas y minúsculas
code = code.replace(
  "if (aiReply.includes('[RESOLVER]')) {\n      isResolvedByAi = true;\n      aiReply = aiReply.replace(/\\[RESOLVER\\]/g, '').trim();\n    }",
  "if (/\\[RESOLVER\\]/i.test(aiReply) || /\\[resolver\\]/i.test(aiReply)) {\n      isResolvedByAi = true;\n      aiReply = aiReply.replace(/\\[RESOLVER\\]/gi, '').trim();\n    }"
);

// Fortalecer el prompt
code = code.replace(
  "INSTRUCCIÓN DE AUTO-CIERRE:\\nSi el usuario se despide explícitamente (ej. \\\"gracias adios\\\", \\\"eso es todo\\\"), despídete de él de forma cordial Y OBLIGATORIAMENTE incluye la palabra exacta [RESOLVER] al final de tu respuesta secreta. Esto activará el sistema para cerrar el chat.",
  "INSTRUCCIÓN CRÍTICA DE AUTO-CIERRE:\\nSi el usuario se despide, da las gracias para terminar, o indica que ya no necesita ayuda, DEBES obligatoriamente escribir la etiqueta secreta [RESOLVER] al mero final de tu mensaje. EJEMPLO DE RESPUESTA: \\\"De nada, ¡que tengas buen día! [RESOLVER]\\\"."
);

code = code.replace(
  "[NOTA DE SISTEMA]: Si la conversación termina o el usuario se despide, incluye la palabra exacta [RESOLVER] al final de tu respuesta para auto-cerrar el chat.",
  "[INSTRUCCIÓN CRÍTICA]: Si el usuario se despide o termina la conversación, DEBES escribir la etiqueta secreta [RESOLVER] al final de tu mensaje. Ejemplo: \\\"Adiós! [RESOLVER]\\\""
);

fs.writeFileSync(path, code, 'utf8');
console.log("Resolve regex and prompt patched");
