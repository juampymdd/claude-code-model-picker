# model-picker

Un mod de Claude Code: una banda arriba del prompt para elegir con qué modelo, y con qué versión, se hacen las próximas requests.

```
▌ MODELO   ✦ Fable 5.1  ▐ ◆ Opus 5.5 ▾ ▌  ▲ Sonnet 5.5   ● Haiku 5.5    razonamiento profundo · respondió Opus 5.5
```

## Uso

- **Clic en un chip**: las próximas requests del loop principal van a la versión más nueva de esa familia.
- **Clic en el chip activo** (`▾`): abre la lista de versiones debajo del chip; un clic en una la elige y cierra la lista.
- **Clic en el modelo de la sesión**: quita la elección y vuelve a seguir a la sesión.
- **`/modelo opus 4.8`**: lo mismo por comando. `/modelo auto` vuelve al modelo de la sesión; `/modelo` solo muestra el actual.

La nota de la derecha muestra el modelo que la API informó en la última respuesta (`respondió …`), para comprobar que el cambio se aplicó.

## Qué hace y qué no

- Reescribe el modelo de cada request del loop principal (`turn.step`). Los subagentes conservan el suyo.
- No ejecuta `/model`: no cambia el modelo de la sesión ni el modelo por defecto, y `/model` sigue mostrando el de la sesión.
- La elección dura la sesión.
- Las familias, versiones e ids están en `FAMILIES`, en `hooks/register.tsx`. Hay que editarlos cuando sale un modelo nuevo.

## Instalación

En una sesión de Claude Code en la terminal:

```
/plugin install model-picker --marketplace juampymdd/claude-code-model-picker
```

Responder `y` para agregar el marketplace y elegir el alcance.

## Desarrollo

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

La API de mods de Claude Code es de acceso anticipado y puede cambiar entre versiones.
