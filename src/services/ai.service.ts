import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

export interface AiResponse {
  text: string;
  isHandoff: boolean;
  isResolved: boolean;
}

export class AiService {
  static async getReply(
    providerName: string,
    modelName: string,
    systemPrompt: string,
    history: any[],
    dynamicTools: any[] = []
  ): Promise<AiResponse> {
    
    let model;

    switch (providerName.toLowerCase()) {
      case 'google':
      case 'gemini':
        const googleProvider = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
        });
        model = googleProvider(modelName);
        break;

      case 'deepseek':
        const deepseek = createOpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: process.env.DEEPSEEK_API_KEY,
        });
        model = deepseek(modelName);
        break;

      case 'openai':
      default:
        const openai = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        model = openai(modelName);
        break;
    }

    try {
      const tools: Record<string, any> = {
        transferir_a_humano: {
          description: 'Transfiere inmediatamente la conversación a un agente humano en vivo. Úsala cuando el usuario lo solicite explícitamente o si no puedes resolver su problema.',
          parameters: z.object({}),
        },
        resolver_conversacion: {
          description: 'Cierra la conversación. Úsala SOLO cuando el usuario se despida definitivamente o indique claramente que ya no necesita más ayuda.',
          parameters: z.object({}),
        },
      };

      for (const dt of dynamicTools) {
        if (!dt.name || !dt.url) continue;
        
        const zodShape: Record<string, z.ZodTypeAny> = {};
        if (dt.parameters && Array.isArray(dt.parameters)) {
          for (const p of dt.parameters) {
            let zType: z.ZodTypeAny = z.string();
            if (p.type === 'number') zType = z.number();
            else if (p.type === 'boolean') zType = z.boolean();
            
            if (p.description) zType = zType.describe(p.description);
            zodShape[p.name] = zType;
          }
        }

        tools[dt.name] = {
          description: dt.description || `Ejecuta la herramienta ${dt.name}`,
          parameters: z.object(zodShape),
          execute: async (args: any) => {
            console.log(`[AiService] Ejecutando herramienta dinámica: ${dt.name}`);
            try {
              const response = await fetch(dt.url, {
                method: dt.method || 'POST',
                headers: { 'Content-Type': 'application/json', ...(dt.headers || {}) },
                body: JSON.stringify(args)
              });
              
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                return await response.json();
              } else {
                return { status: response.status, ok: response.ok };
              }
            } catch (error: any) {
              console.error(`[AiService] Error en herramienta ${dt.name}:`, error);
              return { error: error.message };
            }
          }
        };
      }

      const { text, toolCalls } = await generateText({
        model,
        system: systemPrompt,
        messages: history,
        tools,
        maxSteps: 3 // Permite que la IA llame a la API y luego lea la respuesta para escribir el mensaje final
      } as any);

      let isHandoff = false;
      let isResolved = false;

      // El Vercel AI SDK no expone los toolCalls internos del loop si usas maxSteps,
      // pero si el último step fue una herramienta terminal (handoff/resolve), vendrá en toolCalls
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (tc.toolName === 'transferir_a_humano') isHandoff = true;
          if (tc.toolName === 'resolver_conversacion') isResolved = true;
        }
      }

      // Hack de fallback por si la IA devuelve un texto vacío tras usar herramientas terminales
      let finalText = text || "";
      if (!finalText && isHandoff) finalText = "Transfiriendo a un humano...";
      if (!finalText && isResolved) finalText = "Conversación finalizada.";

      return {
        text: finalText,
        isHandoff,
        isResolved
      };
    } catch (error) {
      console.error('[AiService] Error generando texto:', error);
      return { text: "[ERROR_IA]", isHandoff: false, isResolved: false };
    }
  }
}
