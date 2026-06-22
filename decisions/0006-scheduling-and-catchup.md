# ADR-0006: Scheduling, reset canónico y catch-up

## Status
Accepted

## Context
El gancho de retención depende de contenido diario fresco. El scheduler de Devvit puede fallar o,
en el peor caso, ejecutar de más. Un cron caído nunca debe dejar el juego sin reto del día. Las
zonas horarias deben resolverse de forma determinista.

## Decision
- **Fecha canónica en UTC.** "Hoy" se deriva de una fecha UTC fija; todas las claves diarias se
  indexan por esa fecha (`daily:{fecha}`, `lb:daily:{fecha}`).
- **Cron idempotente.** El rollover diario crea el reto con guarda (`SETNX`/`hSetNx` sobre
  `daily:{fecha}`). Una segunda ejecución para la misma fecha es un no-op.
- **Catch-up perezoso (cinturón y tirantes).** El endpoint que sirve el reto crea hoy de forma
  perezosa e idempotente si el cron no lo hizo. Así un cron caído nunca rompe la experiencia.
- **Trabajo del scheduler.** Además del reto: rotación de leaderboard (implícita por claves
  fechadas), poda complementaria del pool y publicación del post diario vía API de Reddit. Todo
  fuera del camino crítico de los requests de usuario (ver ADR-0002).

## Consequences
- El reto diario está disponible aunque el scheduler falle: lo crea el primer acceso del día.
- La duplicación por doble disparo se neutraliza con la guarda idempotente.
- El reset en UTC simplifica el razonamiento pero implica que el "cambio de día" no coincide con la
  medianoche local de cada jugador; se documenta como decisión consciente.

## Alternatives considered
- **Solo cron, sin catch-up**: un fallo del scheduler degradaría la demo (justo lo que ven los
  jueces). Rechazado.
- **Reset por zona horaria del usuario**: multiplica la complejidad de claves y rankings sin
  beneficio claro para una jam. Rechazado.
