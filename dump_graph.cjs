const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const config = await prisma.botConfig.findFirst();
  console.log(JSON.stringify(config.flowGraph, null, 2));
}
main().finally(() => prisma.$disconnect());
