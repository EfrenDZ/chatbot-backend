const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const node = account.botConfig.flowGraph.nodes.find(n => n.type === "WEBHOOK" && n.url === "/pedidos");
  
  // get sessions from last hour
  const sessions = await prisma.conversationSession.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5
  });
  
  for (const session of sessions) {
    const metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session.sessionMetadata || {});
    if (!metadata.telefono && !metadata.sender) continue; // skip empty
    
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
      return val !== undefined && val !== null ? String(val) : match;
    });
    
    console.log(`\n--- Session ${session.id} ---`);
    console.log(interpolated);
    try {
      JSON.parse(interpolated);
      console.log("JSON is valid!");
    } catch(e) {
      console.log("JSON is INVALIIIID:", e.message);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
