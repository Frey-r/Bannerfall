# Vista: Run (entrenamiento)

Pantalla principal del bucle de turnos. Estética pixel-art con un LIVE FEED del campo de
entrenamiento. Se omite la barra de navegación inferior. (Sin el título "COMMAND_V1.0": era un
artefacto de Stitch, no parte del diseño.)

## A — Turno en curso (energía media)
```
+----------------------------------------------+
| TURNO ACTUAL                            [*]  |
| 03 / 08                          [ :) x1.1 ] |
| ENERGIA                                  45% |
| [##################----------------------]   |
|                                              |
| ESTADO DE ASESORES                 * ACTIVOS |
| +--------+ +--------+ +--------+ +--------+  |
| |        | |        | |    LV.3| |    LV.4|  |
| | [####] | | vacio  | | [img]  | | [img]  |  |
| +--------+ +--------+ +--------+ +--------+  |
|                                              |
| +------------------------------------------+ |
| | ( DESCANSO REPARADOR            +50 ENRG | |
| +------------------------------------------+ |
| +------------------------------------------+ |
| | <)) ARENGA MILITAR              +10 ENRG | |
| +------------------------------------------+ |
|                                              |
| +------------------------------------------+ |
| |* LIVE FEED                               | |
| |  ----                                    | |
| | #### campamento de caballeros (iso) ##   | |
| | >|  /\  /\ +--------------+  /\  #       | |
| | >|  ||  || |   RETRATO    | ||  #        | |
| | >  faroles |   GENERAL    | tiendas#     | |
| | >>##       +--------------+    ####      | |
| |           SECTOR 7G // TRAINING GROUND   | |
| +------------------------------------------+ |
|                                              |
| +------------+ +------------+ +------------+ |
| |    OFE     | |    DEF     | |    MAN     | |
| |     24     | |     18     | |     30     | |
| |     +8     | |     +6     | |    +10     | |
| +------------+ +------------+ +------------+ |
+----------------------------------------------+
```

Orden vertical (arriba → abajo):
1. **Estado de turno / energía** — `TURNO X/08`, ánimo (`:) x1.1`), barra de Energía con %. Engranaje de opciones arriba-derecha.
2. **Estado de asesores** — deck de 4 (avatar + LV); slots vacíos se llenan al obtener nuevos. Marca el/los presentes este turno.
3. **Recuperación** — DESCANSO REPARADOR (+50 ENRG) y ARENGA MILITAR (+10 ENRG, +ánimo).
4. **LIVE FEED** — mapa iso del campo de entrenamiento + retrato del general que reacciona al estado.
5. **3 stats / tarjetas de entrenamiento** — OFE / DEF / MAN con valor y ganancia proyectada (+N), al fondo (zona del pulgar). Es la decisión del turno.

Nota: la nav inferior (UNITS / TRAIN / BOND / RECOVERY) se omitió a propósito.
