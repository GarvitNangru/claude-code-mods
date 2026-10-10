# Ember

A warm, low-glare dark skin for Claude Code, made for long sessions in Windows Terminal.

Claude Code's built-in dark theme draws its main text in pure white and its hints and borders in a grey so dark it almost disappears. On Windows Terminal's default near-black background, that leaves you with glaring headline text and secondary text you have to squint at, and nothing in between that tells you where to look. Windows Terminal's defaults don't help either: tight line spacing, text pressed against the window edge, and bold text drawn as a brighter color instead of bold.

Ember fixes both halves.

## What it changes

**In Claude Code (the theme).** Text falls into three clear levels of emphasis on a warm, dark background:

| Level | Used for | Contrast |
| --- | --- | --- |
| Primary | Claude's replies and anything you need to read | 14:1, an off-white that doesn't glare |
| Secondary | Tool output, file names, metadata | 6.4:1, a warm grey you can still read comfortably |
| Tertiary | Hints, borders, placeholders | 3.2:1, visible but out of the way |

Your own messages sit on a slightly lighter block, so you can find where each exchange starts when you scroll back. For even more separation, pair it with the [Boxed Replies](../../mods/boxed-replies) mod, which draws Claude's answers inside boxes. Claude's orange stays as the accent, and success, error and warning colors are softened to match the palette. Diffs keep their green and red, just less saturated.

**In Windows Terminal (the look).** A matching color scheme, Cascadia Mono at 12 pt with 25% more line height, comfortable padding around the text, real bold for bold text, and a tab bar that blends into the window.

## Installing

### The Claude Code theme

Type this at the Claude Code prompt:

```
/plugin install ember --marketplace GarvitNangru/claude-code-mods
```

Then run `/theme` and pick **Ember**. It's listed as "Ember from ember".

### The Windows Terminal look

This part changes Windows Terminal's own settings, so it's a separate step. From a copy of this repository, run:

```
powershell -ExecutionPolicy Bypass -File skins\ember\windows-terminal\install.ps1
```

It adds the Ember color scheme and window theme, and applies the font, spacing and colors to your **Windows PowerShell** profile. Windows Terminal picks up the change immediately, with no restart needed. To style a different profile, pass its name: `-ProfileName "PowerShell"`.

Before changing anything, the script saves a backup of your settings next to the original, and it prints the one command that puts the backup back. Running it again is safe; it replaces Ember's settings rather than adding them twice.

If you'd rather make the change by hand, `windows-terminal/ember.json` holds the three pieces: the color scheme goes in `schemes`, the window theme in `themes`, and the profile values in the profile you use for Claude Code.

## Tuning it

Everything lives in two small JSON files:

- `themes/ember.json` holds the Claude Code colors. Each key overrides one color of the built-in dark theme, and any key you leave out keeps its default. Colors are `#RRGGBB` hex.
- `windows-terminal/ember.json` holds the terminal scheme and font settings. If 12 pt is too small on your screen, change `size`; if the lines feel too airy, lower `cellHeight` towards `1.1`.

After editing the Claude Code theme, start a new session, or reselect it in `/theme`, to see the change.
