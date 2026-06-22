# AGENTS.md — guía para asistentes de IA

Antes de escribir o modificar código en este proyecto:

1. Lee `openspec/project.md` (contexto global y restricciones de plataforma).
2. Lee la(s) `openspec/specs/<capability>/spec.md` relevante(s). Son el contrato de comportamiento.
3. Lee `openspec/decisions/` para las decisiones de arquitectura vigentes (conexiones, concurrencia, Redis).

Reglas de oro:

- **El cliente no tiene autoridad.** Cualquier salida que afecte PvP, leaderboard o economía se
  computa o se re-simula en el servidor. No confíes en valores calculados por el cliente.
- **Determinismo.** El motor de simulación no usa `Math.random`, `Date.now`, ni estado global.
  Todo aleatorio sale del PRNG sembrado. El servidor debe poder reproducir cualquier resultado.
- **Generales inmutables.** Una vez acuñado, un general nunca se modifica. Eso elimina casi todas
  las condiciones de carrera. Para contadores usa ops atómicas de Redis, no read-modify-write.
- **Idempotencia.** Todo endpoint que muta estado exige un token de idempotencia.
- Las specs describen *qué* (comportamiento observable). El *cómo* (claves Redis, TTL, ops) vive en
  los ADRs y en `design.md`. No metas detalle de implementación en `spec.md`.

Antes de dar por terminado un cambio: `openspec validate` debe pasar y las pruebas de determinismo
del `simulation-engine` deben estar verdes.

Trabajo nuevo: propónlo en `openspec/changes/<id>/` (proposal.md + specs delta + design.md + tasks.md)
antes de implementar.
