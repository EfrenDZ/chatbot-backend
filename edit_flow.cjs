const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  let graph = config.flowGraph;

  // 1. Find relevant nodes
  const quantityNode = graph.nodes.find(n => n.variableName === 'cantidad');
  const catalogNode = graph.nodes.find(n => n.type === 'DYNAMIC_MENU');
  const webhookNode = graph.nodes.find(n => n.id === 'node-webhook-final');

  if (!quantityNode || !catalogNode || !webhookNode) {
    console.log("Missing key nodes. Cannot edit automatically.");
    return;
  }

  // 2. Create the Loop Menu node
  const loopMenuNode = {
    id: "node-cart-loop",
    type: "MENU",
    text: "¿Deseas agregar otro producto a tu pedido?",
    messages: ["¿Deseas agregar otro producto a tu pedido?"],
    position: { x: quantityNode.position.x, y: quantityNode.position.y + 200 },
    options: [
      { id: "opt-loop-yes", label: "Sí, agregar otro", targetNodeId: catalogNode.id },
      { id: "opt-loop-no", label: "No, finalizar pedido", targetNodeId: "node-cart-ticket" }
    ]
  };

  // 3. Create the Ticket Summary Message node
  const ticketNode = {
    id: "node-cart-ticket",
    type: "MESSAGE",
    text: "¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}",
    messages: ["¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}"],
    position: { x: quantityNode.position.x, y: quantityNode.position.y + 400 },
    targetNodeId: webhookNode.id
  };

  // 4. Update the Quantity node to point to the Loop Menu
  quantityNode.targetNodeId = loopMenuNode.id;

  // 5. Shift Webhook node down and update its JSON Template
  webhookNode.position = { x: quantityNode.position.x, y: quantityNode.position.y + 600 };
  webhookNode.payloadTemplate = `{
  "telefono": "{{telefono}}",
  "nombre": "{{nombre_cliente}}",
  "direccion": "{{direccion_nueva}}",
  "ubicacion": "",
  "detalle": {{carrito}}
}`;

  // 6. Push new nodes to the graph (filter out any old duplicates if I re-run this)
  graph.nodes = graph.nodes.filter(n => n.id !== "node-cart-loop" && n.id !== "node-cart-ticket");
  graph.nodes.push(loopMenuNode);
  graph.nodes.push(ticketNode);

  await prisma.botConfig.update({ where: { accountId }, data: { flowGraph: graph } });
  console.log("SUCCESS: Flow updated successfully with Cart Loop, Ticket, and Webhook Template!");
}

main().finally(() => prisma.$disconnect());
