const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const session = await prisma.conversationSession.findFirst({
    where: { accountId: "93e076e9-c540-4c1e-afe7-267d55c52856" },
    orderBy: { updatedAt: 'desc' }
  });
  
  if (!session) return console.log("No session");
  
  const payloadTemplate = `{
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

  const metadata = typeof session.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : session.sessionMetadata;
  const payload = { ...metadata, telefono: "5215555555" };
  
  let interpolated = payloadTemplate.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const path = key.trim();
    const val = path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, payload);
    if (val === undefined || val === null) return "null";
    return String(val);
  });
  
  console.log("Interpolated JSON:\n", interpolated);
  
  try {
    JSON.parse(interpolated);
    console.log("\nJSON is VALID!");
  } catch(e) {
    console.log("\nJSON is INVALID:", e.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
