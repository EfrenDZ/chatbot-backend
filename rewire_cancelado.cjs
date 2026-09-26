const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;

  const canceladoNode = graph.nodes.find(n => n.id === "node-horario-cancelado");
  if (canceladoNode) {
    canceladoNode.targetNodeId = "node-otra-cosa";
  }

  await prisma.botConfig.update({
    where: { accountId: account.id },
    data: { flowGraph: graph }
  });
  console.log("Rewired Cancelado -> Otra cosa!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
