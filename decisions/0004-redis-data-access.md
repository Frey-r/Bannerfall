# ADR-0004: Acceso y manejo de datos en Redis

## Status
Accepted

## Context
Redis (gestionado por Devvit) es el único almacén persistente. La cuota es finita, así que el pool
de fantasmas y los leaderboards no pueden crecer sin control. El acceso se hace con el cliente que
Devvit expone por invocación (ver ADR-0002). Necesitamos un esquema de claves estable, ops
atómicas y una estrategia de expiración que mantenga Redis acotado.

## Decision

### Namespacing de claves
Convención `dominio:id[:sub]`, sin espacios ni separadores de ruta:

| Clave                       | Tipo          | Uso                                                        |
|-----------------------------|---------------|------------------------------------------------------------|
| `user:{id}`                 | hash          | recursos, nivel de asentamiento, versión de esquema        |
| `user:{id}:consejeros`      | hash          | consejeroId → nivel                                        |
| `user:{id}:generals`        | sorted set    | generales propios (score = createdAt)                     |
| `general:{gid}`             | string (JSON) | general inmutable + seed + ownerId; **TTL 30-45 días**     |
| `pool:power`                | sorted set    | matchmaking; score = poder; acotado por tamaño             |
| `lb:daily:{fecha}`          | sorted set    | ranking diario; TTL tras unos días                         |
| `lb:season:{n}`             | sorted set    | ranking de temporada                                       |
| `daily:{fecha}`             | hash          | seed/enemigo/modificador/postId del reto                   |
| `user:{id}:daily:{fecha}`   | string        | flag de reclamo; TTL ~48 h                                 |
| `battle:{bid}`              | string (JSON) | resultado + seed de replay; TTL corto                      |
| `idemp:{token}`             | string        | dedupe de mutaciones; TTL                                  |

### Ops y atomicidad
- Contadores/niveles: `hIncrBy` / `incrBy`. Rankings/pool: `zAdd` / `zIncrBy` / `zRangeByScore`.
- Mutación compuesta crítica: `watch`/`multi`/`exec` (ver ADR-0003).
- Matchmaking: `zRangeByScore pool:power [P-banda, P+banda]` con `LIMIT`, filtrando propios y NPCs.

### Estrategia de expiración y cuota (mantener Redis acotado)
- **TTL por entidad efímera**: `general:{gid}`, `battle:{bid}`, flags de reclamo e idempotencia.
  El pool se auto-poda al expirar sus generales.
- **Leaderboards keyed por fecha**: rotan solos al cambiar la fecha; los antiguos expiran.
- **Pool capado**: tras insertar, si `zCard(pool:power)` supera el tope, recortar con
  `zRemRangeByRank` los de menor poder o más antiguos.
- **Paginación obligatoria** en lecturas de pool/leaderboard para respetar el límite de 10 MB.

## Consequences
- Redis permanece acotado sin un job de limpieza pesado: TTL + rotación por fecha + cap del pool.
- El esquema de claves es predecible y permite barridos por prefijo en diagnóstico.
- La matemática de cuota debe revisarse al escalar (tamaño del pool × tamaño de `general:{gid}`).

## Alternatives considered
- **Sin TTL, limpieza periódica por cron**: posible, pero más frágil y caro que dejar que TTL haga
  el trabajo. El cron se reserva para rotación/poda complementaria, no como única defensa.
- **Un único blob JSON gigante por usuario**: simple pero rompe la atomicidad de los contadores y
  arriesga el límite de payload. Rechazado.
