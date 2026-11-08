# Changelog

Los cambios de cada versión. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/).

## [0.7.0] - 2026-11-08

### Agregado

- Detalle de cada agente en la pestaña **Agentes**: un clic en `ver:` abre su registro con lo que escribe en vivo, cada herramienta con sus argumentos y su tiempo, su razonamiento (opcional, con `ver razonamiento`) y la respuesta final completa.
- La fila de datos de la banda arranca, mientras Claude trabaja, con lo que está haciendo: la herramienta en curso con sus argumentos y su tiempo, o `pensando…`, y el agente más nuevo con la suya. Al terminar vuelve a `respondió …`.
- En la lista de agentes, la herramienta en curso muestra sus argumentos.

### Cambiado

- **Sin dinero en ningún lado**: todo se mide en tokens. La banda ya no muestra el costo de la sesión ni del turno, el dropdown de versiones ya no muestra precios y el encabezado del panel muestra los tokens de la sesión en vez del costo y de `/cost`.
- La pestaña **Costo** pasa a llamarse **Tokens**: el gráfico y la tabla muestran los tokens de cada turno (entrada y salida). Modelos y Agentes se reparten por tokens, y el gráfico de cada agente muestra los tokens de sus últimas requests.
- Token Invaders se acelera con los tokens de la sesión (al doble desde 10M) y la Carrera de agentes muestra los tokens de cada uno.
- El límite de 5 horas se nombra por lo que falta para que se renueve (`↻ 2h 10m`) en vez de `5h`.

## [0.6.0] - 2026-11-08

### Agregado

- **Límites de uso de la cuenta** en la fila de datos de la banda y en una segunda línea del encabezado del panel: el de 5 horas, el semanal y el de Fable si Claude Code informa uno, cada uno con su medidor (verde, ámbar desde 70 %, rojo desde 90 %). En el panel, además, cuánto falta para que se renueve cada uno.
- Un aviso (toast) cuando una ventana pasa el 90 %, una sola vez hasta que se renueva.
- Las ventanas que el mod no conoce se muestran con el nombre que les da Claude Code.

## [0.5.0] - 2026-10-11

### Agregado

- Pestaña **Teoría** en el panel: mientras trabaja, Claude anota los conceptos, patrones y decisiones de diseño que aplica, con dónde los aplica y hace cuánto. Las notas no aparecen en la conversación ni cuentan como herramientas.
- Dos niveles para las notas: `aprender` (el concepto desde cero, por defecto) y `experto` (solo la decisión y su trade-off). El nivel queda guardado entre sesiones.
- Botones en la pestaña para apagar o encender las notas, cambiar el nivel y borrar la lista; subcomando `/modelo teoria [on | off | aprender | experto]`; opción `model-picker.theory` en `/config`.
- Herramienta `mcp__model-picker__teoria`, por la que Claude dicta las notas, y un párrafo en el system prompt que se las pide mientras están encendidas.

### Cambiado

- El panel se abre con 72 columnas en vez de 64, para que entren los nombres de las siete pestañas.

## [0.4.0] - 2026-10-10

### Agregado

- Panel de estadísticas de la sesión, con gráficos hechos con caracteres de bloque: costo y tokens por turno, uso por modelo, herramientas (cantidad, errores y tiempo) y ritmo (duración, pasos y actividad).
- Pestaña **Agentes**: los subagentes de la sesión en vivo, con su estado, tipo, descripción, tiempo, costo, modelo, herramientas usadas y la que tienen en curso.
- Animaciones en la terminal y la app de escritorio: tiempos que corren, estado que late, spinner de la herramienta en curso, barras y medidor de contexto que crecen, columnas que suben, agentes que entran deslizándose y se atenúan al terminar.
- Medidor de contexto en el encabezado del panel (verde, ámbar desde 70 %, rojo desde 90 %).
- Medidores animados de cache y de contexto en la fila de datos de la banda.
- Pestaña **`▶ Jugar`** con 15 juegos, con teclado y mouse y récords guardados entre sesiones: Pong, Space Invaders, Snake, Tetris, Breakout, 2048, Buscaminas, Flappy, Dino, Frogger, Asteroids, Sokoban, Juego de la vida, y dos hechos con los datos de la sesión (Token Invaders y Carrera de agentes). Está en la pestaña `▶ Jugar`, siempre a la vista; se oculta con `/modelo juegos` o desde `/config` (`model-picker.games`).
- En la banda: un `●` con la cantidad de agentes trabajando al lado del botón de estadísticas, y un destello en el chip al cambiar de modelo.
- Botón `▦ stats` al final de la banda y subcomando `/modelo stats` para abrir y cerrar el panel; pestañas con clic o con las teclas `1` a `5`.
- Un `/clear` reinicia los números de la sesión.

### Cambiado

- La nota de la derecha de la banda necesita 106 columnas en vez de 96, para dejar lugar al botón.
- `costOf` se calcula sobre el nuevo `costParts`, que separa el costo por tipo de token.

## [0.3.0] - 2026-10-08

### Agregado

- Actualización automática: una vez por día, al iniciar una sesión, el mod lee la versión publicada en el repositorio y, si es más nueva, la instala (`claude plugin update` si se instaló como plugin, `git pull --ff-only` si se clonó). Se apaga desde `/config` (`model-picker.autoUpdate`).
- Antes de la primera respuesta de la sesión, la fila de datos avisa que los datos llegan tras la próxima respuesta, en vez de no mostrarse.
- CI en GitHub Actions: `claude plugin validate` y `claude plugin test` en cada push y pull request.

## [0.2.0] - 2026-10-08

### Agregado

- Fila de datos debajo de los chips, con lo que la API informó: modelo que respondió, costo estimado de la sesión y del turno, effort, tokens de la última request y porcentaje de cache, más la marca `manual` cuando hay un modelo elegido a mano.
- Precio de lista de cada versión en el dropdown (`$4/$20 por MTok`).
- Tabla de modelos y precios en el README, y README en inglés (`README.en.md`).

### Cambiado

- El dato `respondió …` pasó de la nota de la derecha a la fila de datos, así se ve en terminales de cualquier ancho.
- El código se separó en `hooks/models.ts` (familias, versiones, precios) y `hooks/stats.ts` (costo y fila de datos). Los modelos ahora se editan en `hooks/models.ts`.
- Un id de modelo que la API informa con sufijo se reconoce por el id listado con el que empieza.

## [0.1.0] - 2026-10-08

### Agregado

- Banda arriba del prompt con un chip por familia (Fable, Opus, Sonnet, Haiku).
- Dropdown de versiones al hacer clic en el chip activo.
- Cambio de modelo por request, sin ejecutar `/model`.
- Nota `respondió …` con el modelo que la API informó en la última respuesta.
- Comando `/modelo`.
- Licencia MIT.

[0.7.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/juampymdd/claude-code-model-picker/releases/tag/v0.1.0
