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
        const resumen = up.resumen_texto || (up.detalles ? up.detalles.map((d: any) => `-${d.cantidad}x ${d.nombre_producto || d.producto_nombre}`).join('\n') : '');
        if (resumen && resumen.trim().length > 0 && Number(up.total) > 0) {
          metaParts.push(`- ÚLTIMO PEDIDO HABITUAL REGISTRADO:\n${resumen}`);
        }
      }
      if (sessionMetadata.pedidos_activos && Array.isArray(sessionMetadata.pedidos_activos) && sessionMetadata.pedidos_activos.length > 0) {
        const pText = sessionMetadata.pedidos_activos.map((p: any) => 
          `* Pedido #${p.id || ''} (Código: ${p.codigo_rastreo || p.codigo}) - Estado: ${p.estado_texto || p.estado} | Repartidor asignado: ${p.repartidor_asignado ? 'SÍ (EN RUTA)' : 'NO (PENDIENTE)'} | Total: $${p.total}`
        ).join('\n');
        metaParts.push(`- PEDIDOS ACTIVOS DEL CLIENTE:\n${pText}`);
      }
      if (sessionMetadata.fuera_de_horario) {
        metaParts.push(`- AVISO DE HORARIO: Actualmente estamos cerrados. Próximo día hábil: ${sessionMetadata.mensaje_horario || 'el siguiente día laboral'}. Si el cliente pide productos, aclárale que su entrega se agendará para ese horario.`);
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
1. CLIENTE CON PEDIDO ACTIVO EN CURSO (PRIORIDAD MÁXIMA):
   - APLICA OBLIGATORIAMENTE SI el cliente tiene pedidos listados en "PEDIDOS ACTIVOS DEL CLIENTE":
     * En el saludo o primer mensaje, infórmale de inmediato de su pedido activo:
       - Si ya tiene repartidor asignado:
         "¡Hola [Nombre]! 👋 Tu pedido activo ya fue asignado a un repartidor y va en camino a tu dirección en [Dirección]. ¿Deseas modificar algún dato, cancelarlo o en qué te puedo ayudar?"
       - Si aún está pendiente de asignación:
         "¡Hola [Nombre]! 👋 Tienes un pedido pendiente de entrega registrado a tu dirección en [Dirección]. ¿Deseas modificar algún dato (productos o dirección) o en qué te puedo ayudar?"
     * Si el cliente solicita modificar o cambiar algo (ej. "quiero editarlo", "cambiar dirección", "cambiar garrafones"):
       ¡ESTÁ TOTALMENTE PROHIBIDO LLAMAR A 'modificar_pedido' SIN LOS DATOS! Pregúntale amablemente qué desea cambiar:
       * Dirección: "¡Con gusto! ¿A qué nueva dirección completa y referencias deseas enviarlo?"
       * Productos: "¡Claro! ¿Qué productos o cantidades te gustaría modificar?"
       SOLO cuando el cliente te responda con la nueva dirección o los nuevos productos/cantidades:
       EJECUTA la herramienta 'modificar_pedido' con los nuevos datos. El pedido pasará a revisión del administrador para su validación.
       ¡ESTÁ ESTRICTAMENTE PROHIBIDO usar 'crear_pedido' para un cliente que ya tiene un pedido activo que desea cambiar!
     * Si el cliente solicita cancelarlo:
       ¡REGLA OBLIGATORIA DE RETROALIMENTACIÓN!: NUNCA ejecutes 'cancelar_pedido' de golpe. Primero pregúntale amablemente:
       "¿Podrías decirnos el motivo de tu cancelación? Nos ayuda mucho a mejorar."
       Una vez que el cliente te proporcione el motivo (o si insiste en cancelar sin dar motivo), ejecuta la herramienta 'cancelar_pedido' pasando el parámetro 'motivo'.

2. CLIENTE RECURRENTE SIN PEDIDOS ACTIVOS (PRIORIDAD 2 - ESTRATEGIA 1-CLIC / LO MISMO DE SIEMPRE):
   - APLICA ÚNICAMENTE si el cliente NO TIENE pedidos activos en curso, pero SÍ tiene un "ÚLTIMO PEDIDO HABITUAL REGISTRADO":
     SALÚDALO POR SU NOMBRE Y OFRÉCELE DIRECTAMENTE REPETIR SU PEDIDO HABITUAL EN EL PRIMER MENSAJE USANDO EXACTAMENTE ESTE FORMATO LIMPIO CON VIÑETAS:
     
     "¡Hola [Nombre]! 👋 ¿Te mandamos lo mismo de siempre? 
     [Lista de productos del pedido habitual con viñetas]
     a tu dirección en [Dirección]?"

     Ejemplo exacto de cómo debes responder:
     "¡Hola Efren Dueñas! 👋 ¿Te mandamos lo mismo de siempre? 
     -3x Garrafon normal - $72
     -1x Ciel - $24
     -TOTAL: $96.00 
     a tu dirección en Adolfo de la Huerta 154?"

     REGLA ESTRICTA: NO envíes el catálogo de productos ni la lista de precios a clientes recurrentes que tienen pedido habitual. Solo ofréceles confirmar su pedido habitual con este formato de viñetas para que confirmen en 1 mensaje ("Sí", "Por favor", "Lo de siempre").
   - Si el cliente responde afirmativamente confirmando todo ("Sí", "Por favor", "Simón", "Mándalo", "Lo de siempre", "Ok"):
     EJECUTA INMEDIATAMENTE la herramienta 'crear_pedido' con esos productos y dirección habitual. ¡El pedido debe quedar creado en esa única respuesta del cliente!

   - SI EL CLIENTE INDICA QUE ES OTRA DIRECCIÓN O QUIERE CAMBIAR DE DOMICILIO (ej. "Es otra dirección", "Cambié de domicilio", "Mándalo a otra parte", "No, a otra dirección"):
     ¡ESTÁ ESTRICTAMENTE PROHIBIDO TRANSFERIR A UN ASESOR HUMANO!
     1. Si el cliente solo dice "es otra dirección" sin especificar cuál: Pídele con amabilidad y en una sola frase su nueva dirección completa (calle y número) y referencias (fachada, entrecalles), manteniendo los productos acordados.
        Ejemplo: "¡Con gusto! ¿A qué dirección completa y referencias te lo enviamos?"
     2. Si el cliente ya indica la nueva dirección (ej. "Mándalo a calle Juárez 123 entre Morelos"): toma esa dirección y referencias y ejecuta de inmediato 'crear_pedido' con los productos acordados y la nueva dirección en el parámetro 'direccion'.

   - Si el cliente dice que quiere algo diferente o productos distintos (ej. "No, ahora quiero 1 normal"), muéstrale los productos disponibles o toma su nuevo pedido.

3. CLIENTE NUEVO O SIN PEDIDO PREVIO (VENTA PROACTIVA EN EL PRIMER MENSAJE):
   - APLICA ÚNICAMENTE si el cliente NO tiene pedidos activos Y NO tiene un "ÚLTIMO PEDIDO HABITUAL REGISTRADO" y solo saluda o indica que quiere ordenar:
     NUNCA respondas con un saludo vacío o pasivo ("¿En qué te ayudo?"). EN ESE MISMO PRIMER MENSAJE:
     1. Salúdalo y dale la bienvenida.
     2. MUESTRA LA LISTA DE PRODUCTOS DISPONIBLES CON SUS PRECIOS.
     3. Pídele directamente los datos clave en una sola frase:
     Ejemplo:
     "¡Hola! Bienvenido a ${knowledge.businessName || 'nuestra empresa'}. 👋
     ¿Deseas hacer un pedido? Estos son nuestros productos disponibles:
     [Lista de productos y precios del catálogo]

     Por favor indícame:
     - Tu nombre
     - Qué productos y cantidades necesitas
     - Tu dirección de entrega y referencias (ej. entre qué calles, color de fachada o portón)."

4. REGLAS DE SLOT-FILLING Y DATOS OBLIGATORIOS PARA NUEVOS PEDIDOS:
   - Para poder registrar el pedido en el sistema, NECESITAS OBLIGATORIAMENTE:
     1. Productos y cantidades válidas.
     2. Dirección completa de entrega (calle, número) y referencias (fachada, calles aledañas).
     3. Nombre del cliente (si no está registrado en su contexto).
   - MANEJO INTELIGENTE DE DIRECCIONES:
     * Si el cliente acepta su dirección registrada, úsala.
     * Si el cliente proporciona o solicita una dirección diferente, adáptate de inmediato: solicita la nueva dirección si falta, o regístrala directamente en el parámetro 'direccion' de 'crear_pedido'. ¡NUNCA transfieras a un humano por un cambio de dirección!
   - En cuanto tengas completos los productos, cantidades, dirección y referencias, ejecuta INMEDIATAMENTE la herramienta 'crear_pedido'.
     REGLA CRUCIAL PARA 'crear_pedido': SIEMPRE debes extraer de la conversación los productos y cantidades acordadas y pasarlos en el parámetro 'items' (ej. items: [{ producto: "Garrafon normal", cantidad: 5 }]). SIEMPRE debes extraer el nombre del cliente que te haya proporcionado (ej. "Mayra", "Carlos") y pasarlo en el parámetro 'nombre'. NUNCA envíes 'items' vacío ni transfieras a un humano si ya tienes los datos para crear el pedido.

5. REGLAS ESTRICTAS DE FORMATO Y LIMPIEZA:
   - DIRECCIONES LIMPIAS: NUNCA coloques aclaraciones, comentarios, notas ni textos entre paréntesis en 'direccion' ni en tus mensajes (ej. NUNCA pongas "(Referencia proporcionada por el cliente)", "(Ubicación habitual)"). Coloca ÚNICAMENTE la calle, número y datos limpios.
   - CÓDIGOS DE RASTREO: NUNCA menciones códigos de rastreo (como AC...) en los mensajes al cliente. La confirmación debe ser directa, breve y limpia.

6. CANCELACIÓN DE PEDIDOS:
   - Si el cliente solicita cancelar un pedido activo, NUNCA ejecutes 'cancelar_pedido' de inmediato. Pregúntale amablemente el motivo de cancelación ("¿Podrías decirnos el motivo de la cancelación? Nos ayuda mucho a mejorar."). Una vez que te responda el motivo (o si insiste sin dar motivo), ejecuta 'cancelar_pedido' pasando el motivo.

7. PREGUNTAS NO RELACIONADAS O ASESOR:
   - Utiliza 'transferir_a_humano' ÚNICAMENTE si:
     a) El cliente solicita explícitamente hablar con una persona ("quiero hablar con un humano", "pásame a un asesor", "comunícame con alguien").
     b) Hay una queja o reclamo grave fuera de la venta normal.
   - NUNCA transfieras a humano durante la toma de pedidos, cotizaciones, o cuando un cliente desee modificar o cancelar su pedido activo.

8. AUTO-CIERRE:
   - ¡PROHIBIDO AUTO-CERRAR TRAS CREAR O MODIFICAR UN PEDIDO!: NUNCA uses 'resolver_conversacion' inmediatamente después de registrar o modificar un pedido. Espera a que el cliente confirme que no necesita nada más.
   - ÚNICAMENTE debes usar 'resolver_conversacion' si el cliente se despide expresamente ("gracias adios", "todo bien gracias", "sería todo, bye").`);

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

      const orderPayload = {
        telefono: session.contactIdentifier,
        nombre: rawNombre || 'Cliente WhatsApp',
        direccion: AiOrchestrator.sanitizeAddress(rawDir),
        referencias: AiOrchestrator.sanitizeAddress(rawRef),
        notas: aiResult.orderData?.notas_generales,
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
            confirmation = `¡Listo! Tu pedido ha sido confirmado exitosamente y va en camino a tu domicilio.\n\nResumen de tu pedido:\n${itemsSummary}\nTotal: $${totalCalc.toFixed(2)}\nDirección: ${orderPayload.direccion || 'Domicilio registrado'}`;
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

      const modifyPayload = {
        telefono: session.contactIdentifier,
        codigo: aiResult.modifyData?.codigo_pedido || targetOrder?.codigo_rastreo,
        direccion: AiOrchestrator.sanitizeAddress(aiResult.modifyData?.direccion),
        referencias: AiOrchestrator.sanitizeAddress(aiResult.modifyData?.referencias),
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
