import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, PromptOrigin } from 'claude-code'

const ANSWER = 'Both are done.\n\n- **Agent Monitor** is pushed\n- **Ember** is applied'
const PLAIN_ANSWER = 'Both are done.\n\n- Agent Monitor is pushed\n- Ember is applied'
const NOTE = 'Checking the config first:'
const ACCENT = { bold: true, color: 'cyan_FOR_SUBAGENTS_ONLY' }
const PLUGIN = 'readable-layout'

function engineBeneath(on: On): void {
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine: {e.props.text}</Text>
  })
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine: {e.props.text}</Text>
  })
  on('ui.render', { component: 'TurnDuration' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine: {e.props.word}</Text>
  })
}

const mountReply = ($: Engine, surface: 'terminal' | 'desktop', text: string, isSummary?: true) =>
  $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'AssistantMessage',
    props: { text, isFirstOfReply: true, ...(isSummary ? { isSummary } : {}) },
  })

const mountPrompt = ($: Engine, surface: 'terminal' | 'desktop', text: string, origin: PromptOrigin = { kind: 'composer' }) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'UserMessage', props: { text, origin, isExpanded: true } })

const fromEngine = { type: 'Text', text: 'engine:' } as const

describe('your messages', () => {
  test('sit in a box labeled You', async ($, on) => {
    engineBeneath(on)
    const ui = await mountPrompt($, 'terminal', '  fix the login bug  ')
    const boxes = await ui.findAll({ type: 'Box' })
    expect(boxes.some(b => b.props.borderStyle === 'round' && b.props.borderColor === 'suggestion')).toBe(true)
    expect((await ui.find({ type: 'Text', text: 'You' }))?.text).toBe(' You ')
    expect((await ui.find({ type: 'Text', text: 'login' }))?.text).toBe('fix the login bug')
    expect(await ui.find(fromEngine)).toBeUndefined()
  })

  test('leave notifications, other senders and other surfaces to the engine', async ($, on) => {
    engineBeneath(on)
    const mounts = [
      await mountPrompt($, 'terminal', 'Build finished', { kind: 'task-notification' }),
      await mountPrompt($, 'desktop', 'fix the login bug'),
    ]
    for (const ui of mounts) expect(await ui.find(fromEngine)).toBeDefined()
  })
})

describe("Claude's text", () => {
  test('an answer sits in a box labeled Claude, rendered as markdown', async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', PLAIN_ANSWER)
    const boxes = await ui.findAll({ type: 'Box' })
    expect(boxes.some(b => b.props.borderStyle === 'round' && b.props.borderColor === 'claude')).toBe(true)
    expect((await ui.find({ type: 'Text', text: 'Claude' }))?.text).toBe(' Claude ')
    expect((await ui.find({ type: 'Markdown' }))?.text).toBe(PLAIN_ANSWER)
  })

  test('a one-line note is a quiet, indented line with space above it', async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', NOTE)
    expect((await ui.find({ type: 'Box' }))?.props).toMatchObject({ marginTop: 1, paddingLeft: 2 })
    expect((await ui.find({ type: 'Markdown' }))?.props).toMatchObject({ dimColor: true, text: NOTE })
    expect((await ui.findAll({ type: 'Box' })).some(b => b.props.borderStyle)).toBe(false)
  })

  test('summaries and other surfaces are left to the engine', async ($, on) => {
    engineBeneath(on)
    for (const ui of [await mountReply($, 'terminal', ANSWER, true), await mountReply($, 'desktop', ANSWER)]) {
      expect(await ui.find(fromEngine)).toBeDefined()
    }
  })

  test('with boxes set to all, notes are boxed too', { options: { boxes: 'all' } }, async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', NOTE)
    expect((await ui.findAll({ type: 'Box' })).some(b => b.props.borderColor === 'claude')).toBe(true)
  })
})

const strongTexts = async (ui: Awaited<ReturnType<typeof mountReply>>, style: Record<string, unknown> = ACCENT) =>
  (await ui.findAll({ type: 'Text' }))
    .filter(t => Object.entries(style).every(([k, v]) => t.props[k] === v))
    .map(t => t.text)

describe('bold text', () => {
  test('is drawn in the accent color, and parts without bold stay with the engine', async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', ANSWER)
    expect(await strongTexts(ui)).toEqual(['Agent Monitor', 'Ember'])
    expect((await ui.findAll({ type: 'Markdown' })).map(m => m.text)).toEqual(['Both are done.'])
    expect((await ui.findAll({ type: 'Text', text: /^-$/ })).length).toBe(2)
    expect(await ui.find({ type: 'Text', text: 'is pushed' })).toBeDefined()
  })

  test('keeps list numbers, inline code, italics and links', async ($, on) => {
    engineBeneath(on)
    const text = '3. **Run** `npm test` *first*\n4. See [the docs](https://example.com/docs)'
    const ui = await mountReply($, 'terminal', text)
    expect(await strongTexts(ui)).toEqual(['Run'])
    expect((await ui.findAll({ type: 'Text', text: /^\d\.$/ })).map(t => t.text)).toEqual(['3.', '4.'])
    expect((await ui.find({ type: 'Text', text: /^npm test$/ }))?.props).toMatchObject({ color: 'permission' })
    expect((await ui.find({ type: 'Text', text: /^first$/ }))?.props).toMatchObject({ italic: true })
    expect((await ui.find({ type: 'Link' }))?.props).toMatchObject({ href: 'https://example.com/docs' })
    expect(await ui.find({ type: 'Markdown' })).toBeUndefined()
  })

  test('nested lists keep their markers and indents', async ($, on) => {
    engineBeneath(on)
    const text = '1. **Install** it:\n   1. download\n   2. unzip\n\n   Then restart.\n2. Done'
    const ui = await mountReply($, 'terminal', text)
    expect((await ui.findAll({ type: 'Text', text: /^[\da-z]\.$/ })).map(t => t.text)).toEqual(['1.', 'a.', 'b.', '2.'])
    const rows = (await ui.findAll({ type: 'Box' })).filter(b => b.props.flexDirection === 'row' && b.props.paddingLeft !== undefined)
    expect(rows.map(b => b.props.paddingLeft)).toEqual([0, 3, 3, 0])
    expect((await ui.findAll({ type: 'Box' })).find(b => b.props.paddingLeft === 3 && b.props.marginTop === 1)).toBeDefined()
  })

  test('does not mistake snake_case, arithmetic or code for emphasis', async ($, on) => {
    engineBeneath(on)
    const text = '**Note:** set my_config_value to 2 * 3 * 4 and keep `**raw**` as is'
    const ui = await mountReply($, 'terminal', text)
    expect(await strongTexts(ui)).toEqual(['Note:'])
    expect((await ui.findAll({ type: 'Text' })).some(t => t.props.italic)).toBe(false)
    expect((await ui.find({ type: 'Text', text: /^\*\*raw\*\*$/ }))?.props).toMatchObject({ color: 'permission' })
    expect(await ui.find({ type: 'Text', text: 'my_config_value to 2 * 3 * 4' })).toBeDefined()
  })

  test('code blocks and tables are left to the engine, bold or not', async ($, on) => {
    engineBeneath(on)
    const fence = '```js\nconst a = "**not bold**"\n```'
    const table = '| Mod | State |\n| --- | --- |\n| **Ember** | on |'
    const ui = await mountReply($, 'terminal', `**Done.** Here it is:\n\n${fence}\n\n${table}`)
    expect(await strongTexts(ui)).toEqual(['Done.'])
    expect((await ui.findAll({ type: 'Markdown' })).map(m => m.text)).toEqual([`${fence}\n\n${table}`])
  })

  test('a one-line note keeps its dim look', async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', 'Now **reading** the theme.')
    expect(await strongTexts(ui)).toEqual(['reading'])
    expect((await ui.find({ type: 'Text', text: 'the theme' }))?.props).toMatchObject({ dimColor: true })
  })

  test('with bold set to highlight, bold text gets a background', { options: { bold: 'highlight' } }, async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', ANSWER)
    expect(await strongTexts(ui, { bold: true, backgroundColor: 'selectionBg' })).toEqual(['Agent Monitor', 'Ember'])
  })

  test('with bold set to off, the engine draws the whole answer', { options: { bold: 'off' } }, async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', ANSWER)
    expect((await ui.find({ type: 'Markdown' }))?.text).toBe(ANSWER)
    expect(await strongTexts(ui)).toEqual([])
  })
})

describe('end of turn', () => {
  test('draws a rule across the width with the time taken', async ($, on) => {
    engineBeneath(on)
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'TurnDuration',
      props: { word: 'Baked', durationMs: 65_000 },
      viewport: { columns: 60, rows: 30 },
    })
    const rule = (await ui.find({ type: 'Text' }))?.text ?? ''
    expect(rule.startsWith('── ✻ Baked for 1m 5s ──')).toBe(true)
    expect(rule.length).toBe(58)
  })
})
