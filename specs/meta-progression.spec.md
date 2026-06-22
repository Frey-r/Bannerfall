# Meta Progression

Progresión persistente entre runs: ledger de recursos, niveles de consejero, nivel de
asentamiento y versionado de esquema. Las victorias PvP y los eventos diarios alimentan esta capa,
que a su vez hace más fuertes las runs futuras (bucle de retención).

## Requirements

### Requirement: Non-Negative Resource Ledger
El servidor SHALL mantener el saldo de recursos del usuario mediante operaciones atómicas. Un
débito SHALL fallar atómicamente si dejaría el saldo negativo; no se permiten saldos negativos.

#### Scenario: Acreditación tras victoria (happy)
- GIVEN un usuario con saldo `B`
- WHEN se acreditan `r` recursos de una victoria
- THEN el saldo pasa a `B + r` de forma atómica

#### Scenario: Débito mayor que el saldo (sad)
- GIVEN un usuario con saldo `B`
- WHEN intenta gastar `c > B`
- THEN la operación se rechaza sin modificar el saldo

#### Scenario: Doble gasto concurrente (sad)
- GIVEN dos peticiones de gasto concurrentes que individualmente caben en el saldo pero juntas no
- WHEN ambas se procesan
- THEN a lo sumo una tiene éxito
- AND el saldo nunca queda negativo

### Requirement: Consejero Leveling
El servidor SHALL permitir subir el nivel de un consejero gastando recursos, de forma atómica.
El nivel de un consejero SHALL afectar su bono de entrenamiento, su pasiva y la potencia de su
habilidad cuando se lleve a una run futura.

#### Scenario: Subida de nivel válida (happy)
- GIVEN un usuario con saldo suficiente y un consejero por debajo del máximo
- WHEN sube el nivel del consejero
- THEN el nivel del consejero aumenta en 1
- AND el saldo se debita atómicamente por el costo

#### Scenario: Subida más allá del máximo (sad)
- GIVEN un consejero ya en su nivel máximo
- WHEN el usuario intenta subirlo
- THEN el servidor rechaza la operación
- AND no debita recursos

### Requirement: Settlement Leveling
El nivel del asentamiento SHALL subir al cruzar umbrales y SHALL desbloquear ventajas
(p. ej. un slot adicional de consejero o pasivas) en niveles definidos.

#### Scenario: Umbral alcanzado desbloquea ventaja (happy)
- GIVEN un asentamiento que alcanza el umbral del siguiente nivel
- WHEN se aplica la subida
- THEN el asentamiento sube de nivel
- AND se desbloquea la ventaja asociada a ese nivel

### Requirement: Schema Versioning And Forward Compatibility
Toda entidad persistida SHALL llevar una versión de esquema. Al leer una entidad con una versión
anterior o con campos ausentes, el servidor SHALL aplicar valores por defecto sin fallar.

#### Scenario: Lectura de perfil legado (happy)
- GIVEN un perfil persistido bajo una versión de esquema anterior
- WHEN el servidor lo lee tras un despliegue nuevo
- THEN aplica defaults a los campos ausentes
- AND el usuario continúa sin pérdida de datos ni error

#### Scenario: Campo corrupto o ilegible (sad)
- GIVEN una entidad con un campo corrupto
- WHEN el servidor la lee
- THEN sustituye el campo por un default seguro
- AND registra el incidente para diagnóstico sin interrumpir al usuario
