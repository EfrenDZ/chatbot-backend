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
        const resumen = up.resumen_texto || (up.detalles ? up.detalles.map((d: any) => `${d.cantidad}x ${d.nombre_producto || d.producto_nombre}`).join(', ') : '');
        metaParts.push(`- ÚLTIMO PEDIDO HABITUAL REGISTRADO:\n  ${resumen}\n  Total: $${up.total || ''}`);
      }
      if (sessionMetadata.pedidos_activos && Array.isArray(sessionMetadata.pedidos_activos) && sessionMetadata.pedidos_activos.length > 0) {
        const pText = sessionMetadata.pedidos_activos.map((p: any) => `* Pedido #${p.id || ''} (Código: ${p.codigo_rastreo || p.codigo}) - Estado: ${p.estado_texto || p.estado} - Total: $${p.total}`).join('\n');
        metaParts.push(`- Pedidos activos del cliente:\n${pText}`);
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
1. CLIENTE RECURRENTE (ESTRATEGIA 1-CLIC / LO MISMO DE SIEMPRE):
   - Si el cliente tiene un "ÚLTIMO PEDIDO HABITUAL REGISTRADO" y solo saluda (ej. "Hola", "Buenas tardes", "Quiero pedir"):
     SALÚDALO POR SU NOMBRE Y PREGÚNTALE DIRECTAMENTE SI QUIERE REPETIR SU PEDIDO DE SIEMPRE:
     Ejemplo: "¡Hola [Nombre]! 👋 ¿Te mandamos lo mismo de siempre? ([Productos del pedido habitual] por $[Total]) a tu dirección habitual en [Dirección]?"
   - Si el cliente responde afirmativamente ("Sí", "Por favor", "Simón", "Mándalo", "Lo de siempre", "Ok"):
     EJECUTA INMEDIATAMENTE la herramienta 'crear_pedido' con esos productos y dirección. ¡El pedido debe quedar creado en esa única respuesta del cliente!
   - Si el cliente pide algo distinto (ej. "No, ahora quiero 1 normal"), atiéndelo de inmediato con lo que pida.

2. CLIENTE NUEVO O SIN PEDIDO PREVIO (VENTA PROACTIVA EN EL PRIMER MENSAJE):
   - Si el cliente NO tiene un "ÚLTIMO PEDIDO HABITUAL REGISTRADO" y solo saluda o indica que quiere ordenar (ej. "Hola", "Buenas", "Quiero un pedido"):
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

3. REGLAS DE SLOT-FILLING Y DATOS OBLIGATORIOS PARA AGUACERO:
   - Para poder registrar el pedido en el sistema, NECESITAS OBLIGATORIAMENTE:
     1. Productos y cantidades válidas.
     2. Dirección completa de entrega (calle, número) y referencias (fachada, calles aledañas).
     3. Nombre del cliente (si no está registrado en su contexto).
   - Si el cliente ya tiene dirección y nombre registrados en su contexto, NO se los vuelvas a pedir, solo confírmaselos brevemente.
   - Si el cliente dio solo los productos pero olvidó su dirección o referencias, pídelas de inmediato en una sola pregunta directa.
   - En cuanto tengas completos los productos, cantidades, dirección y referencias, ejecuta INMEDIATAMENTE la herramienta 'crear_pedido'.

4. CANCELACIÓN DE PEDIDOS:
   - Si el cliente solicita cancelar un pedido, utiliza la herramienta 'cancelar_pedido'.

5. PREGUNTAS NO RELACIONADAS O ASESOR:
   - Si el usuario pregunta algo fuera de tu alcance o pide hablar con un humano, utiliza 'transferir_a_humano'.

6. AUTO-CIERRE:
   - Si el cliente se despide ("gracias adios", "todo bien gracias"), despídete cordialmente y utiliza 'resolver_conversacion'.`);

    return promptParts.join('\n\n------------------------\n\n');
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

    // Si la IA responde texto, lo guardamos y enviamos
    if (aiResult.text.trim().length > 0) {
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
      if ((!items || items.length === 0) && metadata.ultimo_pedido?.detalles) {
        items = metadata.ultimo_pedido.detalles.map((d: any) => ({
          producto: d.nombre_producto || d.producto_nombre,
          cantidad: d.cantidad,
          notas: d.notas
        }));
      }

      const detalle = items.map((it: any) => {
        const itemProd = (it.producto || '').toLowerCase().trim();
        const matched = catalog.find((c: any) => {
          const catName = (c.name || '').toLowerCase().trim();
          return catName === itemProd || itemProd.includes(catName) || catName.includes(itemProd);
        });
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
      const orderPayload = {
        telefono: session.contactIdentifier,
        nombre: clientInfo.nombre || 'Cliente WhatsApp',
        direccion: aiResult.orderData?.direccion || clientInfo.direccion_predeterminada || clientInfo.direccion,
        referencias: aiResult.orderData?.referencias || clientInfo.referencias_predeterminadas || clientInfo.referencias,
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
          const confirmation = orderData.mensaje || `¡Listo! Tu pedido ha sido confirmado. Código de seguimiento: ${orderData.codigo_rastreo || ''}`;
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

    // TOOL CALL: CANCELAR PEDIDO
    if (aiResult.isOrderCancelled && config.apiBaseUrl) {
      console.log(`[BotEngine] IA ejecutó cancelar_pedido en sesión ${session.id}`, aiResult.cancelData);
      
      let headers: any = { 'Content-Type': 'application/json' };
      if (config.apiHeaders) {
        try {
          const parsed = typeof config.apiHeaders === 'string' ? JSON.parse(config.apiHeaders) : config.apiHeaders;
          headers = { ...headers, ...parsed };
        } catch (e) {}
      }

      try {
        const cancelRes = await fetch(`${config.apiBaseUrl}/pedidos/cancelar`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            telefono: session.contactIdentifier,
            codigo: aiResult.cancelData?.codigo_pedido,
            motivo: aiResult.cancelData?.motivo
          })
        });
        const cancelData = await cancelRes.json();
        if (cancelRes.ok && cancelData.status === 'success') {
          const cancelMsg = cancelData.mensaje || "Tu pedido ha sido cancelado con éxito.";
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
