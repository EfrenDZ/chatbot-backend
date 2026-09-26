const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({ include: { botConfig: true } });
  const graph = account.botConfig.flowGraph;

  // New condition: check if direccion_nueva is already filled
  let checkAddress = graph.nodes.find(n => n.id === "node-check-address-filled");
  if (!checkAddress) {
    checkAddress = {
      id: "node-check-address-filled",
      type: "CONDITION",
      conditionVariable: "direccion_nueva", // if filled
      successNodeId: "node-cart-ticket-new",
      errorNodeId: "node-name-input",
      position: { x: 1200, y: 2300 }
    };
    graph.nodes.push(checkAddress);
  }

  // Update node-check-client-after-cart
  // If cliente.id exists -> node-cart-ticket (existing client)
  // If not -> check if address is already filled in session
  const checkClient = graph.nodes.find(n => n.id === "node-check-client-after-cart");
  if (checkClient) {
    checkClient.errorNodeId = "node-check-address-filled";
  }

  await prisma.botConfig.update({
    where: { accountId: account.id },
    data: { flowGraph: graph }
  });
  console.log("Loop condition fixed!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
