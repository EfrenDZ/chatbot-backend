const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  let graph = config.flowGraph;

  const ticketNode = graph.nodes.find(n => n.id === 'node-cart-ticket');
  if (ticketNode) {
      ticketNode.text = ticketNode.text.replace('{{webhook.resumen_texto}}', '{{resumen_texto}}');
      if (ticketNode.messages && ticketNode.messages.length > 0) {
          ticketNode.messages[0] = ticketNode.messages[0].replace('{{webhook.resumen_texto}}', '{{resumen_texto}}');
      }
  }

  await prisma.botConfig.update({ where: { accountId: config.accountId }, data: { flowGraph: graph } });
  console.log("Patched node-cart-ticket to use {{resumen_texto}}");
}
main().finally(() => prisma.$disconnect());
