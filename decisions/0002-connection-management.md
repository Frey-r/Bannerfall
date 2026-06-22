# ADR-0002: Manejo de conexiones y modelo de request en serverless

## Status
Accepted

## Context
Devvit Web ejecuta el servidor como funciones serverless sin estado garantizado entre
invocaciones, con un tope de 30 s por request y límites de payload (4 MB) y respuesta (10 MB).
No hay sockets persistentes de aplicación ni un proceso de larga vida del que dependamos.

## Decision
- **Sin estado en proceso.** Ninguna lógica depende de memoria que sobreviva entre requests; todo
  estado vive en Redis. Cualquier caché en memoria se trata como oportunista y desechable.
- **Cliente Redis por alcance de request.** El acceso a Redis se obtiene del contexto de servidor
  de Devvit (`@devvit/web/server`) dentro del manejador. No se mantienen pools de conexiones
  propios ni clientes globales reutilizados entre invocaciones; se usa el cliente gestionado que
  Devvit expone para esa invocación.
- **Trabajo acotado a 30 s.** Cada handler hace trabajo corto y O(1)/O(log n) en Redis. Todo
  proceso pesado o batch (poda del pool, rotación de leaderboard, creación del post diario) se
  delega al **scheduler** (ver ADR-0006), no a un request de usuario.
- **Disciplina de tamaño.** Las respuestas se paginan; nunca se vuelca el pool o el leaderboard
  completos (ver ADR-0004 y la spec de `security`).
- **Idempotencia de transporte.** Como la red móvil reintenta, todo handler mutador es idempotente
  (ver ADR-0005), de modo que un reintento tras timeout no duplica efectos.

## Consequences
- Escala horizontal trivial: cualquier invocación puede atender cualquier request.
- No hay "connection leak" posible a nivel de aplicación porque no gestionamos el ciclo de vida de
  la conexión; nos ceñimos al cliente provisto por invocación.
- Obliga a diseñar cada operación para completarse rápido; las tareas largas se parten o se mueven
  al scheduler.

## Alternatives considered
- **Cliente Redis global reutilizado entre invocaciones**: no fiable en serverless (el entorno
  puede reciclarse) y va contra el modelo de Devvit. Rechazado.
- **Procesar batch dentro de un request de usuario**: arriesga el límite de 30 s y degrada la UX.
  Rechazado en favor del scheduler.
