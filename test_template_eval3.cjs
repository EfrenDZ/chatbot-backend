const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const session = await prisma.conversationSession.findFirst({
    where: { accountId: "93e076e9-c540-4c1e-afe7-267d55c52856" },
    orderBy: { updatedAt: 'desc' }
  });
  
  const config = await prisma.botConfig.findUnique({ where: { accountId: "93e076e9-c540-4c1e-afe7-267d55c52856" } });
  let payloadTemplate = "";
  for (const node of config.flowGraph.nodes) {
    if (node.type === 'WEBHOOK' && (node.url === '/pedidos' || node.url === '/crear_pedido' || node.id === 'node-webhook-final')) {
      payloadTemplate = node.payloadTemplate || '';
      console.log("Found template on node:", node.id, "url:", node.url);
    }
  }
  
  if (!payloadTemplate) {
    console.log("NO TEMPLATE IN DB!");
    return;
  }

  const metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : session.sessionMetadata;
  const payload = { ...metadata, telefono: "5215555555", nombre: "Pruebas" };
  
  let interpolated = payloadTemplate.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const path = key.trim();
    const val = path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, payload);
    if (val === undefined || val === null) return "null";
    return String(val);
  });
  
  console.log("Interpolated JSON:\n", interpolated);
}

main().catch(console.error).finally(() => prisma.$disconnect());
