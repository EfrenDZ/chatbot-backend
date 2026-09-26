const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;

  // 1. Rename existing 'direccion' node to just ask for 'direccion'
  const addressNode = graph.nodes.find(n => n.id === "node-e-1790113969586");
  if (addressNode) {
    addressNode.text = "Gracias {{nombre_cliente}}, ahora dime ¿cuál es tu dirección? (Calle, número y colonia)";
    addressNode.messages = [addressNode.text];
    addressNode.targetNodeId = "node-ref-input"; // Point to new Ref node
  }

  // 2. Create new Reference node
  let refNode = graph.nodes.find(n => n.id === "node-ref-input");
  if (!refNode) {
    refNode = {
      id: "node-ref-input",
      type: "INPUT",
      text: "¡Anotado! Ahora por favor escribe algunas referencias (ej. portón blanco, entre calles X y Y):",
      messages: ["¡Anotado! Ahora por favor escribe algunas referencias (ej. portón blanco, entre calles X y Y):"],
      targetNodeId: "node-cart-ticket-new",
      variableName: "referencias_nueva",
      position: { x: 1010, y: 1300 }
    };
    graph.nodes.push(refNode);
  }

  // 3. Update Tickets to show the new summary and target the new Review Menu
  // For existing clients:
  const ticketExisting = graph.nodes.find(n => n.id === "node-cart-ticket");
  if (ticketExisting) {
    ticketExisting.text = "¡Perfecto {{cliente.nombre}}! Este es tu resumen:\n\n{{resumen_carrito}}";
    ticketExisting.messages = [ticketExisting.text];
    ticketExisting.targetNodeId = "node-review-menu";
  }

  // For new clients:
  const ticketNew = graph.nodes.find(n => n.id === "node-cart-ticket-new");
  if (ticketNew) {
    ticketNew.text = "¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}\n\nDirección: {{direccion_nueva}}\nReferencias: {{referencias_nueva}}";
    ticketNew.messages = [ticketNew.text];
    ticketNew.targetNodeId = "node-review-menu";
  }

  // 4. Create Review Menu (Send, Edit Address, Add Note)
  let reviewMenu = graph.nodes.find(n => n.id === "node-review-menu");
  if (!reviewMenu) {
    reviewMenu = {
      id: "node-review-menu",
      type: "MENU",
      text: "¿Todo listo para enviar tu pedido?",
      messages: ["¿Todo listo para enviar tu pedido?"],
      position: { x: 1400, y: 2600 },
      options: [
        { id: "opt-review-send", label: "Enviar pedido", targetNodeId: "node-webhook-final" },
        { id: "opt-review-edit-address", label: "Editar dirección", targetNodeId: "node-e-1790113969586" }, // Goes back to address
        { id: "opt-review-add-note", label: "Agregar nota", targetNodeId: "node-note-input" },
        { id: "opt-review-edit-cart", label: "Editar pedido", targetNodeId: "node-red-catalog" }
      ]
    };
    graph.nodes.push(reviewMenu);
  }

  // 5. Create Note Input node
  let noteNode = graph.nodes.find(n => n.id === "node-note-input");
  if (!noteNode) {
    noteNode = {
      id: "node-note-input",
      type: "INPUT",
      text: "Escribe la nota para tu pedido:",
      messages: ["Escribe la nota para tu pedido:"],
      targetNodeId: "node-review-ticket", // Send them to a combined ticket to review again
      variableName: "nota_pedido",
      position: { x: 1200, y: 2700 }
    };
    graph.nodes.push(noteNode);
  }

  // 6. Create Review Ticket (After Edit)
  let reviewTicket = graph.nodes.find(n => n.id === "node-review-ticket");
  if (!reviewTicket) {
    reviewTicket = {
      id: "node-review-ticket",
      type: "MESSAGE",
      text: "Resumen actualizado:\n\n{{resumen_carrito}}\n\nDirección: {{direccion_nueva}}\nReferencias: {{referencias_nueva}}\nNota: {{nota_pedido}}",
      messages: ["Resumen actualizado:\n\n{{resumen_carrito}}\n\nDirección: {{direccion_nueva}}\nReferencias: {{referencias_nueva}}\nNota: {{nota_pedido}}"],
      targetNodeId: "node-review-menu",
      position: { x: 1400, y: 2800 }
    };
    graph.nodes.push(reviewTicket);
  }

  // 7. Update Webhook to include References and Notes
  const finalWebhook = graph.nodes.find(n => n.id === "node-webhook-final");
  if (finalWebhook) {
    finalWebhook.payloadTemplate = `{
  "telefono": "{{telefono}}",
  "nombre": "{{nombre_cliente}}",
  "direccion": "{{direccion_nueva}}",
  "referencias": "{{referencias_nueva}}",
  "nota": "{{nota_pedido}}",
  "detalle": {{carrito}}
}`;
  }

  await prisma.botConfig.update({
    where: { accountId: account.id },
    data: { flowGraph: graph }
  });
  console.log("Graph updated with References and Review Menu!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
