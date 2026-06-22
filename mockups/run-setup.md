# Vista: Inicio de run (setup)

Paso previo a la run: elegir loadout y nombrar al general.

## A — Completo (listo para empezar)
```
+----------------------------------------------+
| < volver                             [*] opc |
|                  NUEVA RUN                   |
|----------------------------------------------|
| 1) ELIGE 3 CONSEJEROS        3/3             |
| +-------+ +-------+ +-------+                |
| | [v]   | | [v]   | | [v]   |                |
| | OFE   | | MAN   | | DEF   |                |
| | Lv3   | | Lv2   | | Lv1   |                |
| +-------+ +-------+ +-------+                |
| banca: [OFE Lv1] [MAN Lv1] ...               |
|                                              |
| 2) NOMBRA A TU GENERAL                       |
| +-------------------------+          +-----+ |
| | Aldric_                 |          |[rnd]| |
| +-------------------------+          +-----+ |
|                                              |
|         +--------------------------+         |
|         |     >>  COMENZAR RUN     |         |
|         +--------------------------+         |
+----------------------------------------------+
```
- 3 consejeros elegidos + nombre escrito (o aleatorizado con `[rnd]`) → COMENZAR activo.

## B — Incompleto (botón bloqueado)
```
+----------------------------------------------+
| < volver                             [*] opc |
|                  NUEVA RUN                   |
|----------------------------------------------|
| 1) ELIGE 3 CONSEJEROS        1/3             |
| +-------+ +-------+ +-------+                |
| | [v]   | |  +    | |  +    |                |
| | OFE   | | elige | | elige |                |
| | Lv3   | |       | |       |                |
| +-------+ +-------+ +-------+                |
| banca: [DEF Lv1] [MAN Lv2] ...               |
|                                              |
| 2) NOMBRA A TU GENERAL                       |
| +-------------------------+          +-----+ |
| | _                       |          |[rnd]| |
| +-------------------------+          +-----+ |
|                                              |
|         + - - - - - - - - - - - - -+         |
|         : >> COMENZAR RUN (bloq.)  :         |
|         + - - - - - - - - - - - - -+         |
+----------------------------------------------+
```
- Faltan consejeros o nombre → COMENZAR aparece deshabilitado (línea punteada).
