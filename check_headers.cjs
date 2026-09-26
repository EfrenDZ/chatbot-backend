const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const config = await prisma.botConfig.findFirst();
  console.log("apiHeaders:", config.apiHeaders);
}
main().finally(() => prisma.$disconnect());
