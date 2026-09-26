const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;
  
  const ticketNode = graph.nodes.find(n => n.id === "node-cart-ticket");
  if (ticketNode) {
    ticketNode.text = "¡Perfecto {{nombre_cliente}}! Este es tu resumen:\n\n{{resumen_carrito}}";
    ticketNode.messages = [ticketNode.text];
  }
  
  const finalWebhook = graph.nodes.find(n => n.id === "node-webhook-final");
  if (finalWebhook) {
    finalWebhook.payloadTemplate = `{
  "telefono": "{{telefono}}",
  "nombre": "{{nombre_cliente}}",
  "direccion": "{{direccion_nueva}}",
  "detalle": {{carrito}}
}`;
  }
  
  await prisma.botConfig.update({
    where: { accountId: account.id },
    data: { flowGraph: graph }
  });
  console.log("Graph fixed for MULTI items!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
