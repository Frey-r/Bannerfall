# Plan: Bannerfall — corte vertical sobre Devvit Web

## Context

Bannerfall es un roguelike de gestión militar para **Reddit / Devvit Web**: el jugador entrena un
general en runs cortas (8 turnos), lo "acuña" como entidad inmutable y lo lanza a un PvP asíncrono
de fantasmas; la metaprogresión y los eventos diarios son el gancho de retención. El repo hoy
contiene **solo la especificación** (project.md, AGENTS.md, config.yaml, 6 specs, 7 ADRs, 5 mockups)
— no hay código todavía.

Decisiones del usuario que fijan el rumbo:
- **Prioridad #1 es Devvit.** No es portable: se construye y se piensa para Devvit Web (runtime
  Node serverless de Reddit + Redis gestionado por Devvit). No se crean abstracciones para "otro
  runtime".
- **Bun es la toolchain** del proyecto: package manager, runner de tareas, runner de tests. El build
  de cliente/servidor sigue siendo Vite (Devvit exige `dist/client` + `dist/server/index.cjs`) y el
  deploy/playtest usa el CLI `devvit`. La ejecución en producción es el runtime Node de Devvit; Bun
  conduce el desarrollo local.
- **Persistencia:** Redis de Devvit (`@devvit/web/server`). Para pruebas locales se acepta Docker
  (Redis local detrás de un adaptador), pero las pruebas de determinismo del motor son puras y no
  tocan Redis.
- **Alcance de esta pasada: corte vertical** (`add-run-and-pvp-vertical-slice`): iniciar run → jugar
  8 turnos en cliente → enviar `actionLog` → el servidor re-simula y acuña general inmutable →
  matchmaking por banda de poder (con fallback NPC) → batalla determinista → recompensa atómica +
  leaderboard. Eventos diarios y scheduler quedan para una pasada posterior.

Framework elegido (delegado al asistente): **Express + `@devvit/web/server`** en el servidor
(patrón canónico de Devvit Web), **React 19 + Vite** en el cliente (la UI es de menús y tarjetas,
encaja mejor que Phaser; la animación de batalla se hace con un canvas/CSS ligero), y un paquete
**`src/shared`** con el motor determinista puro reutilizado por cliente y servidor. **Vitest** para
las pruebas de determinismo (gate obligatorio según AGENTS.md).

El motor de simulación es el **límite de integridad** (ADR-0001): el cliente previsualiza, el
servidor re-simula y es la única fuente de verdad. Implementarlo primero y bien de-riskea todo lo
demás.

## Stack / versiones de referencia (verificado contra el template oficial)

`@devvit/web` y `devvit` `^0.12.11` · `express` 5 · `react`/`react-dom` 19 · `vite` 6 ·
`vitest` 3 · TypeScript 5.8 · Tailwind 4 (opcional para estilos). Toolchain con **Bun**
(`bun install`, `bun run <script>`, `bun run test`).

## Estructura del proyecto

```
Bannerfall/
  devvit.json            # post entrypoints, server entry, menu, triggers
  package.json           # scripts (Bun), deps Devvit Web
  bunfig.toml            # config Bun (test runner)
  tsconfig.json          # base + project refs (shared/server/client)
  .env.dev               # flags de dev local (IS_DEV, REDIS_URL para Docker)
  src/
    shared/
      types/             # General, Consejero, DeckSnapshot, ActionLog, BattleResult, DTOs API
      sim/
        prng.ts          # PRNG sembrado (mulberry32/xoshiro128**) — sin Math.random/Date.now
        balance.ts       # constantes: cotas de stats, bandas de tier, umbrales de habilidad
        simulateRun.ts   # simulateRun(seed, deckSnapshot, actionLog) -> General (pura)
        simulateBattle.ts# simulateBattle(seed, A, B) -> BattleResult (pura, log ronda a ronda)
        validate.ts      # validación de actionLog (longitud, consejero presente, cotas)
        index.ts         # API pública del motor
    server/
      index.ts           # app Express, monta routers, startServer
      devvitProxy/       # barrel que conmuta @devvit/web/server (prod) vs adaptador local (Docker)
      routes/
        meta.ts          # GET /api/init, GET /api/profile, GET /api/leaderboard (paginado)
        run.ts           # POST /api/run/start, POST /api/run/submit
        pvp.ts           # POST /api/pvp/battle
        internal.ts      # /internal/menu/post-create, /internal/on-app-install (siembra NPCs)
      core/
        keys.ts          # builders de claves Redis (ADR-0004)
        idempotency.ts   # guarda SETNX (redis.set nx+expiration) + cache de resultado
        runs.ts          # ciclo de vida de run (start/submit, TTL, throttling)
        generals.ts      # acuñar/leer general, alta en pool, ownership
        matchmaking.ts   # banda de poder, exclusiones, fallback NPC, stale handling
        rewards.ts       # ledger no-negativo (txn), leaderboard atómico, idempotente por battleId
        npc.ts           # generación determinista de ~40 NPCs sembrados (cold start, ADR-0007)
        auth.ts          # identidad Reddit (context.userId) + ownership checks
    client/
      splash.html, game.html
      game/
        App.tsx          # router de pantallas
        screens/         # Home, RunSetup, RunPlay, Pvp, Collection (según mockups)
        battle/          # canvas/CSS de replay de batalla a partir del log
        api.ts           # wrappers fetch a /api/* con token de idempotencia
        preview.ts       # usa src/shared/sim para previsualizar run/batalla (sin autoridad)
  tests/
    prng.test.ts
    simulateRun.test.ts  # replay cliente↔servidor, eventos deterministas, cotas, sad paths
    simulateBattle.test.ts
    rewards.test.ts      # idempotencia + no-negatividad (con adaptador redis local)
```

> Nota: se puede arrancar desde el template oficial (`npm create devvit@latest` / template
> bare) y adaptar, o autorar los archivos directamente. El patrón `devvitProxy` (conmutar
> `@devvit/web/server` real vs adaptador local con Redis de Docker) se toma del
> `devvit-local-dev-template` para poder iterar local sin desplegar en cada cambio.

## Modelo de dominio (concreción de las specs)

Las specs son contratos de comportamiento y dejan los números al diseño. Se define aquí lo mínimo
del slice:

- **Consejero**: `{ id, name, affinity: 'OFE'|'DEF'|'MAN', level }`. Su nivel modula el bono de
  entrenamiento y la potencia de habilidad (meta-progression).
- **Deck / loadout**: **3 consejeros** activos (coincide con el mockup `run-setup.md`,
  "ELIGE 3 CONSEJEROS"). *Nota de discrepancia:* la spec `run-training` menciona en un escenario un
  "loadout de 4 consejeros"; se adopta 3 por ser el dato concreto de UI — confirmable luego sin
  reescribir el motor (`deckSnapshot` es de longitud variable). `deckSnapshot` = copia inmutable de
  los consejeros (id, affinity, level) al iniciar la run.
- **ActionLog**: exactamente **8 acciones**; cada acción = `{ consejeroId, choice }` donde `choice`
  entrena una stat (OFE/DEF/MAN). El motor aplica bono base + afinidad/nivel del consejero +
  eventos de campaña sembrados; clampa a cotas (`balance.ts`).
- **General** (inmutable): `{ id, ownerId, name, stats:{ofe,def,man}, power, tier, abilities[],
  seed, schemaVersion, createdAt }`. `power` = suma ponderada de stats; `tier` por bandas; las
  `abilities` se derivan de umbrales/eventos de forma determinista.
- **BattleResult**: `{ battleId, winnerId, rounds:[...], seed }`. Iniciativa por **Mando (MAN)**;
  cada ronda calcula daño = f(ofe atacante, def defensor, habilidades, PRNG); HP derivada de stats.
  El `rounds[]` permite reproducir la animación y el "war report".

## Modelo de datos Redis (subset del ADR-0004 para el slice)

| Clave                     | Tipo        | Uso                                                |
|---------------------------|-------------|----------------------------------------------------|
| `user:{id}`               | hash        | oro, nivel asentamiento, `schemaVersion`           |
| `user:{id}:generals`      | sorted set  | generales propios (score = createdAt)              |
| `general:{gid}`           | string JSON | general inmutable + seed + ownerId; **TTL 30-45 d**|
| `pool:power`              | sorted set  | matchmaking; score = poder; capado por tamaño      |
| `run:{runId}`             | string JSON | run abierta (seed, deckSnapshot, ownerId); **TTL** |
| `lb:season:1`             | sorted set  | leaderboard de temporada                           |
| `battle:{bid}`            | string JSON | resultado + seed de replay; TTL corto              |
| `idemp:{token}`           | string      | dedupe de mutaciones; TTL                          |
| `rate:{id}:run:{ventana}` | string/int  | throttling de runs por ventana                     |

- **Atomicidad** (ADR-0003): `hIncrBy`/`incrBy` para oro y contadores; `zAdd`/`zIncrBy` para pool y
  leaderboard; `redis.watch/multi/exec` para el débito no-negativo del ledger y el leveleo
  compuesto. Nunca read-modify-write en Node sobre un contador.
- **Idempotencia** (ADR-0005): `redis.set(idemp:{token}, result, { nx:true, expiration })`; si ya
  existía, devolver el resultado cacheado. Claves de efecto naturales: `battle:{bid}` para el
  crédito de victoria.
- **Cuota** (ADR-0004): TTL en `general`/`run`/`battle`/`idemp`; pool capado con `zRemRangeByRank`
  tras insertar; lecturas de pool/leaderboard **paginadas** (límite 5 MB request / 500 MB store).

## Plan de implementación (orden por dependencia)

1. **Scaffolding Devvit Web + Bun.** `devvit.json`, `package.json` (scripts Bun: `dev`, `build`,
   `test`, `playtest`, `deploy`), tsconfig con project refs, `bunfig.toml`. Verificar `bun install`
   y `bun run build` produce `dist/`.
2. **`src/shared/sim` (el límite de integridad).** PRNG sembrado → `balance.ts` →
   `validate.ts` → `simulateRun` → `simulateBattle`. **Sin `Math.random`/`Date.now`/estado global.**
   Escribir en paralelo la suite Vitest (replay determinista, eventos, cotas, sad paths). Este es el
   gate: AGENTS.md exige determinismo verde antes de dar por terminado.
3. **Núcleo servidor + Redis.** `keys.ts`, `idempotency.ts`, `auth.ts` (ownership vía
   `context.userId`), `validation.ts`. Adoptar el `devvitProxy` para conmutar Redis real vs Docker.
4. **run-training.** `routes/run.ts` + `core/runs.ts`: `start` (servidor fija seed+deckSnapshot,
   persiste run con TTL, throttling) y `submit` (re-simula con el motor, descarta stats del cliente,
   acuña general inmutable, lo añade a `user:{id}:generals` y a `pool:power`; idempotente; rechaza
   run expirada/consumida).
5. **combat-pvp.** `core/matchmaking.ts` (banda de poder, excluir propios + NPCs del "no pelear
   contigo mismo", re-emparejar si el oponente expira) + `core/npc.ts` (sembrar ~40 NPCs en
   `on-app-install` y en dev) + `routes/pvp.ts` (resolver con `simulateBattle`, persistir
   `battle:{bid}`).
6. **meta-progression (mínimo del slice).** `core/rewards.ts`: ledger no-negativo (credito de oro
   atómico tras victoria), leaderboard atómico, idempotente por `battle:{bid}`; `GET /api/profile`
   y `GET /api/leaderboard` paginado. Schema versioning + defaults en lectura de `user:{id}`.
   (Leveleo de consejeros y asentamiento: stub/siguiente pasada.)
7. **Cliente React.** Pantallas según mockups: Home (JUGAR → Run/PvP), RunSetup (elige 3 +
   nombra), RunPlay (8 turnos con preview usando `shared/sim`), Pvp (tu general, banda, buscar
   rival, replay de batalla), Collection (generales; consejeros básico). `api.ts` envía token de
   idempotencia en cada mutación.
8. **Cold start / pulido.** Verificar NPCs poblando pool y leaderboard desde el minuto cero;
   manejo de errores tolerante (campo corrupto → default seguro).

## Reglas transversales a respetar en todo el código (security spec + AGENTS.md)

- **Cliente sin autoridad:** toda salida que afecte PvP/leaderboard/economía se re-simula o se
  computa en el servidor; las stats que mande el cliente se descartan (y se registra discrepancia).
- **Autorización:** cada mutación verifica que `context.userId` es dueño del recurso.
- **Idempotencia obligatoria** en todo endpoint mutador.
- **Validación de cotas** de toda entrada antes de simular o mutar.
- **Disciplina de tamaño:** paginar pool/leaderboard; nunca volcar colecciones completas.
- **Determinismo:** el motor no usa entropía ambiental; la suite de determinismo debe fallar ante
  cualquier deriva.

## Verificación (end-to-end)

1. **Gate de determinismo:** `bun run test` (Vitest) verde. Casos clave:
   - misma seed → misma secuencia PRNG (100 valores);
   - replay cliente↔servidor de `simulateRun` idéntico (stats/poder);
   - `simulateBattle` rinde mismo ganador y log con la misma seed;
   - sad paths: `actionLog` de 9 acciones rechazado, consejero ausente rechazado, saturación de
     stats sin `NaN`/overflow.
2. **Build:** `bun run build` genera `dist/client` + `dist/server/index.cjs` sin errores de tipos.
3. **Local (Docker Redis):** `bun run dev` (Express local + adaptador Redis), abrir el cliente,
   ejecutar el bucle completo: start run → 8 turnos → submit → ver general acuñado → PvP vs NPC →
   ver recompensa de oro y posición en leaderboard. Reintentar submit con el mismo token → no
   duplica general.
4. **En Reddit:** `devvit playtest <subreddit-de-pruebas>` → crear post desde el menú del subreddit
   → jugar el bucle en la webview real → confirmar persistencia en el Redis de Devvit y que un
   segundo usuario aparece como fantasma en el pool del primero.
5. **Idempotencia/atomicidad** (`tests/rewards.test.ts` con Redis local): doble crédito por
   reintento neutralizado; débito que dejaría saldo negativo rechazado bajo concurrencia.

## Fuera de alcance de esta pasada

Eventos diarios + scheduler/cron (`daily-events`), leveleo de consejeros y asentamiento avanzados,
eventos especiales de tiempo limitado, y el flujo OpenSpec de `changes/` (propose→apply→archive).
Se abordan en una segunda pasada una vez verde el corte vertical.

## Fuentes

- [@devvit/web — npm](https://www.npmjs.com/package/@devvit/web)
- [devvit-local-dev-template (estructura, devvit.json, proxy)](https://github.com/1ennyTM/devvit-local-dev-template)
- [reddit/devvit-docs — Redis (transacciones, sorted sets, cuotas)](https://github.com/reddit/devvit-docs/blob/main/docs/capabilities/server/redis.mdx)
