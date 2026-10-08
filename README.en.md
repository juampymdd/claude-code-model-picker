# model-picker

[![test](https://github.com/juampymdd/claude-code-model-picker/actions/workflows/test.yml/badge.svg)](https://github.com/juampymdd/claude-code-model-picker/actions/workflows/test.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Pick the Claude model, and its version, from a band above the Claude Code prompt.** One click and the next request goes to another model: no `/model`, no dialogs, your default model untouched. Below it, what the API reported: which model answered, what it cost, tokens and cache.

🇪🇸 [Leer en español](README.md)

> The mod's interface is in Spanish (`MODELO`, `respondió`, `sesión`, `turno`, the `/modelo` command). This page translates each label.

```
▌ MODELO   ✦ Fable 5.1  ▐ ◆ Opus 5.5 ▾ ▌  ▲ Sonnet 5.5   ● Haiku 5.5    razonamiento profundo
  respondió Opus 5.5 · sesión ~$0.42 · turno ~$0.031 · effort medium · 48k→1.2k tok · cache 94%
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

Families: `fable`, `opus`, `sonnet`, `haiku`.

## The stats row

Under the chips. Before the session's first response it reads `costo, tokens y cache: tras la próxima respuesta` ("cost, tokens and cache: after the next response"); then:

```
respondió Opus 5.5 · sesión ~$0.42 · turno ~$0.031 · effort medium · 48k→1.2k tok · cache 94% · manual
```

| Label | Meaning |
| --- | --- |
| `respondió Opus 5.5` | "answered by": the model the API says answered the latest request. Use it to confirm a switch took effect |
| `sesión ~$0.42` | Estimated cost of every request of the session, subagents included |
| `turno ~$0.031` | Estimated cost of the current turn (your last message and every call it triggered) |
| `effort medium` | The reasoning effort the latest request asked for |
| `48k→1.2k tok` | Tokens of the latest request: whole prompt (cache included) → response |
| `cache 94%` | The share of that prompt served from cache. Drops to 0% right after a model switch |
| `manual` | A model is picked by hand, other than the session's |

In a narrow terminal the row keeps its leftmost parts and drops the last ones. It is hidden while the dropdown is open.

**Costs are estimates**: the tokens the API reported times the list price. On a subscription, read them as a measure of usage, not as your bill. See [Limitations](#limitations).

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

The mod registers four hooks:

| Hook | What for |
| --- | --- |
| `session.start` | Registers the `/modelo` command |
| `command.run` | Answers `/modelo` |
| `turn.step` | Before each request of the main loop, sets the picked model; after it, tallies what the API reported |
| `ui.render` | Draws the band above the prompt |

Also, at `session.start` it starts the check for a new version in the background (see [Update](#update)).

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
- **In narrow terminals** the band compacts: under 96 columns it hides the note on the right, under 70 it leaves only the glyph of the unpicked models, and the stats row drops its last parts.
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
  update.ts          the self-update
types/
  index.d.ts         the contract of the state the mod keeps
tests/
  picker.test.tsx    the band, the dropdown and the command
  stats.test.ts      costs and formatting
  update.test.ts     the self-update
```

When it loads the mod, Claude Code writes its API's types into `.claude-plugin/types/` (git-ignored); with them `tsc -p .` type-checks the mod.

Issues and pull requests are welcome.

## License

[MIT](LICENSE) © 2026 Juan Pablo Maddoni
