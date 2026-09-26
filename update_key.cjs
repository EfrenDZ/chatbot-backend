const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst();
  if (account) {
    await prisma.botConfig.update({
      where: { accountId: account.id },
      data: {
        apiHeaders: JSON.stringify({
          "x-api-key": "f19311ad821895465b1e45758440fc633dc576e6fb75485d1f63e3e94d88419b"
        })
      }
    });
    console.log("API Key updated in DB!");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
