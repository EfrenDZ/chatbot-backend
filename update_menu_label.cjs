const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;

  const reviewMenu = graph.nodes.find(n => n.id === "node-review-menu");
  if (reviewMenu) {
    const editOpt = reviewMenu.options.find(o => o.id === "opt-review-edit-cart");
    if (editOpt) {
      editOpt.label = "Vaciar carrito e iniciar de nuevo";
    }
  }

  await prisma.botConfig.update({
    where: { accountId: account.id },
    data: { flowGraph: graph }
  });
  console.log("Menu label updated!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
