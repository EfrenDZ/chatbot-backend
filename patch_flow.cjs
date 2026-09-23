const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  let graph = config.flowGraph;

  // Find the onboarding node
  const addressNodeIndex = graph.nodes.findIndex(n => n.variableName === 'direccion_nueva');
  if (addressNodeIndex !== -1) {
    let addrNode = graph.nodes[addressNodeIndex];
    
    // Create new Name node
    const nameNode = {
      id: "node-name-input",
      type: "INPUT",
      text: "¡Hola! Veo que es tu primer pedido. Para registrarte, ¿cuál es tu nombre y apellido?",
      messages: ["¡Hola! Veo que es tu primer pedido. Para registrarte, ¿cuál es tu nombre y apellido?"],
      variableName: "nombre_cliente",
      targetNodeId: addrNode.id,
      position: { x: addrNode.position.x, y: addrNode.position.y - 150 }
    };

    // Update Address node to use the name
    addrNode.text = "Gracias {{nombre_cliente}}, ahora dime ¿cuál es tu dirección y referencias?";
    addrNode.messages = ["Gracias {{nombre_cliente}}, ahora dime ¿cuál es tu dirección y referencias?"];
    
    // Find who points to addrNode and point to nameNode
    graph.nodes.forEach(n => {
      if (n.targetNodeId === addrNode.id && n.id !== "node-name-input") {
        n.targetNodeId = nameNode.id;
      }
      if (n.options) {
        n.options.forEach(opt => {
          if (opt.targetNodeId === addrNode.id) opt.targetNodeId = nameNode.id;
        });
      }
      if (n.successNodeId === addrNode.id) n.successNodeId = nameNode.id;
      if (n.errorNodeId === addrNode.id) n.errorNodeId = nameNode.id;
    });

    graph.nodes.push(nameNode);
  }
  
  await prisma.botConfig.update({ where: { accountId }, data: { flowGraph: graph } });
  console.log("Flow updated with Name node");
}
main().finally(() => prisma.$disconnect());
