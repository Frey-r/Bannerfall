# Security

Requisitos no funcionales transversales de integridad, autorización y resistencia al abuso.
Aplican a todas las capabilities. El modelo de amenaza principal es un **cliente no confiable**
que intenta inflar generales, duplicar recompensas o envenenar el pool/leaderboard.

## Requirements

### Requirement: Server-Authoritative State
Toda salida que afecte al PvP, al leaderboard o a la economía SHALL ser computada o re-simulada
en el servidor. El servidor MUST NOT aceptar como autoritativo ningún valor de resultado
calculado por el cliente.

#### Scenario: Carga de stats forjadas (sad)
- GIVEN un cliente modificado que envía un general con stats infladas
- WHEN el servidor procesa el envío de la run
- THEN el servidor re-simula a partir de `seed` + `actionLog` y descarta las stats del cliente
- AND el general acuñado refleja solo la re-simulación autoritativa

#### Scenario: Mutación autoritativa legítima (happy)
- GIVEN un usuario autenticado que opera sobre sus propios recursos
- WHEN solicita una mutación válida
- THEN el servidor la computa, la persiste y devuelve el estado autoritativo

### Requirement: Authorization And Ownership
Cada operación SHALL verificar que la identidad de Reddit del solicitante es dueña del recurso
afectado. Un usuario MUST NOT poder mutar entidades de otro usuario.

#### Scenario: Intento de mutar recurso ajeno (sad)
- GIVEN el usuario A
- WHEN intenta subir de nivel un consejero del usuario B
- THEN el servidor rechaza la operación por autorización
- AND el estado de B no cambia

#### Scenario: Petición sin identidad válida (sad)
- GIVEN una petición sin contexto de usuario de Reddit válido
- WHEN llega a un endpoint que requiere autenticación
- THEN el servidor la rechaza como no autenticada

### Requirement: Idempotent Mutations
Todo endpoint que muta estado SHALL exigir un token de idempotencia y SHALL garantizar efecto
único ante reintentos.

#### Scenario: Reintento de mutación (happy)
- GIVEN una mutación reintentada con el mismo token de idempotencia
- WHEN el servidor recibe el reintento
- THEN aplica el efecto una sola vez y devuelve el resultado original

### Requirement: Input Validation And Bounds
Toda entrada SHALL validarse contra su esquema y sus cotas antes de procesarse. Entradas fuera de
rango o malformadas SHALL rechazarse sin efecto colateral.

#### Scenario: Entrada fuera de cota (sad)
- GIVEN un `actionLog` que declara cientos de turnos
- WHEN se envía
- THEN el servidor lo rechaza por exceder las cotas
- AND no se ejecuta ninguna simulación ni mutación

### Requirement: Rate Limiting And Abuse Caps
El servidor SHALL imponer topes por usuario sobre runs, batallas y reclamos para proteger la
integridad del pool, del leaderboard y de la cuota de Redis.

#### Scenario: Inundación de peticiones (sad)
- GIVEN un usuario que supera su tope de peticiones en la ventana
- WHEN sigue enviando peticiones
- THEN el servidor las limita (throttle) y las rechaza con indicación de reintento
- AND el resto de usuarios no se ve afectado

### Requirement: Response Size Discipline
Las respuestas SHALL mantenerse dentro de los límites de plataforma (payload ≤ 4 MB,
respuesta ≤ 10 MB). Las colecciones grandes (leaderboard, pool) SHALL paginarse.

#### Scenario: Lectura de leaderboard extenso (happy)
- GIVEN un leaderboard con muchos miles de entradas
- WHEN un cliente solicita el ranking
- THEN el servidor devuelve una página acotada por debajo del límite
- AND nunca vuelca la estructura completa en una sola respuesta

### Requirement: No Secret Or PII Exposure
El cliente MUST NOT contener secretos ni credenciales. El servidor SHALL exponer solo la
identidad provista por Reddit y MUST NOT filtrar datos de un usuario a otro.

#### Scenario: Identidad mínima en respuestas (happy)
- GIVEN una respuesta que incluye datos de un oponente PvP
- WHEN se serializa al cliente
- THEN incluye solo lo necesario para la batalla y la presentación pública
- AND no expone datos privados del oponente
