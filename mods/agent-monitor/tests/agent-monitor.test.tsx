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
