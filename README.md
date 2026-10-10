# Claude Code Mods

Mods and skins for [Claude Code](https://claude.com/claude-code). A mod is a small add-on that changes what you see or can do inside Claude Code, such as a progress bar, a panel or a new command. A skin changes how it looks: its colors, and the terminal around it. Each one lives in its own folder and installs on its own, so you only take the ones you want.

## Mods

| Mod | What it does |
| --- | --- |
| [Agent Monitor](mods/agent-monitor) | A progress bar above the prompt that fills as Claude works through a task, and a panel with the plan and every subagent's model, context use, estimated cost and run time. |
| [Readable Layout](mods/readable-layout) | Lays the terminal out like a conversation: your messages and Claude's answers in labeled boxes, Claude's work as quiet lines between them, bold text in color so it stands out, and a rule at the end of every turn. |

## Skins

| Skin | What it does |
| --- | --- |
| [Ember](skins/ember) | A warm, low-glare dark theme with clear levels of emphasis, so you can tell at a glance what to read first. Comes with a matching Windows Terminal look and the JetBrains Mono font. |

## Installing

Type this at the Claude Code prompt in a terminal, using the name from the tables above:

```
/plugin install agent-monitor --marketplace GarvitNangru/claude-code-mods
```

Claude Code asks whether to add this repository as a marketplace. Answer `y`, then pick a scope. The user scope loads it in every session from then on. A mod starts working right away, with no restart needed. For a skin, run `/theme` afterwards and pick it from the list. Some skins also have a terminal part, which their own page explains.

If you prefer to add the marketplace first and then browse what's in it:

```
/plugin marketplace add GarvitNangru/claude-code-mods
/plugin install agent-monitor@garvit-mods
```

To pick up a newer version later, run `claude plugin update agent-monitor@garvit-mods` and then `/reload-plugins` in an open session. To remove one, run `/plugin uninstall agent-monitor@garvit-mods`.

## Running one from a clone

This is handy if you want to change a mod or skin, or try one before installing it:

```
git clone https://github.com/GarvitNangru/claude-code-mods.git
claude --plugin-dir claude-code-mods/mods/agent-monitor
```

To load cloned folders in every session, the desktop app included, list them in the `env` block of `~/.claude/settings.json`. Separate several folders with `;` on Windows and `:` on macOS and Linux:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "C:\\path\\to\\claude-code-mods\\mods\\agent-monitor;C:\\path\\to\\claude-code-mods\\skins\\ember"
  }
}
```

A mod loaded this way reloads whenever you save one of its files, which makes it the easiest way to work on one.

## A note on compatibility

The mods are built on Claude Code's function hooks, and the skins on its custom themes. Both are still new and can change between releases. Everything here is developed and tested against Claude Code 2.1.292. If something stops showing up after an update, a change in Claude Code is the likely cause. Please open an issue if that happens.

## What's in the repository

```
.claude-plugin/marketplace.json   the list that /plugin reads
mods/<name>/
  .claude-plugin/plugin.json      the mod's name, version and description
  hooks/hooks.json                points Claude Code at the mod's code
  hooks/register.tsx              the mod itself
  types/index.d.ts                the shape of the state the mod keeps
  tests/                          tests, run with `claude plugin test`
  README.md                       what the mod does and how to use it
skins/<name>/
  .claude-plugin/plugin.json      the skin's name, version and description
  themes/<name>.json              the Claude Code theme
  windows-terminal/               the matching terminal look and its installer, if any
  README.md                       what the skin changes and how to install it
```

## Adding a new mod or skin

1. Create `mods/<name>/` or `skins/<name>/` with the files above. The quickest start is to ask Claude Code to build it; it knows the layout.
2. Add an entry for it to `.claude-plugin/marketplace.json` and a row to the right table at the top of this file.
3. Check it before committing:

   ```
   claude plugin validate .
   claude plugin validate mods/<name>
   claude plugin test mods/<name>
   ```

## License

[MIT](LICENSE)
