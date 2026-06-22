# Run Training

Ciclo de vida de una run de entrenamiento: el servidor emite la semilla y el deck, el cliente
juega localmente, y el servidor re-simula al enviar para acuñar un general inmutable.

## Requirements

### Requirement: Start Run
El servidor SHALL, ante una petición de inicio, generar un `runId` y una `seed`, persistir el
estado de la run con expiración, y devolver al cliente la `seed` y el `deckSnapshot` del loadout.
La `seed` y el `deckSnapshot` SHALL ser determinados por el servidor, nunca por el cliente.

#### Scenario: Inicio de run entrega semilla y deck (happy)
- GIVEN un usuario autenticado con un loadout de 4 consejeros
- WHEN solicita iniciar una run
- THEN el servidor crea `runId` + `seed`, persiste la run como abierta con TTL
- AND devuelve `seed` y `deckSnapshot` al cliente

#### Scenario: Loadout inválido al iniciar (sad)
- GIVEN un usuario cuyo loadout referencia un consejero que no posee
- WHEN solicita iniciar una run
- THEN el servidor rechaza la petición
- AND no se crea ninguna run

### Requirement: Submit Run And Mint General
El servidor SHALL, al recibir el `actionLog`, re-simular la run con la `seed` y el `deckSnapshot`
originales mediante `simulation-engine`, y acuñar un `General` **inmutable** con el resultado
autoritativo. El general acuñado SHALL incorporarse al pool de fantasmas para PvP.

#### Scenario: Envío válido acuña general (happy)
- GIVEN una run abierta y un `actionLog` válido de 8 turnos
- WHEN el usuario envía el `actionLog`
- THEN el servidor re-simula, acuña un `General` con stats/tier/poder autoritativos
- AND lo registra como propiedad del usuario
- AND lo añade al pool de matchmaking

#### Scenario: El general acuñado es inmutable (happy)
- GIVEN un general recién acuñado
- WHEN cualquier flujo posterior intenta modificar sus stats
- THEN la operación no está permitida y el general permanece tal cual fue acuñado

#### Scenario: Stats reclamadas por el cliente son ignoradas (sad)
- GIVEN un envío que incluye stats finales calculadas por el cliente
- WHEN el servidor procesa el envío
- THEN el servidor descarta las stats del cliente y usa exclusivamente su re-simulación
- AND si difieren, registra la discrepancia para telemetría de abuso

#### Scenario: actionLog que falla validación (sad)
- GIVEN un `actionLog` con una acción ilegal o fuera de cota
- WHEN se envía
- THEN el servidor rechaza el envío sin acuñar general

### Requirement: Idempotent Submission
El envío de una run SHALL aceptar un token de idempotencia. Reintentos con el mismo token
SHALL devolver el mismo general sin acuñar duplicados.

#### Scenario: Reintento por red móvil inestable (happy)
- GIVEN un envío que se reintenta con el mismo token de idempotencia tras un timeout de red
- WHEN el servidor recibe el segundo intento
- THEN devuelve el general ya acuñado
- AND no acuña un segundo general ni duplica recompensas

### Requirement: Run Expiry And Replay Protection
Una run abierta SHALL expirar tras una ventana configurable. Un envío contra un `runId`
inexistente, ya consumido o expirado SHALL ser rechazado.

#### Scenario: Envío contra run expirada (sad)
- GIVEN una run cuyo TTL ya venció
- WHEN el usuario envía su `actionLog`
- THEN el servidor rechaza el envío como expirado
- AND no acuña general

#### Scenario: Reuso de una run ya consumida (sad)
- GIVEN una run que ya fue enviada y cerrada
- WHEN llega un envío distinto para el mismo `runId` (token de idempotencia diferente)
- THEN el servidor lo rechaza por run ya consumida

### Requirement: Run Throttling
El servidor SHALL aplicar un tope de runs por usuario por ventana de tiempo para evitar
inundar el pool de fantasmas.

#### Scenario: Tope diario de runs alcanzado (sad)
- GIVEN un usuario que alcanzó su tope de runs en la ventana actual
- WHEN intenta iniciar otra run
- THEN el servidor rechaza la petición indicando el límite
- AND no consume cuota adicional
