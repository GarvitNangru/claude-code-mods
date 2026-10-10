# Claude Code Mods

Mods for [Claude Code](https://claude.com/claude-code). Each one is a small add-on that changes what you see or what you can do inside Claude Code, such as a panel, a status bar or a new command. Every mod lives in its own folder under `mods/` and installs on its own, so you only take the ones you want.

## Mods

| Mod | What it does |
| --- | --- |
| [Agent Monitor](mods/agent-monitor) | A progress bar above the prompt that fills as Claude works through a task, and a panel with the plan and every subagent's model, context use, estimated cost and run time. |

## Installing a mod

Type this at the Claude Code prompt in a terminal:

```
/plugin install agent-monitor --marketplace GarvitNangru/claude-code-mods
```

Claude Code asks whether to add this repository as a marketplace. Answer `y`, then pick a scope. The user scope loads the mod in every session from then on. The mod starts working right away, with no restart needed.

If you prefer to add the marketplace first and then browse what's in it:

```
/plugin marketplace add GarvitNangru/claude-code-mods
/plugin install agent-monitor@garvit-mods
```

To pick up a newer version later, run `claude plugin update agent-monitor@garvit-mods` and then `/reload-plugins` in an open session. To remove one, run `/plugin uninstall agent-monitor@garvit-mods`.

## Running a mod from a clone

This is handy if you want to change a mod or try one before installing it:

```
git clone https://github.com/GarvitNangru/claude-code-mods.git
claude --plugin-dir claude-code-mods/mods/agent-monitor
```

To load a cloned mod in every session, the desktop app included, list its folder in the `env` block of `~/.claude/settings.json`. Separate several folders with `;` on Windows and `:` on macOS and Linux:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "C:\\path\\to\\claude-code-mods\\mods\\agent-monitor"
  }
}
```

A mod loaded this way reloads whenever you save one of its files, which makes it the easiest way to work on one.

## A note on compatibility

These mods are built on Claude Code's function hooks, an API that is still in early access and can change between releases. They're developed and tested against Claude Code 2.1.292. If a mod stops showing up after an update, an API change is the likely cause. Please open an issue if that happens.

## What's in the repository

```
.claude-plugin/marketplace.json   the list of mods that /plugin reads
mods/<name>/
  .claude-plugin/plugin.json      the mod's name, version and description
  hooks/hooks.json                points Claude Code at the mod's code
  hooks/register.tsx              the mod itself
  types/index.d.ts                the shape of the state the mod keeps
  tests/                          tests, run with `claude plugin test`
  README.md                       what the mod does and how to use it
```

## Adding a new mod

1. Create `mods/<name>/` with the files above. The quickest start is to ask Claude Code to build the mod; it knows the layout.
2. Add an entry for it to `.claude-plugin/marketplace.json` and a row to the table at the top of this file.
3. Check it before committing:

   ```
   claude plugin validate .
   claude plugin validate mods/<name>
   claude plugin test mods/<name>
   ```

## License

[MIT](LICENSE)
