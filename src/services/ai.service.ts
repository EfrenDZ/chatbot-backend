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
    history: any[]
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
      const { text, toolCalls } = await generateText({
        model,
        system: systemPrompt,
        messages: history,
        tools: {
          transferir_a_humano: {
            description: 'Transfiere inmediatamente la conversación a un agente humano en vivo. Úsala cuando el usuario lo solicite explícitamente o si no puedes resolver su problema.',
            parameters: z.object({}),
          },
          resolver_conversacion: {
            description: 'Cierra la conversación. Úsala SOLO cuando el usuario se despida definitivamente o indique claramente que ya no necesita más ayuda.',
            parameters: z.object({}),
          },
        },
      } as any);

      let isHandoff = false;
      let isResolved = false;

      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (tc.toolName === 'transferir_a_humano') isHandoff = true;
          if (tc.toolName === 'resolver_conversacion') isResolved = true;
        }
      }

      return {
        text: text || "",
        isHandoff,
        isResolved
      };
    } catch (error) {
      console.error('[AiService] Error generando texto:', error);
      return { text: "[ERROR_IA]", isHandoff: false, isResolved: false };
    }
  }
}
