const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/services/bot/flow.router.ts');
let code = fs.readFileSync(file, 'utf8');

const hookLogic = `
    // Guardar la variable
    metadata[varName] = finalValueToSave;
    
    // Auto-build carrito if the variable was 'cantidad'
    if (varName === 'cantidad') {
      const cantidadNum = parseInt(finalValueToSave);
      const itemSeleccionado = metadata['producto_elegido_item'];
      if (!isNaN(cantidadNum) && itemSeleccionado) {
        if (!Array.isArray(metadata.carrito)) metadata.carrito = [];
        const precioNum = parseFloat(itemSeleccionado.precio || 0);
        const subtotal = precioNum * cantidadNum;
        metadata.carrito.push({
          producto_id: itemSeleccionado.id,
          nombre: itemSeleccionado.nombre,
          precio: itemSeleccionado.precio,
          cantidad: cantidadNum,
          subtotal: subtotal
        });
        
        let resumen = '';
        let total = 0;
        metadata.carrito.forEach((p) => {
          resumen += p.cantidad + 'x ' + p.nombre + ' a $$' + p.precio + ' c/u\\n';
          total += p.subtotal;
        });
        resumen += '\\nTotal: $$' + total.toFixed(2);
        metadata.resumen_carrito = resumen;
      }
    }
`;

code = code.split('// Guardar la variable\n    metadata[varName] = finalValueToSave;').join(hookLogic.replace(/\$\$/g, '$'));
fs.writeFileSync(file, code);
console.log("Cart building logic injected.");
