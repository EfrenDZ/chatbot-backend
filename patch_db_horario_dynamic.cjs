const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  if (!config) return;
  const graph = config.flowGraph;

  // Actualizar el nodo de aviso para que use la variable de AguaCero
  const nodeAviso = graph.nodes.find(n => n.id === 'node-horario-aviso');
  if (nodeAviso) {
    nodeAviso.text = "{{mensaje_horario}}";
    nodeAviso.messages = ["{{mensaje_horario}}"];
  }

  await prisma.botConfig.update({
    where: { accountId: config.accountId },
    data: { flowGraph: graph }
  });

  const graphPath = path.join(__dirname, 'my_graph.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

  console.log("DB updated to use dynamic message from AguaCero!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
