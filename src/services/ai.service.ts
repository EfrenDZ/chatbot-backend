import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

export interface AiResponse {
  text: string;
  isHandoff: boolean;
  isResolved: boolean;
  isOrderCreated: boolean;
  orderData?: any;
  isOrderCancelled: boolean;
  cancelData?: any;
}

export class AiService {
  static async getReply(
    providerName: string,
    modelName: string,
    systemPrompt: string,
    history: any[],
    dynamicTools: any[] = []
  ): Promise<AiResponse> {
    
    const isGoogle = providerName.toLowerCase() === 'google' || providerName.toLowerCase() === 'gemini';
    const modelsToTry = isGoogle
      ? Array.from(new Set([modelName, 'gemini-flash-lite-latest', 'gemini-2.5-flash']))
      : [modelName];

    let lastError: any = null;

    for (const currentModel of modelsToTry) {
      try {
        let model;

        if (isGoogle) {
          const googleProvider = createGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
          });
          model = googleProvider(currentModel);
        } else if (providerName.toLowerCase() === 'deepseek') {
          const deepseek = createOpenAI({
            baseURL: 'https://api.deepseek.com/v1',
            apiKey: process.env.DEEPSEEK_API_KEY,
          });
          model = deepseek(currentModel);
        } else {
          const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });
          model = openai(currentModel);
        }
      const tools: Record<string, any> = {
        transferir_a_humano: {
          description: 'Transfiere la conversación a un asesor humano en vivo. Úsala ÚNICAMENTE cuando el usuario lo solicite de manera explícita (ej. "quiero hablar con una persona", "pásame a un asesor"). ESTÁ ESTRICTAMENTE PROHIBIDO usarla ante cambios de dirección, dudas de productos, preguntas o durante la toma de pedidos.',
          parameters: z.object({}),
        },
        resolver_conversacion: {
          description: 'Cierra la conversación. Úsala SOLO cuando el usuario se despida definitivamente o indique claramente que ya no necesita más ayuda.',
          parameters: z.object({}),
        },
        crear_pedido: {
          description: 'Registra y confirma un pedido cuando el cliente ya indicó los productos, cantidades y la dirección de entrega.',
          parameters: z.object({
            items: z.array(z.object({
              producto: z.string().describe('Nombre del producto o servicio del catálogo'),
              cantidad: z.number().int().positive().describe('Cantidad solicitada'),
              notas: z.string().optional().describe('Detalles específicos de este ítem')
            })).min(1).describe('Lista de productos o servicios solicitados'),
            direccion: z.string().optional().describe('Dirección de entrega. Omitir si el cliente confirma usar su dirección registrada'),
            referencias: z.string().optional().describe('Referencias de la ubicación o domicilio'),
            notas_generales: z.string().optional().describe('Instrucciones adicionales para la entrega')
          }),
        },
        cancelar_pedido: {
          description: 'Cancela un pedido que se encuentra pendiente de entrega.',
          parameters: z.object({
            codigo_pedido: z.string().optional().describe('Código de rastreo o identificador del pedido a cancelar'),
            motivo: z.string().optional().describe('Motivo de la cancelación proporcionado por el cliente')
          }),
        }
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
        maxSteps: 3
      } as any);

      let isHandoff = false;
      let isResolved = false;
      let isOrderCreated = false;
      let orderData = null;
      let isOrderCancelled = false;
      let cancelData = null;

      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          if (tc.toolName === 'transferir_a_humano') isHandoff = true;
          if (tc.toolName === 'resolver_conversacion') isResolved = true;
          if (tc.toolName === 'crear_pedido') {
            isOrderCreated = true;
            orderData = (tc as any).input || (tc as any).args;
          }
          if (tc.toolName === 'cancelar_pedido') {
            isOrderCancelled = true;
            cancelData = (tc as any).input || (tc as any).args;
          }
        }
      }

      let finalText = text || "";
      if (!finalText && isHandoff) finalText = "Transfiriendo a un humano...";
      if (!finalText && isResolved) finalText = "Conversación finalizada.";

      return {
        text: finalText,
        isHandoff,
        isResolved,
        isOrderCreated,
        orderData,
        isOrderCancelled,
        cancelData
      };
      } catch (error: any) {
        lastError = error;
        console.warn(`[AiService] Falló modelo ${currentModel}: ${error?.message || error}. Intentando siguiente modelo...`);
      }
    }

    console.error('[AiService] Todos los modelos fallaron. Último error:', lastError);
    return { 
      text: "[ERROR_IA]", 
      isHandoff: false, 
      isResolved: false, 
      isOrderCreated: false, 
      isOrderCancelled: false 
    };
  }
}
