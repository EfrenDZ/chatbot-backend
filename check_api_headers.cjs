const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  console.log("apiHeaders:", config?.apiHeaders);
}
main().finally(() => prisma.$disconnect());
