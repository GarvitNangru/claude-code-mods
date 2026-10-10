# Agent Monitor

When Claude hands work off to subagents, it's hard to tell how far along they are, which model each one runs on, or how heavy the run is getting. Agent Monitor puts all of that on screen while it happens.

## The bar above the prompt

As soon as Claude starts a subagent, a bar appears above the prompt:

```
● Agents ████████████░░░░░░ 2/3 1 running · ≈$0.42 · 1:23 Panel ✕
```

It counts how many agents in the current batch have finished. Agents that start while others are still running join the same batch. When the whole batch is done the bar turns green, and it clears itself once you send your next message. Press ✕ to hide it until the next batch starts, or Panel to open the full list.

## The panel

Type `/agent-monitor` (or press Panel on the bar) to open a list of every subagent in the session:

```
1 running · 2 finished · ≈$0.61

● Scan the auth module
  Explore · Opus 5.5 · high · 14 steps
  ctx 48k (5%) · ≈$0.09 · 1:12

▾ Finished · 2  Clear finished

✓ Read the API docs
  general-purpose · Sonnet 5.5 · medium · 9 steps
  ctx 31k (3%) · ≈$0.04 · 0:48
```

Running agents come first and finished ones follow, newest at the top. You can collapse the finished list or clear it. Run `/agent-monitor` again to close the panel.

In the Claude Code desktop app, the bar and each row are drawn as graphics, with a small crab that walks while its agent is working.

## What the numbers mean

- **steps**: how many model requests the agent has made so far.
- **ctx**: how much context the agent's latest request carried, and what share of the model's context window that is.
- **≈$**: an estimate worked out from token counts and Anthropic's published API prices, with cache writes counted at the one-hour rate Claude Code uses. It is not a bill. On a Claude subscription you aren't charged per token at all, so treat it as a rough measure of how heavy a run was. The price table is `USD_PER_MTOK` in `hooks/register.tsx`.
- **time**: wall-clock time since the agent started.

A finished agent is marked ✓, one you interrupted ■, and one that failed ✗.

## Good to know

- The mod only watches what happens. It adds no tools and nothing to the model's context, so it costs nothing in tokens.
- Everything it shows is kept for the current session only.
- It works with any subagent: the built-in ones, your own, and those that come with other plugins.

## Development

```
claude plugin validate mods/agent-monitor
claude plugin test mods/agent-monitor
```

Once Claude Code has loaded the mod from its folder, `tsc -p mods/agent-monitor` type-checks it against the API of the installed version.

## Credits

The idea comes from [savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) by JohnnyVizz, which pairs a similar panel with his savvy-flow skill. Agent Monitor is a smaller, standalone take that works without any other plugin.
