# model-picker · video

## Style Prompt
A warm dark terminal at night: near-black brown-tinted canvas, monospaced interface drawn exactly as the mod draws it, one orange accent, and the four model-family colors used only as data. Headlines in an expressive serif against the mono UI: the human voice over the machine's. Motion is quick and precise, like a tool responding: short eases, small overshoots on selections, nothing floaty.

## Colors
- Canvas `#17120E` (background, every scene)
- Panel `#0F0B08` (terminal window), hairline `#3A2E24`
- Foreground `#F4EDE4`, dim `#A89F94`
- Accent `#FB923C` (Opus orange; headlines' emphasis, focus)
- Data only: Fable `#C084FC`, Opus `#FB923C`, Sonnet `#38BDF8`, Haiku `#34D399`; warning `#FBBF24`, error `#F87171`
- Ink on filled chips `#18181B`

## Typography
- Fraunces (900 for headlines, 300 for the quiet line): the statements
- JetBrains Mono (400/700): everything that is the interface, and data

## Motion
- Entrances 0.35-0.6s; selections snap with `back.out(2)`; bars and meters `power3.out`
- Scene changes: blur-through and push, 0.5s
- Ambient: one breathing radial glow in the accent, a faint grid

## What NOT to Do
- No gradient text, no neon cyan/purple washes, no pure black or white
- No sans-serif anywhere; no second accent hue for decoration
- No family color used outside of meaning that family
- No floaty, slow fades on interface elements; no exit animations before a transition
