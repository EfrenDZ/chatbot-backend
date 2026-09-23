const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accountId = "1319c5c7-024c-47fc-bad7-ef40a6b7d19c"; // From the db output
  const config = await prisma.botConfig.findUnique({ where: { accountId } });
  
  if (!config) { console.log('Config not found'); return; }

  const graph = config.flowGraph;
  
  // We want to fix the Red Branch (node-e-1790113969586)
  const redNodeIndex = graph.nodes.findIndex(n => n.id === "node-e-1790113969586");
  
  if (redNodeIndex >= 0) {
    graph.nodes[redNodeIndex] = {
      "id": "node-e-1790113969586",
      "text": "¡Hola! Veo que es tu primer pedido. Para poder registrarte y enviar tu agua, ¿cuál es tu dirección completa y referencias?",
      "type": "INPUT",
      "messages": [
        "¡Hola! Veo que es tu primer pedido. Para poder registrarte y enviar tu agua, ¿cuál es tu dirección completa y referencias?"
      ],
      "variableName": "direccion_nueva",
      "targetNodeId": "node-red-catalog"
    };

    // Red Catalog
    graph.nodes.push({
      "id": "node-red-catalog",
      "text": "¡Perfecto! Aquí tienes nuestros productos disponibles hoy:",
      "type": "DYNAMIC_MENU",
      "messages": [
        "¡Perfecto! Aquí tienes nuestros productos disponibles hoy:"
      ],
      "valueKey": "id",
      "variableName": "producto_elegido",
      "arrayVariable": "catalogo",
      "titleTemplate": "{{nombre}} - ${{precio}}",
      "targetNodeId": "node-red-quantity"
    });

    // Red Quantity
    graph.nodes.push({
      "id": "node-red-quantity",
      "text": "Excelente elección. ¿Cuántos vas a querer?",
      "type": "INPUT",
      "messages": [
        "Excelente elección. ¿Cuántos vas a querer?"
      ],
      "variableName": "cantidad",
      "targetNodeId": "node-webhook-final" // shared
    });
  }

  // Find the end of the Green Branch Option 2 (node-1790116158229)
  const greenEndIndex = graph.nodes.findIndex(n => n.id === "node-1790116158229");
  if (greenEndIndex >= 0) {
    graph.nodes[greenEndIndex].targetNodeId = "node-webhook-final"; // Link to the same final webhook
    // Actually, node-1790116158229 is a MESSAGE. It shouldn't be a MESSAGE if it needs to trigger a webhook next.
    // Wait, let's just make it a webhook.
    graph.nodes[greenEndIndex] = {
      "id": "node-1790116158229",
      "text": "Confirmando pedido...",
      "type": "WEBHOOK",
      "messages": ["Confirmando pedido..."],
      "url": "?action=crear_pedido",
      "method": "POST",
      "successNodeId": "node-final-success",
      "errorNodeId": "node-final-error"
    };
  }
  
  // Also fix "Lo mismo de siempre"
  const loMismoIndex = graph.nodes.findIndex(n => n.id === "node-1790114024125");
  if (loMismoIndex >= 0) {
    graph.nodes[loMismoIndex] = {
      "id": "node-1790114024125",
      "text": "Creando pedido...",
      "type": "WEBHOOK",
      "messages": ["Creando pedido..."],
      "url": "?action=crear_pedido",
      "method": "POST",
      "successNodeId": "node-final-success",
      "errorNodeId": "node-final-error"
    };
  }

  // The final Webhook for the Red path
  graph.nodes.push({
    "id": "node-webhook-final",
    "text": "Creando pedido...",
    "type": "WEBHOOK",
    "messages": ["Creando pedido..."],
    "url": "?action=crear_pedido",
    "method": "POST",
    "successNodeId": "node-final-success",
    "errorNodeId": "node-final-error"
  });

  // Final Success and Error
  graph.nodes.push({
    "id": "node-final-success",
    "text": "¡Tu pedido ha sido confirmado con éxito! Va en camino a tu domicilio. ¡Gracias por elegir AguaCero!",
    "type": "MESSAGE",
    "messages": ["¡Tu pedido ha sido confirmado con éxito! Va en camino a tu domicilio. ¡Gracias por elegir AguaCero!"]
  });
  
  graph.nodes.push({
    "id": "node-final-error",
    "text": "Hubo un problema procesando tu pedido. Por favor intenta de nuevo en unos minutos o escribe 'humano'.",
    "type": "MESSAGE",
    "messages": ["Hubo un problema procesando tu pedido. Por favor intenta de nuevo en unos minutos o escribe 'humano'."]
  });

  await prisma.botConfig.update({
    where: { accountId },
    data: { flowGraph: graph }
  });
  
  console.log('Flow injected successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
