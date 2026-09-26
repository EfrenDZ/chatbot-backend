const metadata = require('./metadata.json');
const payloadTemplate = "{\n  \"carrito_actual\": {{carrito}},\n  \"accion\": \"agregar\",\n  \"producto_id\": \"{{producto_elegido}}\",\n  \"cantidad\": \"{{cantidad}}\",\n  \"producto_nombre\": \"{{producto_elegido_item.nombre}}\",\n  \"precio\": \"{{producto_elegido_item.precio}}\"\n}";

const payload = { ...metadata };

let interpolated = payloadTemplate.replace(/"\{\{([^}]+)\}\}"/g, (match, key) => {
  const path = key.trim();
  if (path === 'carrito' && metadata.carrito) return JSON.stringify(metadata.carrito);
  return match;
}).replace(/\{\{([^}]+)\}\}/g, (match, key) => {
  const path = key.trim();
  if (path === 'carrito' && metadata.carrito) return JSON.stringify(metadata.carrito);
  const val = path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, payload);
  return val !== undefined && val !== null ? String(val) : match;
});

console.log(interpolated);
