const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const node = account.botConfig.flowGraph.nodes.find(n => n.type === "WEBHOOK" && n.url === "/pedidos");
  
  const sessions = await prisma.conversationSession.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 3
  });
  
  for (const session of sessions) {
    const metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session.sessionMetadata || {});
    
    let telefono = session.contactIdentifier;
    let nombre = metadata.nombre_cliente || 'Usuario';
    const payload = { ...metadata, telefono, nombre, nombre_cliente: nombre };
    
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
}
main().catch(console.error).finally(() => prisma.$disconnect());
