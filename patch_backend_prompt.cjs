const fs = require('fs');
const path = '/Users/efrendz/Downloads/chatwoot/chatbot-saas/backend/src/services/bot.service.ts';
let code = fs.readFileSync(path, 'utf8');

const buildSystemPromptFn = `
  private static buildSystemPrompt(config: any): string {
    if (config.aiPromptMode === 'FREE') {
      return config.systemPrompt || '';
    }

    const knowledge = config.aiKnowledge as any || {};
    let promptParts = [];
    
    promptParts.push(\`ERES el asistente virtual de: \${knowledge.businessName || 'esta empresa'}.\`);
    
    if (knowledge.businessDescription) {
      promptParts.push(\`DESCRIPCIÓN DE LA EMPRESA:\\n\${knowledge.businessDescription}\`);
    }
    
    if (knowledge.tone) {
      promptParts.push(\`TONO DE CONVERSACIÓN:\\nDebes responder con un tono: \${knowledge.tone}.\`);
    }

    if (knowledge.rules && knowledge.rules.length > 0) {
      promptParts.push(\`REGLAS DE OBLIGATORIO CUMPLIMIENTO:\\n\${knowledge.rules.map((r: string) => \`- \${r}\`).join('\\n')}\`);
    }

    if (knowledge.catalog && knowledge.catalog.length > 0) {
      const catText = knowledge.catalog.map((c: any) => \`- Producto/Servicio: \${c.name}\\n  Precio: \${c.price}\\n  Detalles: \${c.description}\`).join('\\n\\n');
      promptParts.push(\`CATÁLOGO DE PRODUCTOS / SERVICIOS:\\n\${catText}\`);
    }

    if (knowledge.faqs && knowledge.faqs.length > 0) {
      const faqText = knowledge.faqs.map((f: any) => \`Q: \${f.question}\\nA: \${f.answer}\`).join('\\n\\n');
      promptParts.push(\`PREGUNTAS FRECUENTES (Utiliza esta información para responder a clientes):\\n\${faqText}\`);
    }

    if (knowledge.branches && knowledge.branches.length > 0) {
      const branchesText = knowledge.branches.map((b: any) => \`- Sucursal: \${b.name}\\n  Horario: \${b.schedule}\\n  Ubicación/Maps: \${b.mapsLink}\`).join('\\n\\n');
      promptParts.push(\`NUESTRAS SUCURSALES:\\n\${branchesText}\`);
    }

    if (knowledge.extraContext) {
      promptParts.push(\`CONTEXTO ADICIONAL / NOTAS EXTRA:\\n\${knowledge.extraContext}\`);
    }

    promptParts.push(\`INSTRUCCIONES GENERALES:\\nBásate estrictamente en la información proporcionada arriba. Si el usuario pregunta algo que no está en tu conocimiento o catálogo, indícale amablemente que no tienes esa información y ofrécele transferencia a un humano si es necesario.\`);

    return promptParts.join('\\n\\n------------------------\\n\\n');
  }

  private static async processAiMessage(account: Account, session: ConversationSession, cwConvId: number, content: string) {`;

code = code.replace(
  '  private static async processAiMessage(account: Account, session: ConversationSession, cwConvId: number, content: string) {',
  buildSystemPromptFn
);

code = code.replace(
  "let finalSystemPrompt = config.systemPrompt || '';",
  "let finalSystemPrompt = this.buildSystemPrompt(config);"
);

fs.writeFileSync(path, code, 'utf8');
console.log("Patched bot.service.ts");
