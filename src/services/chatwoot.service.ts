export interface SendMessageOptions {
  contentType?: 'text' | 'input_select';
  contentAttributes?: {
    items: Array<{ title: string; value: string }>;
  };
}

export class ChatwootService {
  static async setConversationStatus(
    apiUrl: string,
    accessToken: string,
    accountId: number,
    conversationId: number,
    status: 'open' | 'resolved' | 'pending' | 'snoozed' | 'bot'
  ): Promise<void> {
    const url = `${apiUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': accessToken,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        console.error(`[ChatwootService] Error seteando status ${status}: ${await response.text()}`);
      }
    } catch (error) {
      console.error(`[ChatwootService] Excepción seteando status:`, error);
    }
  }

  /**
   * Envía un mensaje desde el bot hacia el cliente en una conversación específica.
   */
  static async sendMessage(
    apiUrl: string,
    accessToken: string,
    accountId: number,
    conversationId: number,
    content: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const url = `${apiUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

    const body: any = {
      content,
      message_type: 'outgoing',
      private: false,
    };

    if (options?.contentType) {
      body.content_type = options.contentType;
    }

    if (options?.contentAttributes) {
      body.content_attributes = options.contentAttributes;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': accessToken,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ChatwootService] Error enviando mensaje: ${errorText}`);
      }
    } catch (error) {
      console.error(`[ChatwootService] Excepción enviando mensaje:`, error);
    }
  }

  /**
   * Transfiere la conversación a un agente humano cambiando el estado a 'open'.
   * Chatwoot ruteará la conversación a los agentes disponibles de la bandeja.
   */
  static async handoffToHuman(
    apiUrl: string,
    accessToken: string,
    accountId: number,
    conversationId: number
  ): Promise<void> {
    const url = `${apiUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`;

    try {
      // Al hacer POST a toggle_status (o PUT a status='open'), 
      // quitamos el control del bot y permitimos que un humano atienda.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': accessToken,
        },
        body: JSON.stringify({
          status: 'open',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ChatwootService] Error en handoff: ${errorText}`);
      }
    } catch (error) {
      console.error(`[ChatwootService] Excepción en handoff:`, error);
    }
  }

  static async resolveConversation(
    apiUrl: string,
    accessToken: string,
    accountId: number,
    conversationId: number
  ): Promise<void> {
    const url = `${apiUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': accessToken,
        },
        body: JSON.stringify({
          status: 'resolved',
        }),
      });

      if (!response.ok) {
        console.error(`[ChatwootService] Error resolviendo conv: ${await response.text()}`);
      }
    } catch (error) {
      console.error(`[ChatwootService] Excepción en resolve:`, error);
    }
  }
}
