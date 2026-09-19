import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export class AiService {
  /**
   * Genera una respuesta usando el proveedor configurado (OpenAI, DeepSeek o Gemini).
   */
  static async getReply(
    providerName: string,
    modelName: string,
    systemPrompt: string,
    history: any[]
  ): Promise<string> {
    
    let model;

    switch (providerName.toLowerCase()) {
      case 'google':
      case 'gemini':
        const googleProvider = createGoogleGenerativeAI({
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
        });
        model = googleProvider(modelName); // ej. 'gemini-1.5-flash'
        break;

      case 'deepseek':
        // DeepSeek es 100% compatible con la API de OpenAI, solo cambiamos la baseURL
        const deepseek = createOpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: process.env.DEEPSEEK_API_KEY,
        });
        model = deepseek(modelName); // ej. 'deepseek-chat'
        break;

      case 'openai':
      default:
        const openai = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        model = openai(modelName); // ej. 'gpt-4o-mini'
        break;
    }

    try {
      const { text } = await generateText({
        model,
        system: systemPrompt,
        messages: history,
      } as any); // cast to any to bypass version mismatch of ai-sdk
      return text;
    } catch (error) {
      console.error('[AiService] Error generando texto:', error);
      return "[ERROR_IA]";
    }
  }
}
