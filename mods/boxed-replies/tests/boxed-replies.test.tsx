import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const ANSWER = 'Both are done.\n\n- **Agent Monitor** is pushed\n- **Ember** is applied'
const NOTE = 'Checking the config first:'

function engineBeneath(on: On): void {
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine: {e.props.text}</Text>
  })
}

const mountReply = ($: Engine, surface: 'terminal' | 'desktop', text: string, isSummary?: true) =>
  $.ui.mount({
    plugin: 'boxed-replies',
    surface,
    component: 'AssistantMessage',
    props: { text, isFirstOfReply: true, ...(isSummary ? { isSummary } : {}) },
  })

describe('answers (the default)', () => {
  test('boxes a reply of several lines on the terminal', async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', ANSWER)
    const box = await ui.find({ type: 'Box' })
    expect(box?.props).toMatchObject({ marginTop: 1, borderStyle: 'round', borderColor: 'subtle', paddingX: 1 })
    expect((await ui.find({ type: 'Markdown' }))?.text).toBe(ANSWER)
    expect(await ui.find({ type: 'Text', text: 'engine:' })).toBeUndefined()
  })

  test('boxes one long paragraph', async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', 'word '.repeat(40))
    expect((await ui.find({ type: 'Box' }))?.props.borderStyle).toBe('round')
  })

  test('leaves a one-line progress note to the engine', async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', NOTE)
    expect(await ui.find({ type: 'Text', text: 'engine:' })).toBeDefined()
    expect(await ui.find({ type: 'Box' })).toBeUndefined()
  })

  test('leaves summaries and every surface but the terminal to the engine', async ($, on) => {
    engineBeneath(on)
    for (const ui of [await mountReply($, 'terminal', ANSWER, true), await mountReply($, 'desktop', ANSWER)]) {
      expect(await ui.find({ type: 'Text', text: 'engine:' })).toBeDefined()
    }
  })
})

describe('all', () => {
  test('boxes one-line notes too', { options: { boxes: 'all' } }, async ($, on) => {
    engineBeneath(on)
    const ui = await mountReply($, 'terminal', NOTE)
    expect((await ui.find({ type: 'Box' }))?.props.borderStyle).toBe('round')
    expect((await ui.find({ type: 'Markdown' }))?.text).toBe(NOTE)
  })
})
