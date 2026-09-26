const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;

  const finalWebhook = graph.nodes.find(n => n.id === "node-webhook-final");
  if (finalWebhook) {
    finalWebhook.payloadTemplate = `{
  "telefono": "{{telefono}}",
  "nombre": "{{nombre_cliente}}",
  "direccion": "{{direccion_nueva}}",
  "referencias": "{{referencias_nueva}}",
  "notas": "{{nota_pedido}}",
  "detalle": {{carrito}}
}`;
  }

  await prisma.botConfig.update({
    where: { accountId: account.id },
    data: { flowGraph: graph }
  });
  console.log("Webhook payload updated to use 'notas' instead of 'nota'!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
