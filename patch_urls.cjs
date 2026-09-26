const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  let graph = config.flowGraph;

  // Corregir URLs
  const updateUrl = (id, newUrl) => {
      const node = graph.nodes.find(n => n.id === id);
      if (node) node.url = newUrl;
  };

  updateUrl('node-add-wh', '/carrito/editar');
  updateUrl('node-remove-wh', '/carrito/editar');
  updateUrl('node-cancel-wh', '/carrito/editar');
  updateUrl('node-rastreo-wh', '/pedidos/rastreo');

  await prisma.botConfig.update({ where: { accountId: config.accountId }, data: { flowGraph: graph } });
  console.log("URLs relativas corregidas.");
}
main().finally(() => prisma.$disconnect());
