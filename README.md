# Claude Code Mods

These are some things I thought I could build to make my experience better while using [Claude Code](https://claude.com/claude-code). I use it a lot, and a few things kept bugging me. The terminal was hard to read, everything Claude wrote looked the same, and I never really knew how far along it was in a task. So I started building small fixes for those, and this repo is where I keep them.

There are two kinds of things in here. Mods change what you see or can do inside Claude Code, like a progress bar or a panel. Skins change how it looks, like the colors and the terminal around it. Each one is its own separate thing, so you can just take the ones you like.

## What's in here

### Mods

**[Agent Monitor](mods/agent-monitor).** I wanted to see where Claude is in a task without reading through everything, so this puts a progress bar above the prompt that fills up as Claude finishes each step. It also has a panel that shows every subagent Claude starts: which model it's on, how much context it's using, roughly what it costs and how long it's been running.

**[Readable Layout](mods/readable-layout).** The terminal used to feel like one long wall of text to me. This puts my messages and Claude's answers in their own labeled boxes, turns Claude's little in-between notes into quiet lines, and draws a line at the end of every turn so you can see where one exchange ends. It also makes bold text teal, because in the terminal bold looked almost the same as normal text.

### Skins

**[Ember](skins/ember).** Claude Code's default dark theme was either too bright or too faint for me, with nothing in between. Ember is a warmer, softer dark theme where you can tell what's important just by looking. It also comes with a matching Windows Terminal setup with the JetBrains Mono font, better spacing and real bold text.

**[Firelight](skins/firelight).** Claude Code themes in the three variants of [Firelight](https://github.com/ridusaini/firelight), a color palette by [ridusaini](https://github.com/ridusaini): Coal and Smoulder are dark, Ash is light. It comes with matching Windows Terminal colors and the same font and spacing as Ember.

## Before and after

Here's the same conversation in my terminal, first without Readable Layout and then with it. Both have the Ember skin on.

**Without Readable Layout**

![The conversation in stock Claude Code: the prompt, Claude's notes and its answer all start with the same white dot, and the bold names look like normal text](docs/screenshots/readable-layout-before.png)

**With Readable Layout**

![The same conversation with Readable Layout: the prompt and the answer sit in boxes labeled You and Claude, the notes are quiet grey lines, the bold names are teal, and a rule ends the turn](docs/screenshots/readable-layout-after.png)

## Does it work on Mac and Linux?

Mostly, yes. Both mods and the skins' themes work anywhere Claude Code runs, because they only use Claude Code's own features and never touch the operating system.

The one Windows-only part is the skins' terminal setup: the install script, the font and the Windows Terminal colors. On a Mac or Linux you still get the themes inside Claude Code. You just set up your terminal's font and colors yourself. Use a terminal that can show full colors, like iTerm2, Ghostty or WezTerm, or the colors will come out slightly off.

Also, Readable Layout only changes the terminal. The desktop app, VS Code and mobile already lay things out their own way, so it leaves those alone.

I've only tested all of this on Windows though, so if something looks weird on your machine, please open an issue.

## Installing

Type this at the Claude Code prompt, swapping in whichever one you want (`agent-monitor`, `readable-layout`, `ember` or `firelight`):

```
/plugin install agent-monitor --marketplace GarvitNangru/claude-code-mods
```

It'll ask if you want to add this repo as a marketplace. Say `y` and pick a scope. The user scope loads it in every session from then on. Mods start working right away, no restart needed. For a skin, run `/theme` afterwards and pick it from the list. Skins also have a terminal part, which each skin's own page explains.

If you'd rather add the marketplace first and then look around:

```
/plugin marketplace add GarvitNangru/claude-code-mods
/plugin install agent-monitor@garvit-mods
```

To get a newer version later, run `claude plugin update agent-monitor@garvit-mods` and then `/reload-plugins` in an open session. To get rid of one, run `/plugin uninstall agent-monitor@garvit-mods`.

## Trying one from a clone

This is handy if you want to change something or try a mod before installing it:

```
git clone https://github.com/GarvitNangru/claude-code-mods.git
claude --plugin-dir claude-code-mods/mods/agent-monitor
```

If you want cloned folders loaded in every session, the desktop app included, put them in the `env` block of `~/.claude/settings.json`. Separate them with `;` on Windows and `:` on Mac and Linux:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "C:\\path\\to\\claude-code-mods\\mods\\agent-monitor;C:\\path\\to\\claude-code-mods\\skins\\ember"
  }
}
```

That's how I run them myself. A mod loaded this way reloads every time you save one of its files, which makes it really easy to work on.

## Heads up

The mods are built on Claude Code's function hooks and the skins on its custom themes. Both are pretty new and could change between releases. I built and tested everything on Claude Code 2.1.292, so if something stops showing up after an update, that's probably why. Let me know in an issue if it happens.

## How the repo is laid out

If you want to poke around:

```
.claude-plugin/marketplace.json   the list that /plugin reads
docs/screenshots/                 the before and after screenshots
mods/<name>/
  .claude-plugin/plugin.json      the mod's name, version and description
  hooks/hooks.json                points Claude Code at the mod's code
  hooks/register.tsx              the mod itself
  types/index.d.ts                the shape of the state the mod keeps
  tests/                          tests, run with `claude plugin test`
  README.md                       what the mod does and how to install and use it
skins/<name>/
  .claude-plugin/plugin.json      the skin's name, version and description
  themes/<name>.json              the Claude Code theme, one file per variant
  windows-terminal/               the matching terminal look and its installer
  README.md                       what the skin changes and how to install it
  NOTICE.md                       credit and license for borrowed work, if any
```

## Adding your own

1. Make a `mods/<name>/` or `skins/<name>/` folder with the files above. Honestly, the easiest way is to just ask Claude Code to build it. It knows the layout.
2. Add it to `.claude-plugin/marketplace.json` and to the list at the top of this file.
3. Check it before you commit:

   ```
   claude plugin validate .
   claude plugin validate mods/<name>
   claude plugin test mods/<name>
   ```

## License

[MIT](LICENSE), so do whatever you want with it.
