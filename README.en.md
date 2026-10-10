# model-picker

[![test](https://github.com/juampymdd/claude-code-model-picker/actions/workflows/test.yml/badge.svg)](https://github.com/juampymdd/claude-code-model-picker/actions/workflows/test.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Pick the Claude model, and its version, from a band above the Claude Code prompt.** One click and the next request goes to another model: no `/model`, no dialogs, your default model untouched. Below it, what the API reported: which model answered, what it cost, tokens and cache.

🇪🇸 [Leer en español](README.md)

> The mod's interface is in Spanish (`MODELO`, `respondió`, `sesión`, `turno`, the `/modelo` command). This page translates each label.

![model-picker's band: a click switches the model, and the active chip lists its versions with prices](docs/demo.gif)

▶ [Watch the full video (30 s, in Spanish)](https://github.com/juampymdd/claude-code-model-picker/releases/download/v0.4.0/model-picker.mp4)

```
▌ MODELO   ✦ Fable 5.1  ▐ ◆ Opus 5.5 ▾ ▌  ▲ Sonnet 5.5   ● Haiku 5.5    razonamiento profundo
  respondió Opus 5.5 · sesión ~$0.42 · turno ~$0.031 · effort medium · 48k→1.2k tok · cache ▰▰▰▰▰▰ 94% · contexto ▰▰▱▱▱▱ 38%
```

With the version dropdown open:

```
▌ MODELO   ✦ Fable 5.1  ▐ ◆ Opus 5.5 ▴ ▌  ▲ Sonnet 5.5   ● Haiku 5.5
                          ● Opus 5.5 $4/$20 por MTok
                          ○ Opus 5 $5/$25 por MTok
                          ○ Opus 4.8 $5/$25 por MTok
                          ○ Opus 4.7 $5/$25 por MTok
                          ○ Opus 4.6 $5/$25 por MTok
```

## What it does

- **One chip per family** (Fable, Opus, Sonnet, Haiku), each in its own color. The active one is filled.
- **Version dropdown with prices**: a click on the active chip lists every version of that family with its list price.
- **Starts on your real model**: a new session highlights the model the session already runs.
- **Instant switch**: the choice applies to the next request.
- **Stats row**: the model that answered, estimated session and turn cost, effort, tokens and cache share.
- **Animated stats pane** with charts of the session's cost, models, tools and pace, and the **agents, live**: what each one is doing, on which model and what it costs.
- **15 games** in the pane (Pong, Tetris, Snake, Minesweeper, 2048… and two made of your session's data), under the [`▶ Jugar`](#6--jugar-play) tab.
- **`/modelo` command** to do the same from the keyboard.
- **Updates itself**: once a day it looks for a new version and installs it. It can be [turned off](#turning-it-off).

## Requirements

- **Claude Code 2.1.295 or newer**, with mod support (function hooks). Check with `claude --version`.
- A terminal with 24-bit color to see the colors as designed.
- The band draws in the terminal and the desktop app. It has been tried in the terminal.

> Claude Code's mod API is early access and may change between releases. If a Claude Code update breaks the mod, please open an issue.

## Install

Pick **one** option. Installing it two ways at once keeps one copy from loading (see [Troubleshooting](#troubleshooting)).

### Option A: as a plugin (recommended)

From any terminal:

```bash
claude plugin marketplace add juampymdd/claude-code-model-picker
claude plugin install model-picker@model-picker
```

The first command registers this repository as a marketplace; the second installs the mod for your user, in every project. Open a new Claude Code session and the band is above the prompt.

To install it for one project only, run the second command inside that project with `--scope project`.

It can also be installed from inside a Claude Code terminal session:

```
/plugin install model-picker --marketplace juampymdd/claude-code-model-picker
```

Answer `y` to add the marketplace, then pick a scope.

### Option B: clone the repository

Claude Code loads any mod found in your `~/.claude/skills/` folder. The folder **must be named `model-picker`**.

macOS / Linux:

```bash
git clone https://github.com/juampymdd/claude-code-model-picker.git ~/.claude/skills/model-picker
```

Windows (PowerShell):

```powershell
git clone https://github.com/juampymdd/claude-code-model-picker.git "$env:USERPROFILE\.claude\skills\model-picker"
```

Open a new Claude Code session. Use this option to edit the mod: changes in that folder reload by themselves.

### Option C: try it without installing

```bash
git clone https://github.com/juampymdd/claude-code-model-picker.git
claude --plugin-dir ./claude-code-model-picker
```

The mod is loaded for that session only.

## Check that it is installed

```bash
claude plugin list
```

`model-picker` should be listed as `enabled` or `loaded`. Then, in a new session, type `/modelo`: an answer like `Modelo: Opus 5.5. Uso: …` means the mod is loaded.

## Usage

### With the mouse

| Action | Result |
| --- | --- |
| Click another family's chip | Switches to that family's newest version |
| Click the active chip (`▾`) | Opens its versions, with prices, under the chip |
| Click a version in the list | Switches to it and closes the list (`●` marks the current one) |
| Click the active chip again (`▴`) | Closes the list, changing nothing |
| Pick the model the session already runs | Drops the choice and follows the session again |

### With the command

| Command | Result |
| --- | --- |
| `/modelo` | Shows the current model and the usage |
| `/modelo sonnet` | Switches to the newest Sonnet |
| `/modelo opus 4.8` | Switches to that exact version |
| `/modelo auto` | Goes back to the session's model |
| `/modelo stats` | Opens or closes the [stats pane](#the-stats-pane) |
| `/modelo juegos` | Hides or shows the pane's [games](#6--jugar-play) tab |

Families: `fable`, `opus`, `sonnet`, `haiku`.

## The stats row

Under the chips. Before the session's first response it reads `costo, tokens y cache: tras la próxima respuesta` ("cost, tokens and cache: after the next response"); then:

```
respondió Opus 5.5 · sesión ~$0.42 · turno ~$0.031 · effort medium · 48k→1.2k tok · cache ▰▰▰▰▰▰ 94% · contexto ▰▰▱▱▱▱ 38% · manual
```

| Label | Meaning |
| --- | --- |
| `respondió Opus 5.5` | "answered by": the model the API says answered the latest request. Use it to confirm a switch took effect |
| `sesión ~$0.42` | Estimated cost of every request of the session, subagents included |
| `turno ~$0.031` | Estimated cost of the current turn (your last message and every call it triggered) |
| `effort medium` | The reasoning effort the latest request asked for |
| `48k→1.2k tok` | Tokens of the latest request: whole prompt (cache included) → response |
| `cache ▰▰▰▰▰▰ 94%` | The share of that prompt served from cache, with its meter: green when high, amber under 70%, red under 30%. Drops to 0% right after a model switch |
| `contexto ▰▰▱▱▱▱ 38%` | How full the context window is: green, amber from 70%, red from 90% |
| `manual` | A model is picked by hand, other than the session's |

In a narrow terminal the row keeps its leftmost parts and drops the last ones. It is hidden while the dropdown is open.

**Costs are estimates**: the tokens the API reported times the list price. On a subscription, read them as a measure of usage, not as your bill. See [Limitations](#limitations).

## The stats pane

A pane with charts of the whole session. Open and close it with the **`▦ stats`** button at the end of the band, or with `/modelo stats`. On wide terminals (110 columns or more, fullscreen) it docks on the right; otherwise it shows above the prompt. `Esc` closes it too when it has the focus.

```
sesión 1h12m · ~$0.42 · 31 turnos · contexto ▰▰▰▱▱▱▱▱ 38%
 1: Costo   2: Modelos   3: Tools   4: Ritmo   5: Agentes   6: ▶ Jugar
```

Change tabs with a click or, with the pane focused (click on it or `ctrl+x tab`), with the `1` to `6` keys. The charts are made of block characters, with no libraries, so they look the same in the terminal and the desktop app. Labels are in Spanish, like the rest of the interface (`sesión` = session, `turnos` = turns, `contexto` = context window).

### 1 · Costo (cost)

What each turn cost: each message of yours with every request it triggered.

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

- On top, a column chart of the latest turns' cost.
- The table lists the 50 most recent turns, newest first. The bar is the turn's cost: `▒` what the prompt cost (`entrada` = input) and `█` what the response cost (`salida` = output), in the color of the model that answered.
- `tok` is the turn's tokens (whole prompt, cache included → response) and `cache` the share of the prompt served from cache.
- In narrow panes the table drops `tok` first and then `cache`.

### 2 · Modelos (models)

How the session's cost splits between models, subagents included.

```
USO POR MODELO
◆ Opus 5.5    ████████████▌   $0.31   74%  1.4M→30k  22 req
● Haiku 5.5   ██▏             $0.05   12%  410k→9k   14 req
subagentes: $0.05 (12% del total)
```

### 3 · Tools

Which tools ran, from every loop: how many times, how many failed, total and average time.

```
TOOLS · 87 llamadas · 3 errores · 2m41s
Bash          ██████████▏   42  2 err   1m12s   1.7s
Read          ██████▎       26  –          4s  150ms
```

A call counts as an error if the tool returned an error or another plugin refused it. The time includes any permission prompts the tool raised.

### 4 · Ritmo (pace)

How long Claude worked and at what rate.

```
RITMO · activo 18m de 1h12m (25%) · 4.2 pasos/turno · prom 35s
duración   ▁▂▁▅▃▁▁█▂▁▃▂▁▁▄▂   máx 3m12s
pasos      ▁▁▂▇▃▁▁█▂▁▂▂▁▁▃▂   máx 23
actividad  ··▁▃█▅···▂▃▁··▂▅   16 tramos de 4m30s
  31  12s     3 pasos  respuesta
  30  3m12s   23 pasos abortado
```

- `duración` (duration) and `pasos` (steps) are per-turn charts: how long each took and how many requests the main loop made.
- `actividad` (activity) spreads the steps over the session's time; a `·` is a stretch with no activity.
- Each turn ends as `respuesta` (answered), `abortado` (aborted), `rechazo` (refused) or `error`, and reads `en curso` (running) while it runs.

### 5 · Agentes (agents)

The session's subagents, live. Claude Code already shows which agents are running; this tab adds what it does not: what each one costs, on which model, which tools it used, which one it is in now and how long it has been going.

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

Each agent takes two rows. On top: state, type, description, time and cost. Below: model, requests, most used tools, what it is doing now (`▸`) and a chart of its latest requests' cost.

| State | Glyph | Color |
| --- | --- | --- |
| Running (`corriendo`) | `●` (beats) | green |
| Waiting, pending or idle (`esperando`) | `◐` (beats) | amber |
| Finished (`terminados`) | `○` | gray |
| Failed or cancelled (`fallaron`) | `✕` | red |

- The state colors are Claude Code's theme colors, so they follow your light or dark theme. The model takes its family's color, like the chips in the band.
- `▸` shows the tool in progress with its time, or `pensando` ("thinking") while the agent waits on the model. A tool's time turns amber after 10 seconds (usually a pending permission prompt), the agent's after 5 minutes.
- A tool with failures carries `✕` and their count in red. A cost above $1 turns red.
- An agent spawned by another agent is listed under it, with `└`.
- Running ones come first (newest on top), then the latest 10 finished; **`ocultar terminados`** ("hide finished") drops them from the list.
- While agents are at work, a `●` with their count beats beside the band's `▦ stats` button, so you know without opening the pane.

### 6 · Jugar (play)

For when Claude is working by itself: **15 games** inside the pane, under the **`▶ Jugar`** tab, always there beside the others.

```
 ☰ juegos   ◆ Pong · récord 7
```

**`☰ juegos`** opens the list of every game with its best score (`récord`); a click on one opens it. To play with the keyboard you have to **click on the game** (that gives it the focus); `Esc` hands it back to the prompt. The mouse always works.

Keys every game shares:

| Key | Action |
| --- | --- |
| `space` or a click | Starts; resumes after a pause |
| `p` or `Enter` | Pause and resume |
| `r` | New game |

| Game | What it is | Keyboard | Mouse |
| --- | --- | --- | --- |
| ◆ **Pong** | Against the machine, to 11 points | `↑` `↓` move · `space` pauses | the paddle follows the pointer |
| ▲ **Space Invaders** | Three rows coming down faster and faster, shields, three lives | `←` `→` · `space` fires | the ship follows the pointer · click fires |
| ● **Snake** | Eat, grow, and speed up every five meals | arrows turn | a click points that way |
| ▟ **Tetris** | Seven pieces from a bag, a held piece and a drop shadow | `←` `→` · `↑`/`x` turns · `z` the other way · `↓` down · `space` drops · `c` holds | a click to a side moves, in the middle turns · right drops |
| ▬ **Breakout** | Six rows of bricks, three lives, faster levels | `←` `→` · `space` launches | the paddle follows the pointer · click launches |
| ▦ **2048** | Slide and merge like tiles | arrows | drag |
| ✸ **Buscaminas** (Minesweeper) | The first click is never a mine; the board depends on the pane's width | arrows + `space` opens · `f` flags | click opens · right flags · a click on a number opens around it |
| ▶ **Flappy** | Fly between the pipes; the gap narrows | `space` or `↑` flaps | click flaps |
| ▙ **Dino** | Jump the cactuses, duck under the birds | `space`/`↑` jumps · `↓` ducks | click jumps |
| ☻ **Frogger** | Across the road and the river to five homes, against the clock | arrows hop | a click hops that way |
| ◇ **Asteroids** | A field with no edges, rocks that split in two | `←` `→` turn · `↑` thrusts · `space` fires | points at the pointer · click fires · right thrusts |
| ▣ **Sokoban** | Six levels: push every box onto its goal | arrows · `u` undoes · `n`/`b` change level | click beside the player |
| ░ **Juego de la vida** (Game of Life) | Not won: drawn on and watched | `space` pauses · `c` clears · `g` glider · `1`–`5` speed | draws (right erases) |
| $ **Token Invaders** | Invaders with **your tools** as the invaders | as Invaders | as Invaders |
| ⚑ **Carrera de agentes** (agents' race) | The session's subagents on a track | not played | — |

Two games use your session's data:

- **Token Invaders**: each invader is a tool Claude used (`Ba` Bash, `Ed` Edit, `Re` Read…), the most used first. Green if it never failed, amber if it ever did, red past one failure in five. They come down faster the more the session cost: twice as fast from $10 on.
- **Carrera de agentes**: a lane per subagent, moving one cell per request, with its cost at the end. Those still working take their model's color and a beating `▶`; those that finished show `✔` or `✕`.

Good to know:

- Records are kept between sessions. In Minesweeper the record rewards the shortest time; in Sokoban it counts the levels solved; the Game of Life and the race have none.
- A terminal does not report key releases: each press moves one step (holding the key repeats). Asteroids and Breakout play better with the mouse.
- While the game has the focus, the `1` to `6` tab keys may not answer: `Esc` first.
- Each game needs a minimum width (between 20 and 38 columns) and says so when the pane falls short.
- The games run in the terminal and the desktop app.

**Hiding the tab:** `/modelo juegos` removes it or puts it back for the session. To never see it, `/config` → **Juegos en el panel** (`model-picker.games`) → off.

### Motion

In the terminal and the desktop app the pane moves; on other surfaces it is drawn still, with the same data.

| What | How it moves |
| --- | --- |
| Times (session, running turn, agents, tool in progress) | Run by themselves, second by second |
| An active agent's state | The glyph beats |
| Tool in progress / `pensando` | A spinner and advancing dots |
| The Models and Tools bars, the context meter | Grow to their value when the tab opens and when new data arrives |
| Cost columns | Rise from zero when the tab opens |
| A new agent | Slides in from the right |
| An agent that ends | Flashes for a moment, then dims |
| The newest stretch of `actividad` | Beats while a turn is running |
| The model chip in the band | Lights up for a moment when the model changes |

The context meter (`▰▰▰▱▱▱▱▱ 38%`) goes from green to amber at 70% and to red at 90%. When nothing moves the pane is not redrawn, and with only clocks on screen it is redrawn once a second.

### Good to know

- The pane counts what the mod has seen since it loaded: it knows nothing of what happened before. A `/clear` resets it.
- Costs are list-price estimates (see [Limitations](#limitations)). When Claude Code reports a cost of its own, the header shows it beside it as `/cost`.
- A turn's duration and a tool's time are wall-clock: they include waiting on permissions.
- A subagent still running after your turn ends adds its cost to whichever turn is open then. The per-model and session totals are exact regardless.
- An agent shows up when the mod sees it: at its spawn, or at its first request or tool. Those that ended before the mod loaded are not there.
- Each agent's state is brought from Claude Code's own list every 2 seconds while any is at work. A workflow's agent is not in that list: it is shown all the same, typed `agente` and with no description.
- `pensando` and the amber of a slow tool are the mod's own deductions (no tool in progress; over 10 seconds), not states Claude Code reports.
- The latest 200 turns, up to 40 tool names (the rest count as `otros`, "others") and up to 100 agents are kept; the totals always include everything.

## Models and prices

Anthropic API list prices in US dollars per million tokens (MTok), as of October 6, 2026.

| Model | Input | Output |
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

Your account needs access to the model you pick. Prices change: the current ones are on [Anthropic's pricing page](https://www.anthropic.com/pricing).

## How it works

The mod registers these hooks:

| Hook | What for |
| --- | --- |
| `session.start` | Registers the `/modelo` command |
| `command.run` | Answers `/modelo` |
| `turn.step` | Before each request of the main loop, sets the picked model; after it, tallies what the API reported |
| `turn.start`, `turn.complete` | Open and close each turn in the stats pane's history |
| `tool.call` | Counts and times each tool without changing the call |
| `agent.spawn` | Notes each agent that is spawned, with its type and description |
| `session.end` | Resets the numbers on a `/clear` |
| `ui.render` | Draws the band above the prompt and the stats pane |
| `ui.message` | Takes a finished game's score and keeps the record |

Also, at `session.start` it starts the check for a new version in the background (see [Update](#update)) and a timer that every 2 seconds brings the agents' state up to date while any is at work.

The pane's moving part is a *surface module* (`hooks/live.tsx`): it runs on the drawing thread with a clock of its own, with no access to the engine, and gets its rows ready-made from the hooks.

The switch is **per request**: the mod rewrites the `model` field of each call the main loop makes. It never runs `/model`.

## Limitations

- **`/model` does not reflect the choice.** The built-in command keeps showing the session's model; the band and its `respondió …` are the source of truth.
- **The choice lasts the session.** Each new session starts on the session's model.
- **Main loop only.** Subagents keep their own model (their cost is still added to the session's).
- **Cost is an estimate.**
  - It uses list prices written in the code; it knows nothing of discounts, subscriptions or price changes.
  - Cache reads are priced at the model's published rate or, where there is none, at 10% of the input price; cache writes at 125%.
  - Haiku 5.5 is always priced at its base rate, although prompts over 100K tokens are billed higher.
  - It counts only the requests that went through the mod since it loaded, and a response from a model missing from the list adds $0.
- **Models and prices are written in the code.** A new model has to be added by hand (see below).
- **Switching models mid-conversation makes that request cost more**: the conversation's cache is per model, so the new model reads the whole history again.
- **In narrow terminals** the band compacts: under 106 columns it hides the note on the right, under 70 it leaves only the glyph of the unpicked models, and the stats row drops its last parts.
- **The interface is in Spanish.**

## Add or change models

Everything is in the `FAMILIES` list in [`hooks/models.ts`](hooks/models.ts). Each family has a name, glyph, color, note and its versions, newest first:

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

- `version` is what is shown; `model` is the exact API id.
- `price` is `[input, output]` in dollars per million tokens; the optional `cacheRead` is the price of a cache read.
- The first version listed is the one a click on the family picks.
- To add a family, add another block with a new lowercase `choice`: that is the name `/modelo` takes.

With option B or C, changes reload on save. Before sharing them, run `claude plugin validate .` and `claude plugin test .`.

## Update

**The mod updates itself.** Once a day, when a session starts, it reads the version published in this repository. If that is newer than the installed one, it installs it the way this copy was installed:

| Install | What runs |
| --- | --- |
| As a plugin (option A) | `claude plugin marketplace update model-picker` and `claude plugin update model-picker@model-picker` |
| Cloned (option B) | `git pull --ff-only` in the mod's folder |
| Anything else (e.g. `--plugin-dir` without git) | Nothing: it only tells you a new version exists |

When done it shows `model-picker actualizado a X.Y.Z · /reload-plugins o sesión nueva para aplicar` ("updated to X.Y.Z · /reload-plugins or a new session to apply"). The running session keeps the version it loaded until you run `/reload-plugins` or open another.

It does not slow startup (it runs in the background), does nothing offline, and if the install fails it tells you the command to run by hand.

### What that means

With this on, **every new version published in this repository is installed and run on your machine without you reviewing it**. That is convenient, and also the reason to turn it off if you would rather read the changes first: they are in [CHANGELOG.md](CHANGELOG.md).

### Turning it off

Inside a session: `/config` → **Actualización automática** (`model-picker.autoUpdate`) → off.

With it off, update by hand:

```bash
# option A
claude plugin marketplace update model-picker
claude plugin update model-picker@model-picker

# option B
git -C ~/.claude/skills/model-picker pull
```

Self-update exists since version 0.3.0: from an earlier version, update by hand once.

## Uninstall

Option A:

```bash
claude plugin uninstall model-picker@model-picker
claude plugin marketplace remove model-picker
```

Option B: delete the `~/.claude/skills/model-picker` folder.

## Troubleshooting

**I don't see the band.**
- Open a new session: installed mods load at startup.
- It may be collapsed: look for `[-]` / `[+]` on the right above the prompt, or press `ctrl+x ctrl+a`.
- Run `claude plugin list` and check `model-picker`'s status.
- Try `/modelo`: if it answers, the mod is loaded and only the drawing is at fault.

**`claude plugin list` says "the name "model-picker" is already taken".**
It is installed two ways (as a plugin and as a folder in `~/.claude/skills/`). Keep one: uninstall the plugin or delete the folder.

**I picked a model and `/model` still shows the old one.**
Expected: the mod does not change the session's model. Check `respondió …` in the stats row.

**`respondió …` shows a model other than the one I picked.**
The switch did not take effect. Confirm your account has access to that model and that its id in `FAMILIES` is right; if it persists, open an issue with your Claude Code version.

**The stats row is missing.**
It hides while the dropdown is open. Before the session's first response it only shows a notice.

**The cost does not match my bill.**
It is an estimate at list price. See [Limitations](#limitations).

**The colors look off.**
They are hex colors and depend on your terminal's color support. Change them in `FAMILIES`.

**I see a dim line starting with `model-picker:`.**
That is Claude Code reporting that one of the mod's hooks failed. Paste that line into an issue.

## Development

```bash
git clone https://github.com/juampymdd/claude-code-model-picker.git
cd claude-code-model-picker

claude plugin validate .   # checks the manifest and the hooks
claude plugin test .       # runs tests/*.test.ts(x)
claude --plugin-dir .      # opens a session with the mod loaded from this folder
```

Layout:

```
.claude-plugin/
  plugin.json        the mod's manifest
  marketplace.json   makes this repo installable as a marketplace
hooks/
  hooks.json         names the hooks module
  register.tsx       the hooks and the band's drawing
  models.ts          families, versions, ids and prices
  stats.ts           cost, tokens and the stats row
  charts.ts          charts made of block characters
  history.ts         the history of turns, models and tools
  rows.ts            each tab of the pane as rows of text
  paint.tsx          draws the rows, still or in motion
  live.tsx           surface module: the clock of the animations
  games.tsx          surface module: runs the chosen game (clock, keys, pointer)
  arcade.ts          the contract every game meets, and what they share
  catalog.ts         the list of games
  pixels.ts          a screen of half blocks for the games
  pong.ts invaders.ts classics.ts screens.ts        Pong and Space Invaders
  snake.ts tetris.ts breakout.ts g2048.ts mines.ts  one game per file
  flappy.ts dino.ts frogger.ts asteroids.ts
  sokoban.ts life.ts
  sessiongames.ts    Token Invaders and the agents' race
  pane.tsx           the tabs and the pane's assembly
  update.ts          the self-update
types/
  index.d.ts         the contract of the state the mod keeps
tests/
  picker.test.tsx    the band, the dropdown and the command
  stats.test.ts      costs and formatting
  charts.test.ts     the charts
  history.test.ts    the history
  motion.test.ts     the animation engine and the agents list
  games.test.ts      the rules of Pong and Space Invaders
  rules.test.ts      the rules of the other games
  arcade.test.tsx    the games running in the pane
  pane.test.tsx      the stats pane
  update.test.ts     the self-update
```

The video above is an animated recreation, not a recording: its source is in [`video/`](video/) (HTML + GSAP, rendered with [HyperFrames](https://github.com/heygen-com/hyperframes): `npx hyperframes render` inside that folder).

When it loads the mod, Claude Code writes its API's types into `.claude-plugin/types/` (git-ignored); with them `tsc -p .` type-checks the mod.

Issues and pull requests are welcome.

## License

[MIT](LICENSE) © 2026 Juan Pablo Maddoni
