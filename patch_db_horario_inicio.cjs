const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  if (!config) {
    console.log("No config found in db!");
    return;
  }
  const graph = config.flowGraph;
  
  // 1. Encontrar el nodo del webhook /contexto
  const contextoNode = graph.nodes.find(n => n.type === 'WEBHOOK' && n.url === '/contexto');
  if (!contextoNode) {
    console.log("No se encontró el nodo /contexto");
    return;
  }

  // Guardamos a donde iba originalmente (normalmente "node-s-1790113889755")
  const originalSuccess = contextoNode.successNodeId;

  // 2. Apuntar el éxito del webhook a nuestra nueva validación
  contextoNode.successNodeId = "node-contexto-horario-check";

  // 3. Crear los nuevos nodos
  const nodeHorarioCheck = {
    id: "node-contexto-horario-check",
    type: "CONDITION",
    conditionVariable: "fuera_de_horario",
    conditionOperator: "equals",
    conditionValue: "true",
    successNodeId: "node-horario-aviso",    // Si está cerrado
    errorNodeId: originalSuccess,           // Si está abierto, sigue normal
    position: { x: contextoNode.position.x + 200, y: contextoNode.position.y }
  };

  const nodeHorarioAviso = {
    id: "node-horario-aviso",
    type: "MENU",
    text: "Aviso de Horario",
    messages: [
      "Actualmente nos encontramos fuera de horario laboral o en día festivo.",
      "Si gustas, podemos registrar tu pedido de una vez y quedará agendado automáticamente para salir a primera hora nuestro próximo día hábil. ¿Deseas continuar?"
    ],
    options: [
      { id: "opt-horario-si", label: "Sí, agendar pedido", targetNodeId: originalSuccess },
      { id: "opt-horario-no", label: "No, cancelar", targetNodeId: "node-horario-cancelado" }
    ],
    position: { x: contextoNode.position.x + 400, y: contextoNode.position.y }
  };

  const nodeHorarioCancelado = {
    id: "node-horario-cancelado",
    type: "MESSAGE",
    text: "Entendido. Estaremos encantados de atenderte cuando regresemos. ¡Hasta pronto!",
    messages: ["Entendido. Estaremos encantados de atenderte cuando regresemos. ¡Hasta pronto!"],
    targetNodeId: "node-horario-resolve",
    position: { x: contextoNode.position.x + 600, y: contextoNode.position.y }
  };

  // El nodo node-horario-resolve ya fue creado en el parche anterior, pero si no está lo creamos
  let resolveNode = graph.nodes.find(n => n.id === "node-horario-resolve");
  if (!resolveNode) {
    resolveNode = {
      id: "node-horario-resolve",
      type: "RESOLVE",
      text: "Cerrando ticket por horario",
      messages: [],
      position: { x: contextoNode.position.x + 800, y: contextoNode.position.y }
    };
    graph.nodes.push(resolveNode);
  }

  // Filtrar si ya existían para reemplazarlos (idempotencia)
  graph.nodes = graph.nodes.filter(n => !["node-contexto-horario-check", "node-horario-aviso", "node-horario-cancelado"].includes(n.id));
  
  graph.nodes.push(nodeHorarioCheck, nodeHorarioAviso, nodeHorarioCancelado);

  // Guardar en Prisma
  await prisma.botConfig.update({
    where: { accountId: config.accountId },
    data: { flowGraph: graph }
  });

  // Guardar copia local por referencia
  const graphPath = path.join(__dirname, 'my_graph.json');
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

  console.log("DB updated with frontend schedule check!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
