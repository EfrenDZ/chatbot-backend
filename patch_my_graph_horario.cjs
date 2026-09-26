const fs = require('fs');
const path = require('path');

async function main() {
  const graphPath = path.join(__dirname, 'my_graph.json');
  const graphData = fs.readFileSync(graphPath, 'utf-8');
  const graph = JSON.parse(graphData);

  // Define new nodes
  const nodeHorarioCheck = {
    id: "node-horario-check",
    type: "CONDITION",
    conditionVariable: "fuera_de_horario",
    conditionOperator: "equals",
    conditionValue: "true",
    successNodeId: "node-horario-cerrado", // if fuera_de_horario === true
    errorNodeId: "node-final-success",    // if fuera_de_horario === false
    position: { x: 1200, y: 3000 }
  };

  const nodeHorarioCerrado = {
    id: "node-horario-cerrado",
    type: "MESSAGE",
    text: "{{mensaje_horario}} (Código: {{codigo_rastreo}})",
    messages: [
      "{{mensaje_horario}}\nCódigo de rastreo: {{codigo_rastreo}}"
    ],
    position: { x: 1400, y: 3200 },
    targetNodeId: "node-horario-resolve"
  };

  const nodeHorarioResolve = {
    id: "node-horario-resolve",
    type: "RESOLVE",
    text: "Cerrando ticket por horario",
    messages: [],
    position: { x: 1400, y: 3400 }
  };

  const nodeFinalSuccessNew = {
    id: "node-final-success",
    text: "{{datos_normales}}",
    type: "MESSAGE",
    messages: [
      "{{datos_normales}}"
    ],
    position: { x: 1000, y: 3200 },
    targetNodeId: "node-horario-resolve"
  };

  // Add the new nodes (remove old node-final-success if it exists)
  graph.nodes = graph.nodes.filter(n => n.id !== 'node-final-success');
  graph.nodes.push(nodeHorarioCheck, nodeHorarioCerrado, nodeHorarioResolve, nodeFinalSuccessNew);

  // Update webhooks to point success to node-horario-check
  graph.nodes.forEach(n => {
    if (n.type === 'WEBHOOK' && n.url === '/pedidos') {
      n.successNodeId = 'node-horario-check';
    }
  });

  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  console.log("Graph patched successfully with condition node.");
}

main().catch(console.error);
