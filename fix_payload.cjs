const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;
  
  const webhookNode = graph.nodes.find(n => n.type === "WEBHOOK" && n.url === "/pedidos");
  if (webhookNode) {
    webhookNode.payloadTemplate = `{
  "telefono": "{{telefono}}",
  "nombre": "{{nombre_cliente}}",
  "direccion": "{{direccion_nueva}}",
  "detalle": "{{carrito}}"
}`;
    await prisma.botConfig.update({
      where: { accountId: account.id },
      data: { flowGraph: graph }
    });
    console.log("Payload Template updated!");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
