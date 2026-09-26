const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;

  // Existing clients go straight to node-cart-ticket
  const checkClient = graph.nodes.find(n => n.id === "node-check-client-after-cart");
  if (checkClient) {
    checkClient.successNodeId = "node-cart-ticket";
    checkClient.errorNodeId = "node-name-input";
  }

  // Restore node-cart-ticket for EXISTING clients
  const ticketExisting = graph.nodes.find(n => n.id === "node-cart-ticket");
  if (ticketExisting) {
    ticketExisting.text = "¡Perfecto! Este es tu resumen:\n\n{{resumen_carrito}}";
    ticketExisting.messages = [ticketExisting.text];
    ticketExisting.targetNodeId = "node-webhook-final";
  }

  // Create new ticket for NEW clients
  let ticketNew = graph.nodes.find(n => n.id === "node-cart-ticket-new");
  if (!ticketNew) {
    ticketNew = {
      id: "node-cart-ticket-new",
      type: "MESSAGE",
      text: "¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}\n\nDirección de entrega: {{direccion_nueva}}",
      messages: ["¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}\n\nDirección de entrega: {{direccion_nueva}}"],
      targetNodeId: "node-webhook-final",
      position: { x: 1200, y: 1400 }
    };
    graph.nodes.push(ticketNew);
  }

  // Route Address node to the NEW ticket
  const addressNode = graph.nodes.find(n => n.id === "node-e-1790113969586");
  if (addressNode) {
    addressNode.targetNodeId = "node-cart-ticket-new";
  }

  // Wait, does existing client have `nombre_cliente`?
  // They have `cliente.nombre`. The old ticket was "¡Perfecto {{nombre_cliente}}!".
  // We can just use "¡Perfecto {{cliente.nombre}}!" for existing clients.
  if (ticketExisting) {
    ticketExisting.text = "¡Perfecto {{cliente.nombre}}! Este es tu resumen:\n\n{{resumen_carrito}}";
    ticketExisting.messages = [ticketExisting.text];
  }

  await prisma.botConfig.update({
    where: { accountId: account.id },
    data: { flowGraph: graph }
  });
  console.log("Perfect wiring applied!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
