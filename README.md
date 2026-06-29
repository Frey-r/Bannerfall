# Bannerfall

> Forja generales en *runs* de entrenamiento, llévalos a una arena PvP asíncrona de fantasmas
> y escala tu asentamiento entre partidas. Un juego de táctica por turnos construido sobre
> **Reddit Devvit**, donde cada resultado es **determinista, reproducible y verificado por el servidor**.

App de Devvit: **`tiny-tacticians`** · Cliente **Phaser 4** · Servidor **Devvit Web (Express 5)** · Estado en **Redis gestionado**.

---

## ⏱️ Del primer commit al cierre de la jam

| Hito | Fecha |
|------|-------|
| **Inicio del proyecto** (primer commit) | `2026-06-22` |
| **Cierre de la hackatón** (fecha límite de entrega) | `2026-07-15` |
| **Ventana total de la jam** | **≈ 23 días** (del 22 de junio al 15 de julio de 2026) |

Todo el sistema —motor determinista, anti-cheat estructural, PvP asíncrono, meta-progresión,
eventos diarios por scheduler, 9 escenas de Phaser y una suite de 13 conjuntos de pruebas— se
diseña, especifica e implementa dentro de esa ventana de ~23 días. *(El primer commit cargó el
andamiaje el 22 de junio; el desarrollo continúa hasta la entrega del 15 de julio.)*

---

## 🎯 Propósito

Bannerfall responde a una pregunta de diseño concreta: **¿cómo se construye un juego competitivo
multijugador sobre una webview no confiable, sin netcode en tiempo real y sin que el cliente pueda
hacer trampa?**

La respuesta es el corazón del proyecto: un **motor de simulación determinista compartido** entre
cliente y servidor. El cliente lo usa para que la partida se sienta instantánea (sin un round-trip
por turno); el servidor lo re-ejecuta como **única fuente de verdad**. Inflar stats es
estructuralmente imposible: la semilla y el mazo salen del servidor, y el resultado se vuelve a
simular byte a byte.

Sobre esa base se monta un bucle de juego completo pensado para una comunidad de Reddit:

- **Asíncrono por diseño** — el PvP enfrenta a *fantasmas* (generales guardados de otros jugadores).
  No hay sincronía en vivo: una batalla se reduce a `(seed, generalA, generalB)` reproducible.
- **Cold-start resuelto** — si no hay rival humano en tu banda de poder, entras contra un NPC
  sembrado, así una comunidad recién creada nunca se queda sin oponente.
- **Retención diaria** — un reto diario generado por cron entrega recursos y contratos de
  reclutamiento, dando una razón para volver cada día.

---

## 🕹️ Bucle de juego

```
        ┌─────────────────────────────────────────────────────────────┐
        │                                                             │
        ▼                                                             │
  CORRER RUN ──► entrenas 8 turnos con dados sembrados ──► ENVÍAS    │
  (el servidor                y consejeros del mazo          actionLog │
   emite seed + deck)                                            │     │
                                                                ▼     │
                                              EL SERVIDOR RE-SIMULA   │
                                              y ACUÑA un GENERAL      │
                                              inmutable y autoritativo │
                                                                │     │
                          ┌─────────────────────────────────────┘     │
                          ▼                                            │
                    PvP / ARENA ──► batalla determinista vs fantasma   │
                    (matchmaking      o NPC ──► recompensas atómicas    │
                     por banda                  + leaderboard           │
                     de poder)                       │                  │
                                                     ▼                  │
                                         META-PROGRESIÓN ───────────────┘
                                         (oro, subir consejeros,
                                          asentamiento, reclutar)
```

1. **Run de entrenamiento.** El servidor te entrega una `seed` y el `deckSnapshot` de tu loadout.
   Durante 8 turnos eliges **entrenar** una afinidad (asignando consejeros del mazo), **descansar**
   para recuperar energía, o resolver un **evento** de campaña. Cada entrenamiento y cada rama
   probabilística se resuelve con dados sembrados → banda **FALLO / NORMAL / CRÍTICO**.
2. **Acuñación.** Al enviar tu `actionLog`, el servidor lo re-simula y acuña un **General inmutable**
   con stats, *tier*, poder y habilidades autoritativas. Las habilidades pueden venir de cruzar
   umbrales de stat **o** del *bond* (afinidad) acumulado con un consejero durante la run.
3. **Arena PvP.** Tu general entra a un *matchmaking por banda de poder* contra fantasmas de otros
   jugadores (o un NPC si el pool está vacío). El servidor resuelve la batalla ronda a ronda de
   forma determinista y acredita recompensas de forma **atómica e idempotente**.
4. **Meta-progresión.** Gastas oro para subir consejeros y tu asentamiento, y reclutas nuevos
   consejeros vía **contratos** (desbloqueo permanente) o el **préstamo diario** (temporal, 24 h).

---

## ✨ Características clave

- **Motor determinista compartido** (`src/shared/sim`): PRNG sembrado + funciones puras
  `simulateRun` y `simulateBattle`. Sin `Math.random`, sin `Date.now`, sin estado global.
- **Servidor autoritativo / anti-cheat estructural**: el cliente solo transmite intenciones
  acotadas (`actionLog`); todo resultado que toque PvP, leaderboard o economía se recomputa.
- **Generales inmutables**: una vez acuñados nunca cambian, lo que elimina casi todas las
  condiciones de carrera. Los contadores usan ops atómicas de Redis, no read-modify-write.
- **Idempotencia de extremo a extremo**: todo endpoint que muta estado exige token de idempotencia;
  los reintentos por red móvil inestable no duplican generales, recompensas ni puntuación.
- **Dados restringidos y modificadores puros**: los consejeros y la energía reforman la tirada
  (`DiceRoll → DiceRoll`) moviendo umbrales y añadiendo dados de ventaja, con cotas seguras.
- **PvP de fantasmas + fallback NPC**: matchmaking por banda de poder con exclusión de generales
  propios y manejo de oponentes caducados (re-emparejamiento en lugar de fallar).
- **Eventos diarios por scheduler**: reto del día idempotente (con *lazy creation* si el cron
  falla) que entrega un **contrato** cuyo color depende del modificador del día.
- **Compatibilidad hacia adelante**: toda entidad persistida lleva versión de esquema; al leer
  datos legados se aplican defaults sin romper al usuario.

---

## 🏗️ Arquitectura

El proyecto se rige por una metodología **spec-driven** (estilo OpenSpec): las `specs/*.spec.md`
son el **contrato de comportamiento** (qué se observa, en formato GIVEN/WHEN/THEN), y las
`decisions/*.md` (ADRs) registran el **cómo** (claves Redis, concurrencia, TTL).

### Límite de integridad (la decisión fundacional — [ADR-0001](decisions/0001-deterministic-simulation-engine.md))

```
   CLIENTE (webview no confiable)              SERVIDOR (fuente de verdad)
   ──────────────────────────────             ──────────────────────────────
   simulateRun(seed, deck, log)  ── previsualiza ──►  emite seed + deck
   simulateBattle(seed, A, B)    ── anima ─────────►  RE-SIMULA y acuña/resuelve
                                                       persiste en Redis (atómico)
                  ▲                                              │
                  └──────────── mismo paquete @shared ───────────┘
```

El **mismo código** viaja a ambos lados; el cliente nunca tiene autoridad. Esto da anti-cheat
estructural y un PvP asíncrono barato, a costa de una restricción dura: el motor **debe** ser
determinista, garantizado por una suite de pruebas que falla ante cualquier deriva.

### Capas

| Capa | Ruta | Responsabilidad |
|------|------|-----------------|
| **Shared / Sim** | `src/shared/sim` | PRNG, dados, `simulateRun`, `simulateBattle`, balance, validación. El motor determinista. |
| **Server** | `src/server` | Express 5 sobre Devvit Web. Rutas de run, PvP, daily, meta, reclutamiento; core de generales, matchmaking, NPC, recompensas, idempotencia, rate-limit y proxy gRPC de Devvit. |
| **Client** | `src/client` | 9 escenas de Phaser 4 (Boot, Home, RunSetup, RunPlay, Pvp, PvpCombat, Collection, Eventos, Reclutamiento), tema/widgets/terreno propios y capa de API. |

---

## 🧰 Stack tecnológico

- **Plataforma:** Reddit **Devvit Web** (`@devvit/web`, `@devvit/public-api`)
- **Cliente:** **Phaser 4.2** + **TypeScript**, bundleado con **Vite 6**
- **Servidor:** **Express 5** (beta) ejecutado dentro del runtime de Devvit
- **Estado:** **Redis gestionado** por Devvit (ops atómicas; nada que hostear)
- **Pruebas:** **Vitest 3** (13 suites; incluye pruebas de determinismo del motor)
- **Runtime de scripts:** **Bun** para el dev server

---

## 📁 Estructura del repositorio

```
Bannerfall/
├─ src/
│  ├─ shared/sim/      # Motor determinista: prng, dice, simulateRun, simulateBattle, balance, validate
│  ├─ server/          # Devvit Web (Express): routes/ + core/ + devvitProxy/
│  └─ client/          # Phaser: scenes/ + ui/ + api/state
├─ specs/              # Contratos de comportamiento (GIVEN/WHEN/THEN) por capability
├─ decisions/          # ADRs: motor determinista, conexiones, concurrencia, Redis, idempotencia…
├─ mockups/            # Wireframes ASCII de cada pantalla (home, pvp, colección, eventos, run-setup)
├─ tests/              # 13 suites Vitest (determinismo, balance, recompensas, daily, rate-limit…)
├─ scripts/dev.mjs     # Dev server (Bun)
└─ AGENTS.md           # Guía y reglas de oro para asistentes de IA
```

### Capabilities especificadas (`specs/`)

| Spec | Qué cubre |
|------|-----------|
| [`simulation-engine`](specs/simulation-engine.spec.md) | Determinismo del PRNG, `simulateRun`, `simulateBattle`, seguridad numérica acotada. |
| [`dice-resolution`](specs/dice-resolution.spec.md) | Dados sembrados, dados restringidos, modificadores como transformaciones puras. |
| [`run-training`](specs/run-training.spec.md) | Ciclo start → submit → acuñar; asignación de consejeros, bond y desbloqueo de habilidades. |
| [`combat-pvp`](specs/combat-pvp.spec.md) | Matchmaking por banda, fallback NPC, resolución determinista, recompensas atómicas. |
| [`meta-progression`](specs/meta-progression.spec.md) | Ledger de oro, niveles de consejero/asentamiento, reclutamiento, versionado de esquema. |
| [`daily-events`](specs/daily-events.spec.md) | Reto diario por cron, *lazy creation*, reclamo idempotente, contrato por color. |
| [`security`](specs/security.spec.md) | Autoridad de servidor, autorización/ownership, idempotencia, validación, rate-limit. |

---

## 📖 Glosario del juego

- **General** — la unidad coleccionable e **inmutable** que acuñas al terminar una run; combate en PvP.
- **Consejero** — mentor con una **afinidad** (`OFE` ofensiva · `DEF` defensa · `MAN` mando) que asignas
  a los entrenamientos; aporta modificadores al dado y puede desbloquear una habilidad por *bond*.
- **Bond** — afinidad acumulada con un consejero **durante una run** (no se persiste); al cruzar un
  umbral, su habilidad de combate se une al general acuñado.
- **Run** — sesión de 8 turnos de entrenamiento que produce un general.
- **Fantasma** — general guardado de otro jugador, usado como oponente en el PvP asíncrono.
- **Contrato** — vale de color (rojo/`OFE`, azul/`DEF`, morado/`MAN`, blanco comodín) que canjeas
  por un consejero permanente; lo entregan los retos diarios.
- **Préstamo diario** — consejero aleatorio prestado por 24 h (no es desbloqueo permanente).

---

## 🚀 Puesta en marcha

> Requiere una cuenta de Reddit con acceso a Devvit. En Windows, la CLI se invoca vía Node
> (el shim de Bun puede fallar): `node node_modules/devvit/bin/devvit.js …` (alias en `package.json`).

```bash
# Instalar dependencias
npm install

# Pruebas (incluye el determinismo del motor — debe pasar antes de dar por cerrado un cambio)
npm test

# Desarrollo local (cliente + servidor)
npm run dev          # dev server completo (Bun)
npm run dev:client   # solo cliente (Vite)
npm run dev:server   # solo servidor (hot reload)

# Build de producción (cliente + servidor)
npm run build

# Devvit
npm run login        # autenticarse en Devvit
npm run upload       # subir la app
npm run playtest     # playtest en un subreddit
```

### Reglas de oro para contribuir (ver [`AGENTS.md`](AGENTS.md))

1. **El cliente no tiene autoridad.** Cualquier salida que afecte PvP, leaderboard o economía se
   recomputa o re-simula en el servidor.
2. **Determinismo.** El motor no usa `Math.random`, `Date.now` ni estado global. Todo lo aleatorio
   sale del PRNG sembrado.
3. **Generales inmutables.** Una vez acuñado, un general nunca se modifica. Para contadores, ops
   atómicas de Redis, no read-modify-write.
4. **Idempotencia.** Todo endpoint que muta estado exige un token de idempotencia.
5. Las **specs** describen el *qué*; los **ADRs** el *cómo*. No mezcles detalle de implementación
   en las specs. Antes de cerrar: las pruebas de determinismo del `simulation-engine` deben estar verdes.

---

<sub>Construido para una hackatón del 22 de junio al 15 de julio de 2026 · App de Devvit `tiny-tacticians`.</sub>
