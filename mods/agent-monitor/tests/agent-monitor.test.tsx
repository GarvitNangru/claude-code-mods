import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const SURFACES = ['terminal', 'desktop'] as const
const MODEL = 'claude-opus-5-5'
const USAGE = {
  input_tokens: 1000,
  output_tokens: 2000,
  cache_read_input_tokens: 40_000,
  cache_creation_input_tokens: 5000,
  model: MODEL,
}
const SCROLL = { offset: 0, bodyRows: 20 }
const BAND = {
  plugin: 'agent-monitor',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 120, scroll: SCROLL, view: {} },
} as const
const PANE = {
  plugin: 'agent-monitor',
  component: 'Pane',
  requestId: 'agent-monitor',
  props: { title: 'Agents', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: SCROLL, view: {} },
} as const

function engineBeneath(on: On): void {
  let spawned = 0
  on('agent.spawn', () => ({ model: MODEL, agentId: `a${++spawned}` }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: USAGE }
  })
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

const spawn = ($: Engine, description: string) =>
  $.agent.spawn({
    tool_use_id: `t-${description}`,
    prompt: 'go',
    description,
    subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: MODEL,
    background: true,
    fork: false,
  })

async function step($: Engine, agentId: string): Promise<void> {
  const stream = $.turn.step({ turnId: `turn-${agentId}`, index: 0, model: MODEL, effort: 'high', messageCount: 1, agentId })
  for await (const _ of stream);
  await stream.result
}

const complete = ($: Engine, agentId: string) =>
  $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: `turn-${agentId}`, agentId, reason: 'answer' })

const submit = ($: Engine) => $.prompt.submit({ text: 'next', wait: false, origin: { kind: 'composer' } })

const PROGRESS = 'mcp__agent-monitor__progress'
const STEPS = ['Move folder', 'Update names', 'Run tests', 'Push']
let calls = 0

const progress = ($: Engine, input: { title?: string; steps?: string[]; done?: number; agentId?: string }) =>
  $.tool.call({ tool: PROGRESS, tool_use_id: `p${++calls}`, ...input })

const bandText = async ($: Engine, surface: 'terminal' | 'desktop'): Promise<string> => {
  const ui = await $.ui.mount({ ...BAND, surface })
  const shown =
    surface === 'desktop'
      ? String((await ui.find({ type: 'Svg' }))?.props.alt ?? '')
      : (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' ')
  await ui.unmount()
  return shown
}

describe('plan', () => {
  test('fills the bar as Claude reports finished steps', async ($, on) => {
    mock.clock(on, { now: 0 })
    engineBeneath(on)
    await progress($, { title: 'Rename mod', steps: STEPS })

    for (const surface of SURFACES) {
      const shown = await bandText($, surface)
      expect(shown).toContain('Rename mod')
      expect(shown).toContain('0/4')
      expect(shown).toContain('Move folder')
    }

    await progress($, { done: 2 })
    for (const surface of SURFACES) {
      const shown = await bandText($, surface)
      expect(shown).toContain('2/4')
      expect(shown).toContain('Run tests')
    }

    await progress($, { done: 4 })
    expect(await bandText($, 'terminal')).toMatch(/✓ Rename mod .* 4\/4 done in/)
  })

  test('ignores progress reported by subagents', async ($, on) => {
    mock.clock(on, { now: 0 })
    engineBeneath(on)
    await progress($, { title: 'Rename mod', steps: STEPS })
    await progress($, { title: 'Side quest', steps: ['One', 'Two'], agentId: 'a1' })
    expect(await bandText($, 'terminal')).toContain('Rename mod')
  })

  test('clears a finished plan on the next prompt and a stale one a prompt later', async ($, on) => {
    mock.clock(on, { now: 0 })
    engineBeneath(on)
    await progress($, { title: 'Done task', steps: ['Only step'], done: 1 })
    await submit($)
    expect(await bandText($, 'terminal')).toBe('engine')

    await progress($, { title: 'Half task', steps: STEPS, done: 1 })
    await submit($)
    expect(await bandText($, 'terminal')).toContain('Half task')
    await submit($)
    expect(await bandText($, 'terminal')).toBe('engine')
  })

  test('asks no permission for the progress tool unless a rule denies it', async ($, on) => {
    let verdict: 'ask' | 'deny' = 'ask'
    on('tool.check', () => ({ decision: verdict }))
    expect((await $.tool.check({ tool: PROGRESS, input: { done: 1 } })).decision).toBe('allow')
    verdict = 'deny'
    expect((await $.tool.check({ tool: PROGRESS, input: { done: 1 } })).decision).toBe('deny')
  })

  test('tells the model about the bar only when the tool is offered', async ($, on) => {
    on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'Hi', scope: 'shared' as const }] }))
    const compose = (tools: string[]) =>
      $.prompt.compose({ model: MODEL, promptModel: MODEL, surfaces: ['terminal'], tools, outputStyle: null, traits: [] })
    const withTool = (await compose(['Read', PROGRESS])).sections.map(s => s.id)
    expect(withTool).toEqual(['intro', 'agent-monitor:progress'])
    expect((await compose(['Read'])).sections.map(s => s.id)).toEqual(['intro'])
  })

  test('shows the plan as a checklist in the panel, its first call as one line and later calls not at all', async ($, on) => {
    mock.clock(on, { now: 0 })
    engineBeneath(on)
    await progress($, { title: 'Rename mod', steps: STEPS, done: 1 })

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      const shown = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
      expect(shown).toContain('Rename mod · 1/4')
      expect(shown).toContain('✓ Move folder')
      expect(shown).toContain('▸ Update names')
      expect(shown).toContain('○ Push')
      await ui.unmount()

      const row = await $.ui.mount({
        plugin: 'agent-monitor',
        surface,
        component: 'ToolUse',
        props: {
          tool_use_id: 'p1',
          tool: PROGRESS,
          input: { title: 'Rename mod', steps: STEPS },
          isRunning: false,
          isErrored: false,
          isInterrupted: false,
        },
      })
      expect((await row.find({ type: 'Text' }))?.text).toBe('▸ Plan · Rename mod · 4 steps')
      await row.unmount()

      const update = await $.ui.mount({
        plugin: 'agent-monitor',
        surface,
        component: 'ToolUse',
        props: { tool_use_id: 'p2', tool: PROGRESS, input: { done: 2 }, isRunning: false, isErrored: false, isInterrupted: false },
      })
      expect(await update.find({ type: 'Text' })).toBeUndefined()
      await update.unmount()
    }
  })
})

describe('band', () => {
  test('tracks the wave of agents and hides on dismiss', async ($, on) => {
    mock.clock(on, { now: 0 })
    engineBeneath(on)
    await spawn($, 'Scan repo')
    await spawn($, 'Read docs')
    await step($, 'a1')
    await complete($, 'a1')

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      const shown =
        surface === 'desktop'
          ? String((await ui.find({ type: 'Svg' }))?.props.alt)
          : (await ui.findAll({ type: 'Text' })).map(t => t.text).join(' ')
      expect(shown).toContain('1/2')
      expect(shown).toContain('1 running')
      expect(await ui.find({ key: 'open' })).toBeDefined()
      await ui.unmount()
    }

    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    await ui.press({ key: 'dismiss' })
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  })

  test('starts a new wave after the last one finished and the person moved on', async ($, on) => {
    mock.clock(on, { now: 0 })
    engineBeneath(on)
    await spawn($, 'First')
    await complete($, 'a1')

    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: '1 done' })).toBeDefined()

    await submit($)
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()

    await spawn($, 'Second')
    expect(await ui.find({ type: 'Text', text: '0/1' })).toBeDefined()
  })
})

describe('pane', () => {
  test('lists runs with model, context and cost, and clears finished ones', async ($, on) => {
    mock.clock(on, { now: 0 })
    engineBeneath(on)
    await spawn($, 'Scan repo')
    await spawn($, 'Read docs')
    await step($, 'a1')
    await complete($, 'a1')

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...PANE, surface })
      const shown =
        surface === 'desktop'
          ? (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.alt)).join('\n')
          : (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
      expect(shown).toContain('Scan repo')
      expect(shown).toContain('Read docs')
      expect(shown).toContain('ctx 48k (5%) · ≈$0.09')
      if (surface === 'terminal') expect(shown).toContain('Explore · Opus 5.5 · high · 1 steps')
      await ui.unmount()
    }

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key: 'clear' })
    expect(await ui.find({ type: 'Text', text: 'Scan repo' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'Read docs' })).toBeDefined()
  })
})
