import { ConversationSession } from '@prisma/client';
import { Account, prisma } from './types';
import { AiService } from '../ai.service';
import { ChatwootService } from '../chatwoot.service';
import { FlowRouter } from './flow.router';

export class AiOrchestrator {
  static buildSystemPrompt(config: any, sessionMetadata?: any): string {
    if (config.aiPromptMode === 'FREE') {
      return config.systemPrompt || '';
    }

    const knowledge = config.aiKnowledge as any || {};
    let promptParts = [];
    
    promptParts.push(`ERES el asistente virtual de: ${knowledge.businessName || 'esta empresa'}.`);
    
    if (knowledge.businessDescription) {
      promptParts.push(`DESCRIPCIÓN DE LA EMPRESA:\n${knowledge.businessDescription}`);
    }
    
    if (knowledge.tone) {
      promptParts.push(`TONO DE CONVERSACIÓN:\nDebes responder con un tono: ${knowledge.tone}.`);
    }

    if (knowledge.rules && knowledge.rules.length > 0) {
      promptParts.push(`REGLAS DE OBLIGATORIO CUMPLIMIENTO:\n${knowledge.rules.map((r: string) => `- ${r}`).join('\n')}`);
    }

    const dynamicCatalog = sessionMetadata?.catalogo;
    const effectiveCatalog = (dynamicCatalog && Array.isArray(dynamicCatalog) && dynamicCatalog.length > 0)
      ? dynamicCatalog.map((c: any) => ({
          id: c.id,
          name: c.nombre || c.name,
          price: c.precio ?? c.price,
          description: c.es_exclusivo ? 'Precio especial exclusivo para este cliente' : (c.description || '')
        }))
      : (knowledge.catalog || []);

    if (effectiveCatalog.length > 0) {
      const catText = effectiveCatalog.map((c: any) => `- Producto/Servicio: ${c.name}\n  Precio: $${c.price}\n  Detalles: ${c.description || 'Sin descripción adicional'}`).join('\n\n');
      promptParts.push(`CATÁLOGO DE PRODUCTOS / SERVICIOS:\n${catText}`);
    }

    if (knowledge.faqs && knowledge.faqs.length > 0) {
      const faqText = knowledge.faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
      promptParts.push(`PREGUNTAS FRECUENTES:\n${faqText}`);
    }

    if (knowledge.branches && knowledge.branches.length > 0) {
      const branchesText = knowledge.branches.map((b: any) => `- Sucursal: ${b.name}\n  Horario: ${b.schedule}\n  Ubicación/Maps: ${b.mapsLink}`).join('\n\n');
      promptParts.push(`NUESTRAS SUCURSALES:\n${branchesText}`);
    }

    if (knowledge.extraContext) {
      promptParts.push(`CONTEXTO ADICIONAL:\n${knowledge.extraContext}`);
    }

    if (sessionMetadata) {
      let metaParts = [];
      if (sessionMetadata.cliente) {
        const cl = sessionMetadata.cliente;
        metaParts.push(`- Nombre del cliente: ${cl.nombre || 'No registrado'}`);
        if (cl.direccion_predeterminada || cl.direccion) {
          metaParts.push(`- Dirección habitual registrada: ${cl.direccion_predeterminada || cl.direccion}`);
        }
        if (cl.referencias_predeterminadas || cl.referencias) {
          metaParts.push(`- Referencias registradas: ${cl.referencias_predeterminadas || cl.referencias}`);
        }
      }
      if (sessionMetadata.ultimo_pedido) {
        const up = sessionMetadata.ultimo_pedido;
        let resumen = '';
        if (up.detalles && Array.isArray(up.detalles) && up.detalles.length > 0) {
          resumen = up.detalles.map((d: any) => {
            const qty = d.cantidad || 1;
            const price = parseFloat(d.precio || 0);
            const subtotal = price * qty;
            const subtotalStr = Number.isInteger(subtotal) ? subtotal.toString() : subtotal.toFixed(2);
            return `• ${qty}x ${d.nombre_producto || d.producto_nombre || 'Producto'} - $${subtotalStr}`;
          }).join('\n');
          if (up.detalles.length > 1 && up.total) {
            const tot = parseFloat(up.total);
            resumen += `\n• Total: $${Number.isInteger(tot) ? tot.toString() : tot.toFixed(2)}`;
          }
        } else if (up.resumen_texto) {
          resumen = up.resumen_texto;
        }
        if (resumen && resumen.trim().length > 0) {
          metaParts.push(`- ÚLTIMO PEDIDO HABITUAL REGISTRADO (OFRÉCELE ESTOS PRODUCTOS EXACTOS CON ESTE FORMATO EN VIÑETA Y CON SU PRECIO TOTAL):\n${resumen}`);
        }
      }
      if (sessionMetadata.pedidos_activos && Array.isArray(sessionMetadata.pedidos_activos) && sessionMetadata.pedidos_activos.length > 0) {
        const pText = sessionMetadata.pedidos_activos.map((p: any) => 
          `* Pedido #${p.id || ''} (Código: ${p.codigo_rastreo || p.codigo || 'N/A'}) - Productos: ${p.resumen_productos || 'Productos'} - Total: $${p.total} | Estado: ${p.estado_texto || (p.repartidor_asignado ? 'En camino' : 'Pendiente')} ${p.fecha_programada ? `| Fecha programada: ${p.fecha_programada}` : ''} | Dirección de entrega: ${p.ubicacion || p.direccion || 'Dirección registrada'}`
        ).join('\n');
        metaParts.push(`- PEDIDOS ACTIVOS O PROGRAMADOS DEL CLIENTE (¡EL CLIENTE YA TIENE UN PEDIDO REGISTRADO!):\n${pText}`);
      }
      if (sessionMetadata.estado_operativo) {
        let opText = `- ESTADO OPERATIVO DEL NEGOCIO: ${sessionMetadata.estado_operativo}\n`;
        opText += `  * Día y hora actual: ${sessionMetadata.dia_actual || ''} ${sessionMetadata.fecha_actual || ''} (${sessionMetadata.hora_actual || ''})\n`;
        if (sessionMetadata.horario_hoy) {
          opText += `  * Horario de hoy (${sessionMetadata.dia_actual}): ${sessionMetadata.horario_hoy.laborable ? `Apertura ${sessionMetadata.horario_hoy.hora_inicio} - Corte pedidos ${sessionMetadata.horario_hoy.hora_corte}` : 'Día de descanso (no laborable)'}\n`;
        }
        if (sessionMetadata.mensaje_estado) {
          opText += `  * Mensaje del estado: "${sessionMetadata.mensaje_estado}"\n`;
        }
        if (sessionMetadata.instruccion_horario) {
          opText += `  * Instrucción de atención: ${sessionMetadata.instruccion_horario}\n`;
        }
        if (sessionMetadata.proximo_dia_habil) {
          opText += `  * Próximo día hábil de entrega: ${sessionMetadata.proximo_dia_habil.dia_nombre} ${sessionMetadata.proximo_dia_habil.fecha} (Apertura ${sessionMetadata.proximo_dia_habil.hora_inicio})\n`;
        }
        if (sessionMetadata.fecha_programada_sugerida) {
          opText += `  * Fecha programada sugerida: ${sessionMetadata.fecha_programada_sugerida}\n`;
        }
        if (sessionMetadata.aviso_proximo_festivo) {
          opText += `  * AVISO PRÓXIMO FESTIVO: ${sessionMetadata.aviso_proximo_festivo.mensaje}\n`;
        }
        metaParts.push(opText.trim());
      } else if (sessionMetadata.fuera_de_horario) {
        metaParts.push(`- AVISO DE HORARIO: Actualmente estamos cerrados. Próximo día hábil: ${sessionMetadata.mensaje_horario || 'el siguiente día laboral'}. Si el cliente pide productos, aclárale que su entrega se agendará para ese horario.`);
      }
      if (sessionMetadata.todos_los_horarios && Array.isArray(sessionMetadata.todos_los_horarios) && sessionMetadata.todos_los_horarios.length > 0) {
        const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const horariosText = sessionMetadata.todos_los_horarios.map((h: any) => {
          const dia = diasNombres[h.dia_semana] !== undefined ? diasNombres[h.dia_semana] : `Día ${h.dia_semana}`;
          if (!h.laborable) {
            return `  * ${dia}: Cerrado (Día de descanso)`;
          }
          return `  * ${dia}: Abierto de ${h.hora_inicio || '08:00'} a corte de recepción de pedidos a las ${h.hora_corte || '15:00'}`;
        }).join('\n');
        metaParts.push(`- HORARIOS SEMANALES COMPLETOS DE SERVICIO:\n${horariosText}`);
      }
      if (sessionMetadata.dias_festivos && Array.isArray(sessionMetadata.dias_festivos) && sessionMetadata.dias_festivos.length > 0) {
        const festivosText = sessionMetadata.dias_festivos.map((f: any) => {
          return `  * Fecha: ${f.fecha} (${f.descripcion || 'Día Festivo'}) - ${f.pausar_reparto ? 'No laborable / Sin reparto' : 'Horario especial'}${f.mensaje_bot ? ` | Mensaje: "${f.mensaje_bot}"` : ''}`;
        }).join('\n');
        metaParts.push(`- DÍAS FESTIVOS REGISTRADOS:\n${festivosText}`);
      }
      if (sessionMetadata.ultimo_repartidor) {
        metaParts.push(`- CHOFER HABITUAL DEL CLIENTE: ${sessionMetadata.ultimo_repartidor.nombre} (ID: ${sessionMetadata.ultimo_repartidor.id})`);
      }
      if (metaParts.length > 0) {
        promptParts.push(`INFORMACIÓN Y CONTEXTO DEL CLIENTE ACTUAL:\n${metaParts.join('\n')}`);
      }
    }

    const now = new Date();
    const timeString = now.toLocaleString('es-ES', { 
      timeZone: process.env.TZ || 'America/Mexico_City',
      dateStyle: 'full', 
      timeStyle: 'long' 
    });
    promptParts.push(`FECHA Y HORA ACTUAL:\nLa fecha y hora actual es: ${timeString}.`);

    promptParts.push(`INSTRUCCIONES DE ATENCIÓN Y TOMA DE PEDIDOS (EFICIENCIA MÁXIMA EN MENSAJES - PROTOCOLO RÁPIDO):
0. HORARIOS DE OPERACIÓN Y PROGRAMACIÓN DE ENTREGAS (CRÍTICO - PRIMER PÁRRAFO DEL MENSAJE ANTES DEL SALUDO):
   - REGLA DE ORO DE COMUNICACIÓN INICIAL:
     Si el "ESTADO OPERATIVO DEL NEGOCIO" NO es 'ABIERTO' (es decir, es 'DESPUES_CIERRE', 'CERRADO', 'FESTIVO' o 'ANTES_APERTURA'):
     ¡ESTA INFORMACIÓN DEBE SER LO PRIMERITO QUE DIGAS EN TU MENSAJE AL CLIENTE, EN EL PRIMER PÁRRAFO, ANTES DE CUALQUIER SALUDO O PREGUNTA!
     NUNCA lo dejes para después ni tomes el pedido sin haberlo avisado en el primer párrafo.
     * Si es 'ANTES_APERTURA': "¡Te informamos que abrimos a las ${sessionMetadata?.horario_hoy?.hora_inicio || '08:00'}. Con gusto tomamos tu pedido y quedará programado para entrega hoy mismo a partir de esa hora!"
     * Si es 'DESPUES_CIERRE': "¡Te informamos que por hoy ya concluyó nuestro horario de corte de recepción de pedidos (${sessionMetadata?.horario_hoy?.hora_corte || 'horario de corte'}). Con gusto tomamos tu pedido y quedará programado para entrega el próximo día hábil: ${sessionMetadata?.proximo_dia_habil ? `${sessionMetadata.proximo_dia_habil.dia_nombre} ${sessionMetadata.proximo_dia_habil.fecha} a partir de las ${sessionMetadata.proximo_dia_habil.hora_inicio}` : 'mañana'}!"
     * Si es 'CERRADO' (Día de descanso): "¡Te informamos que hoy ${sessionMetadata?.dia_actual || ''} es nuestro día de descanso y no laboramos. Con gusto tomamos tu pedido y quedará programado para entrega el próximo día hábil: ${sessionMetadata?.proximo_dia_habil ? `${sessionMetadata.proximo_dia_habil.dia_nombre} ${sessionMetadata.proximo_dia_habil.fecha} a partir de las ${sessionMetadata.proximo_dia_habil.hora_inicio}` : 'el siguiente día laboral'}!"
     * Si es 'FESTIVO': "¡Te informamos que hoy no laboramos por ser día festivo (${sessionMetadata?.mensaje_estado || 'día festivo'}). Con gusto tomamos tu pedido y quedará programado para entrega el próximo día hábil: ${sessionMetadata?.proximo_dia_habil ? `${sessionMetadata.proximo_dia_habil.dia_nombre} ${sessionMetadata.proximo_dia_habil.fecha}` : 'el siguiente día laboral'}!"
     
     EXCEPCIÓN CRÍTICA DE ATENCIÓN:
     Si el cliente tiene un pedido en "PEDIDOS ACTIVOS O PROGRAMADOS DEL CLIENTE", ¡ESTÁ TERMINANTEMENTE PROHIBIDO OFRECER REPETIR LO DE SIEMPRE NI CREAR UN NUEVO PEDIDO! En su lugar, aplica INMEDIATAMENTE la Regla 1 (informarle sobre su pedido activo o programado y preguntarle si desea modificarlo o cancelarlo).
     Únicamente si el cliente NO tiene pedidos activos ni programados, continúa en ese mismo texto con la atención (ofreciendo lo de siempre con el formato estricto de la Regla 2 si es recurrente, o pidiendo datos si es nuevo).
     Al llamar a 'crear_pedido', OBLIGATORIAMENTE asigna 'fecha_programada' con "${sessionMetadata?.fecha_programada_sugerida || sessionMetadata?.proximo_dia_habil?.fecha || 'YYYY-MM-DD'}".

   - Si el estado es 'ABIERTO': Horario habitual de reparto hoy. La entrega se realiza hoy mismo en horario normal. No es necesario dar avisos de horario salvo que el cliente solicite expresamente programar para un día futuro.
   - Si el cliente solicita expresamente programar su entrega para un día específico (ej. "para el viernes", "para mañana"), respeta su solicitud y asigna 'fecha_programada' con esa fecha en formato YYYY-MM-DD.
   - Si un pedido queda programado para otra fecha o antes de apertura, NUNCA digas que "va en camino a tu domicilio"; la confirmación debe indicar claramente que "ha sido confirmado y quedó programado para entrega el [fecha]".

1. CLIENTE CON PEDIDO ACTIVO O PROGRAMADO EN CURSO (PRIORIDAD MÁXIMA ABSOLUTA):
   - APLICA OBLIGATORIAMENTE SI el cliente tiene pedidos listados en "PEDIDOS ACTIVOS O PROGRAMADOS DEL CLIENTE":
     ¡ESTÁ TOTALMENTE PROHIBIDO ofrecer repetir "lo de siempre", ofrecer crear un nuevo pedido o pedir datos de compra a un cliente que ya tiene un pedido activo o programado!
     * En el saludo o primer mensaje:
       - Si el pedido está PROGRAMADO PARA UNA FECHA FUTURA (tiene fecha programada):
         "¡Hola [Nombre]! 👋 Tienes el pedido #[ID] por [resumen_productos / total] programado para entrega el [fecha_programada] a tu dirección en [Dirección]. ¿Deseas modificar algún dato (productos, fecha o dirección), cancelarlo o en qué te puedo ayudar?"
       - Si el pedido ya tiene repartidor asignado / va en camino hoy:
         "¡Hola [Nombre]! 👋 Tu pedido activo #[ID] por [resumen_productos / total] ya fue asignado a un repartidor y va en camino a tu dirección en [Dirección]. ¿Deseas modificar algún dato, cancelarlo o en qué te puedo ayudar?"
       - Si el pedido está pendiente de entrega hoy:
         "¡Hola [Nombre]! 👋 Tienes el pedido #[ID] por [resumen_productos / total] registrado para entrega hoy en [Dirección]. ¿Deseas modificar algún dato (productos o dirección), cancelarlo o en qué te puedo ayudar?"

     * PREGUNTAS DEL CLIENTE SOBRE SU PEDIDO (ej. "¿No tengo un pedido en curso?", "¿Tengo pedido activo?", "¿Qué pasó con mi pedido?"):
       ¡JAMÁS le digas que no tiene un pedido! Si aparece en "PEDIDOS ACTIVOS O PROGRAMADOS DEL CLIENTE", responde de inmediato con seguridad confirmando su pedido:
       "Sí, tienes el pedido #[ID] ([resumen_productos], total $[Total]) programado para entrega el [fecha_programada] / registrado a tu dirección en [Dirección]. ¿Deseas modificarlo, cancelarlo o en qué te puedo apoyar?"

     * Si el cliente solicita modificar o cambiar algo (ej. "quiero editarlo", "cambiar dirección", "cambiar garrafones", "cambiar fecha"):
       ¡ESTÁ TOTALMENTE PROHIBIDO LLAMAR A 'modificar_pedido' SIN LOS DATOS! Pregúntale amablemente qué desea cambiar:
       * Dirección: "¡Con gusto! ¿A qué nueva dirección completa deseas enviarlo?"
       * Productos: ¡ENVÍA DE INMEDIATO LA LISTA DE PRODUCTOS DISPONIBLES EN VIÑETAS CON PRECIOS! NUNCA preguntes a ciegas sin mostrar el catálogo para evitar que el cliente deba preguntar qué productos venden.
         Ejemplo:
         "¡Claro! Te comparto los productos disponibles:
         • Garrafon normal: $24
         • Garrafon ciel: $24
         • Garrafon epura: $24
         • Galon normal: $13
         • Litro: $10
         ¿Qué productos y cantidades te gustaría ordenar?"
       * Fecha: "¡Claro! ¿Para qué fecha deseas programar tu entrega?"
       SOLO cuando el cliente te responda con los nuevos datos (dirección, productos o fecha):
       EJECUTA la herramienta 'modificar_pedido' con los nuevos datos. El pedido pasará a revisión del administrador para su validación.
       ¡ESTÁ ESTRICTAMENTE PROHIBIDO usar 'crear_pedido' para un cliente que ya tiene un pedido activo o programado que desea cambiar!

     * Si el cliente solicita cancelarlo:
       ¡REGLA OBLIGATORIA DE RETROALIMENTACIÓN!: NUNCA ejecutes 'cancelar_pedido' de golpe. Primero pregúntale amablemente:
       "¿Podrías decirnos el motivo de tu cancelación? Nos ayuda mucho a mejorar."
       Una vez que el cliente te proporcione el motivo (o si insiste en cancelar sin dar motivo), ejecuta la herramienta 'cancelar_pedido' pasando el parámetro 'motivo'.

2. CLIENTE RECURRENTE SIN PEDIDOS ACTIVOS (PRIORIDAD 2 - ESTRATEGIA 1-CLIC / LO MISMO DE SIEMPRE):
   - APLICA ÚNICAMENTE si el cliente NO TIENE pedidos en "PEDIDOS ACTIVOS O PROGRAMADOS DEL CLIENTE", pero SÍ tiene un "ÚLTIMO PEDIDO HABITUAL REGISTRADO":
     
     * ESTRUCTURA EXACTA DEL MENSAJE (OBLIGATORIA - CADA PRODUCTO EN SU PROPIA VIÑETA CON PRECIO TOTAL):
       1. Párrafo 1 (SOLO SI EL NEGOCIO NO ESTÁ 'ABIERTO', ej. 'ANTES_APERTURA', 'DESPUES_CIERRE', 'CERRADO' o 'FESTIVO'):
          Escribe OBLIGATORIAMENTE en el primer párrafo el aviso de horario de la Regla 0:
          "¡Te informamos que abrimos a las ${sessionMetadata?.horario_hoy?.hora_inicio || '08:00'}. Con gusto tomamos tu pedido y quedará programado para entrega hoy mismo a partir de esa hora!"
       
       2. Párrafo 2 (Saludo y propuesta):
          "¡Hola [Nombre]! 👋 ¿Te mandamos lo mismo de siempre?"
       
       3. Párrafo 3 (CADA PRODUCTO OBLIGATORIAMENTE EN SU VIÑETA CON '•' o '-', CON CANTIDAD, NOMBRE Y PRECIO TOTAL):
          • 4x Garrafon normal - $96
          a tu dirección en [Dirección]? 😊
          (Si son varios productos habituales, CADA UNO debe ir en su propia viñeta, ej:
          • 4x Garrafon normal - $96
          • 2x Ciel - $48
          a tu dirección en [Dirección]? 😊)

     EJEMPLO EXACTO CUANDO ES ANTES DE ABRIR (ANTES_APERTURA):
     ¡Te informamos que abrimos a las 08:00. Con gusto tomamos tu pedido y quedará programado para entrega hoy mismo a partir de esa hora!

     ¡Hola Jesús! 👋 ¿Te mandamos lo mismo de siempre?

     • 4x Garrafon normal - $96
     a tu dirección en Adolfo de la Huerta 154? 😊

     EJEMPLO EXACTO CUANDO EL NEGOCIO YA ESTÁ ABIERTO:
     ¡Hola Jesús! 👋 ¿Te mandamos lo mismo de siempre?

     • 4x Garrafon normal - $96
     a tu dirección en Adolfo de la Huerta 154? 😊

     REGLA ESTRICTA DE PRECIO Y VIÑETAS:
     - CADA PRODUCTO DEBE IR OBLIGATORIAMENTE EN SU PROPIA VIÑETA con el símbolo '•' o '-': "• [Cantidad]x [Producto] - $[PrecioTotal]".
     - SIEMPRE incluye el precio total al final de cada viñeta.
     - ¡ESTÁ ESTRICTAMENTE PROHIBIDO omitir las viñetas, omitir el precio o usar formatos como "Garrafon normal (x2)"!
     - En el saludo / propuesta inicial de "lo de siempre", NO envíes el catálogo de productos completo; ofrece directamente lo habitual para que el cliente pueda confirmar con 1 sola palabra ("Sí", "Por favor", "Lo de siempre").
   - Si el cliente responde afirmativamente confirmando todo ("Sí", "Por favor", "Simón", "Mándalo", "Lo de siempre", "Ok"):
     ¡EJECUTA INMEDIATAMENTE la herramienta 'crear_pedido' con esos productos y dirección habitual!
     ¡ESTÁ ESTRICTAMENTE PROHIBIDO PREGUNTAR POR NOTAS O REFERENCIAS! Las notas y referencias son 100% opcionales. El pedido debe quedar creado en esa única respuesta del cliente.

   - SI EL CLIENTE INDICA QUE ES OTRA DIRECCIÓN O QUIERE CAMBIAR DE DOMICILIO:
     1. Si solo dice "es otra dirección" sin especificar cuál: Pídele su nueva dirección completa (calle y número) manteniendo los productos acordados.
     2. Si ya indica la nueva dirección: toma esa dirección y ejecuta de inmediato 'crear_pedido'. ¡NUNCA insistas por referencias ni notas!

   - SI EL CLIENTE DICE "NO", RECHAZA "LO DE SIEMPRE", O PIDE CAMBIAR/ELEGIR PRODUCTOS DISTINTOS:
     ¡ESTÁ TERMINANTEMENTE PROHIBIDO RESPONDER PREGUNTANDO "¿QUÉ DESEAS PEDIR?" O "¿QUÉ TE GUSTARÍA CAMBIAR?" SIN MOSTRAR LOS PRODUCTOS!
     Si preguntas sin mostrar el catálogo, obligas al cliente a enviar otro mensaje preguntando qué productos venden y gastar mensajes innecesarios.
     EN ESA MISMA RESPUESTA DEBES:
     1. Aceptar amablemente su respuesta (ej. "¡Entendido, [Nombre]!").
     2. ENVIAR OBLIGATORIAMENTE EL CATÁLOGO COMPLETO DE PRODUCTOS DISPONIBLES EN VIÑETAS CON SUS PRECIOS (tomado del CATÁLOGO DE PRODUCTOS / SERVICIOS).
     3. Preguntarle directamente cuáles productos y cuántas piezas necesita.
     Ejemplo exacto de respuesta si dice "No":
     "¡Entendido, [Nombre]! 👍 Te comparto nuestros productos disponibles:
     • Garrafon normal: $24
     • Garrafon ciel: $24
     • Garrafon epura: $24
     • Galon normal: $13
     • Litro: $10
     ¿Cuáles y cuántos te gustaría pedir hoy?"

3. CLIENTE NUEVO O SIN PEDIDO PREVIO (VENTA PROACTIVA EN EL PRIMER MENSAJE):
   - APLICA ÚNICAMENTE si el cliente NO tiene pedidos activos Y NO tiene un "ÚLTIMO PEDIDO HABITUAL REGISTRADO" y solo saluda o indica que quiere ordenar:
     NUNCA respondas con un saludo vacío o pasivo ("¿En qué te ayudo?"). EN ESE MISMO PRIMER MENSAJE:
     1. Salúdalo y dale la bienvenida. SI ESTAMOS FUERA DE HORARIO, EN DESCANSO O FESTIVO, DA PRIMERO EL AVISO DE HORARIO (Regla 0).
     2. MUESTRA LA LISTA DE PRODUCTOS DISPONIBLES CON SUS PRECIOS.
     3. Pídele directamente en una sola frase:
     "Por favor indícame tu nombre, qué productos y cantidades necesitas, y tu dirección de entrega." (NUNCA exijas referencias ni notas obligatorias).

4. REGLAS DE SLOT-FILLING Y DESCOMPOSICIÓN INTELIGENTE DE ENTIDADES:
   - DESCOMPOSICIÓN INTELIGENTE DE ENTIDADES (SEPARACIÓN ESTRICTA DE SLOTS):
     Cuando el cliente proporcione sus datos (ya sea todo en un solo mensaje o en varios), debes analizar, interpretar y separar CADA componente en su campo correspondiente sin mezclar información:
     * 'nombre': ÚNICAMENTE el nombre de la persona (ej. "Federico", "Mayra Gómez").
     * 'direccion': ÚNICAMENTE la calle y número exterior/interior limpios (ej. "Calle Morelos 834", "Av. Juárez 102"). NUNCA mezcles entrecalles, fachadas ni instrucciones aquí.
     * 'referencias': Detalles físicos de ubicación si los mencionó espontáneamente (ej. "entre Juárez e Independencia, casa con portón negro", "fachada blanca"). SI NO LOS MENCIONÓ, DÉJALO VACÍO.
     * 'notas_generales': Instrucciones operativas si las mencionó espontáneamente (ej. "los garrafones están en la entrada", "dejar con el vecino", "pago con billete de 500"). SI NO LAS MENCIONÓ, DÉJALO VACÍO.

   - PROHIBICIÓN ABSOLUTA DE INSISTIR EN NOTAS O REFERENCIAS (SON 100% OPCIONALES):
     ¡ESTÁ ESTRICTAMENTE PROHIBIDO PREGUNTAR AL CLIENTE SI DESEA AGREGAR UNA NOTA O INSISTIRLE POR REFERENCIAS!
     Tanto las notas como las referencias son COMPLETAMENTE OPCIONALES.
     - Si el cliente las incluye en su mensaje de forma espontánea (ej. "casa con portón negro, dejarlos en la entrada"), sepáralas y pásalas a 'referencias' o 'notas_generales'.
     - Pero si el cliente NO las menciona, ¡NO LE PREGUNTES NI LE INSISTAS! Procede de inmediato a confirmar y ejecutar 'crear_pedido'.
     - NUNCA respondas con "¿Deseas agregar alguna nota?" ni "¿Tienes alguna referencia?". Si ya tienes los productos, cantidades y la dirección de entrega (o el cliente confirmó lo de siempre), ejecuta 'crear_pedido' en ese mismo instante.

   - MANEJO INTELIGENTE DE DIRECCIONES:
     * Si el cliente acepta su dirección registrada, úsala.
     * Si el cliente proporciona o solicita una dirección diferente, adáptate de inmediato: solicita la nueva dirección si falta, o regístrala directamente en el parámetro 'direccion' de 'crear_pedido'. ¡NUNCA transfieras a un humano por un cambio de dirección!

   - En cuanto tengas completos los productos, cantidades y la dirección de entrega:
     Ejecuta INMEDIATAMENTE la herramienta 'crear_pedido'.
     REGLA CRUCIAL PARA 'crear_pedido': SIEMPRE debes extraer de la conversación los productos y cantidades acordadas y pasarlos en el parámetro 'items' (ej. items: [{ producto: "Garrafon normal", cantidad: 5 }]). SIEMPRE debes extraer el nombre del cliente (ej. "Federico", "Mayra") y pasarlo en el parámetro 'nombre'. Pasa las notas en 'notas_generales' solo si el cliente las mencionó. NUNCA envíes 'items' vacío ni transfieras a un humano si ya tienes los datos para crear el pedido.

5. REGLAS ESTRICTAS DE FORMATO Y LIMPIEZA:
   - DIRECCIONES LIMPIAS: NUNCA coloques aclaraciones, comentarios, notas ni textos entre paréntesis en 'direccion' ni en tus mensajes (ej. NUNCA pongas "(Referencia proporcionada por el cliente)", "(Ubicación habitual)"). Coloca ÚNICAMENTE la calle, número y datos limpios.
   - RESUMEN Y MENSAJES LIMPIOS SIN NOTAS NI REFERENCIAS VACÍAS:
     Si el cliente no dejó notas para el chofer, NUNCA escribas "Nota: ninguna", "Nota: sin notas", "Nota: no" ni menciones la palabra "Nota" en tus mensajes o en el resumen. Si el cliente no dio referencias, NUNCA escribas "Referencias: ninguna" ni menciones "Referencias". Solo incluye Notas o Referencias cuando el cliente las haya proporcionado explícitamente.
   - En las herramientas 'crear_pedido' y 'modificar_pedido', si el cliente no especificó referencias o notas, o dijo "no" / "ninguna", déjalos completamente vacíos (sin valor), NUNCA envíes textos como "sin notas", "ninguna", "n/a".
   - CÓDIGOS DE RASTREO: NUNCA menciones códigos de rastreo (como AC...) en los mensajes al cliente. La confirmación debe ser directa, breve y limpia.

6. CANCELACIÓN DE PEDIDOS:
   - Si el cliente solicita cancelar un pedido activo, NUNCA ejecutes 'cancelar_pedido' de inmediato. Pregúntale amablemente el motivo de cancelación ("¿Podrías decirnos el motivo de la cancelación? Nos ayuda mucho a mejorar."). Una vez que te responda el motivo (o si insiste sin dar motivo), ejecuta 'cancelar_pedido' pasando el motivo.

7. CONSULTAS DE HORARIOS, DÍAS DE ATENCIÓN Y DÍAS FESTIVOS:
   - Si el cliente pregunta si abren o atienden en un día específico (ej. "¿abren los domingos?", "¿qué días abren?", "¿a qué hora cierran los sábados?", "¿abren mañana?", "¿abren el 25 de diciembre?", "¿trabajan en Navidad?"):
     * Consulta con detenimiento las secciones "HORARIOS SEMANALES COMPLETOS DE SERVICIO" y "DÍAS FESTIVOS REGISTRADOS".
     * Responde de forma precisa, amable y directa con la información oficial:
       - Si es un día laboral normal (ej. Lunes a Viernes o Sábado): indícale con exactitud la hora de apertura y la hora de corte para recepción de pedidos (ej. "Los sábados abrimos a las 8:00 y cerramos recepción de pedidos a las 13:00 hrs").
       - Si es un día de descanso (ej. Domingo): indícale con claridad que ese día es de descanso y permanece cerrado, e infórmale qué días y a qué hora se reanuda el servicio (ej. "Los domingos descansamos y no tenemos servicio. Con gusto te atendemos de lunes a sábado a partir de las 8:00 am").
       - Si es un día festivo registrado (ej. 25 de diciembre / Navidad): menciona la festividad, aclara que no se labora / no hay reparto por ser día festivo, e infórmale que los pedidos se programan para el siguiente día hábil (apoyándote en el mensaje configurado en el festivo si existe).
     * ¡ESTÁ TOTALMENTE PROHIBIDO inventar horarios, dar información contradictoria o transferir a un asesor humano si la respuesta ya está en los horarios y festivos del contexto!

8. PREGUNTAS NO RELACIONADAS O ASESOR:
   - Utiliza 'transferir_a_humano' ÚNICAMENTE si:
     a) El cliente solicita explícitamente hablar con una persona ("quiero hablar con un humano", "pásame a un asesor", "comunícame con alguien").
     b) Hay una queja o reclamo grave fuera de la venta normal.
   - NUNCA transfieras a humano durante la toma de pedidos, cotizaciones, consultas de horarios/festivos, o cuando un cliente desee modificar o cancelar su pedido activo.

9. AGRADECIMIENTO Y FINALIZACIÓN:
   - Al confirmar el pedido, agradece siempre al cliente por su compra y preferencia. El sistema enviará el resumen y marcará automáticamente la conversación como finalizada en Chatwoot.
   - Si el cliente únicamente se despide o indica que no requiere nada más, despídete con amabilidad y utiliza 'resolver_conversacion'.`);

    return promptParts.join('\n\n------------------------\n\n');
  }

  private static sanitizeAddress(val?: string): string | undefined {
    if (!val) return undefined;
    return val
      .replace(/\s*\([^)]*(?:referencia|cliente|proporcionad|nota|aclaraci|habitual|ubicaci)[^)]*\)/gi, '')
      .replace(/\s*\(\s*\)/g, '')
      .trim();
  }

  private static normalizeStr(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private static findCatalogMatch(itemProdName: string, catList: any[]) {
    if (!catList || catList.length === 0) return null;
    const normItem = this.normalizeStr(itemProdName);
    const exact = catList.find(c => this.normalizeStr(c.name) === normItem);
    if (exact) return exact;

    const sub = catList.find(c => {
      const normCat = this.normalizeStr(c.name);
      return normItem.includes(normCat) || normCat.includes(normItem);
    });
    if (sub) return sub;

    const itemWords = normItem.split(/\s+/).map(w => w.replace(/(es|s)$/, '')).filter(w => w.length > 2);
    let bestScore = 0;
    let bestMatch = null;
    for (const c of catList) {
      const normCat = this.normalizeStr(c.name);
      const catWords = normCat.split(/\s+/).map(w => w.replace(/(es|s)$/, '')).filter(w => w.length > 2);
      let score = 0;
      for (const iw of itemWords) {
        if (catWords.some(cw => cw === iw || cw.includes(iw) || iw.includes(cw))) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = c;
      }
    }
    return bestScore > 0 ? bestMatch : null;
  }

  static async processAiMessage(account: Account, session: ConversationSession, cwConvId: number, content: string) {
    const config = account.botConfig!;

    await prisma.messageLog.create({
      data: { conversationSessionId: session.id, senderType: 'USER', content }
    });

    const newAiCount = session.aiMessagesCount + 1;
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { aiMessagesCount: newAiCount },
    });

    if (newAiCount > config.maxAiMessages) {
      await FlowRouter.executeHandoff(account, session, cwConvId);
      return;
    }

    let metadata: any = typeof session.sessionMetadata === 'string'
      ? JSON.parse(session.sessionMetadata)
      : (session.sessionMetadata || {});

    // Inyección de contexto dinámico desde apiBaseUrl/contexto
    if (config.apiBaseUrl) {
      try {
        let headers: any = { 'Content-Type': 'application/json' };
        if (config.apiHeaders) {
          try {
            const parsed = typeof config.apiHeaders === 'string' ? JSON.parse(config.apiHeaders) : config.apiHeaders;
            headers = { ...headers, ...parsed };
          } catch (e) {}
        }
        const ctxRes = await fetch(`${config.apiBaseUrl}/contexto`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ telefono: session.contactIdentifier })
        });
        if (ctxRes.ok) {
          const ctxData = await ctxRes.json();
          metadata = { ...metadata, ...ctxData };
          await prisma.conversationSession.update({
            where: { id: session.id },
            data: { sessionMetadata: metadata }
          });
        }
      } catch (err) {
        console.error('[AiOrchestrator] Error obteniendo /contexto dinámico:', err);
      }
    }

    const recentLogs = await prisma.messageLog.findMany({
      where: { conversationSessionId: session.id, senderType: { in: ['USER', 'BOT_AI'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    const history = recentLogs.reverse().map(log => ({
      role: log.senderType === 'USER' ? 'user' : 'assistant',
      content: log.content,
    })) as any[];

    let finalSystemPrompt = this.buildSystemPrompt(config, metadata);
    const messagesLeft = config.maxAiMessages - newAiCount;
    
    if (messagesLeft <= config.aiWrapUpMessages) {
      finalSystemPrompt += `\n\n[IMPORTANTE]: Te quedan ${messagesLeft} mensajes con el usuario antes de transferir a un asesor.`;
    }

    const aiResult = await AiService.getReply(
      config.aiProvider,
      config.aiModel,
      finalSystemPrompt,
      history,
      (config as any).aiTools || []
    );

    if (aiResult.text.includes('[ERROR_IA]')) {
      console.log(`[BotEngine] Falla en IA detectada en la sesión ${session.id}.`);
      const emergencyMsg = "En este momento te comunicaré con uno de nuestros asesores para atenderte personalmente.";
      await FlowRouter.executeHandoff(account, session, cwConvId, emergencyMsg);
      return;
    }

    const hasTerminalAction = aiResult.isOrderCreated || aiResult.isOrderModified || aiResult.isOrderCancelled || aiResult.isHandoff || aiResult.isResolved;

    // Si la IA responde texto ordinario sin acciones terminales, lo guardamos y enviamos
    if (!hasTerminalAction && aiResult.text.trim().length > 0) {
      await prisma.messageLog.create({
        data: { conversationSessionId: session.id, senderType: 'BOT_AI', content: aiResult.text }
      });

      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          aiResult.text
        );
      }
    }

    // TOOL CALL: CREAR PEDIDO
    if (aiResult.isOrderCreated && config.apiBaseUrl) {
      const dynamicCat = metadata.catalogo;
      const catalog = (dynamicCat && Array.isArray(dynamicCat) && dynamicCat.length > 0)
        ? dynamicCat.map((c: any) => ({ id: c.id, name: c.nombre || c.name, price: c.precio ?? c.price }))
        : ((config.aiKnowledge as any)?.catalog || []);

      let items = aiResult.orderData?.items || [];
      
      // Fallback 1: Buscar productos y cantidades en el historial de mensajes recientes
      if (!items || items.length === 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          const hMsg = history[i];
          const match = (hMsg.content || '').match(/(\d+)\s*(garraf[oó]n\w*|botella\w*|ciel|agua\s*cero|normal\w*)/i);
          if (match) {
            items = [{ producto: match[2], cantidad: parseInt(match[1]) }];
            break;
          }
        }
      }

      // Fallback 2: Usar detalles del último pedido si el cliente dijo "lo de siempre"
      if ((!items || items.length === 0) && metadata.ultimo_pedido?.detalles) {
        items = metadata.ultimo_pedido.detalles.map((d: any) => ({
          producto: d.nombre_producto || d.producto_nombre,
          cantidad: d.cantidad,
          notas: d.notas
        }));
      }

      const detalle = items.map((it: any) => {
        const matched = AiOrchestrator.findCatalogMatch(it.producto, catalog);
        return {
          producto_id: matched?.id || null,
          nombre_producto: matched?.name || it.producto,
          cantidad: it.cantidad,
          precio: matched?.price ? parseFloat(matched.price) : 0,
          notas: it.notas
        };
      });

      let headers: any = { 'Content-Type': 'application/json' };
      if (config.apiHeaders) {
        try {
          const parsed = typeof config.apiHeaders === 'string' ? JSON.parse(config.apiHeaders) : config.apiHeaders;
          headers = { ...headers, ...parsed };
        } catch (e) {}
      }

      const clientInfo = metadata.cliente || {};
      const rawDir = aiResult.orderData?.direccion || clientInfo.direccion_predeterminada || clientInfo.direccion;
      const rawRef = aiResult.orderData?.referencias || clientInfo.referencias_predeterminadas || clientInfo.referencias;
      
      let rawNombre = aiResult.orderData?.nombre?.trim();
      if (!rawNombre || rawNombre.toLowerCase() === 'cliente whatsapp' || rawNombre.toLowerCase() === 'cliente bot') {
        rawNombre = (clientInfo.nombre && clientInfo.nombre !== 'Cliente WhatsApp' && clientInfo.nombre !== 'Cliente Bot')
          ? clientInfo.nombre
          : undefined;
      }

      const scheduledDate = aiResult.orderData?.fecha_programada
        || metadata.fecha_programada_sugerida
        || undefined;

      const cleanRef = AiOrchestrator.sanitizeAddress(rawRef);
      const isRefEmpty = !cleanRef || /^(ninguna|sin referencias?|n\/a|no)$/i.test(cleanRef.trim());

      const cleanNotas = aiResult.orderData?.notas_generales?.trim();
      const isNotasEmpty = !cleanNotas || /^(ninguna|sin notas?|n\/a|no|as[ií] est[aá] bien|pedido v[ií]a whatsapp bot)$/i.test(cleanNotas);

      const orderPayload = {
        telefono: session.contactIdentifier,
        nombre: rawNombre || 'Cliente WhatsApp',
        direccion: AiOrchestrator.sanitizeAddress(rawDir),
        referencias: isRefEmpty ? undefined : cleanRef,
        notas: isNotasEmpty ? undefined : cleanNotas,
        fecha_programada: scheduledDate,
        detalle
      };

      try {
        const orderRes = await fetch(`${config.apiBaseUrl}/pedidos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(orderPayload)
        });
        const orderData = await orderRes.json();
        if (orderRes.ok && orderData.status === 'success') {
          let confirmation = orderData.mensaje;
          if (!confirmation || (!confirmation.includes('Resumen') && !confirmation.includes('Total:'))) {
            const itemsSummary = (detalle || []).map((it: any) => `- ${it.cantidad}x ${it.nombre_producto}`).join('\n');
            const totalCalc = (detalle || []).reduce((acc: number, it: any) => acc + (parseFloat(it.precio || 0) * parseInt(it.cantidad || 1)), 0);
            if (scheduledDate) {
              confirmation = `¡Listo! Tu pedido ha sido confirmado y quedó programado para entrega el ${scheduledDate}.\n\nResumen de tu pedido:\n${itemsSummary}\nTotal: $${totalCalc.toFixed(2)}\nDirección: ${orderPayload.direccion || 'Domicilio registrado'}`;
            } else {
              confirmation = `¡Listo! Tu pedido ha sido confirmado exitosamente y va en camino a tu domicilio.\n\nResumen de tu pedido:\n${itemsSummary}\nTotal: $${totalCalc.toFixed(2)}\nDirección: ${orderPayload.direccion || 'Domicilio registrado'}`;
            }
            if (orderPayload.referencias) confirmation += `\nReferencias: ${orderPayload.referencias}`;
            if (orderPayload.notas) confirmation += `\nNota: ${orderPayload.notas}`;
          }
          if (!confirmation.toLowerCase().includes('gracias')) {
            confirmation += `\n\n¡Muchas gracias por tu compra y preferencia! 🙌`;
          }
          await prisma.messageLog.create({
            data: { conversationSessionId: session.id, senderType: 'BOT_AI', content: confirmation }
          });
          if (account.chatwootAccessToken) {
            await ChatwootService.sendMessage(
              account.chatwootApiUrl,
              account.chatwootAccessToken,
              account.chatwootAccountId,
              cwConvId,
              confirmation
            );
            await ChatwootService.resolveConversation(
              account.chatwootApiUrl,
              account.chatwootAccessToken,
              account.chatwootAccountId,
              cwConvId
            );
            await prisma.conversationSession.update({
              where: { id: session.id },
              data: { status: 'RESOLVED' }
            });
          }
        } else {
          const errMsg = orderData.mensaje || orderData.msg || "Hubo un inconveniente al registrar el pedido.";
          await FlowRouter.executeHandoff(account, session, cwConvId, `${errMsg} Te comunico con un asesor.`);
        }
      } catch (err) {
        console.error('[BotEngine] Error enviando pedido a webhook:', err);
        await FlowRouter.executeHandoff(account, session, cwConvId, "Error de conexión al registrar tu pedido. Te comunico con un asesor.");
      }
      return;
    }

    // TOOL CALL: MODIFICAR PEDIDO
    if (aiResult.isOrderModified && config.apiBaseUrl) {
      console.log(`[BotEngine] IA ejecutó modificar_pedido en sesión ${session.id}`, aiResult.modifyData);

      const hasNewAddress = Boolean(aiResult.modifyData?.direccion && aiResult.modifyData.direccion.trim().length > 0);
      const hasNewItems = Boolean(aiResult.modifyData?.items && Array.isArray(aiResult.modifyData.items) && aiResult.modifyData.items.length > 0);

      // GUARDRAIL 1: Si no vienen nuevos productos ni nueva dirección, no ejecutamos a ciegas
      if (!hasNewAddress && !hasNewItems) {
        console.warn(`[BotEngine] modificar_pedido invocado sin datos en sesión ${session.id}. Solicitando datos al cliente.`);
        const askMsg = aiResult.text.trim().length > 0
          ? aiResult.text
          : "Con gusto te ayudo a modificar tu pedido. ¿Qué cambios deseas realizar en los productos o en la dirección de entrega?";

        await prisma.messageLog.create({
          data: { conversationSessionId: session.id, senderType: 'BOT_AI', content: askMsg }
        });

        if (account.chatwootAccessToken) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            askMsg
          );
        }
        return;
      }

      const targetOrder = metadata.pedidos_activos?.[0];

      const dynamicCat = metadata.catalogo;
      const catalog = (dynamicCat && Array.isArray(dynamicCat) && dynamicCat.length > 0)
        ? dynamicCat.map((c: any) => ({ id: c.id, name: c.nombre || c.name, price: c.precio ?? c.price }))
        : ((config.aiKnowledge as any)?.catalog || []);

      const items = aiResult.modifyData?.items;
      let detalle = undefined;

      if (items && Array.isArray(items) && items.length > 0) {
        detalle = items.map((it: any) => {
          const matched = AiOrchestrator.findCatalogMatch(it.producto, catalog);
          return {
            producto_id: matched?.id || null,
            nombre_producto: matched?.name || it.producto,
            cantidad: it.cantidad,
            precio: matched?.price ? parseFloat(matched.price) : 0,
            notas: it.notas
          };
        });
      }

      let headers: any = { 'Content-Type': 'application/json' };
      if (config.apiHeaders) {
        try {
          const parsed = typeof config.apiHeaders === 'string' ? JSON.parse(config.apiHeaders) : config.apiHeaders;
          headers = { ...headers, ...parsed };
        } catch (e) {}
      }

      const cleanModRef = AiOrchestrator.sanitizeAddress(aiResult.modifyData?.referencias);
      const isModRefEmpty = !cleanModRef || /^(ninguna|sin referencias?|n\/a|no)$/i.test(cleanModRef.trim());

      const cleanModNotas = aiResult.modifyData?.notas_generales?.trim();
      const isModNotasEmpty = !cleanModNotas || /^(ninguna|sin notas?|n\/a|no|as[ií] est[aá] bien)$/i.test(cleanModNotas);

      const modifyPayload = {
        telefono: session.contactIdentifier,
        codigo: aiResult.modifyData?.codigo_pedido || targetOrder?.codigo_rastreo,
        direccion: AiOrchestrator.sanitizeAddress(aiResult.modifyData?.direccion),
        referencias: isModRefEmpty ? undefined : cleanModRef,
        notas: isModNotasEmpty ? undefined : cleanModNotas,
        fecha_programada: aiResult.modifyData?.fecha_programada || undefined,
        detalle
      };

      try {
        const modifyRes = await fetch(`${config.apiBaseUrl}/pedidos/modificar`, {
          method: 'POST',
          headers,
          body: JSON.stringify(modifyPayload)
        });
        const modifyData = await modifyRes.json();
        if (modifyRes.ok && modifyData.status === 'success') {
          let confirmation = modifyData.mensaje;
          if (!confirmation || (!confirmation.includes('Resumen') && !confirmation.includes('Total:'))) {
            if (detalle && detalle.length > 0) {
              const itemsSummary = detalle.map((it: any) => `- ${it.cantidad}x ${it.nombre_producto}`).join('\n');
              const totalCalc = detalle.reduce((acc: number, it: any) => acc + (parseFloat(it.precio || 0) * parseInt(it.cantidad || 1)), 0);
              confirmation = `¡Listo! Tu pedido ha sido modificado exitosamente.\n\nResumen actualizado:\n${itemsSummary}\nTotal: $${totalCalc.toFixed(2)}\nDirección: ${modifyPayload.direccion || 'Domicilio registrado'}`;
            } else if (modifyPayload.direccion) {
              confirmation = `¡Listo! La dirección de tu pedido ha sido actualizada a: ${modifyPayload.direccion}.`;
            } else {
              confirmation = modifyData.mensaje || '¡Listo! Tu pedido ha sido modificado exitosamente.';
            }
            if (modifyPayload.referencias) confirmation += `\nReferencias: ${modifyPayload.referencias}`;
            if (modifyPayload.notas) confirmation += `\nNota: ${modifyPayload.notas}`;
          }
          if (!confirmation.toLowerCase().includes('gracias')) {
            confirmation += `\n\n¡Muchas gracias por tu preferencia! 🙌`;
          }
          await prisma.messageLog.create({
            data: { conversationSessionId: session.id, senderType: 'BOT_AI', content: confirmation }
          });
          if (account.chatwootAccessToken) {
            await ChatwootService.sendMessage(
              account.chatwootApiUrl,
              account.chatwootAccessToken,
              account.chatwootAccountId,
              cwConvId,
              confirmation
            );
            await ChatwootService.resolveConversation(
              account.chatwootApiUrl,
              account.chatwootAccessToken,
              account.chatwootAccountId,
              cwConvId
            );
            await prisma.conversationSession.update({
              where: { id: session.id },
              data: { status: 'RESOLVED' }
            });
          }
        } else {
          const errMsg = modifyData.mensaje || modifyData.msg || "Hubo un inconveniente al modificar el pedido.";
          await FlowRouter.executeHandoff(account, session, cwConvId, `${errMsg} Te comunico con un asesor.`);
        }
      } catch (err) {
        console.error('[BotEngine] Error enviando modificación de pedido a webhook:', err);
        await FlowRouter.executeHandoff(account, session, cwConvId, "Error de conexión al modificar tu pedido. Te comunico con un asesor.");
      }
      return;
    }

    // TOOL CALL: CANCELAR PEDIDO
    if (aiResult.isOrderCancelled && config.apiBaseUrl) {
      console.log(`[BotEngine] IA ejecutó cancelar_pedido en sesión ${session.id}`, aiResult.cancelData);
      
      // GUARDRAIL: Si no hay motivo de cancelación, pedirlo al cliente antes de cancelar en el sistema
      const motivoProvided = aiResult.cancelData?.motivo && typeof aiResult.cancelData.motivo === 'string' && aiResult.cancelData.motivo.trim().length > 0;
      if (!motivoProvided) {
        console.log(`[BotEngine] cancelar_pedido llamado sin motivo. Solicitando motivo al cliente.`);
        const askMotivoMsg = "¿Podrías comentarnos brevemente el motivo de tu cancelación? Tu opinión nos ayuda mucho a mejorar nuestro servicio.";
        await prisma.messageLog.create({
          data: { conversationSessionId: session.id, senderType: 'BOT_AI', content: askMotivoMsg }
        });
        if (account.chatwootAccessToken) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            askMotivoMsg
          );
        }
        return;
      }

      let headers: any = { 'Content-Type': 'application/json' };
      if (config.apiHeaders) {
        try {
          const parsed = typeof config.apiHeaders === 'string' ? JSON.parse(config.apiHeaders) : config.apiHeaders;
          headers = { ...headers, ...parsed };
        } catch (e) {}
      }

      const targetOrder = metadata?.pedidos_activos?.[0];

      try {
        const cancelRes = await fetch(`${config.apiBaseUrl}/pedidos/cancelar`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            telefono: session.contactIdentifier,
            codigo: aiResult.cancelData?.codigo_pedido || targetOrder?.codigo_rastreo,
            motivo: aiResult.cancelData?.motivo
          })
        });
        const cancelData = await cancelRes.json();
        if (cancelRes.ok && cancelData.status === 'success') {
          const cancelMsg = cancelData.mensaje || "Tu pedido ha sido cancelado con éxito. Agradecemos tus comentarios.";
          await prisma.messageLog.create({
            data: { conversationSessionId: session.id, senderType: 'BOT_AI', content: cancelMsg }
          });
          if (account.chatwootAccessToken) {
            await ChatwootService.sendMessage(
              account.chatwootApiUrl,
              account.chatwootAccessToken,
              account.chatwootAccountId,
              cwConvId,
              cancelMsg
            );
          }
        } else {
          const reason = cancelData.mensaje || cancelData.msg || "El pedido ya no se puede cancelar automáticamente.";
          await FlowRouter.executeHandoff(account, session, cwConvId, `${reason} Te comunico con un asesor.`);
        }
      } catch (err) {
        console.error('[BotEngine] Error cancelando pedido:', err);
        await FlowRouter.executeHandoff(account, session, cwConvId, "Error al cancelar el pedido. Te comunico con un asesor.");
      }
      return;
    }

    if (aiResult.isHandoff) {
      console.log(`[BotEngine] La IA decidió transferir a humano (Tool Call) en sesión ${session.id}`);
      const handoffMsg = aiResult.text.trim().length > 0 ? aiResult.text : undefined;
      await FlowRouter.executeHandoff(account, session, cwConvId, handoffMsg);
      return;
    }

    if (aiResult.isResolved && account.chatwootAccessToken) {
      console.log(`[BotEngine] La IA decidió auto-resolver (Tool Call) en sesión ${session.id}`);
      await ChatwootService.resolveConversation(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId
      );
      await prisma.conversationSession.update({ where: { id: session.id }, data: { status: 'RESOLVED' } });
    }
  }
}
