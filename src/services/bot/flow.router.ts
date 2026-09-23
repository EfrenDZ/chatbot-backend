import { ConversationSession, BotConfig } from '@prisma/client';
import { Account, prisma, delay } from './types';
import { ChatwootService } from '../chatwoot.service';
import { SessionManager } from './session.manager';

export class FlowRouter {
  static async sendCurrentNode(account: Account, config: BotConfig, sessionId: string, cwConvId: number) {
    const flowGraph = config.flowGraph as any;
    
    const session = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
    const nodeId = session?.currentNodeId || flowGraph.rootNodeId;
    
    const node = flowGraph.nodes.find((n: any) => n.id === nodeId);
    if (!node) return;

    const messages: string[] = (node.messages && Array.isArray(node.messages) && node.messages.length > 0)
      ? node.messages
      : [node.text];

    for (let i = 0; i < messages.length - 1; i++) {
      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          messages[i]
        );
        await delay(2500);
      }
    }

    let finalMessageText = messages[messages.length - 1];
    
    // Interpolación de variables {{variable}} desde sessionMetadata
    const metadata = typeof session?.sessionMetadata === 'string' ? JSON.parse(session.sessionMetadata) : (session?.sessionMetadata || {});
    finalMessageText = finalMessageText.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const path = key.trim();
      const val = path.split('.').reduce((acc: any, part: string) => acc && acc[part] !== undefined ? acc[part] : undefined, metadata);
      return val !== undefined && val !== null ? String(val) : match;
    });

    if (node.type === 'RESTART') {
      await SessionManager.resetSession(sessionId, config);
      const newSession = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
      if (newSession) {
        await this.sendCurrentNode(account, config, newSession.id, cwConvId);
      }
      return;
    }

    if (node.type === 'RESOLVE') {
      if (account.chatwootAccessToken) {
        await ChatwootService.resolveConversation(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId
        );
      }
      await prisma.conversationSession.update({ where: { id: sessionId }, data: { status: 'RESOLVED' } });
      return;
    }

    if (node.type === 'HANDOFF') {
      await this.executeHandoff(account, session!, cwConvId, finalMessageText);
      return;
    }

    
    
    if (node.type === 'CONDITION') {
      try {
        const metadata = typeof session!.sessionMetadata === 'string' ? JSON.parse(session!.sessionMetadata) : (session!.sessionMetadata || {});
        
        // Helper para extraer variables anidadas (ej. "cliente.direccion")
        const getValue = (obj: any, path: string) => {
          if (!path) return undefined;
          return path.split('.').reduce((acc, part) => acc && acc[part], obj);
        };

        const val = getValue(metadata, node.conditionVariable || '');
        let isTrue = false;

        if (node.conditionOperator === 'equals') {
          isTrue = String(val) === String(node.conditionValue || '');
        } else {
          // Default: 'exists'
          isTrue = val !== undefined && val !== null && val !== '';
        }

        const nextNodeId = isTrue ? node.successNodeId : node.errorNodeId;

        await prisma.conversationSession.update({
          where: { id: sessionId },
          data: { currentNodeId: nextNodeId, consecutiveErrors: 0 }
        });

        const newSession = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
        if (newSession) {
          await this.sendCurrentNode(account, config, newSession.id, cwConvId);
        }
      } catch (err) {
        console.error('[FlowRouter] Condition evaluation error:', err);
      }
      return;
    }

    if (node.type === 'WEBHOOK') {
      try {
        const metadata = typeof session!.sessionMetadata === 'string' ? JSON.parse(session!.sessionMetadata) : (session!.sessionMetadata || {});
        
        // Configuración Global API
        const globalHeaders = typeof config.apiHeaders === 'string' ? JSON.parse(config.apiHeaders) : (config.apiHeaders || {});
        const customHeaders = { ...globalHeaders, ...(node.headers || {}) };
        
        let finalUrl = node.url;
        if (node.url && (node.url.startsWith('/') || node.url.startsWith('?')) && config.apiBaseUrl) {
          // Limpiar slash final del baseUrl si existe
          const base = config.apiBaseUrl.endsWith('/') ? config.apiBaseUrl.slice(0, -1) : config.apiBaseUrl;
          finalUrl = node.url.startsWith('?') ? base + '/' + node.url.replace(/^\//, '') : base + node.url;
        }

        // Ejecutar petición HTTP
        const response = await fetch(finalUrl, {
          method: node.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...customHeaders },
          body: JSON.stringify(metadata)
        });

        let responseData = {};
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            responseData = await response.json();
          } catch(e) {}
        }
        
        const updatedMetadata = { ...metadata, ...responseData };

        if (response.ok) {
          await prisma.conversationSession.update({
            where: { id: sessionId },
            data: { 
              currentNodeId: node.successNodeId, 
              consecutiveErrors: 0,
              sessionMetadata: updatedMetadata 
            }
          });
        } else {
          await prisma.conversationSession.update({
            where: { id: sessionId },
            data: { 
              currentNodeId: node.errorNodeId, 
              consecutiveErrors: 0,
              sessionMetadata: updatedMetadata 
            }
          });
        }
      } catch (err) {
        console.error('[FlowRouter] Webhook error:', err);
        await prisma.conversationSession.update({
          where: { id: sessionId },
          data: { currentNodeId: node.errorNodeId, consecutiveErrors: 0 }
        });
      }
      
      // Llamada recursiva para procesar el nodo destino (success o error)
      const newSession = await prisma.conversationSession.findUnique({ where: { id: sessionId } });
      if (newSession) {
        await this.sendCurrentNode(account, config, newSession.id, cwConvId);
      }
      return;
    }

    if (node.type === 'INPUT') {
      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          finalMessageText
        );
        await delay(2000);
      }
      return;
    }

    if (node.type === 'DYNAMIC_MENU') {
      const arr = metadata[node.arrayVariable || ''] || [];
      const items = arr.slice(0, 10).map((item: any, index: number) => {
        let title = node.titleTemplate || '{{nombre}}';
        title = title.replace(/\{\{([^}]+)\}\}/g, (m: string, k: string) => {
          const val = item[k.trim()];
          return val !== undefined && val !== null ? String(val) : m;
        });
        const valKey = node.valueKey || 'id';
        const value = item[valKey] !== undefined ? String(item[valKey]) : String(index);
        return { title: title.substring(0, 23), value };
      });

      if (account.chatwootAccessToken) {
        if (items.length > 0) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText,
            { contentType: 'input_select', contentAttributes: { items } }
          );
        } else {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText + '\n(No hay opciones disponibles)'
          );
        }
        await delay(2500);
      }
      return;
    }

    if (node.type === 'MENU' && node.options && node.options.length > 0) {
      if (node.options.length <= 10) {
        const maxTitleLen = node.options.length <= 3 ? 20 : 24;
        const items = node.options.map((opt: any, index: number) => {
          let title = opt.label.trim();
          if (title.length > maxTitleLen) title = title.substring(0, maxTitleLen);
          return { title, value: (index + 1).toString() };
        });

        if (account.chatwootAccessToken) {
          await ChatwootService.sendMessage(
            account.chatwootApiUrl,
            account.chatwootAccessToken,
            account.chatwootAccountId,
            cwConvId,
            finalMessageText,
            { contentType: 'input_select', contentAttributes: { items } }
          );
          await delay(2500);
        }
        return;
      }
      
      let textMenu = finalMessageText + '\n\n';
      node.options.forEach((opt: any, index: number) => {
        textMenu += `${index + 1}. ${opt.label}\n`;
      });

      if (account.chatwootAccessToken) {
        await ChatwootService.sendMessage(
          account.chatwootApiUrl,
          account.chatwootAccessToken,
          account.chatwootAccountId,
          cwConvId,
          textMenu
        );
        await delay(2000);
      }
      return;
    }

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        finalMessageText
      );
      await delay(2000);
    }
  }

  static async executeHandoff(account: Account, session: ConversationSession, cwConvId: number, customMessage?: string) {
    const msg = customMessage || account.botConfig!.handoffMessage;
    
    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        msg
      );
      await ChatwootService.handoffToHuman(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId
      );
    }

    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { status: 'HANDED_OFF_TO_HUMAN' },
    });
  }

  static async processMenuOption(account: Account, session: ConversationSession, cwConvId: number, userMessage: string) {
    const wasValid = await this.tryProcessMenuOption(account, session, cwConvId, userMessage);
    if (!wasValid) {
      await this.processMenuError(account, session, cwConvId);
    }
  }

  static async tryProcessMenuOption(account: Account, session: ConversationSession, cwConvId: number, userMessage: string): Promise<boolean> {
    const config = account.botConfig!;
    const flowGraph = config.flowGraph as any;
    const nodeId = session.currentNodeId || flowGraph.rootNodeId;
    const node = flowGraph.nodes.find((n: any) => n.id === nodeId);

    if (!node || node.type !== 'MENU' || !node.options) return false;

    const cleanUserMsg = userMessage.toLowerCase().trim();
    const cleanUserMsgNoNum = cleanUserMsg.replace(/^[0-9]+[\.\-\)\s]*/, '').trim();

    const selectedOption = node.options.find((opt: any, index: number) => {
      const optNumber = (index + 1).toString();
      if (cleanUserMsg === optNumber) return true;
      const cleanLabel = opt.label.toLowerCase().trim();
      if (cleanUserMsg === cleanLabel) return true;
      if (cleanUserMsgNoNum === cleanLabel) return true;
      const isPartial = cleanLabel.includes(cleanUserMsg) || cleanUserMsg.includes(cleanLabel);
      return isPartial;
    });

    if (selectedOption) {
      await prisma.conversationSession.update({
        where: { id: session.id },
        data: { currentNodeId: selectedOption.targetNodeId, consecutiveErrors: 0 },
      });
      await this.sendCurrentNode(account, config, session.id, cwConvId);
      return true;
    }
    return false;
  }

  static async processMenuError(account: Account, session: ConversationSession, cwConvId: number) {
    const config = account.botConfig!;
    const newErrors = session.consecutiveErrors + 1;
    await prisma.conversationSession.update({
      where: { id: session.id },
      data: { consecutiveErrors: newErrors },
    });

    if (account.chatwootAccessToken) {
      await ChatwootService.sendMessage(
        account.chatwootApiUrl,
        account.chatwootAccessToken,
        account.chatwootAccountId,
        cwConvId,
        config.fallbackMessage
      );
      await delay(2000);
      await this.sendCurrentNode(account, config, session.id, cwConvId);
    }
  }

  static async tryProcessInputNode(account: Account, session: ConversationSession, cwConvId: number, userMessage: string, node: any): Promise<boolean> {
    if (node.type !== 'INPUT' && node.type !== 'DYNAMIC_MENU') return false;
    
    const varName = node.variableName || 'input';
    let metadata = typeof session!.sessionMetadata === 'string' ? JSON.parse(session!.sessionMetadata) : (session!.sessionMetadata || {});
    
    // Guardar la variable
    metadata[varName] = userMessage.trim();

    await prisma.conversationSession.update({
      where: { id: session.id },
      data: {
        currentNodeId: node.targetNodeId,
        consecutiveErrors: 0,
        sessionMetadata: metadata
      },
    });

    await this.sendCurrentNode(account, account.botConfig!, session.id, cwConvId);
    return true;
  }

}