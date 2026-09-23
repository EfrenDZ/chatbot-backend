const payloadTemplate = `{
  "telefono": "{{telefono}}",
  "nombre": "{{nombre}}",
  "direccion": "{{direccion_nueva}}",
  "detalle": [
    {
      "producto_id": {{producto_elegido}},
      "cantidad": {{cantidad}},
      "precio": "48.00"
    }
  ]
}`;
const payload = { telefono: "5215555555", nombre: "Efren", direccion_nueva: "Calle", producto_elegido: 3, cantidad: 3 };
let interpolated = payloadTemplate.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const path = key.trim();
    const val = path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : undefined, payload);
    if (val === undefined || val === null) return "null";
    return String(val);
  });
console.log(interpolated);
console.log("Parses:", typeof JSON.parse(interpolated));
