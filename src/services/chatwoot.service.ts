export class ChatwootService {
  /**
   * Envía un mensaje desde el bot hacia el cliente en una conversación específica.
   */
  static async sendMessage(
    apiUrl: string,
    accessToken: string,
    accountId: number,
    conversationId: number,
    content: string
  ): Promise<void> {
    const url = `${apiUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': accessToken,
        },
        body: JSON.stringify({
          content,
          message_type: 'outgoing',
          private: false,
        }),
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
}
