const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const node = account.botConfig.flowGraph.nodes.find(n => n.type === "WEBHOOK" && n.url === "/pedidos");
  
  const session = await prisma.conversationSession.findFirst({
    where: { currentNodeId: { in: ['node-e-1790113889755', 'node-final-error', 'node-s-1790113889755', 'node-webhook-final', 'node-horario-check'] } },
    orderBy: { updatedAt: 'desc' }
  });
  
  const metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session.sessionMetadata || {});
  
  let payload = { 
    ...metadata, 
    telefono: metadata.sender?.phone_number || session.contactIdentifier,
    nombre: metadata.nombre_cliente || metadata.sender?.name,
    direccion_nueva: metadata.direccion_nueva || metadata.cliente?.direccion
  };
  
  let interpolated = node.payloadTemplate.replace(/"\{\{([^}]+)\}\}"/g, (match, key) => {
    const path = key.trim();
    if (path === 'carrito' && metadata.carrito) return JSON.stringify(metadata.carrito);
    return match;
  }).replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const path = key.trim();
    if (path === 'carrito' && metadata.carrito) return JSON.stringify(metadata.carrito);
    const val = path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, payload);
    return val !== undefined && val !== null ? String(val) : 'null';
  });
  
  console.log(interpolated);
}
main().catch(console.error).finally(() => prisma.$disconnect());
