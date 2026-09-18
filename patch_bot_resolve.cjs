const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Añadir instrucción de cierre al final del prompt en el modo estructurado
code = code.replace(
  "promptParts.push(`INSTRUCCIONES GENERALES:\\nBásate estrictamente en la información proporcionada arriba. Si el usuario pregunta algo que no está en tu conocimiento o catálogo, indícale amablemente que no tienes esa información y ofrécele transferencia a un humano si es necesario.`);",
  "promptParts.push(`INSTRUCCIONES GENERALES:\\nBásate estrictamente en la información proporcionada arriba. Si el usuario pregunta algo que no está en tu conocimiento o catálogo, indícale amablemente que no tienes esa información y ofrécele transferencia a un humano.\\n\\nINSTRUCCIÓN DE AUTO-CIERRE:\\nSi el usuario se despide explícitamente (ej. \"gracias adios\", \"eso es todo\"), despídete de él de forma cordial Y OBLIGATORIAMENTE incluye la palabra exacta [RESOLVER] al final de tu respuesta secreta. Esto activará el sistema para cerrar el chat.`);"
);

// Lo mismo para el modo LIBRE
code = code.replace(
  "return config.systemPrompt || '';",
  "let base = config.systemPrompt || '';\n      base += '\\n\\n[NOTA DE SISTEMA]: Si la conversación termina o el usuario se despide, incluye la palabra exacta [RESOLVER] al final de tu respuesta para auto-cerrar el chat.';\n      return base;"
);

// 2. Interceptar el [RESOLVER] en la respuesta de la IA
const oldAiCall = `    const aiReply = await AiService.getReply(
      config.aiProvider,
      config.aiModel,
      finalSystemPrompt,
      history
    );

    // 6. Guardar respuesta en BD y enviarla a Chatwoot`;

const newAiCall = `    let aiReply = await AiService.getReply(
      config.aiProvider,
      config.aiModel,
      finalSystemPrompt,
      history
    );

    let isResolvedByAi = false;
    if (aiReply.includes('[RESOLVER]')) {
      isResolvedByAi = true;
      aiReply = aiReply.replace(/\\[RESOLVER\\]/g, '').trim();
    }

    // 6. Guardar respuesta en BD y enviarla a Chatwoot`;

code = code.replace(oldAiCall, newAiCall);

// 3. Ejecutar el cierre si la bandera está prendida
const oldSaveSend = `    await ChatwootService.sendMessage(
      account.chatwootApiUrl,
      account.chatwootAccessToken!,
      account.chatwootAccountId,
      cwConvId,
      aiReply
    );`;

const newSaveSend = `    await ChatwootService.sendMessage(
      account.chatwootApiUrl,
      account.chatwootAccessToken!,
      account.chatwootAccountId,
      cwConvId,
      aiReply
    );

    if (isResolvedByAi && account.chatwootAccessToken) {
      console.log(\`[BotEngine] La IA decidió auto-resolver la sesión \${session.id}\`);
      await ChatwootService.resolveConversation(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId
      );
      // El webhook de "conversation_status_changed" a "resolved"
      // hará el resto (actualizar BD a RESOLVED)
    }`;

code = code.replace(oldSaveSend, newSaveSend);

fs.writeFileSync(path, code, 'utf8');
console.log("Bot AI resolve patched");
