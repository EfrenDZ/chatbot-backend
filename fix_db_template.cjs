const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  
  if (!config) return;

  const graph = config.flowGraph;
  for (const node of graph.nodes) {
    if (node.type === 'WEBHOOK' && (node.url === '/crear_pedido' || node.url === '?action=crear_pedido' || node.id === 'node-webhook-final')) {
      node.url = '/pedidos';
      node.payloadTemplate = `{
  "telefono": "{{telefono}}",
  "nombre": "{{sender.name}}",
  "direccion": "{{direccion_nueva}}",
  "detalle": [
    {
      "producto_id": "{{producto_elegido}}",
      "cantidad": {{cantidad}},
      "precio": "48.00"
    }
  ]
}`;
    }
  }

  await prisma.botConfig.update({
    where: { accountId },
    data: { flowGraph: graph }
  });
  
  console.log('Fixed DB template.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
