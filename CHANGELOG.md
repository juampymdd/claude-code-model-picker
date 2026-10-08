# Changelog

Los cambios de cada versión. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones, [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado

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

[0.2.0]: https://github.com/juampymdd/claude-code-model-picker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/juampymdd/claude-code-model-picker/releases/tag/v0.1.0
