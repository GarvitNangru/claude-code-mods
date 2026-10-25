import type { Register, RenderElement } from 'claude-code'
import { drawMarkdown, type Emphasis } from './markdown'

const SHORT_NOTE_CHARS = 160

const isShortNote = (text: string): boolean => !text.includes('\n') && text.length <= SHORT_NOTE_CHARS

const ruleWidth = (columns: number | undefined): number => Math.max(24, (columns ?? 80) - 2)

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
    return framed(Box, Text, 'You', 'suggestion', e.viewport?.columns, <Text>{e.props.text.trim()}</Text>)
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
    return framed(Box, Text, 'Claude', 'claude', e.viewport?.columns, drawMarkdown(ui, text, emphasis))
  })

  on('ui.render', { component: 'TurnDuration' }, ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const label = ` ✻ ${e.props.word} for ${fmtDuration(e.props.durationMs)} `
    const width = ruleWidth(e.viewport?.columns)
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

// Rules above and below, never beside: side borders end up in text copied from the terminal.
function framed(
  Box: Element,
  Text: Element,
  title: string,
  color: string,
  columns: number | undefined,
  body: RenderElement,
): RenderElement {
  const width = ruleWidth(columns)
  const label = ` ${title} `
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={color} wrap="truncate-end">
        {'──'}
        <Text bold>{label}</Text>
        {'─'.repeat(Math.max(0, width - label.length - 2))}
      </Text>
      <Box flexDirection="column" paddingLeft={2}>
        {body}
      </Box>
      <Text color={color} wrap="truncate-end">
        {'─'.repeat(width)}
      </Text>
    </Box>
  )
}
