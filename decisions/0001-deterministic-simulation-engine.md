# ADR-0001: Motor de simulación determinista compartido como límite de integridad

## Status
Accepted

## Context
El cliente corre en una webview no confiable. Si el cliente calculara el general o el resultado
de combate, podría inflar stats y envenenar el pool de fantasmas y el leaderboard. A la vez,
queremos que la run y la batalla se sientan instantáneas (sin un round-trip por turno) y que el
PvP sea asíncrono y barato (sin netcode en tiempo real).

## Decision
Un único paquete `@devvit/web/shared` contiene un **PRNG sembrado** y dos funciones puras:
`simulateRun(seed, deckSnapshot, actionLog)` y `simulateBattle(seed, generalA, generalB)`.
El **cliente** las ejecuta para previsualizar; el **servidor** las re-ejecuta como única fuente
de verdad. El cliente solo transmite intenciones acotadas (`actionLog`); todo lo demás (semilla,
deck, resultado) lo fija o lo recomputa el servidor.

## Consequences
- Anti-cheat estructural: inflar stats es imposible si la semilla y el deck salen del servidor y
  el resultado se re-simula.
- El PvP es asíncrono y determinista: una batalla se reduce a `(seed, A, B)` reproducible.
- Restricción dura: el motor MUST NOT usar `Math.random`, `Date.now` ni estado global. Se exige
  una suite de pruebas de determinismo que falle ante cualquier deriva.
- El mismo código viaja a cliente y servidor; cambios de balance deben versionarse con cuidado
  para no invalidar generales ya acuñados (ver ADR-0003: inmutabilidad).

## Alternatives considered
- **Run autoritativa turno a turno** (un request por turno): más segura de base pero chatty
  (8+ round-trips), peor UX móvil. Rechazada.
- **Confiar en el cliente con validación heurística**: frágil y eludible. Rechazada.
