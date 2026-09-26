const fs = require('fs');
const path = require('path');

async function main() {
  const idleServicePath = path.join(__dirname, 'src/services/idle.service.ts');
  const idleCode = `import { PrismaClient } from '@prisma/client';
import { ChatwootService } from './chatwoot.service';

const prisma = new PrismaClient();

export class IdleService {
  static startIdleCloser(checkIntervalMinutes = 10) {
    console.log(\`[IdleService] Started. Checking every \${checkIntervalMinutes}m for expired sessions (based on each account config)\`);
    
    setInterval(async () => {
      try {
        const idleSessions = await prisma.conversationSession.findMany({
          where: {
            status: 'BOT_HANDLING',
          },
          include: { 
            account: {
              include: { botConfig: true }
            } 
          }
        });

        const now = Date.now();
        let closedCount = 0;

        for (const session of idleSessions) {
          if (!session.account.chatwootAccessToken) continue;
          
          const timeoutHours = session.account.botConfig?.sessionTimeoutHours || 24;
          const sessionCutoff = session.updatedAt.getTime() + (timeoutHours * 60 * 60 * 1000);
          
          if (now < sessionCutoff) continue; // Todavía está activa
          
          try {
            const timeoutMessage = session.account.botConfig?.farewellMessage || "Cerrando conversación por inactividad. ¡Estaremos encantados de atenderte cuando regreses!";
            
            await ChatwootService.sendMessage(
              session.account.chatwootApiUrl,
              session.account.chatwootAccessToken,
              session.account.chatwootAccountId,
              session.chatwootConversationId,
              timeoutMessage
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

            closedCount++;
            console.log(\`[IdleService] Sesión \${session.id} resuelta tras \${timeoutHours}h de inactividad.\`);
          } catch (e) {
            console.error(\`[IdleService] Error cerrando sesión \${session.id}:\`, e);
          }
        }
        
        if (closedCount > 0) {
          console.log(\`[IdleService] \${closedCount} sesiones inactivas fueron cerradas automáticamente.\`);
        }
      } catch (err) {
        console.error('[IdleService] Error en el cron de inactividad:', err);
      }
    }, checkIntervalMinutes * 60 * 1000);
  }
}
`;
  fs.writeFileSync(idleServicePath, idleCode);
  console.log("Updated idle.service.ts to use dynamic timeout & message");

  // Fix index.ts to not pass hardcoded 1 hour
  const indexPath = path.join(__dirname, 'src/index.ts');
  let indexCode = fs.readFileSync(indexPath, 'utf-8');
  indexCode = indexCode.replace("IdleService.startIdleCloser(10, 1);", "IdleService.startIdleCloser(10);");
  fs.writeFileSync(indexPath, indexCode);
  console.log("Updated index.ts");
}

main().catch(console.error);
