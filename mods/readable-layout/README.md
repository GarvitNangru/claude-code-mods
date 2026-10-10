# Readable Layout

In the terminal, a Claude Code session is one long stream. Your message, Claude's short notes ("I'll check the config first"), its tool calls and its final answer all start with the same bullet in the same style. That makes it hard to tell who is talking, what Claude is doing, and which part is the answer you need to read.

Readable Layout gives every part of a turn its own look. Here is the same request in stock Claude Code and with the mod:

```
Before                                          After

❯ Count the test files, then read the theme     ╭─ You ──────────────────────────────────────╮
                                                │ Count the test files, then read the theme  │
● I'll count the files in the tests folder.     ╰────────────────────────────────────────────╯

  Searched for 1 pattern                          · I'll count the files in the tests folder.

● Now I'll read the theme file.                   Searched for 1 pattern

  Read 1 file                                     · Now I'll read the theme file.

● - The tests folder has 1 file.                  Read 1 file
  - The theme is built on the dark base.
                                                ╭─ Claude ───────────────────────────────────╮
✻ Cogitated for 8s · done 23:49                 │ - The tests folder has 1 file.             │
                                                │ - The theme is built on the dark base.     │
                                                ╰────────────────────────────────────────────╯

                                                ── ✻ Brewed for 20s ──────────────────────────
```

## What changes

- **Your messages** sit in a box labeled **You**, in your theme's blue.
- **Claude's answers** sit in a box labeled **Claude**, in Claude's orange. Anything longer than a line or two counts as an answer. Inside the box it renders as before: headings, lists, tables, code blocks and links.
- **Bold text stands out.** Claude Code draws bold text in the same color as everything else, only thicker, and at terminal font sizes that is easy to miss. Readable Layout draws it bold and in a soft peach, Claude's accent color, so key words and the lead-in of each list item catch your eye. Inline `code` keeps its own blue.
- **Claude's short notes** between steps become quiet, indented lines with a blank line above each one, so every note sits with the step it describes.
- **Tool activity** ("Read 1 file", "Searched for 1 pattern") keeps Claude Code's own quiet style, so you can skim past it.
- **Each turn ends with a rule** across the screen that shows how long it took, so you can see where one exchange stops and the next begins.

Notifications from background tasks, messages from other agents, permission prompts, diffs and command output are left exactly as Claude Code draws them.

## Settings

`Claude text to box` in `/config` has two choices:

- `answers` (the default) boxes replies of more than a line or two and shows one-line notes as quiet lines.
- `all` boxes everything Claude writes, notes included.

`Bold text` has three:

- `color` (the default) draws bold text in your theme's accent shimmer color, a soft peach in the dark themes and Ember.
- `highlight` puts a soft background behind bold text, like a marker pen. Pick this on a light theme, where the peach is too pale to read comfortably.
- `off` leaves bold text exactly as Claude Code draws it.

For a mod loaded from a folder, set them in `~/.claude/settings.json` instead:

```json
{ "pluginConfigs": { "readable-layout": { "options": { "boxes": "all", "bold": "highlight" } } } }
```

## Good to know

- Only the terminal changes. The desktop app, VS Code and mobile already lay a conversation out on their own, so they're left alone.
- The box and rule colors come from your theme, so they match whatever theme you use. It's designed alongside the [Ember](../../skins/ember) skin.
- To color bold text, the mod draws the paragraphs, headings and lists that contain it itself. Everything else is still drawn by Claude Code: code blocks, tables, quotes, and any part of a reply without bold. Bold text inside a table or a quote stays plain bold.
- It only changes how the transcript is drawn. What you and Claude wrote, and what's saved, stay exactly the same. Ctrl+O still shows the full transcript.

## Development

```
claude plugin validate mods/readable-layout
claude plugin test mods/readable-layout
```
