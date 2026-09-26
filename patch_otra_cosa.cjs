const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  if (!config) return;
  const graph = config.flowGraph;

  // 1. Crear nodos para "Otra cosa"
  const nodeOtraCosa = {
    id: "node-otra-cosa",
    type: "MENU",
    text: "¿Puedo ayudarte con algo más?",
    messages: ["¿Puedo ayudarte con algo más?"],
    options: [
      { id: "opt-otra-si", label: "Sí", targetNodeId: "node-root" },
      { id: "opt-otra-no", label: "No", targetNodeId: "node-despedida-final" }
    ],
    position: { x: 1200, y: 3600 }
  };

  const nodeDespedidaFinal = {
    id: "node-despedida-final",
    type: "MESSAGE",
    text: "¡Perfecto! Fue un placer atenderte. ¡Que tengas un excelente día!",
    messages: ["¡Perfecto! Fue un placer atenderte. ¡Que tengas un excelente día!"],
    targetNodeId: "node-horario-resolve", // El nodo RESOLVE que creamos antes
    position: { x: 1200, y: 3800 }
  };

  // Filtrar si ya existían
  graph.nodes = graph.nodes.filter(n => !["node-otra-cosa", "node-despedida-final"].includes(n.id));
  graph.nodes.push(nodeOtraCosa, nodeDespedidaFinal);

  // 2. Apuntar el final del pedido a "Otra cosa"
  const successNode = graph.nodes.find(n => n.id === 'node-final-success');
  if (successNode) {
    successNode.targetNodeId = "node-otra-cosa";
  }

  const cerradoNode = graph.nodes.find(n => n.id === 'node-horario-cerrado');
  if (cerradoNode) {
    cerradoNode.targetNodeId = "node-otra-cosa";
  }

  // 3. Modificar el nodo info para que también pregunte si desea algo más
  const infoNode = graph.nodes.find(n => n.id === 'node-info');
  if (infoNode) {
    infoNode.targetNodeId = "node-otra-cosa";
  }

  await prisma.botConfig.update({
    where: { accountId: config.accountId },
    data: { flowGraph: graph }
  });

  const graphPath = path.join(__dirname, 'my_graph.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

  console.log("DB updated with 'Otra cosa' loop!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
