const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  console.log(account);
}
main().catch(console.error).finally(() => prisma.$disconnect());
