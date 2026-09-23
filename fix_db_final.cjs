const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "93e076e9-c540-4c1e-afe7-267d55c52856";
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  
  if (!config) return;

  // 1. Fix headers
  config.apiHeaders = {
    "x-api-key": "f19311ad821895465b1e45758440fc633dc576e6fb75485d1f63e3e94d88419b",
    "Bypass-Tunnel-Reminder": "true"
  };

  // 2. Fix Node URL in the flow graph
  const graph = config.flowGraph;
  for (const node of graph.nodes) {
    if (node.type === 'WEBHOOK') {
      if (node.url === '?action=contexto') {
        node.url = '/contexto';
      } else if (node.url === '?action=crear_pedido') {
        node.url = '/crear_pedido';
      }
    }
  }

  await prisma.botConfig.update({
    where: { accountId },
    data: { 
      apiHeaders: config.apiHeaders,
      flowGraph: graph 
    }
  });
  
  console.log('Fixed DB settings automatically.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
