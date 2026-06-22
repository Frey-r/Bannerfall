# Vista: Home

Navegación global: **JUGAR** (centro) · **Colección** (izq) · **Eventos** (der) · **opciones** (engranaje, arriba-der).

## A — Inicial (idle)
```
+----------------------------------------------+
|  $120 oro   |  3 consejeros         [*] opc  |
|                                              |
|       ▓▒░  CAMPO DE ENTRENAMIENTO  ░▒▓       |
|      ░▒▓  (mapa pixel-art animado)  ▓▒░      |
|      )|   o      (D)   |X||X|   o    )|      |
|     ~ muñecos ~   ~ vallas ~   ~ humo ~      |
|     ▓▓▒▒░░ ====== banderas ======░░▒▒▓▓      |
|                                              |
| +----------+                   +-----------+ |
| | COLECCION|                   |  EVENTOS  | |
| |  consej. |                  | comb.diario| |
| | +genrls. |                   | +especial.| |
| +----------+                   +-----------+ |
|                                              |
|         +--------------------------+         |
|         |      >>   JUGAR          |         |
|         +--------------------------+         |
|                                              |
+----------------------------------------------+
```
- Fondo: mapa pixel-art animado del campo de entrenamiento de caballeros.
- Barra superior: recursos + nº de consejeros (izq), engranaje de opciones (der).
- Esquinas: Colección (izq), Eventos (der). Único CTA grande: JUGAR.

## B — JUGAR pulsado (fondo difuminado)
```
+----------------------------------------------+
| ░░░░░░░░░░░░░░░░░░░░░░░░░             [*] ░░ |
| ░░░░░  fondo difuminado  ░░░░░░░░░░░         |
| ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░        |
|                                              |
|             ¿QUÉ QUIERES HACER?              |
|                                              |
|        +----------------------------+        |
|        |   )==>   CORRER RUN        |        |
|        |   entrena a un general     |        |
|        +----------------------------+        |
|                                              |
|        +----------------------------+        |
|        |   (D)    PVP / ARENA       |        |
|        |   batalla asíncrona        |        |
|        +----------------------------+        |
|                                              |
|               [  x  cerrar  ]                |
|                                              |
+----------------------------------------------+
```
- Al tocar JUGAR el fondo se difumina y emergen las dos opciones.
- Correr Run → setup de run. PvP → arena (o estado vacío si no hay general).
- "x cerrar" regresa al idle.
