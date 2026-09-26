const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  let graph = config.flowGraph;

  const fixNode = (id) => {
      const n = graph.nodes.find(n => n.id === id);
      if (n && n.text === undefined) {
          n.text = "";
          n.messages = [""];
      }
  };

  fixNode('node-add-wh');
  fixNode('node-remove-wh');
  fixNode('node-cancel-wh');
  fixNode('node-rastreo-wh');

  await prisma.botConfig.update({ where: { accountId: config.accountId }, data: { flowGraph: graph } });
  console.log("Empty strings added to webhooks text and messages properties.");
}
main().finally(() => prisma.$disconnect());
