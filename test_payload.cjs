const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const node = account.botConfig.flowGraph.nodes.find(n => n.type === "WEBHOOK" && n.url === "/pedidos");
  
  const session = await prisma.conversationSession.findFirst({
    orderBy: { updatedAt: 'desc' }
  });
  
  const metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session.sessionMetadata || {});
  let payload = { ...metadata };
  
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
  
  console.log("INTERPOLATED:\n" + interpolated);
  try {
    JSON.parse(interpolated);
    console.log("JSON is valid!");
  } catch(e) {
    console.log("JSON is invalid:", e.message);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
