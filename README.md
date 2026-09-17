# Chatbot SaaS - Backend

Servicio Node.js + Express + TypeScript + Prisma.
Responsabilidades:
- Receptor de Webhooks de Chatwoot (inmediato 200 OK + procesamiento asíncrono).
- Validador y gestor de tokens de sesión para la Dashboard App.
- Motor de ejecución de flujos (State Machine / FSM).
- Orquestador de IA (OpenAI / Anthropic / etc.) con límite de tokens/mensajes.
- Cliente REST API de Chatwoot para envío de respuestas y handoff a humanos.
