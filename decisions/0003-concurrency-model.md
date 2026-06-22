# ADR-0003: Modelo de concurrencia

## Status
Accepted

## Context
Múltiples invocaciones serverless pueden tocar las mismas estructuras a la vez: el ledger de
recursos, el nivel de consejeros, el pool de matchmaking y los leaderboards. No hay locks de
aplicación ni transacciones multi-clave al estilo SQL; solo las primitivas de Redis. Las
condiciones de carrera más peligrosas son el doble gasto de recursos y el doble crédito de
recompensas.

## Decision
Tres reglas, en orden de preferencia:

1. **Generales inmutables (write-once).** Un general nunca se modifica tras acuñarse. Esto elimina
   de raíz casi todas las carreras: no hay read-modify-write sobre la entidad más disputada.
2. **Operaciones atómicas sobre read-modify-write.** Contadores y rankings usan ops atómicas de
   Redis (`incrBy`/`hIncrBy` para recursos y niveles; `zAdd`/`zIncrBy` para pool y leaderboards).
   Nunca se hace leer-en-Node, modificar, y reescribir un contador.
3. **Concurrencia optimista solo para la mutación compuesta rara.** Cuando una operación debe
   coordinar dos efectos (p. ej. debitar recursos *y* subir el nivel de un consejero como una
   unidad), se usa `watch`/`multi`/`exec`: se vigila la clave, se valida la precondición
   (saldo suficiente), y si `exec` aborta por modificación concurrente se reintenta con backoff
   acotado. El débito que dejaría saldo negativo se rechaza dentro de la validación.

Política de conflicto general: **last-write-wins** es aceptable para estado no crítico; el estado
crítico (saldo, nivel, recompensas) se protege con (1)-(3) y con idempotencia (ADR-0005).

## Consequences
- El doble gasto concurrente se resuelve: a lo sumo una transacción `exec` gana; la otra reintenta
  y observa el saldo ya consumido.
- El doble crédito por reintento se neutraliza combinando ops atómicas con tokens de idempotencia.
- Mantener los generales inmutables condiciona el diseño de balance: re-balancear no migra
  generales viejos; se versiona el motor y los generales conservan su semántica de acuñación.

## Alternatives considered
- **Locks distribuidos** (SETNX como mutex con TTL): viable pero añade complejidad y riesgo de
  deadlock/expiración; reservado solo para secciones críticas si (1)-(3) no bastaran.
- **Read-modify-write sin protección**: rechazado; produce doble gasto bajo carrera.
