const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  if (!config) {
    console.log("No config found in db!");
    return;
  }
  const graphPath = path.join(__dirname, 'my_graph.json');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
  
  await prisma.botConfig.update({
    where: { accountId: config.accountId },
    data: { flowGraph: graph }
  });
  console.log("DB updated with new flowGraph!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
