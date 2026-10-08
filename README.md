# model-picker

[![test](https://github.com/juampymdd/claude-code-model-picker/actions/workflows/test.yml/badge.svg)](https://github.com/juampymdd/claude-code-model-picker/actions/workflows/test.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Elegí el modelo de Claude, y su versión, desde una banda arriba del prompt de Claude Code.** Un clic y la próxima request sale con otro modelo: sin `/model`, sin diálogos, sin tocar tu modelo por defecto. Y debajo, lo que la API informó: qué modelo respondió, cuánto costó, tokens y cache.

🇬🇧 [Read this in English](README.en.md)

```
▌ MODELO   ✦ Fable 5.1  ▐ ◆ Opus 5.5 ▾ ▌  ▲ Sonnet 5.5   ● Haiku 5.5    razonamiento profundo
  respondió Opus 5.5 · sesión ~$0.42 · turno ~$0.031 · effort medium · 48k→1.2k tok · cache 94%
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
- **Comando `/modelo`** para hacer lo mismo desde el teclado.

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
  Version: 0.2.0
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

Familias válidas: `fable`, `opus`, `sonnet`, `haiku`.

## La fila de datos

Debajo de los chips hay una fila con lo que la API informó. Antes de la primera respuesta de la sesión dice `costo, tokens y cache: tras la próxima respuesta`; después:

```
respondió Opus 5.5 · sesión ~$0.42 · turno ~$0.031 · effort medium · 48k→1.2k tok · cache 94% · manual
```

| Dato | Qué es |
| --- | --- |
| `respondió Opus 5.5` | El modelo que la API dice que respondió la última request. Sirve para comprobar que el cambio se aplicó |
| `sesión ~$0.42` | Costo estimado de todas las requests de la sesión, subagentes incluidos |
| `turno ~$0.031` | Costo estimado del turno actual (tu último mensaje y todas las llamadas que disparó) |
| `effort medium` | Nivel de razonamiento con el que salió la última request |
| `48k→1.2k tok` | Tokens de la última request: prompt completo (cache incluida) → respuesta |
| `cache 94%` | Qué parte de ese prompt salió de la cache. Baja a 0% justo después de cambiar de modelo |
| `manual` | Hay un modelo elegido a mano, distinto al de la sesión |

Si la terminal es angosta, la fila deja primero los datos de la izquierda y descarta los últimos. Mientras el dropdown está abierto, la fila se oculta.

**Los costos son una estimación**: tokens informados por la API multiplicados por el precio de lista. Si usás una suscripción en vez de pagar por token, tomalos como referencia de consumo, no como tu factura. Ver [Limitaciones](#limitaciones).

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

El mod registra cuatro hooks:

| Hook | Para qué |
| --- | --- |
| `session.start` | Registra el comando `/modelo` |
| `command.run` | Responde a `/modelo` |
| `turn.step` | Antes de cada request del loop principal, pone el modelo elegido; después, suma lo que la API informó de la respuesta |
| `ui.render` | Dibuja la banda arriba del prompt |

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
- **En terminales angostas** la banda se compacta: con menos de 96 columnas oculta la nota de la derecha, con menos de 70 deja solo el glifo de los modelos no elegidos, y la fila de datos descarta sus últimos datos.
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

Si lo instalaste como plugin (opción A):

```bash
claude plugin marketplace update model-picker
claude plugin update model-picker@model-picker
```

Si lo clonaste (opción B):

```bash
git -C ~/.claude/skills/model-picker pull
```

En los dos casos, abrí una sesión nueva o corré `/reload-plugins`. Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md).

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
types/
  index.d.ts         contrato del estado que guarda el mod
tests/
  picker.test.tsx    la banda, el dropdown y el comando
  stats.test.ts      costos y formato
```

Al cargar el mod, Claude Code escribe los tipos de su API en `.claude-plugin/types/` (ignorada por git); con eso `tsc -p .` chequea los tipos.

Issues y pull requests son bienvenidos.

## Licencia

[MIT](LICENSE) © 2026 Juan Pablo Maddoni
