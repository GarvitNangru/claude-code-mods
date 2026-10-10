import type { Register, RenderElement } from 'claude-code'
import { drawMarkdown, type Emphasis } from './markdown'

const SHORT_NOTE_CHARS = 160

const isShortNote = (text: string): boolean => !text.includes('\n') && text.length <= SHORT_NOTE_CHARS

const fmtDuration = (ms: number): string => {
  const s = Math.max(1, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return m ? `${m}m ${s % 60}s` : `${s}s`
}

export const register: Register = (on, options) => {
  const boxesAll = options.boxes === 'all'
  const emphasis: Emphasis = options.bold === 'highlight' || options.bold === 'off' ? options.bold : 'color'

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.origin.kind !== 'composer' || !e.props.text.trim()) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return framed(Box, Text, 'You', 'suggestion', <Text>{e.props.text.trim()}</Text>)
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const text = e.props.text.trim()
    if (e.surface !== 'terminal' || e.props.isSummary || !text) return next(e)
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui

    if (!boxesAll && isShortNote(text)) {
      return (
        <Box flexDirection="row" marginTop={1} paddingLeft={2}>
          <Text color="subtle">{'· '}</Text>
          {drawMarkdown(ui, text, emphasis, true)}
        </Box>
      )
    }
    return framed(Box, Text, 'Claude', 'claude', drawMarkdown(ui, text, emphasis))
  })

  on('ui.render', { component: 'TurnDuration' }, ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const label = ` ✻ ${e.props.word} for ${fmtDuration(e.props.durationMs)} `
    const width = Math.max(24, (e.viewport?.columns ?? 80) - 2)
    return (
      <Box marginTop={1}>
        <Text color="subtle" wrap="truncate-end">
          {`──${label}${'─'.repeat(Math.max(0, width - label.length - 2))}`}
        </Text>
      </Box>
    )
  })
}

type Element = (props: Record<string, unknown>, ...children: unknown[]) => RenderElement

function framed(Box: Element, Text: Element, title: string, color: string, body: RenderElement): RenderElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
        {body}
      </Box>
      <Box position="absolute" top={0} left={2}>
        <Text color={color} bold>
          {` ${title} `}
        </Text>
      </Box>
    </Box>
  )
}
