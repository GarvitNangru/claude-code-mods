# Boxed Replies

In the terminal, Claude's answers, its short progress notes and its tool calls all run together in one stream of text. When you come back to a long session, it takes effort to find what Claude actually told you. Boxed Replies draws each real answer inside a rounded box, so it stands out from everything around it:

```
❯ Read README.md, then tell me in three short bullets what this repository contains.

  Read 1 file

╭──────────────────────────────────────────────────────────────────────────╮
│ - Mods and skins for Claude Code, set up as a plugin marketplace. You    │
│   install each one on its own with /plugin install.                      │
│ - One mod so far, Agent Monitor, with a progress bar and an agents panel.│
│ - One skin so far, Ember, a warm, low-glare dark theme.                  │
╰──────────────────────────────────────────────────────────────────────────╯
```

Tool calls and one-line progress notes such as "Checking the config first:" keep their usual plain look. The boxes then mean "this is the part to read". Everything inside a box renders exactly as before: headings, lists, tables, code blocks and links.

## Settings

`Replies to box` in `/config` has two choices:

- `answers` (the default) boxes any reply that runs past a single line or is longer than a sentence or two, and leaves one-line notes plain.
- `all` boxes every piece of text Claude writes, notes included.

For a mod loaded from a folder, set it in `~/.claude/settings.json` instead:

```json
{ "pluginConfigs": { "boxed-replies": { "options": { "boxes": "all" } } } }
```

## Good to know

- The boxes are drawn only in the terminal. The desktop app, VS Code and mobile already lay replies out on their own, so they're left alone.
- The border uses your theme's subtle border color, so it matches whatever theme you use. It pairs well with the [Ember](../../skins/ember) skin.
- It only changes how replies are drawn. What Claude wrote, and what's saved in the transcript, stay exactly the same.

## Development

```
claude plugin validate mods/boxed-replies
claude plugin test mods/boxed-replies
```
