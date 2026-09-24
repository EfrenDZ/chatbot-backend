const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  console.log("Config keys:", Object.keys(config));
  console.log("botHeaders:", config?.botHeaders || config?.customHeaders || config?.headers);
}
main().finally(() => prisma.$disconnect());
