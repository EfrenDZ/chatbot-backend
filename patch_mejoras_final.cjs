const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.botConfig.findFirst();
  let graph = config.flowGraph;

  const urlAguaCero = "http://localhost:8000"; // Cambiar por la url real si la tienen en config

  // 1. Modificar node-cart-ticket
  const ticketNodeIndex = graph.nodes.findIndex(n => n.id === 'node-cart-ticket');
  if (ticketNodeIndex !== -1) {
    const originalPos = graph.nodes[ticketNodeIndex].position;
    graph.nodes[ticketNodeIndex] = {
      id: "node-cart-ticket",
      type: "MENU",
      text: "Este es tu resumen:\n{{webhook.resumen_texto}}\n\n¿Qué deseas hacer?",
      messages: ["Este es tu resumen:\n{{webhook.resumen_texto}}\n\n¿Qué deseas hacer?"],
      position: originalPos,
      options: [
        { id: "opt-confirm", label: "Confirmar pedido", targetNodeId: "node-webhook-final" },
        { id: "opt-edit", label: "Editar carrito", targetNodeId: "node-edit-menu" },
        { id: "opt-cancel", label: "Cancelar pedido", targetNodeId: "node-cancel-wh" }
      ]
    };
  }

  // 2. Modificar el mensaje final de confirmacion
  const finalSuccessIndex = graph.nodes.findIndex(n => n.id === 'node-final-success');
  if (finalSuccessIndex !== -1) {
      graph.nodes[finalSuccessIndex].text = "¡Tu pedido ha sido confirmado con éxito! Va en camino a tu domicilio. Usa el código {{webhook.codigo_rastreo}} para rastrearlo.";
      graph.nodes[finalSuccessIndex].messages = [graph.nodes[finalSuccessIndex].text];
  }

  // 3. Crear nodos de Edicion
  const editNodes = [
    {
      id: "node-edit-menu",
      type: "MENU",
      text: "¿Qué cambio necesitas hacer?",
      messages: ["¿Qué cambio necesitas hacer?"],
      position: { x: 1900, y: 2500 },
      options: [
        { id: "opt-add-more", label: "Agregar otro producto", targetNodeId: "node-red-catalog" },
        { id: "opt-remove", label: "Eliminar producto", targetNodeId: "node-remove-input" }
      ]
    },
    {
      id: "node-remove-input",
      type: "INPUT",
      variableName: "producto_eliminar_id",
      text: "¿Cuál es el ID del producto que quieres eliminar?",
      messages: ["¿Cuál es el ID o número del producto que quieres eliminar?"],
      position: { x: 2200, y: 2500 },
      targetNodeId: "node-remove-wh"
    },
    {
      id: "node-remove-wh",
      type: "WEBHOOK",
      method: "POST",
      url: `${urlAguaCero}/api/webhooks/bot/carrito/editar`,
      payloadTemplate: "{\n  \"carrito_actual\": {{carrito}},\n  \"accion\": \"eliminar\",\n  \"producto_id\": \"{{producto_eliminar_id}}\"\n}",
      position: { x: 2500, y: 2500 },
      successNodeId: "node-cart-ticket",
      errorNodeId: "node-cart-ticket"
    },
    {
      id: "node-cancel-wh",
      type: "WEBHOOK",
      method: "POST",
      url: `${urlAguaCero}/api/webhooks/bot/carrito/editar`,
      payloadTemplate: "{\n  \"carrito_actual\": {{carrito}},\n  \"accion\": \"vaciar\"\n}",
      position: { x: 1900, y: 2800 },
      successNodeId: "node-cancel-msg",
      errorNodeId: "node-cancel-msg"
    },
    {
      id: "node-cancel-msg",
      type: "MESSAGE",
      text: "Tu carrito ha sido vaciado y el pedido cancelado.",
      messages: ["Tu carrito ha sido vaciado y el pedido cancelado."],
      position: { x: 2200, y: 2800 }
    }
  ];

  // 4. Agregar Webhook Add (para reemplazar el interceptor defectuoso y usar el backend)
  const addWhNode = {
      id: "node-add-wh",
      type: "WEBHOOK",
      method: "POST",
      url: `${urlAguaCero}/api/webhooks/bot/carrito/editar`,
      payloadTemplate: "{\n  \"carrito_actual\": {{carrito}},\n  \"accion\": \"agregar\",\n  \"producto_id\": \"{{producto_elegido}}\",\n  \"cantidad\": \"{{cantidad}}\",\n  \"producto_nombre\": \"{{producto_elegido_item.nombre}}\",\n  \"precio\": \"{{producto_elegido_item.precio}}\"\n}",
      position: { x: 700, y: 2200 },
      successNodeId: "node-cart-loop",
      errorNodeId: "node-cart-loop"
  };

  // Redirigir quantity al webhook de Add
  const qtyNode1 = graph.nodes.find(n => n.id === 'node-red-quantity');
  if (qtyNode1) qtyNode1.targetNodeId = 'node-add-wh';
  const qtyNode2 = graph.nodes.find(n => n.id === 'node-1790115906983');
  if (qtyNode2) qtyNode2.targetNodeId = 'node-add-wh';

  // Eliminar duplicados si el script se corre 2 veces
  graph.nodes = graph.nodes.filter(n => !editNodes.find(e => e.id === n.id) && n.id !== 'node-add-wh');
  graph.nodes.push(...editNodes, addWhNode);

  // 5. Agregar Rastreo al Menu Principal
  const rootNode = graph.nodes.find(n => n.id === graph.rootNodeId);
  if (rootNode && rootNode.options) {
      if (!rootNode.options.find(o => o.id === 'opt-rastreo')) {
          rootNode.options.push({
              id: 'opt-rastreo',
              label: "Buscar pedido",
              targetNodeId: "node-rastreo-input"
          });
      }
  }

  const rastreoNodes = [
      {
          id: "node-rastreo-input",
          type: "INPUT",
          variableName: "codigo_rastreo",
          text: "Ingresa tu código de rastreo (Ej. ACX7K9):",
          messages: ["Ingresa tu código de rastreo (Ej. ACX7K9):"],
          position: { x: 300, y: -200 },
          targetNodeId: "node-rastreo-wh"
      },
      {
          id: "node-rastreo-wh",
          type: "WEBHOOK",
          method: "POST",
          url: `${urlAguaCero}/api/webhooks/bot/pedidos/rastreo`,
          payloadTemplate: "{\n  \"codigo\": \"{{codigo_rastreo}}\"\n}",
          position: { x: 600, y: -200 },
          successNodeId: "node-rastreo-msg",
          errorNodeId: "node-rastreo-msg"
      },
      {
          id: "node-rastreo-msg",
          type: "MESSAGE",
          text: "{{webhook.mensaje}}",
          messages: ["{{webhook.mensaje}}"],
          position: { x: 900, y: -200 }
      }
  ];
  graph.nodes = graph.nodes.filter(n => !rastreoNodes.find(r => r.id === n.id));
  graph.nodes.push(...rastreoNodes);

  await prisma.botConfig.update({ where: { accountId: config.accountId }, data: { flowGraph: graph } });
  console.log("GRAFO ACTUALIZADO CORRECTAMENTE. (Rastreo y Edicion inyectados)");
}
main().finally(() => prisma.$disconnect());
