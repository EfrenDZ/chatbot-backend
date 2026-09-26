const fs = require('fs');
const path = require('path');

async function main() {
  const idleServicePath = path.join(__dirname, 'src/services/idle.service.ts');
  const idleCode = `import { PrismaClient } from '@prisma/client';
import { ChatwootService } from './chatwoot.service';

const prisma = new PrismaClient();

export class IdleService {
  static startIdleCloser(checkIntervalMinutes = 10, idleTimeoutHours = 1) {
    console.log(\`[IdleService] Started. Checking every \${checkIntervalMinutes}m for sessions inactive > \${idleTimeoutHours}h\`);
    
    setInterval(async () => {
      try {
        const cutoffTime = new Date(Date.now() - (idleTimeoutHours * 60 * 60 * 1000));
        
        const idleSessions = await prisma.conversationSession.findMany({
          where: {
            status: 'BOT_HANDLING',
            updatedAt: { lt: cutoffTime }
          },
          include: { account: true }
        });

        if (idleSessions.length > 0) {
          console.log(\`[IdleService] Encontradas \${idleSessions.length} sesiones inactivas. Procediendo a cerrarlas...\`);
        }

        for (const session of idleSessions) {
          if (!session.account.chatwootAccessToken) continue;
          
          try {
            await ChatwootService.sendMessage(
              session.account.chatwootApiUrl,
              session.account.chatwootAccessToken,
              session.account.chatwootAccountId,
              session.chatwootConversationId,
              "Cerrando conversación por inactividad. ¡Estaremos encantados de atenderte cuando regreses!"
            );

            await ChatwootService.resolveConversation(
              session.account.chatwootApiUrl,
              session.account.chatwootAccessToken,
              session.account.chatwootAccountId,
              session.chatwootConversationId
            );

            await prisma.conversationSession.update({
              where: { id: session.id },
              data: { status: 'RESOLVED' }
            });

            console.log(\`[IdleService] Sesión \${session.id} resuelta por inactividad.\`);
          } catch (e) {
            console.error(\`[IdleService] Error cerrando sesión \${session.id}:\`, e);
          }
        }
      } catch (err) {
        console.error('[IdleService] Error en el cron de inactividad:', err);
      }
    }, checkIntervalMinutes * 60 * 1000);
  }
}
`;
  fs.writeFileSync(idleServicePath, idleCode);
  console.log("Created idle.service.ts");

  const indexPath = path.join(__dirname, 'src/index.ts');
  let indexCode = fs.readFileSync(indexPath, 'utf-8');
  
  if (!indexCode.includes('IdleService')) {
    indexCode = indexCode.replace("import integrationRouter from './routes/integration';", "import integrationRouter from './routes/integration';\nimport { IdleService } from './services/idle.service';");
    
    indexCode = indexCode.replace(
      "console.log(`🚀 Chatbot SaaS Backend running on http://localhost:${PORT}`);",
      "console.log(`🚀 Chatbot SaaS Backend running on http://localhost:${PORT}`);\n  IdleService.startIdleCloser(10, 1); // Chequea cada 10 min, inactivo por 1 hora"
    );
    fs.writeFileSync(indexPath, indexCode);
    console.log("Patched index.ts");
  } else {
    console.log("index.ts already patched");
  }
}

main().catch(console.error);
