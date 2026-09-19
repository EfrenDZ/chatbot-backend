import { generateText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({ apiKey: '...' });

async function test() {
  await generateText({
    model: openai('gpt-4o'),
    messages: [],
    tools: {
      transferir: {
        description: 'hola',
        parameters: z.object({}),
      }
    }
  });
}
