# ADR-0007: Cold start y degradación elegante

## Status
Accepted

## Context
Los jueces de la jam entran a un post recién publicado: el pool de fantasmas y el leaderboard
estarán vacíos. Un PvP sin oponentes o un ranking en blanco arruinarían la primera impresión.
Además, los despliegues a mitad de evento no deben brickear a jugadores existentes.

## Decision
- **Sembrado de NPCs.** Un script de seed inserta ~40 generales NPC (`ownerId="npc"`) repartidos en
  bandas de poder dentro de `pool:power`, y unas pocas entradas en el leaderboard. Garantiza
  oponentes y un ranking poblado desde el minuto cero.
- **Fallback de matchmaking.** Si no hay humano elegible en la banda, se amplía la banda y, en
  última instancia, se empareja contra un NPC (ver spec `combat-pvp`). La experiencia nunca queda
  sin oponente.
- **Versionado de esquema + defaults.** Toda entidad lleva versión; las lecturas aplican defaults a
  campos ausentes (ver spec `meta-progression`). Un despliegue nuevo no rompe perfiles viejos.
- **Errores tolerantes.** Un campo corrupto se sustituye por un default seguro y se registra, en
  lugar de propagar un fallo al usuario.

## Consequences
- Demo jugable de inmediato: clave para la evaluación del jurado.
- Los NPCs deben quedar excluidos de "no pelear contra ti mismo" pero incluidos en matchmaking;
  conviene marcarlos para no contaminar métricas de jugadores reales.
- El versionado de esquema es una disciplina permanente: cada cambio de forma de datos define su
  default de lectura.

## Alternatives considered
- **Lanzar sin sembrado y esperar masa crítica**: arriesga una demo muerta. Rechazado.
- **Bloquear PvP hasta que haya N jugadores**: penaliza al evaluador que llega primero. Rechazado.
