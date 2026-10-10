import type { Elements, RenderChildren, RenderElement, TextProps } from 'claude-code'

export type Emphasis = 'color' | 'highlight' | 'off'

type Ui = Pick<Elements['terminal'], 'Box' | 'Text' | 'Link' | 'Markdown'>

type Span =
  | string
  | { kind: 'strong' | 'em' | 'del'; children: Span[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; children: Span[] }

type Item = { paras: string[][]; gaps: boolean[]; contentCol: number; lists: List[] }
type List = { ordered: boolean; start: number; markerCol: number; items: Item[] }
type Block =
  | { kind: 'heading'; depth: number; lines: string[] }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'list'; list: List }
type Line = { text: string; start: number; end: number }
type Chunk = { start: number; end: number; blocks?: Block[] }
type Found = { span: Span; end: number } | undefined

const STRONG_STYLE: Record<Exclude<Emphasis, 'off'>, TextProps> = {
  // The one cool accent every built-in theme defines in light, dark and ANSI variants, clear of Claude's orange.
  color: { bold: true, color: 'cyan_FOR_SUBAGENTS_ONLY' },
  highlight: { bold: true, backgroundColor: 'selectionBg' },
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const LEFT_TO_ENGINE = [
  FENCE,
  /^ {0,3}>/,
  /^ {0,3}\|/,
  /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/,
  /^ {0,3}(?:=+|-+|(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})\s*$/,
  /^ {0,3}<\/?[A-Za-z!?]/,
]
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:([ \t]+)(.*))?$/
const DELIMS = '*_~'
const PUNCT = /[!-/:-@[-`{-~]/
const WORD = /[\p{L}\p{N}]/u
const LINKABLE = /^(?:https?|file):/i
const MAX_INDENT = 32

export function drawMarkdown(ui: Ui, text: string, emphasis: Emphasis, dimColor = false): RenderElement {
  const { Box, Markdown } = ui
  const native = (t: string) => (dimColor ? <Markdown text={t} dimColor /> : <Markdown text={t} />)
  if (emphasis === 'off') return native(text)

  const segments: Chunk[] = []
  for (const c of splitChunks(text)) {
    const prev = segments.at(-1)
    if (prev && !prev.blocks && !c.blocks) prev.end = c.end
    else segments.push({ ...c })
  }
  if (!segments.some(s => s.blocks)) return native(text)

  const blocks = blockDrawer(ui, STRONG_STYLE[emphasis], dimColor)
  return (
    <Box flexDirection="column">
      {segments.map((s, i) => (
        <Box flexDirection="column" marginTop={i ? 1 : 0}>
          {s.blocks ? blocks(s.blocks) : native(text.slice(s.start, s.end))}
        </Box>
      ))}
    </Box>
  )
}

function blockDrawer({ Box, Text, Link }: Ui, strong: TextProps, dim: boolean) {
  const spans = (src: Span[]): RenderChildren =>
    src.map(s => {
      if (typeof s === 'string') return s
      if (s.kind === 'code') return <Text color="permission">{s.text}</Text>
      const inner = spans(s.children)
      switch (s.kind) {
        case 'strong':
          return <Text {...strong}>{inner}</Text>
        case 'em':
          return <Text italic>{inner}</Text>
        case 'del':
          return <Text strikethrough>{inner}</Text>
        case 'link':
          if (!LINKABLE.test(s.href)) return <Text>{inner}</Text>
          return s.children.length ? <Link href={s.href}>{inner}</Link> : <Link href={s.href} />
      }
    })
  const prose = (lines: string[] = []) => spans(parseInline(lines.join('\n')))

  const list = (l: List, indent: number, depth: number): RenderChildren => {
    const last = l.start + l.items.length - 1
    return l.items.map((item, i) => {
      const marker = l.ordered ? `${ordinal(depth, l.start + i, l.start, last)}.` : '-'
      const cell = marker.length + 1
      return [
        <Box flexDirection="row" paddingLeft={indent} marginTop={item.gaps[0] ? 1 : 0}>
          <Box width={cell} flexShrink={0}>
            <Text dimColor={dim}>{marker}</Text>
          </Box>
          <Text dimColor={dim}>{prose(item.paras[0])}</Text>
        </Box>,
        item.paras.slice(1).map((p, k) => (
          <Box paddingLeft={indent + cell} marginTop={item.gaps[k + 1] ? 1 : 0}>
            <Text dimColor={dim}>{prose(p)}</Text>
          </Box>
        )),
        item.lists.map(sub => list(sub, Math.min(indent + cell, MAX_INDENT), depth + 1)),
      ]
    })
  }

  return (blocks: Block[]): RenderChildren =>
    blocks.map((b, i) => {
      const marginTop = blocks[i - 1]?.kind === 'heading' ? 1 : 0
      if (b.kind === 'list') {
        return (
          <Box flexDirection="column" marginTop={marginTop}>
            {list(b.list, 0, 0)}
          </Box>
        )
      }
      const h1 = b.kind === 'heading' && b.depth === 1
      return (
        <Box marginTop={marginTop}>
          <Text dimColor={dim} bold={b.kind === 'heading'} italic={h1} underline={h1}>
            {prose(b.lines)}
          </Text>
        </Box>
      )
    })
}

function ordinal(depth: number, n: number, first: number, last: number): string {
  if (depth === 1 && first >= 1) return letters(n)
  if (depth === 2 && first >= 1 && last <= 3999) return roman(n)
  return String(n)
}

function letters(n: number): string {
  let s = ''
  while (n > 0) {
    n--
    s = String.fromCharCode(97 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
]

function roman(n: number): string {
  let s = ''
  for (const [value, numeral] of ROMAN) {
    while (n >= value) {
      s += numeral
      n -= value
    }
  }
  return s
}

function splitChunks(text: string): Chunk[] {
  const chunks: Chunk[] = []
  let cur: Line[] = []
  let fence: RegExp | undefined
  let blankBefore = false
  const close = () => {
    while (cur.length && !cur.at(-1)?.text.trim()) cur.pop()
    const first = cur[0]
    const last = cur.at(-1)
    if (first && last) chunks.push({ start: first.start, end: last.end, blocks: parseChunk(cur.map(l => l.text)) })
    cur = []
  }

  let start = 0
  for (const raw of text.split('\n')) {
    const line: Line = { text: raw.replace(/\r$/, '').replace(/\t/g, '    '), start, end: start + raw.length }
    start = line.end + 1
    if (fence) {
      cur.push(line)
      if (fence.test(line.text)) fence = undefined
    } else if (!line.text.trim()) {
      blankBefore = cur.length > 0
      if (blankBefore) cur.push(line)
    } else {
      if (blankBefore && !(/^ {2,}\S/.test(line.text) && cur.some(l => ITEM.test(l.text)))) close()
      blankBefore = false
      const open = FENCE.exec(line.text)?.[1]
      if (open) fence = new RegExp(`^ {0,3}${open.charAt(0)}{${open.length},}\\s*$`)
      cur.push(line)
    }
  }
  close()
  return chunks
}

function parseChunk(lines: string[]): Block[] | undefined {
  if (!/\*\*|__/.test(lines.join('\n'))) return
  if (/^ {4}/.test(lines[0] ?? '') || lines.some(t => LEFT_TO_ENGINE.some(re => re.test(t)))) return

  const blocks: Block[] = []
  const stack: List[] = []
  const deepest = () => stack.at(-1)?.items.at(-1)
  let para: string[] | undefined
  let blank = false

  for (const line of lines) {
    if (!line.trim()) {
      blank = true
      continue
    }
    const indent = line.length - line.trimStart().length
    const heading = HEADING.exec(line)
    const item = ITEM.exec(line)

    if (heading && !(stack.length && indent >= 2)) {
      stack.length = 0
      para = undefined
      blocks.push({ kind: 'heading', depth: (heading[1] ?? '#').length, lines: [heading[2] ?? ''] })
    } else if (item && (stack.length || !para || interrupts(item))) {
      const [, lead = '', marker = '-', pad = ' ', content = ''] = item
      const ordered = /\d/.test(marker)
      para = [content.trim()]
      const next: Item = { paras: [para], gaps: [blank], contentCol: lead.length + marker.length + Math.min(pad.length, 4), lists: [] }
      place(stack, blocks, next, { ordered, start: ordered ? parseInt(marker, 10) : 1, markerCol: lead.length })
    } else if (stack.length && blank) {
      while (stack.length > 1 && indent < (deepest()?.contentCol ?? 0)) stack.pop()
      const owner = deepest()
      if (!owner || indent < owner.contentCol) return
      para = [line.trim()]
      owner.paras.push(para)
      owner.gaps.push(true)
    } else if (blank) return
    else if (para) para.push(line.trim())
    else {
      para = [line.trim()]
      blocks.push({ kind: 'paragraph', lines: para })
    }
    blank = false
  }
  return hasStrong(blocks) ? blocks : undefined
}

function interrupts(item: RegExpExecArray): boolean {
  return /^(?:[-*+]|1[.)])$/.test(item[2] ?? '') && (item[4] ?? '').trim() !== ''
}

function place(stack: List[], blocks: Block[], item: Item, shape: Omit<List, 'items'>): void {
  const fresh = (): List => ({ ...shape, items: [item] })
  for (let top = stack.at(-1); top; top = stack.at(-1)) {
    const last = top.items.at(-1)
    if (last && shape.markerCol >= last.contentCol) {
      const list = fresh()
      last.lists.push(list)
      stack.push(list)
      return
    }
    if (shape.markerCol >= top.markerCol || stack.length === 1) {
      if (top.ordered === shape.ordered) {
        top.items.push(item)
        return
      }
      stack.pop()
      const list = fresh()
      const parent = stack.at(-1)?.items.at(-1)
      if (parent) parent.lists.push(list)
      else blocks.push({ kind: 'list', list })
      stack.push(list)
      return
    }
    stack.pop()
  }
  const list = fresh()
  blocks.push({ kind: 'list', list })
  stack.push(list)
}

function hasStrong(blocks: Block[]): boolean {
  const texts: string[] = []
  const collect = (l: List): void => {
    for (const item of l.items) {
      for (const p of item.paras) texts.push(p.join('\n'))
      item.lists.forEach(collect)
    }
  }
  for (const b of blocks) {
    if (b.kind === 'list') collect(b.list)
    else texts.push(b.lines.join('\n'))
  }
  return texts.some(t => strongIn(parseInline(t)))
}

function strongIn(spans: Span[]): boolean {
  return spans.some(s => typeof s !== 'string' && s.kind !== 'code' && (s.kind === 'strong' || strongIn(s.children)))
}

function parseInline(src: string): Span[] {
  const out: Span[] = []
  let buf = ''
  const push = (span: Span) => {
    if (buf) out.push(buf)
    buf = ''
    out.push(span)
  }
  let i = 0
  while (i < src.length) {
    const c = src.charAt(i)
    const next = src.charAt(i + 1)
    if (c === '\\' && next && (PUNCT.test(next) || next === '\n')) {
      buf += next
      i += 2
      continue
    }
    if (c === '`') {
      const run = runLength(src, i, '`')
      const close = codeClose(src, i + run, run)
      if (close < 0) {
        buf += src.slice(i, i + run)
        i += run
        continue
      }
      push({ kind: 'code', text: trimCode(src.slice(i + run, close)) })
      i = close + run
      continue
    }
    const delim = DELIMS.includes(c)
    const found: Found = c === '[' ? link(src, i) : c === '<' ? autolink(src, i) : delim ? delimited(src, i, c) : undefined
    if (found) {
      push(found.span)
      i = found.end
      continue
    }
    const run = delim ? runLength(src, i, c) : 1
    buf += src.slice(i, i + run)
    i += run
  }
  if (buf) out.push(buf)
  return out
}

function delimited(src: string, i: number, ch: string): Found {
  const run = runLength(src, i, ch)
  const size = ch === '~' ? (run === 2 ? 2 : 0) : run === 1 ? 1 : run <= 3 ? 2 : 0
  const after = src.charAt(i + run)
  if (!size || !after || /\s/.test(after)) return
  if (ch === '_' && WORD.test(src.charAt(i - 1))) return

  let j = i + run
  while (j < src.length) {
    const c = src.charAt(j)
    if (c === '\\') {
      j += 2
      continue
    }
    if (c === '`') {
      j = skipCode(src, j)
      continue
    }
    if (c !== ch) {
      j++
      continue
    }
    const len = runLength(src, j, ch)
    const fits = size === 1 ? len === 1 || len >= 3 : len >= 2
    if (fits && !/\s/.test(src.charAt(j - 1)) && !(ch === '_' && WORD.test(src.charAt(j + len)))) {
      const inner = src.slice(i + size, j + len - size)
      if (!inner.trim()) return
      const kind = ch === '~' ? 'del' : size === 2 ? 'strong' : 'em'
      return { span: { kind, children: parseInline(inner) }, end: j + len }
    }
    j += len
  }
}

function link(src: string, i: number): Found {
  let depth = 0
  let j = i
  for (; j < src.length; j++) {
    const c = src.charAt(j)
    if (c === '\\') j++
    else if (c === '`') j = skipCode(src, j) - 1
    else if (c === '[') depth++
    else if (c === ']' && --depth === 0) break
  }
  if (j >= src.length || src.charAt(j + 1) !== '(') return
  let k = j + 2
  for (let parens = 1; k < src.length; k++) {
    const c = src.charAt(k)
    if (c === '\\') k++
    else if (c === '(') parens++
    else if (c === ')' && --parens === 0) break
  }
  if (k >= src.length) return
  const dest = src.slice(j + 2, k).trim()
  const href = /^<([^>]*)>/.exec(dest)?.[1] ?? dest.split(/\s+/)[0]
  if (!href) return
  return { span: { kind: 'link', href, children: parseInline(src.slice(i + 1, j)) }, end: k + 1 }
}

function autolink(src: string, i: number): Found {
  const m = /^<((?:https?|file):[^\s<>]+)>/i.exec(src.slice(i))
  if (!m?.[1]) return
  return { span: { kind: 'link', href: m[1], children: [m[1]] }, end: i + m[0].length }
}

function runLength(src: string, i: number, ch: string): number {
  let n = 0
  while (src.charAt(i + n) === ch) n++
  return n
}

function codeClose(src: string, from: number, run: number): number {
  for (let k = src.indexOf('`', from); k >= 0; ) {
    const len = runLength(src, k, '`')
    if (len === run) return k
    k = src.indexOf('`', k + len)
  }
  return -1
}

function skipCode(src: string, j: number): number {
  const run = runLength(src, j, '`')
  const close = codeClose(src, j + run, run)
  return close < 0 ? j + run : close + run
}

function trimCode(code: string): string {
  const flat = code.replace(/\n/g, ' ')
  return /^ .*[^ ].* $/.test(flat) ? flat.slice(1, -1) : flat
}
