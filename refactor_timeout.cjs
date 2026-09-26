const fs = require('fs');
const path = require('path');

// 1. Update schema.prisma
const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
let schemaCode = fs.readFileSync(schemaPath, 'utf-8');
schemaCode = schemaCode.replace(
  /sessionTimeoutHours\s+Int\s+@default\(24\)\s+@map\("session_timeout_hours"\)/,
  'sessionTimeoutMinutes Int      @default(1440) @map("session_timeout_minutes")'
);
fs.writeFileSync(schemaPath, schemaCode);
console.log("Updated schema.prisma");

// 2. Update routes/config.ts
const configPath = path.join(__dirname, 'src/routes/config.ts');
let configCode = fs.readFileSync(configPath, 'utf-8');
configCode = configCode.replace(/sessionTimeoutHours/g, 'sessionTimeoutMinutes');
fs.writeFileSync(configPath, configCode);
console.log("Updated routes/config.ts");

// 3. Update bot/index.ts
const indexBotPath = path.join(__dirname, 'src/services/bot/index.ts');
let indexBotCode = fs.readFileSync(indexBotPath, 'utf-8');
// Fix the math in bot/index.ts
// Original: const hoursInactive = (Date.now() - session.updatedAt.getTime()) / (1000 * 60 * 60);
// Original: const timeoutHours = account.botConfig.sessionTimeoutHours || 24;
// Original: if (hoursInactive > timeoutHours) { ... }
indexBotCode = indexBotCode.replace(/const hoursInactive[\s\S]*?timeoutHours\) \{/, (match) => {
  return `const minutesInactive = (Date.now() - session.updatedAt.getTime()) / (1000 * 60);
    const timeoutMins = account.botConfig.sessionTimeoutMinutes || 1440;
    
    if (minutesInactive > timeoutMins) {`;
});
// Need to replace the console.log and other references to sessionTimeoutHours
indexBotCode = indexBotCode.replace(/hoursInactive/g, 'minutesInactive');
indexBotCode = indexBotCode.replace(/timeoutHours/g, 'timeoutMins');
indexBotCode = indexBotCode.replace(/sessionTimeoutHours/g, 'sessionTimeoutMinutes');
indexBotCode = indexBotCode.replace(/>\$\{timeoutMins\}h/g, '>${timeoutMins}m');
fs.writeFileSync(indexBotPath, indexBotCode);
console.log("Updated bot/index.ts");

// 4. Update idle.service.ts
const idlePath = path.join(__dirname, 'src/services/idle.service.ts');
let idleCode = fs.readFileSync(idlePath, 'utf-8');
// Original: const timeoutHours = session.account.botConfig?.sessionTimeoutHours || 24;
// Original: const sessionCutoff = session.updatedAt.getTime() + (timeoutHours * 60 * 60 * 1000);
idleCode = idleCode.replace(/sessionTimeoutHours/g, 'sessionTimeoutMinutes');
idleCode = idleCode.replace(/timeoutHours \* 60 \* 60 \* 1000/g, 'timeoutMins * 60 * 1000');
idleCode = idleCode.replace(/timeoutHours/g, 'timeoutMins');
idleCode = idleCode.replace(/\$\{timeoutMins\}h/g, '${timeoutMins}m');
fs.writeFileSync(idlePath, idleCode);
console.log("Updated idle.service.ts");

