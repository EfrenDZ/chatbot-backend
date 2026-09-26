const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  let graph = config.flowGraph;

  // 1. Ensure both quantity nodes point to node-cart-loop
  const qNew = graph.nodes.find(n => n.id === 'node-red-quantity');
  if (qNew) qNew.targetNodeId = 'node-cart-loop';

  const qReturning = graph.nodes.find(n => n.id === 'node-1790115906983');
  if (qReturning) qReturning.targetNodeId = 'node-cart-loop';

  // 2. Ensure node-cart-loop exists and options point properly
  let loopNode = graph.nodes.find(n => n.id === 'node-cart-loop');
  if (!loopNode) {
    loopNode = {
      id: "node-cart-loop",
      type: "MENU",
      text: "¿Deseas agregar otro producto a tu pedido?",
      messages: ["¿Deseas agregar otro producto a tu pedido?"],
      position: { x: 760, y: 2200 },
      options: [
        { id: "opt-loop-yes", label: "Sí, agregar otro", targetNodeId: "node-red-catalog" },
        { id: "opt-loop-no", label: "No, finalizar pedido", targetNodeId: "node-cart-ticket" }
      ]
    };
    graph.nodes.push(loopNode);
  } else {
    loopNode.options = [
      { id: "opt-loop-yes", label: "Sí, agregar otro", targetNodeId: "node-red-catalog" },
      { id: "opt-loop-no", label: "No, finalizar pedido", targetNodeId: "node-cart-ticket" }
    ];
  }

  // 3. Ensure node-cart-ticket points to node-webhook-final
  let ticketNode = graph.nodes.find(n => n.id === 'node-cart-ticket');
  if (!ticketNode) {
    ticketNode = {
      id: "node-cart-ticket",
      type: "MESSAGE",
      text: "¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}",
      messages: ["¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}"],
      position: { x: 760, y: 2400 },
      targetNodeId: "node-webhook-final"
    };
    graph.nodes.push(ticketNode);
  } else {
    ticketNode.targetNodeId = "node-webhook-final";
    ticketNode.text = "¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}";
    ticketNode.messages = ["¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}"];
  }

  // 4. Update webhook node
  const webhookNode = graph.nodes.find(n => n.id === 'node-webhook-final');
  if (webhookNode) {
    webhookNode.payloadTemplate = `{
  "telefono": "{{telefono}}",
  "nombre": "{{nombre_cliente}}",
  "direccion": "{{direccion_nueva}}",
  "ubicacion": "",
  "detalle": {{carrito}}
}`;
  }

  await prisma.botConfig.update({ where: { accountId }, data: { flowGraph: graph } });
  console.log("Successfully wired node-red-quantity -> node-cart-loop -> node-cart-ticket -> node-webhook-final");
}

main().finally(() => prisma.$disconnect());
