# Changelog

Los cambios de cada versión. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/).

## [0.4.0] - 2026-10-08

### Agregado

- Panel de estadísticas de la sesión, con gráficos hechos con caracteres de bloque: costo y tokens por turno, uso por modelo, herramientas (cantidad, errores y tiempo) y ritmo (duración, pasos y actividad).
- Pestaña **Agentes**: los subagentes de la sesión en vivo, con su estado, tipo, descripción, tiempo, costo, modelo, herramientas usadas y la que tienen en curso.
- Animaciones en la terminal y la app de escritorio: tiempos que corren, estado que late, spinner de la herramienta en curso, barras y medidor de contexto que crecen, columnas que suben, agentes que entran deslizándose y se atenúan al terminar.
- Medidor de contexto en el encabezado del panel (verde, ámbar desde 70 %, rojo desde 90 %).
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

[0.4.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/juampymdd/claude-code-model-picker/releases/tag/v0.1.0
