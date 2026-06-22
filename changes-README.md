# changes/

Trabajo nuevo o modificaciones se proponen aquí antes de implementar.

Cada cambio vive en su carpeta `changes/<id>/` y contiene:

- `proposal.md` — por qué y qué cambia (con in-scope / out-of-scope explícitos).
- `specs/<capability>/spec.md` — el *delta* con secciones `## ADDED`, `## MODIFIED`, `## REMOVED`.
- `design.md` — detalle técnico (claves Redis, ops, TTL, secuencias).
- `tasks.md` — checklist de implementación, ordenado por dependencias.

Flujo: **propose → apply → archive**. Al archivar, los deltas se fusionan en `openspec/specs/`
y la carpeta del cambio se mueve a `changes/archive/`. Las specs en `openspec/specs/` son la
línea base ya establecida del sistema.

Ejemplo de primer cambio sugerido para arrancar la implementación:
`add-run-and-pvp-vertical-slice` — el corte vertical mínimo (start run → submit → acuñar →
batalla vs NPC → recompensa) que de-riskea la plataforma en los primeros días.
