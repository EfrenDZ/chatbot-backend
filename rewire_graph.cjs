const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;

  // 1. node-horario-check (Condition: cliente.id)
  // Currently: success -> node-s-1790113969586, error -> node-name-input
  // We want: error -> node-1790115871394 (Catalog)
  const horarioCheck = graph.nodes.find(n => n.id === "node-horario-check");
  if (horarioCheck) {
    horarioCheck.errorNodeId = "node-1790115871394";
  }

  // 2. node-cart-loop (Menu: add another or finish)
  // Currently: opt-loop-no -> node-cart-ticket
  // We want: opt-loop-no -> node-check-client-after-cart (New Condition)
  const cartLoop = graph.nodes.find(n => n.id === "node-cart-loop");
  if (cartLoop) {
    const optNo = cartLoop.options.find(o => o.id === "opt-loop-no");
    if (optNo) optNo.targetNodeId = "node-check-client-after-cart";
  }

  // 3. Create new CONDITION node: node-check-client-after-cart
  // Condition: cliente.id
  // success -> node-cart-ticket
  // error -> node-name-input
  const newCondition = {
    id: "node-check-client-after-cart",
    type: "CONDITION",
    conditionVariable: "cliente.id",
    successNodeId: "node-cart-ticket",
    errorNodeId: "node-name-input",
    position: { x: 1200, y: 2200 }
  };
  // Only add if it doesn't exist
  if (!graph.nodes.find(n => n.id === "node-check-client-after-cart")) {
    graph.nodes.push(newCondition);
  }

  // 4. node-name-input targets node-e-1790113969586 (Address)
  // This is already correct.

  // 5. node-e-1790113969586 (Address) currently targets node-1790115871394 (Catalog)
  // We want it to target node-cart-ticket instead!
  const addressNode = graph.nodes.find(n => n.id === "node-e-1790113969586");
  if (addressNode) {
    addressNode.targetNodeId = "node-cart-ticket";
  }

  // 6. Update node-cart-ticket to include address
  const ticketNode = graph.nodes.find(n => n.id === "node-cart-ticket");
  if (ticketNode) {
    ticketNode.text = "¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}\n\nDirección de entrega: {{direccion_nueva}}";
    ticketNode.messages = [ticketNode.text];
  }

  await prisma.botConfig.update({
    where: { accountId: account.id },
    data: { flowGraph: graph }
  });
  console.log("Graph re-wired successfully!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
