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

Your own messages sit on a slightly lighter block, so you can find where each exchange starts when you scroll back. Claude's orange stays as the accent, and success, error and warning colors are softened to match the palette. Cyan becomes a soft teal (#8FD1C4), which [Readable Layout](../../mods/readable-layout) uses for bold text. Diffs keep their green and red, just less saturated.

**In Windows Terminal (the look).** A matching color scheme and the [JetBrains Mono](https://www.jetbrains.com/lp/mono/) font, which is designed for reading code: tall lowercase letters, clear differences between `0` and `O` or `1`, `l` and `I`, at 12 pt with 20% more line height. It uses the NL version, which shows `!=` and `->` exactly as typed instead of merging them into symbols. On top of that: comfortable padding around the text, real bold for bold text, and a tab bar that blends into the window.

Ember changes colors and type. To also change how a conversation is laid out (your messages and Claude's answers in labeled boxes, Claude's work as quiet lines, a rule at the end of each turn), add the [Readable Layout](../../mods/readable-layout) mod. The two are designed to work together.

## Installing

### The Claude Code theme

Type this at the Claude Code prompt:

```
/plugin install ember --marketplace GarvitNangru/claude-code-mods
```

It asks whether to add this repo as a marketplace. Say `y` and pick a scope; the user scope loads it in every session. Then run `/theme` and pick **Ember**. It's listed as "Ember from ember".

### The Windows Terminal look

This part changes Windows Terminal's own settings, so it's a separate step. It's Windows only; on a Mac or Linux, skip it and set your terminal's font and colors yourself. Clone this repository and run the script:

```
git clone https://github.com/GarvitNangru/claude-code-mods.git
powershell -ExecutionPolicy Bypass -File claude-code-mods\skins\ember\windows-terminal\install.ps1
```

It does three things:

1. Installs JetBrains Mono for your Windows account, if you don't have it yet. It downloads the official release from JetBrains' GitHub page and needs no admin rights. Pass `-SkipFont` to keep Cascadia Mono instead.
2. Adds the Ember color scheme and window theme.
3. Applies the font, spacing and colors to your **Windows PowerShell** profile. To style a different profile, pass its name: `-ProfileName "PowerShell"`.

Colors and spacing change immediately. If the font doesn't switch, close and reopen Windows Terminal.

Before changing anything, the script saves a backup of your settings next to the original, and it prints the one command that puts the backup back. Running it again is safe; it replaces Ember's settings rather than adding them twice.

If you'd rather make the change by hand, `windows-terminal/ember.json` holds the three pieces: the color scheme goes in `schemes`, the window theme in `themes`, and the profile values in the profile you use for Claude Code.

### Updating or removing it

To update the theme later, run `claude plugin update ember@garvit-mods`, then `/reload-plugins` in an open session. To remove it, run `/plugin uninstall ember@garvit-mods`. To undo the Windows Terminal part, run the restore command the install script printed.

## Tuning it

Everything lives in two small JSON files:

- `themes/ember.json` holds the Claude Code colors. Each key overrides one color of the built-in dark theme, and any key you leave out keeps its default. Colors are `#RRGGBB` hex.
- `windows-terminal/ember.json` holds the terminal scheme and font settings. If 12 pt is too small on your screen, change `size`; if the lines feel too airy, lower `cellHeight` towards `1.1`.

After editing the Claude Code theme, start a new session, or reselect it in `/theme`, to see the change.
