# model-picker

[![test](https://github.com/juampymdd/claude-code-model-picker/actions/workflows/test.yml/badge.svg)](https://github.com/juampymdd/claude-code-model-picker/actions/workflows/test.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Elegí el modelo de Claude, y su versión, desde una banda arriba del prompt de Claude Code.** Un clic y la próxima request sale con otro modelo: sin `/model`, sin diálogos, sin tocar tu modelo por defecto. Y debajo, lo que la API informó: qué modelo respondió, cuánto costó, tokens y cache.

🇬🇧 [Read this in English](README.en.md)

![La banda de model-picker: un clic cambia el modelo, y el chip activo despliega sus versiones con precio](docs/demo.gif)

▶ [Ver el video completo (30 s)](https://github.com/juampymdd/claude-code-model-picker/releases/download/v0.4.0/model-picker.mp4)

```
▌ MODELO   ✦ Fable 5.1  ▐ ◆ Opus 5.5 ▾ ▌  ▲ Sonnet 5.5   ● Haiku 5.5    razonamiento profundo
  respondió Opus 5.5 · sesión ~$0.42 · turno ~$0.031 · effort medium · 48k→1.2k tok · cache ▰▰▰▰▰▰ 94% · contexto ▰▰▱▱▱▱ 38%
```

Con el dropdown de versiones abierto:

```
▌ MODELO   ✦ Fable 5.1  ▐ ◆ Opus 5.5 ▴ ▌  ▲ Sonnet 5.5   ● Haiku 5.5
                          ● Opus 5.5 $4/$20 por MTok
                          ○ Opus 5 $5/$25 por MTok
                          ○ Opus 4.8 $5/$25 por MTok
                          ○ Opus 4.7 $5/$25 por MTok
                          ○ Opus 4.6 $5/$25 por MTok
```

## Contenido

- [Qué hace](#qué-hace)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Comprobar que quedó instalado](#comprobar-que-quedó-instalado)
- [Uso](#uso)
- [La fila de datos](#la-fila-de-datos)
- [El panel de estadísticas](#el-panel-de-estadísticas)
- [Modelos y precios](#modelos-y-precios)
- [Cómo funciona](#cómo-funciona)
- [Limitaciones](#limitaciones)
- [Agregar o cambiar modelos](#agregar-o-cambiar-modelos)
- [Actualizar](#actualizar)
- [Desinstalar](#desinstalar)
- [Problemas frecuentes](#problemas-frecuentes)
- [Desarrollo](#desarrollo)
- [Licencia](#licencia)

## Qué hace

- **Un chip por familia** (Fable, Opus, Sonnet, Haiku), cada uno con su color. El activo va relleno.
- **Dropdown de versiones con precio**: un clic en el chip activo lista todas las versiones de esa familia y su precio de lista.
- **Arranca en tu modelo real**: al abrir una sesión marca el modelo que la sesión ya usa.
- **Cambio instantáneo**: la elección se aplica a la request siguiente.
- **Fila de datos**: modelo que respondió, costo estimado de la sesión y del turno, effort, tokens y porcentaje de cache.
- **Panel de estadísticas** animado, con gráficos de costo, modelos, herramientas y ritmo de la sesión, y los **agentes en vivo**: qué hace cada uno, con qué modelo y cuánto gasta.
- **15 juegos** en el panel (Pong, Tetris, Snake, Buscaminas, 2048… y dos hechos con los datos de tu sesión), en la pestaña [`▶ Jugar`](#6--jugar).
- **Comando `/modelo`** para hacer lo mismo desde el teclado.
- **Se actualiza solo**: una vez por día busca una versión nueva y la instala. Se puede [apagar](#apagarlo).

## Requisitos

- **Claude Code 2.1.295 o más nuevo**, con soporte de mods (hooks de función). Verificá tu versión con `claude --version`.
- Una terminal con color de 24 bits para ver los colores tal cual (Windows Terminal, iTerm2, la terminal de VS Code, etc.).
- La banda se dibuja en la terminal y en la app de escritorio. Está probada en la terminal.

> La API de mods de Claude Code es de acceso anticipado y puede cambiar entre versiones. Si una actualización de Claude Code rompe el mod, abrí un issue.

## Instalación

Elegí **una sola** de las opciones. Instalar por dos caminos a la vez hace que una copia no cargue (ver [Problemas frecuentes](#problemas-frecuentes)).

### Opción A: como plugin (recomendada)

Desde cualquier terminal:

```bash
claude plugin marketplace add juampymdd/claude-code-model-picker
claude plugin install model-picker@model-picker
```

El primer comando registra este repositorio como marketplace; el segundo instala el mod para tu usuario, en todos tus proyectos. Abrí una sesión nueva de Claude Code y la banda aparece arriba del prompt.

Para instalarlo solo en un proyecto, corré el segundo comando dentro de ese proyecto con `--scope project`.

También se puede instalar desde adentro de una sesión de Claude Code en la terminal:

```
/plugin install model-picker --marketplace juampymdd/claude-code-model-picker
```

Respondé `y` para agregar el marketplace y elegí el alcance.

### Opción B: clonando el repositorio

Claude Code carga solo cualquier mod que esté en tu carpeta `~/.claude/skills/`. La carpeta **tiene que llamarse `model-picker`**.

macOS / Linux:

```bash
git clone https://github.com/juampymdd/claude-code-model-picker.git ~/.claude/skills/model-picker
```

Windows (PowerShell):

```powershell
git clone https://github.com/juampymdd/claude-code-model-picker.git "$env:USERPROFILE\.claude\skills\model-picker"
```

Abrí una sesión nueva de Claude Code. Esta opción sirve si querés editar el mod: los cambios en esa carpeta se recargan solos.

### Opción C: probarlo sin instalar

```bash
git clone https://github.com/juampymdd/claude-code-model-picker.git
claude --plugin-dir ./claude-code-model-picker
```

El mod queda cargado solo en esa sesión.

## Comprobar que quedó instalado

```bash
claude plugin list
```

Tiene que aparecer `model-picker` con estado `enabled` o `loaded`:

```
❯ model-picker@model-picker
  Version: 0.4.0
  Scope: user
  Status: ✔ enabled
```

Después, en una sesión nueva, escribí `/modelo`. Si responde `Modelo: Opus 5.5. Uso: …` (con tu modelo), el mod está cargado.

## Uso

### Con el mouse

| Acción | Resultado |
| --- | --- |
| Clic en un chip de otra familia | Cambia a la versión más nueva de esa familia |
| Clic en el chip activo (`▾`) | Abre la lista de versiones, con su precio, debajo del chip |
| Clic en una versión de la lista | Cambia a esa versión y cierra la lista (`●` marca la actual) |
| Clic otra vez en el chip activo (`▴`) | Cierra la lista sin cambiar nada |
| Elegir el modelo que ya usa la sesión | Quita la elección y vuelve a seguir a la sesión |

### Con el comando

| Comando | Resultado |
| --- | --- |
| `/modelo` | Muestra el modelo actual y la ayuda |
| `/modelo sonnet` | Cambia a la versión más nueva de Sonnet |
| `/modelo opus 4.8` | Cambia a esa versión puntual |
| `/modelo auto` | Vuelve al modelo de la sesión |
| `/modelo stats` | Abre o cierra el [panel de estadísticas](#el-panel-de-estadísticas) |
| `/modelo juegos` | Oculta o muestra la pestaña de [juegos](#6--jugar) del panel |

Familias válidas: `fable`, `opus`, `sonnet`, `haiku`.

## La fila de datos

Debajo de los chips hay una fila con lo que la API informó. Antes de la primera respuesta de la sesión dice `costo, tokens y cache: tras la próxima respuesta`; después:

```
respondió Opus 5.5 · sesión ~$0.42 · turno ~$0.031 · effort medium · 48k→1.2k tok · cache ▰▰▰▰▰▰ 94% · contexto ▰▰▱▱▱▱ 38% · manual
```

| Dato | Qué es |
| --- | --- |
| `respondió Opus 5.5` | El modelo que la API dice que respondió la última request. Sirve para comprobar que el cambio se aplicó |
| `sesión ~$0.42` | Costo estimado de todas las requests de la sesión, subagentes incluidos |
| `turno ~$0.031` | Costo estimado del turno actual (tu último mensaje y todas las llamadas que disparó) |
| `effort medium` | Nivel de razonamiento con el que salió la última request |
| `48k→1.2k tok` | Tokens de la última request: prompt completo (cache incluida) → respuesta |
| `cache ▰▰▰▰▰▰ 94%` | Qué parte de ese prompt salió de la cache, con su medidor: verde si es alta, ámbar bajo 70 %, rojo bajo 30 %. Baja a 0% justo después de cambiar de modelo |
| `contexto ▰▰▱▱▱▱ 38%` | Cuán llena está la ventana de contexto: verde, ámbar desde 70 %, rojo desde 90 % |
| `manual` | Hay un modelo elegido a mano, distinto al de la sesión |

Si la terminal es angosta, la fila deja primero los datos de la izquierda y descarta los últimos. Mientras el dropdown está abierto, la fila se oculta.

**Los costos son una estimación**: tokens informados por la API multiplicados por el precio de lista. Si usás una suscripción en vez de pagar por token, tomalos como referencia de consumo, no como tu factura. Ver [Limitaciones](#limitaciones).

## El panel de estadísticas

Un panel con gráficos de toda la sesión. Se abre y se cierra con el botón **`▦ stats`** del final de la banda, o con `/modelo stats`. En terminales anchas (110 columnas o más, en pantalla completa) se acopla a la derecha; si no, se muestra arriba del prompt. Se cierra también con `Esc` cuando tiene el foco.

```
sesión 1h12m · ~$0.42 · 31 turnos · contexto ▰▰▰▱▱▱▱▱ 38%
 1: Costo   2: Modelos   3: Tools   4: Ritmo   5: Agentes   6: ▶ Jugar
```

Las pestañas se cambian con un clic o, con el panel enfocado (clic en el panel o `ctrl+x tab`), con las teclas `1` a `6`. Los gráficos están hechos con caracteres de bloque, sin librerías, así que se ven igual en la terminal y en la app de escritorio.

### 1 · Costo

Cuánto costó cada turno, es decir, cada mensaje tuyo con todas las requests que disparó.

```
COSTO POR TURNO · últimos 28 de 31 · máx $0.21
      █
  ▂   █    ▅
▁▃█▂▁▂█▃▁▁▂█▂▁▁▃▂▁▁▂▃▁▂▅▂▁▂▃
   #  costo   ▒ entrada █ salida    tok          cache
  31  $0.084  ▒▒▒▒▒▒██████████      48k→1.2k     94%
  30  $0.012  ▒▒█                   12k→300      88%
total ~$0.42 · 1.9M→41k tok · cache 91% · subagentes $0.05
```

- Arriba, un gráfico de columnas con el costo de los últimos turnos.
- La tabla lista los 50 turnos más recientes, el último primero. La barra es el costo del turno: `▒` lo que costó el prompt y `█` lo que costó la respuesta, con el color del modelo que respondió.
- `tok` son los tokens del turno (prompt completo, cache incluida → respuesta) y `cache` la parte del prompt que salió de la cache.
- En paneles angostos la tabla pierde primero `tok` y después `cache`.

### 2 · Modelos

Cómo se reparte el costo de la sesión entre modelos, subagentes incluidos.

```
USO POR MODELO
◆ Opus 5.5    ████████████▌   $0.31   74%  1.4M→30k  22 req
● Haiku 5.5   ██▏             $0.05   12%  410k→9k   14 req
subagentes: $0.05 (12% del total)
```

### 3 · Tools

Qué herramientas se usaron, de todos los loops: cuántas veces, cuántas fallaron, tiempo total y promedio.

```
TOOLS · 87 llamadas · 3 errores · 2m41s
Bash          ██████████▏   42  2 err   1m12s   1.7s
Read          ██████▎       26  –          4s  150ms
```

Una llamada cuenta como error si la herramienta devolvió error o si otro plugin la rechazó. El tiempo incluye las confirmaciones de permisos que haya pedido la herramienta.

### 4 · Ritmo

Cuánto tiempo trabajó Claude y a qué ritmo.

```
RITMO · activo 18m de 1h12m (25%) · 4.2 pasos/turno · prom 35s
duración   ▁▂▁▅▃▁▁█▂▁▃▂▁▁▄▂   máx 3m12s
pasos      ▁▁▂▇▃▁▁█▂▁▂▂▁▁▃▂   máx 23
actividad  ··▁▃█▅···▂▃▁··▂▅   16 tramos de 4m30s
  31  12s     3 pasos  respuesta
  30  3m12s   23 pasos abortado
```

- `duración` y `pasos` son un gráfico por turno (duración y cantidad de requests del loop principal).
- `actividad` reparte los pasos a lo largo del tiempo de la sesión; un `·` es un tramo sin actividad.
- Cada turno termina en `respuesta`, `abortado`, `rechazo` o `error`, y mientras corre dice `en curso`.

### 5 · Agentes

Los subagentes de la sesión, en vivo. Claude Code ya muestra qué agentes corren; esta pestaña agrega lo que no muestra: cuánto gasta cada uno, con qué modelo, qué herramientas usó, en cuál está ahora y cuánto lleva.

```
AGENTES  ● 2 corriendo  ✕ 1 fallaron  $1.04
────────────────────────────────────────────────────────────────────────
● Explore   buscar usos de FAMILIES                        1m12s  $0.058
  ● Haiku 5.5  12 req  Grep ×3 Read ×2  ▸ ⠹ Grep 4s          ▁▂▃▅▇█
● Plan      diseñar pestaña de agentes                     3m02s   $0.98
  ◆ Opus 5.5  8 req  Read ×6            ▸ pensando..         ▁▁▂▄▆█
✕ general   correr los tests                                  3s  $0.000 error
  ◆ Opus 5.5  1 req  Bash ×1 ✕1
```

Cada agente ocupa dos filas. Arriba: estado, tipo, descripción, tiempo y costo. Abajo: modelo, requests, herramientas más usadas, lo que hace ahora (`▸`) y un gráfico del costo de sus últimas requests.

| Estado | Glifo | Color |
| --- | --- | --- |
| Corriendo | `●` (late) | verde |
| Esperando, pendiente o inactivo | `◐` (late) | ámbar |
| Terminado | `○` | gris |
| Falló o fue cancelado | `✕` | rojo |

- Los colores de estado son los del tema de Claude Code, así que siguen tu tema claro u oscuro. El modelo lleva el color de su familia, igual que los chips de la banda.
- `▸` muestra la herramienta en curso con su tiempo, o `pensando` cuando el agente espera al modelo. El tiempo de una herramienta se pone ámbar pasados 10 segundos (suele ser una confirmación de permisos pendiente) y el del agente, pasados 5 minutos.
- Una herramienta con fallos lleva `✕` y la cantidad en rojo. Un costo mayor a $1 se pone rojo.
- Un agente lanzado por otro agente aparece debajo, con `└`.
- Primero van los que corren (el más nuevo arriba) y después los últimos 10 terminados; **`ocultar terminados`** los saca de la lista.
- Mientras hay agentes trabajando, al lado del botón `▦ stats` de la banda late un `●` con la cantidad, así te enterás sin abrir el panel.

### 6 · Jugar

Para los ratos en que Claude trabaja solo: **15 juegos** dentro del panel, en la pestaña **`▶ Jugar`**, siempre a la vista al lado de las demás.

```
 ☰ juegos   ◆ Pong · récord 7
```

**`☰ juegos`** abre la lista con todos los juegos y el récord de cada uno; un clic en uno lo abre. Para jugar con el teclado hay que **hacer clic sobre el juego** (así toma el foco); `Esc` se lo devuelve al prompt. El mouse funciona siempre.

Teclas comunes a todos:

| Tecla | Acción |
| --- | --- |
| `espacio` o clic | Empieza; sigue después de una pausa |
| `p` o `Enter` | Pausa y sigue |
| `r` | Partida nueva |

| Juego | De qué se trata | Teclado | Mouse |
| --- | --- | --- | --- |
| ◆ **Pong** | Contra la máquina, a 11 puntos | `↑` `↓` mueven · `espacio` pausa | la paleta sigue al puntero |
| ▲ **Space Invaders** | Tres filas que bajan cada vez más rápido, escudos, tres vidas | `←` `→` · `espacio` dispara | la nave sigue al puntero · clic dispara |
| ● **Snake** | Come, crece y acelera cada cinco comidas | flechas giran | clic apunta hacia ahí |
| ▟ **Tetris** | Siete piezas en bolsa, pieza guardada y sombra de caída | `←` `→` · `↑`/`x` gira · `z` al revés · `↓` baja · `espacio` cae · `c` guarda | clic a un lado mueve, en el medio gira · derecho cae |
| ▬ **Breakout** | Seis filas de ladrillos, tres vidas, niveles más rápidos | `←` `→` · `espacio` lanza | la paleta sigue al puntero · clic lanza |
| ▦ **2048** | Deslizar y fusionar fichas iguales | flechas | arrastrar |
| ✸ **Buscaminas** | El primer clic nunca es mina; tablero según el ancho del panel | flechas + `espacio` abre · `f` marca | clic abre · derecho marca · clic en un número abre alrededor |
| ▶ **Flappy** | Pasar entre los tubos; el hueco se achica | `espacio` o `↑` aletea | clic aletea |
| ▙ **Dino** | Saltar cactus, agacharse bajo los pájaros | `espacio`/`↑` salta · `↓` se agacha | clic salta |
| ☻ **Frogger** | Cruzar la ruta y el río hasta los cinco nidos, con tiempo | flechas saltan | clic salta hacia ahí |
| ◇ **Asteroids** | Campo sin bordes, rocas que se parten en dos | `←` `→` giran · `↑` empuja · `espacio` dispara | apunta al puntero · clic dispara · derecho empuja |
| ▣ **Sokoban** | Seis niveles: empujar cada caja a su meta | flechas · `u` deshace · `n`/`b` cambian de nivel | clic al lado del jugador |
| ░ **Juego de la vida** | No se gana: se dibuja y se mira evolucionar | `espacio` pausa · `c` limpia · `g` planeador · `1`–`5` velocidad | dibuja (derecho borra) |
| $ **Token Invaders** | Invaders con **tus herramientas** como invasores | como Invaders | como Invaders |
| ⚑ **Carrera de agentes** | Los subagentes de la sesión en una pista | no se juega | — |

Dos juegos usan los datos de tu sesión:

- **Token Invaders**: cada invasor es una herramienta que usó Claude (`Ba` Bash, `Ed` Edit, `Re` Read…), las más usadas primero. Verde si nunca falló, ámbar si falló alguna vez, rojo si falló más de una de cada cinco. Bajan más rápido cuanto más costó la sesión: al doble desde $10.
- **Carrera de agentes**: una pista por subagente, que avanza una celda por request, con su costo al final. Los que siguen trabajando llevan el color de su modelo y un `▶` que late; los que terminaron quedan con `✔` o `✕`.

Cosas a saber:

- Los récords se guardan entre sesiones. En Buscaminas el récord premia el menor tiempo; en Sokoban cuenta los niveles resueltos; el Juego de la vida y la Carrera no tienen.
- La terminal no avisa cuando se suelta una tecla: cada pulsación mueve un paso (mantenerla apretada repite). Asteroids y Breakout se juegan mejor con el mouse.
- Mientras el juego tiene el foco, las teclas `1` a `6` de las pestañas pueden no responder: `Esc` primero.
- Cada juego necesita un ancho mínimo (entre 20 y 38 columnas) y avisa si el panel no llega.
- Los juegos corren en la terminal y en la app de escritorio.

**Ocultar la pestaña:** `/modelo juegos` la saca o la vuelve a poner para la sesión. Para no verla nunca, `/config` → **Juegos en el panel** (`model-picker.games`) → desactivar.

### Animaciones

En la terminal y en la app de escritorio el panel se mueve; en las demás superficies se dibuja quieto, con los mismos datos.

| Qué | Cómo se mueve |
| --- | --- |
| Tiempos (sesión, turno en curso, agentes, herramienta en curso) | Corren solos, segundo a segundo |
| Estado de un agente activo | El glifo late |
| Herramienta en curso / `pensando` | Un spinner y puntos que avanzan |
| Barras de Modelos y Tools, medidor de contexto | Crecen hasta su valor al abrir la pestaña y cuando llega un dato nuevo |
| Columnas de costo | Suben desde cero al abrir la pestaña |
| Agente nuevo | Entra deslizándose desde la derecha |
| Agente que termina | Destella un instante y después se atenúa |
| Último tramo de `actividad` | Late mientras hay un turno corriendo |
| Chip del modelo en la banda | Se enciende un instante al cambiar de modelo |

El medidor de contexto (`▰▰▰▱▱▱▱▱ 38%`) pasa de verde a ámbar al 70 % y a rojo al 90 %. Cuando nada se mueve el panel no se redibuja, y con solo relojes en pantalla lo hace una vez por segundo.

### Cosas a saber

- El panel cuenta lo que ve el mod desde que cargó: no conoce lo que pasó antes. Un `/clear` lo reinicia.
- Los costos son estimaciones a precio de lista (ver [Limitaciones](#limitaciones)). Si Claude Code informa un costo propio, el encabezado lo muestra al lado como `/cost`.
- La duración de un turno y el tiempo de una tool son tiempo real: incluyen esperas por permisos.
- Un subagente que sigue corriendo después de que termina tu turno suma su costo al turno que esté abierto en ese momento. Los totales por modelo y de sesión son exactos igual.
- Un agente aparece cuando el mod lo ve: al lanzarse, o en su primera request o herramienta. Los que terminaron antes de que cargara el mod no están.
- El estado de cada agente se trae de la lista de Claude Code cada 2 segundos mientras haya alguno trabajando. Un agente de un workflow no está en esa lista: se muestra igual, con tipo `agente` y sin descripción.
- `pensando` y el ámbar de una herramienta lenta son deducciones del mod (no hay herramienta en curso; lleva más de 10 segundos), no estados que informe Claude Code.
- Se guardan los últimos 200 turnos, hasta 40 nombres de herramientas (el resto se cuenta como `otros`) y hasta 100 agentes; los totales siempre incluyen todo.

## Modelos y precios

Precios de lista de la API de Anthropic, en dólares por millón de tokens (MTok), al 6 de octubre de 2026.

| Modelo | Entrada | Salida |
| --- | --- | --- |
| ✦ Fable 5.1 | $10 | $50 |
| ✦ Fable 5 | $10 | $50 |
| ◆ Opus 5.5 | $4 | $20 |
| ◆ Opus 5 | $5 | $25 |
| ◆ Opus 4.8 | $5 | $25 |
| ◆ Opus 4.7 | $5 | $25 |
| ◆ Opus 4.6 | $5 | $25 |
| ▲ Sonnet 5.5 | $2 | $10 |
| ▲ Sonnet 5 | $2 | $10 |
| ▲ Sonnet 4.6 | $3 | $15 |
| ● Haiku 5.5 | $0.10 | $0.50 |
| ● Haiku 4.5 | $1 | $5 |

Tu cuenta tiene que tener acceso al modelo que elijas. Los precios pueden cambiar: los vigentes están en la [página de precios de Anthropic](https://www.anthropic.com/pricing).

## Cómo funciona

El mod registra estos hooks:

| Hook | Para qué |
| --- | --- |
| `session.start` | Registra el comando `/modelo` |
| `command.run` | Responde a `/modelo` |
| `turn.step` | Antes de cada request del loop principal, pone el modelo elegido; después, suma lo que la API informó de la respuesta |
| `turn.start`, `turn.complete` | Abren y cierran cada turno en el historial del panel de estadísticas |
| `tool.call` | Cuenta y cronometra cada herramienta sin modificar la llamada |
| `agent.spawn` | Anota cada agente que se lanza, con su tipo y descripción |
| `session.end` | Reinicia los números con un `/clear` |
| `ui.render` | Dibuja la banda arriba del prompt y el panel de estadísticas |
| `ui.message` | Recibe el puntaje de una partida terminada y guarda el récord |

Además, en `session.start` lanza en segundo plano la búsqueda de versión nueva (ver [Actualizar](#actualizar)) y un temporizador que cada 2 segundos pone al día el estado de los agentes mientras alguno trabaja.

La parte animada del panel es un *módulo de superficie* (`hooks/live.tsx`): corre en el hilo de dibujo con su propio reloj, sin acceso al motor, y recibe de los hooks las filas ya armadas.

El cambio se hace **por request**: el mod reescribe el campo `model` de cada llamada del loop principal. No ejecuta `/model`.

## Limitaciones

- **`/model` no refleja la elección.** El comando nativo sigue mostrando el modelo de la sesión; la fuente de verdad es la banda y su dato `respondió …`.
- **La elección dura la sesión.** Cada sesión nueva arranca siguiendo el modelo de la sesión.
- **Solo el loop principal.** Los subagentes conservan su propio modelo (su costo sí se suma al de la sesión).
- **El costo es estimado.**
  - Usa precios de lista escritos en el código; no conoce descuentos, suscripciones ni cambios de precio.
  - La lectura de cache se calcula con la tarifa publicada del modelo o, si no hay, al 10% del precio de entrada; la escritura de cache, al 125%.
  - Haiku 5.5 se calcula siempre a su tarifa base, aunque los prompts de más de 100K tokens se cobran más caro.
  - Cuenta solo las requests que pasaron por el mod desde que cargó, y una respuesta de un modelo que no está en la lista suma $0.
- **Los modelos y precios están escritos en el código.** Cuando sale un modelo nuevo hay que agregarlo (ver abajo).
- **Cambiar de modelo a mitad de una conversación cuesta más en esa request**: la cache de la conversación es por modelo, así que el modelo nuevo relee todo el historial.
- **En terminales angostas** la banda se compacta: con menos de 106 columnas oculta la nota de la derecha, con menos de 70 deja solo el glifo de los modelos no elegidos, y la fila de datos descarta sus últimos datos.
- **La interfaz está en español.**

## Agregar o cambiar modelos

Todo está en la lista `FAMILIES`, en [`hooks/models.ts`](hooks/models.ts). Cada familia tiene su nombre, glifo, color, nota y versiones, de la más nueva a la más vieja:

```ts
{
  choice: 'opus',
  label: 'Opus',
  glyph: '◆',
  color: '#FB923C',
  note: 'razonamiento profundo',
  versions: [
    { version: '5.5', model: 'claude-opus-5-5', price: [4, 20], cacheRead: 0.2 },
    { version: '5', model: 'claude-opus-5', price: [5, 25] },
  ],
},
```

- `version` es lo que se muestra; `model` es el id exacto de la API.
- `price` es `[entrada, salida]` en dólares por millón de tokens; `cacheRead`, opcional, el precio de leer cache.
- La primera versión de la lista es la que se elige al hacer clic en la familia.
- Para sumar una familia, agregá otro bloque con un `choice` nuevo en minúsculas: ese es el nombre que acepta `/modelo`.

Con la opción B o C los cambios se recargan solos al guardar. Antes de compartirlos, corré `claude plugin validate .` y `claude plugin test .`.

## Actualizar

**El mod se actualiza solo.** Una vez por día, al iniciar una sesión, lee la versión publicada en este repositorio. Si es más nueva que la instalada, la instala según cómo esté instalado:

| Instalación | Qué corre |
| --- | --- |
| Como plugin (opción A) | `claude plugin marketplace update model-picker` y `claude plugin update model-picker@model-picker` |
| Clonado (opción B) | `git pull --ff-only` en la carpeta del mod |
| Otra (por ejemplo `--plugin-dir` sin git) | Nada: solo avisa que hay versión nueva |

Al terminar muestra `model-picker actualizado a X.Y.Z · /reload-plugins o sesión nueva para aplicar`. La sesión en curso sigue con la versión que cargó hasta que corras `/reload-plugins` o abras otra.

No demora el arranque (corre en segundo plano), sin red no hace nada, y si la instalación falla avisa con el comando para correrlo a mano.

### Qué implica

Con esto, **cada versión nueva que se publique en este repositorio se instala y corre en tu máquina sin que la revises**. Es cómodo, y es también la razón para apagarlo si preferís leer los cambios antes: están en [CHANGELOG.md](CHANGELOG.md).

### Apagarlo

Dentro de una sesión: `/config` → **Actualización automática** (`model-picker.autoUpdate`) → desactivar.

Apagado, se actualiza a mano:

```bash
# opción A
claude plugin marketplace update model-picker
claude plugin update model-picker@model-picker

# opción B
git -C ~/.claude/skills/model-picker pull
```

La actualización automática existe desde la versión 0.3.0: desde una versión anterior hay que actualizar a mano una vez.

## Desinstalar

Opción A:

```bash
claude plugin uninstall model-picker@model-picker
claude plugin marketplace remove model-picker
```

Opción B: borrá la carpeta `~/.claude/skills/model-picker`.

## Problemas frecuentes

**No veo la banda.**
- Abrí una sesión nueva: los mods instalados cargan al iniciar.
- Puede estar colapsada: buscá `[-]` / `[+]` a la derecha, arriba del prompt, o usá `ctrl+x ctrl+a`.
- Corré `claude plugin list` y mirá el estado de `model-picker`.
- Probá `/modelo`: si responde, el mod cargó y el problema es solo de dibujo.

**`claude plugin list` dice "the name "model-picker" is already taken".**
Está instalado por dos caminos (plugin y carpeta en `~/.claude/skills/`). Dejá uno solo: desinstalá el plugin o borrá la carpeta.

**Elegí un modelo y `/model` sigue mostrando el anterior.**
Es lo esperado: el mod no cambia el modelo de la sesión. Mirá el dato `respondió …` de la fila de datos.

**`respondió …` muestra un modelo distinto al elegido.**
El cambio no se aplicó. Confirmá que tu cuenta tiene acceso a ese modelo y que el id en `FAMILIES` es correcto; si sigue pasando, abrí un issue con tu versión de Claude Code.

**No aparece la fila de datos.**
Se oculta mientras el dropdown está abierto. Antes de la primera respuesta de la sesión solo muestra un aviso.

**El costo no coincide con mi factura.**
Es una estimación a precio de lista. Ver [Limitaciones](#limitaciones).

**Los colores se ven raros.**
Los colores son hexadecimales y dependen del soporte de color de tu terminal. Podés cambiarlos en `FAMILIES`.

**Veo una línea gris que empieza con `model-picker:`.**
Es Claude Code avisando que un hook del mod falló. Copiá esa línea en un issue.

## Desarrollo

```bash
git clone https://github.com/juampymdd/claude-code-model-picker.git
cd claude-code-model-picker

claude plugin validate .   # revisa el manifiesto y los hooks
claude plugin test .       # corre tests/*.test.ts(x)
claude --plugin-dir .      # abre una sesión con el mod cargado desde esta carpeta
```

Estructura:

```
.claude-plugin/
  plugin.json        manifiesto del mod
  marketplace.json   hace que este repo sea instalable como marketplace
hooks/
  hooks.json         apunta al módulo de hooks
  register.tsx       los hooks y el dibujo de la banda
  models.ts          familias, versiones, ids y precios
  stats.ts           costo, tokens y la fila de datos
  charts.ts          gráficos hechos con caracteres de bloque
  history.ts         el historial de turnos, modelos y tools
  rows.ts            cada pestaña del panel como filas de texto
  paint.tsx          dibuja las filas, quietas o en movimiento
  live.tsx           módulo de superficie: el reloj de las animaciones
  games.tsx          módulo de superficie: corre el juego elegido (reloj, teclas, mouse)
  arcade.ts          el contrato que cumple cada juego y lo que comparten
  catalog.ts         la lista de juegos
  pixels.ts          pantalla de medios bloques para los juegos
  pong.ts invaders.ts classics.ts screens.ts        Pong y Space Invaders
  snake.ts tetris.ts breakout.ts g2048.ts mines.ts  un juego por archivo
  flappy.ts dino.ts frogger.ts asteroids.ts
  sokoban.ts life.ts
  sessiongames.ts    Token Invaders y la Carrera de agentes
  pane.tsx           las pestañas y el armado del panel
  update.ts          la actualización automática
types/
  index.d.ts         contrato del estado que guarda el mod
tests/
  picker.test.tsx    la banda, el dropdown y el comando
  stats.test.ts      costos y formato
  charts.test.ts     los gráficos
  history.test.ts    el historial
  motion.test.ts     el motor de animación y la lista de agentes
  games.test.ts      las reglas de Pong y Space Invaders
  rules.test.ts      las reglas de los demás juegos
  arcade.test.tsx    los juegos corriendo en el panel
  pane.test.tsx      el panel de estadísticas
  update.test.ts     la actualización automática
```

El video de arriba es una recreación animada, no una grabación: su fuente está en [`video/`](video/) (HTML + GSAP, renderizado con [HyperFrames](https://github.com/heygen-com/hyperframes): `npx hyperframes render` dentro de esa carpeta).

Al cargar el mod, Claude Code escribe los tipos de su API en `.claude-plugin/types/` (ignorada por git); con eso `tsc -p .` chequea los tipos.

Issues y pull requests son bienvenidos.

## Licencia

[MIT](LICENSE) © 2026 Juan Pablo Maddoni
