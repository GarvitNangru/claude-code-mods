import type { Register } from 'claude-code'

const SHORT_NOTE_CHARS = 160

const isShortNote = (text: string): boolean => {
  const trimmed = text.trim()
  return !trimmed.includes('\n') && trimmed.length <= SHORT_NOTE_CHARS
}

export const register: Register = (on, options) => {
  const boxesAll = options.boxes === 'all'

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isSummary || !e.props.text.trim()) return next(e)
    if (!boxesAll && isShortNote(e.props.text)) return next(e)

    const { Box, Markdown } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="subtle" paddingX={1}>
        <Markdown text={e.props.text.trim()} />
      </Box>
    )
  })
}
