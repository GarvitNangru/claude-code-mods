# Agent Monitor

Claude Code shows a spinner while it works, but nothing that tells you how far along a longer task is. Agent Monitor adds a progress bar above the prompt that fills as Claude finishes each step, and a panel that shows the whole plan and every subagent in the session.

## The bar above the prompt

When you ask for something that takes a few steps, Claude lays out its plan and the bar appears:

```
● temps.py module + tests ██████████████░░░░░░░░░░ 2/4 Write README.md · 0:41  Panel ✕
```

You see the task, how many steps are done, what Claude is working on right now and how long it has been going. If Claude starts subagents along the way, the bar adds how many are running. When the last step is done the bar turns green and shows the total time. It clears itself once you send your next message.

Quick questions and one-step requests don't get a bar, because there is nothing to measure progress against. If Claude only runs subagents without a plan, the bar counts those instead (`Agents 1/3 · 2 running`).

Press ✕ to hide the bar, or Panel to open the full view. You never need a command for the bar; it shows up on its own.

## The panel

Type `/agent-monitor`, or press Panel on the bar, to open the side panel. Run the command again to close it. It shows the current plan as a checklist, followed by every subagent in the session:

```
temps.py module + tests · 2/4
✓ Write temps.py
✓ Write test_temps.py
▸ Write README.md
○ Run tests

Subagents · 1 running · 1 finished · ≈$0.13

● Scan the auth module
  Explore · Opus 5.5 · high · 14 steps
  ctx 48k (5%) · ≈$0.09 · 1:12

▾ Finished · 1  Clear finished

✓ Read the API docs
  general-purpose · Sonnet 5.5 · medium · 9 steps
  ctx 31k (3%) · ≈$0.04 · 0:48
```

In the Claude Code desktop app, the bar and the subagent rows are drawn as graphics, with a small crab that walks while work is going on.

## Installing

Type this at the Claude Code prompt:

```
/plugin install agent-monitor --marketplace GarvitNangru/claude-code-mods
```

It asks whether to add this repo as a marketplace. Say `y` and pick a scope; the user scope loads it in every session. It starts working right away, no restart needed.

To update it later, run `claude plugin update agent-monitor@garvit-mods`, then `/reload-plugins` in an open session. To remove it, run `/plugin uninstall agent-monitor@garvit-mods`. To run it from a clone instead, see [Trying one from a clone](../../README.md#trying-one-from-a-clone).

## How it knows how far along Claude is

Claude Code doesn't keep a record of how much of a task is done, so the mod gives Claude a small tool called `progress`. Claude calls it once with its plan, then again each time it finishes a step. The mod also adds two sentences to Claude's instructions explaining when to use it.

- In the transcript, the plan shows as one dim line, such as `▸ Plan · temps.py module + tests · 4 steps`, instead of a full tool block. The step updates after it add nothing there, since the bar already shows them.
- You're never asked for permission to run it, because it only draws the bar. If you add a rule that denies the tool, your rule wins.
- It costs a little: the tool and the instructions add a few hundred tokens to each request (they are cached), and each step adds one short tool call.
- Claude decides what counts as a step, and occasionally skips the bar on a borderline task.

## What the subagent numbers mean

- **steps**: how many model requests the agent has made so far.
- **ctx**: how much context the agent's latest request carried, and what share of the model's context window that is.
- **≈$**: an estimate worked out from token counts and Anthropic's published API prices, with cache writes counted at the one-hour rate Claude Code uses. It is not a bill. On a Claude subscription you aren't charged per token at all, so treat it as a rough measure of how heavy a run was. The price table is `USD_PER_MTOK` in `hooks/register.tsx`.
- **time**: wall-clock time since the agent started.

A finished agent is marked ✓, one you interrupted ■, and one that failed ✗. Everything the mod shows is kept for the current session only.

## Development

```
claude plugin validate mods/agent-monitor
claude plugin test mods/agent-monitor
```

Once Claude Code has loaded the mod from its folder, `tsc -p mods/agent-monitor` type-checks it against the API of the installed version.

## Credits

The idea comes from [savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) by JohnnyVizz, which pairs a similar bar and panel with his savvy-flow skill. Agent Monitor is a smaller, standalone take that works without any other plugin.
