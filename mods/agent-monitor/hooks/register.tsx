import { atom, read, update } from 'claude-code'
import type { AgentStatus, EngineInterface, ModelUsage, Register } from 'claude-code'

import type { AgentRun, Plan, RunStatus } from '../types'

const runs = atom({ plugin: 'agent-monitor', key: 'runs' } as const, [])
const wave = atom({ plugin: 'agent-monitor', key: 'wave' } as const, { ids: [], isHidden: true })
const plan = atom({ plugin: 'agent-monitor', key: 'plan' } as const, null)
const isDoneCollapsed = atom({ plugin: 'agent-monitor', key: 'isDoneCollapsed' } as const, false)
const now = atom({ plugin: 'agent-monitor', key: 'now' } as const, 0)

const PANE = 'agent-monitor'
const PROGRESS_TOOL = 'mcp__agent-monitor__progress'
const MAX_RUNS = 100
const CLAY = '#D97757'
const DONE = '#3B9C5F'
const FAIL = '#D0453F'
const INK = '#1F1E1D'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"

const STATUS_COLOR: Record<RunStatus, string> = { running: CLAY, done: DONE, stopped: '#8A8A86', failed: FAIL }

const STATUS_GLYPH: Record<RunStatus, string> = { running: '●', done: '✓', stopped: '■', failed: '✗' }

const PROGRESS_DESCRIPTION =
  'Shows the user a progress bar above their prompt for the task you are working on. ' +
  'For any task that takes three or more steps, call it once you have a plan, with a short `title` and the `steps` in order. ' +
  'Then call it with `done` (how many steps are finished) each time you finish one, and with the full `steps` again if the plan changes. ' +
  'Send `done` equal to the number of steps when the task is complete. Skip it for questions and one-step tasks. It only draws the bar.'

const PROGRESS_GUIDANCE =
  'The user sees a progress bar above their prompt that only moves when you report to it. ' +
  'When a request will take three or more steps (several files to create or edit, a change plus its tests, a multi-part request), ' +
  `first call ${PROGRESS_TOOL} with a short title and the steps, then call it with \`done\` after you finish each step. ` +
  'Skip it for questions and one-step requests.'

const PROGRESS_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'The task in a few words, e.g. "Add login page".' },
    steps: {
      type: 'array',
      items: { type: 'string' },
      description: 'The plan in order, each step a few words. Sending it replaces the plan.',
    },
    done: { type: 'integer', minimum: 0, description: 'How many steps are finished.' },
  },
}

type ProgressInput = { title?: unknown; steps?: unknown; done?: unknown }

type Price = [input: number, output: number, cacheRead: number, cacheWrite1h: number]

const USD_PER_MTOK: [RegExp, Price][] = [
  [/fable|mythos/, [10, 50, 0.25, 20]],
  [/opus-5-5/, [4, 20, 0.2, 8]],
  [/opus/, [5, 25, 0.5, 10]],
  [/sonnet-4/, [3, 15, 0.3, 6]],
  [/sonnet/, [2, 10, 0.2, 4]],
  [/haiku/, [1, 5, 0.1, 2]],
]

const priceOf = (model: string): Price =>
  USD_PER_MTOK.find(([re]) => re.test(model.toLowerCase()))?.[1] ?? [4, 20, 0.2, 8]

const costOf = (model: string, u: ModelUsage): number => {
  const [i, o, r, w] = priceOf(model)
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

const contextOf = (u: ModelUsage): number =>
  (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)

const windowOf = (model: string): number => (/haiku/i.test(model) ? 200_000 : 1_000_000)

const modelName = (id: string): string => {
  const [, family, major, minor] = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id) ?? []
  if (!family) return id.replace(/^claude-/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? `.${minor}` : ''}`
}

const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`

const fmtCost = (usd: number): string => `≈$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const clip = (s: string, max: number): string => (s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s)

const isLive = (r: AgentRun): boolean => r.status === 'running'

const endOf = (r: AgentRun, at: number): number => r.endedAt ?? Math.max(at, r.startedAt)

const ctxPct = (r: AgentRun): number => Math.min(100, Math.round((r.contextTokens / windowOf(r.model)) * 100))

const summarize = (list: AgentRun[], at: number) => {
  const running = list.filter(isLive).length
  return {
    total: list.length,
    running,
    finished: list.length - running,
    failed: list.filter(r => r.status === 'failed').length,
    cost: list.reduce((sum, r) => sum + r.costUsd, 0),
    time: list.length ? Math.max(...list.map(r => endOf(r, at))) - Math.min(...list.map(r => r.startedAt)) : 0,
  }
}

type Summary = ReturnType<typeof summarize>

const isComplete = (p: Plan): boolean => p.done >= p.steps.length

const nextPlan = (prev: Plan | null, input: ProgressInput, at: number): Plan | null => {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const steps = Array.isArray(input.steps) ? input.steps.map(s => String(s).trim()).filter(Boolean) : []
  const done = typeof input.done === 'number' && Number.isFinite(input.done) ? Math.max(0, Math.round(input.done)) : undefined

  if (!prev || (steps.length && (isComplete(prev) || (title && title !== prev.title)))) {
    if (!steps.length) return prev
    const d = Math.min(steps.length, done ?? 0)
    return {
      title: title || 'Working',
      steps,
      done: d,
      startedAt: at,
      endedAt: d >= steps.length ? at : undefined,
      isStale: false,
      isHidden: false,
    }
  }

  const nextSteps = steps.length ? steps : prev.steps
  const d = Math.min(nextSteps.length, done ?? prev.done)
  return {
    ...prev,
    title: title || prev.title,
    steps: nextSteps,
    done: d,
    endedAt: d >= nextSteps.length ? (prev.endedAt ?? at) : undefined,
    isStale: false,
  }
}

type Band = {
  title: string
  ratio: number
  label: string
  detail: string
  color: string
  glyph: string
  isLive: boolean
}

const agentsRunning = (n: number): string => (n ? `${n} agent${n > 1 ? 's' : ''} running` : '')

const planBand = (p: Plan, agents: Summary | null, at: number, isWorking: boolean): Band => {
  const total = p.steps.length
  const complete = isComplete(p)
  const detail = [
    complete ? `done in ${fmtTime((p.endedAt ?? at) - p.startedAt)}` : (p.steps[p.done] ?? ''),
    agentsRunning(agents?.running ?? 0),
    !complete && isWorking ? fmtTime(at - p.startedAt) : '',
  ]
  return {
    title: p.title,
    ratio: total ? p.done / total : 0,
    label: `${p.done}/${total}`,
    detail: detail.filter(Boolean).join(' · '),
    color: complete ? DONE : CLAY,
    glyph: complete ? '✓' : '●',
    isLive: !complete,
  }
}

const waveBand = (s: Summary): Band => ({
  title: 'Agents',
  ratio: s.total ? s.finished / s.total : 0,
  label: s.running ? `${s.finished}/${s.total}` : s.failed ? `${s.failed} of ${s.total} failed` : `${s.total} done`,
  detail: [s.running ? `${s.running} running` : '', fmtCost(s.cost), fmtTime(s.time)].filter(Boolean).join(' · '),
  color: s.running ? CLAY : s.failed ? FAIL : DONE,
  glyph: s.running ? '●' : s.failed ? '✗' : '✓',
  isLive: s.running > 0,
})

const runMeta = (r: AgentRun): string =>
  [r.type, modelName(r.model), r.effort, `${r.steps} steps`].filter(Boolean).join(' · ')

const runStats = (r: AgentRun, at: number): string =>
  `ctx ${fmtTokens(r.contextTokens)} (${ctxPct(r)}%) · ${fmtCost(r.costUsd)} · ${fmtTime(endOf(r, at) - r.startedAt)}`

const planRow = (input: unknown): string | null => {
  const { title, steps } = (input ?? {}) as ProgressInput
  if (!Array.isArray(steps) || !steps.length) return null
  return `Plan · ${typeof title === 'string' && title ? `${title} · ` : ''}${steps.length} steps`
}

const textBar = (ratio: number, width: number): string => {
  const filled = Math.round(width * Math.min(1, Math.max(0, ratio)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const xml = (s: string): string => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

const fit = (s: string, maxPx: number, size: number): string => clip(s, Math.max(1, Math.floor(maxPx / (size * 0.58))))

const SVG_CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.k{fill:#e7e6e2}.ln{stroke:#e4e4e1}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a3a39f}.k{fill:#2e2e2c}.ln{stroke:#333331}}
.walk .la{animation:st .5s steps(1) infinite}.walk .lb{animation:st .5s steps(1) infinite -.25s}
.walk .bd{animation:bob .5s steps(1) infinite -.125s}
.flow{animation:flow .8s linear infinite}.live{animation:pulse 1.6s ease-in-out infinite}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
@keyframes flow{to{transform:translateX(12px)}}@keyframes pulse{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.walk g,.flow,.live{animation:none}}
</style>`

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${SVG_CSS}${body}</svg>`

const crab = (x: number, y: number, isWalking: boolean, opacity = 1): string => {
  const px = (cx: number, cy: number, w: number, h: number, c = CLAY) =>
    `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`
  return (
    `<g transform="translate(${x},${y}) scale(2)" opacity="${opacity}" shape-rendering="crispEdges">` +
    `<g class="${isWalking ? 'walk' : ''}">` +
    `<g class="bd">${px(1, 0, 10, 6)}${px(0, 2, 1, 2)}${px(11, 2, 1, 2)}${px(3, 1, 1, 2, INK)}${px(8, 1, 1, 2, INK)}</g>` +
    `<g class="la">${px(2, 6, 1, 2)}${px(7, 6, 1, 2)}</g>` +
    `<g class="lb">${px(4, 6, 1, 2)}${px(9, 6, 1, 2)}</g>` +
    `</g></g>`
  )
}

const statusMark = (x: number, y: number, status: RunStatus): string => {
  const c = STATUS_COLOR[status]
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${c}"/>`
  if (status === 'done')
    return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed')
    return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`
  return `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" rx="1.5" fill="${c}"/>`
}

const BAND_H = 22
const BAR_H = 14

const bandSvg = (b: Band, W: number): string => {
  const title = fit(b.title, Math.max(60, W * 0.3), 13)
  const barX = Math.round(30 + title.length * 13 * 0.58 + 12)
  const tail = fit(b.detail ? `${b.label} · ${b.detail}` : b.label, Math.max(60, W - barX - 90), 12)
  const barW = Math.max(80, W - barX - Math.round(tail.length * 12 * 0.55) - 10)
  const fillW = Math.round(barW * Math.min(1, b.ratio))
  const y0 = (BAND_H - BAR_H) / 2
  const stripes: string[] = []
  for (let x = -BAR_H - 12; x < fillW; x += 12) stripes.push(`<path d="M${x} ${BAR_H}l${BAR_H} -${BAR_H}h5l-${BAR_H} ${BAR_H}z"/>`)
  return svg(
    W,
    BAND_H,
    `${crab(0, 3, b.isLive)}
<text class="t" x="30" y="${BAND_H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="600">${xml(title)}</text>
<defs><clipPath id="f"><rect width="${fillW}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath></defs>
<g transform="translate(${barX},${y0})">
<rect class="k" width="${barW}" height="${BAR_H}" rx="${BAR_H / 2}"/>
<rect width="${fillW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${b.color}"/>
${b.isLive ? `<g clip-path="url(#f)"><g class="flow" fill="#fff" opacity=".22">${stripes.join('')}</g></g>` : ''}
</g>
<text class="s" x="${barX + barW + 10}" y="${BAND_H / 2 + 4.5}" font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">${xml(tail)}</text>`,
  )
}

const ROW_H = 50

const runSvg = (r: AgentRun, W: number, at: number): string => {
  const stats = runStats(r, at)
  const statsW = Math.round(stats.length * 6)
  const textX = 34
  const barW = W - textX - 2
  return svg(
    W,
    ROW_H,
    `${crab(0, 9, isLive(r), isLive(r) ? 1 : 0.55)}
<text class="t" x="${textX}" y="15" font-family="${FONT}" font-size="13" font-weight="600">${xml(fit(r.description || r.type, W - textX - 20, 13))}</text>
<text class="s" x="${textX}" y="31" font-family="${FONT}" font-size="11">${xml(fit(runMeta(r), barW - statsW - 12, 11))}</text>
<text class="s" x="${W - 2}" y="31" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(stats)}</text>
<rect class="k" x="${textX}" y="38" width="${barW}" height="3" rx="1.5"/>
<rect x="${textX}" y="38" width="${Math.round((barW * ctxPct(r)) / 100)}" height="3" rx="1.5" fill="${STATUS_COLOR[r.status]}"/>
${statusMark(W - 8, 11, r.status)}
<line class="ln" x1="0" y1="${ROW_H - 0.5}" x2="${W}" y2="${ROW_H - 0.5}"/>`,
  )
}

async function togglePane($: EngineInterface): Promise<boolean> {
  if ((await $.ui.panes()).some(p => p.id === PANE)) {
    await $.ui.close({ id: PANE })
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await $.ui.open({ id: PANE, title: 'Agent Monitor' })
  return true
}

async function dismissBand($: EngineInterface): Promise<void> {
  await update($, plan, p => (p ? { ...p, isHidden: true } : p))
  await update($, wave, w => ({ ...w, isHidden: true }))
}

const ENDED: Partial<Record<AgentStatus, RunStatus>> = { completed: 'done', failed: 'failed', killed: 'stopped' }

async function settleEndedAgents($: EngineInterface, list: AgentRun[], at: number): Promise<void> {
  const ended = new Map<string, RunStatus>()
  for (const a of await $.agent.list()) {
    const status = ENDED[a.status]
    if (status) ended.set(a.id, status)
  }
  if (!list.some(r => isLive(r) && ended.has(r.id))) return
  await update($, runs, prev =>
    prev.map(r => (isLive(r) && ended.has(r.id) ? { ...r, status: ended.get(r.id) ?? 'done', endedAt: at } : r)),
  )
}

let isTurnRunning = false

async function tick($: EngineInterface): Promise<void> {
  const list = await read($, runs)
  const hasLiveAgents = list.some(isLive)
  if (!hasLiveAgents) {
    const p = await read($, plan)
    if (!isTurnRunning || !p || p.isHidden || isComplete(p)) return
  }
  const at = await $.clock.now()
  if (hasLiveAgents) await settleEndedAgents($, list, at)
  await update($, now, () => at)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'agent-monitor',
      description: "Show or hide the Agent Monitor panel: Claude's current plan and every subagent with its model, context, estimated cost and time",
    })
    await $.tool.register({ name: 'progress', description: PROGRESS_DESCRIPTION, inputSchema: PROGRESS_SCHEMA })
    $.clock.every(1000, () => void tick($))
    return started
  })

  on('command.run', { command: 'agent-monitor' }, async $ => ({
    text: (await togglePane($)) ? 'Agent Monitor panel opened.' : 'Agent Monitor panel closed.',
  }))

  on('tool.describe', { tool: PROGRESS_TOOL }, async ($, e, next) => ({ ...(await next(e)), isDeferred: false }))

  on('tool.check', { tool: PROGRESS_TOOL }, async ($, e, next) => {
    const verdict = await next(e)
    return verdict.decision === 'deny' ? verdict : { decision: 'allow', reason: 'It only draws the progress bar.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!e.tools.includes(PROGRESS_TOOL)) return composed
    return { sections: [...composed.sections, { id: 'agent-monitor:progress', text: PROGRESS_GUIDANCE, scope: 'session' }] }
  })

  on('tool.call', { tool: PROGRESS_TOOL }, async ($, e) => {
    if (e.agentId) return { result: 'Ignored: the progress bar follows the main task only.' }
    const at = await $.clock.now()
    const p = await update($, plan, prev => nextPlan(prev, e as unknown as ProgressInput, at))
    await update($, now, () => at)
    if (!p) return { result: 'No plan yet: call it with a title and steps first.' }
    return { result: `Shown: ${p.done} of ${p.steps.length} steps done.` }
  })

  on('turn.start', ($, e, next) => {
    isTurnRunning = true
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined || !started.agentId) return started

    const at = await $.clock.now()
    const run: AgentRun = {
      id: started.agentId,
      type: e.subagentType,
      description: e.description,
      model: started.model,
      status: 'running',
      startedAt: at,
      contextTokens: 0,
      costUsd: 0,
      steps: 0,
    }
    const list = await update($, runs, prev => [...prev.filter(r => r.id !== run.id), run].slice(-MAX_RUNS))
    const liveIds = new Set(list.filter(isLive).map(r => r.id))
    await update($, wave, w =>
      w.ids.some(id => liveIds.has(id)) ? { ...w, ids: [...w.ids, run.id] } : { ids: [run.id], isHidden: false },
    )
    await update($, now, () => at)
    return started
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage
    const agentId = e.agentId
    if (!agentId || !usage) return result

    const model = usage.model || e.model
    await update($, runs, list =>
      list.map(r =>
        r.id !== agentId
          ? r
          : {
              ...r,
              model,
              effort: typeof e.effort === 'string' ? e.effort : r.effort,
              status: 'running',
              endedAt: undefined,
              contextTokens: contextOf(usage),
              costUsd: r.costUsd + costOf(model, usage),
              steps: r.steps + 1,
            },
      ),
    )
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (!agentId) {
      isTurnRunning = false
      return next(e)
    }
    const at = await $.clock.now()
    const status: RunStatus = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
    await update($, runs, list =>
      list.map(r => {
        if (r.id !== agentId) return r
        const usage = r.steps === 0 ? e.usage : undefined
        return {
          ...r,
          status,
          endedAt: at,
          ...(usage
            ? { model: usage.model || r.model, costUsd: costOf(usage.model || r.model, usage), contextTokens: contextOf(usage) }
            : {}),
        }
      }),
    )
    await update($, now, () => at)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const p = await read($, plan)
    if (p) await update($, plan, prev => (!prev || isComplete(prev) || prev.isStale ? null : { ...prev, isStale: true }))
    const w = await read($, wave)
    if (w.ids.length) {
      const list = await read($, runs)
      if (!list.some(r => isLive(r) && w.ids.includes(r.id))) await update($, wave, () => ({ ids: [], isHidden: true }))
    }
    return next(e)
  })

  on('ui.render', { component: 'ToolUse', props: { tool: PROGRESS_TOOL } }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const row = planRow(e.props.input)
    if (!row) return <Box />
    return (
      <Box paddingLeft={2}>
        <Text dimColor wrap="truncate-end">
          ▸ {row}
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult', props: { tool: PROGRESS_TOOL } }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const p = await read($, plan)
    const w = await read($, wave)
    const waveRuns = w.isHidden ? [] : (await read($, runs)).filter(r => w.ids.includes(r.id))
    const at = await read($, now)
    const agents = waveRuns.length ? summarize(waveRuns, at) : null
    const band = p && !p.isHidden ? planBand(p, agents, at, e.props.isWorking) : agents ? waveBand(agents) : null
    if (!band) return next(e)

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const open = <Button key="open" label="Panel" plain onPress={() => void togglePane($)} />
    const dismiss = <Button key="dismiss" label="✕" plain role="dismiss" onPress={() => dismissBand($)} />

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const width = Math.max(180, Math.min(1400, (e.props.bodyColumns || 100) * 8 - 120))
      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Svg source={bandSvg(band, width)} alt={`${band.title}: ${band.label}, ${band.detail}`} width={width} height={BAND_H} />
          {open}
          {dismiss}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    const title = clip(band.title, Math.max(12, Math.floor(cols / 4)))
    const barW = Math.max(6, Math.min(24, cols - title.length - band.label.length - Math.min(band.detail.length, 30) - 24))
    return (
      <Box flexDirection="row" gap={1}>
        <Text color={band.color}>{band.glyph}</Text>
        <Text bold>{title}</Text>
        <Text color={band.color}>{textBar(band.ratio, barW)}</Text>
        <Text>{band.label}</Text>
        {band.detail ? (
          <Text dimColor wrap="truncate-end">
            {band.detail}
          </Text>
        ) : null}
        {open}
        {dismiss}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const p = await read($, plan)
    const list = await read($, runs)
    const at = await read($, now)
    const isCollapsed = await read($, isDoneCollapsed)
    const running = list.filter(isLive).reverse()
    const finished = list.filter(r => !isLive(r)).reverse()
    const s = summarize(list, at)

    const planView = p && (
      <Box key="plan" flexDirection="column" marginBottom={1}>
        <Text bold wrap="truncate-end">
          {p.title} · {p.done}/{p.steps.length}
        </Text>
        {p.steps.map((step, i) => (
          <Text key={`step-${i}`} wrap="truncate-end" dimColor={i < p.done}>
            <Text color={i < p.done ? DONE : i === p.done ? CLAY : undefined}>{i < p.done ? '✓' : i === p.done ? '▸' : '○'}</Text>{' '}
            {step}
          </Text>
        ))}
      </Box>
    )
    const empty = !p && list.length === 0 && (
      <Text dimColor>
        Nothing to show yet. Claude's plan shows up here for tasks with several steps, and subagents as soon as one starts.
      </Text>
    )
    const summary = list.length > 0 && (
      <Text dimColor wrap="truncate-end">
        Subagents · {s.running} running · {s.finished} finished · {fmtCost(s.cost)}
      </Text>
    )
    const controls = finished.length > 0 && (
      <Box key="controls" flexDirection="row" gap={2}>
        <Button
          key="toggle-done"
          label={`${isCollapsed ? '▸' : '▾'} Finished · ${finished.length}`}
          plain
          onPress={() => update($, isDoneCollapsed, prev => !prev)}
        />
        <Button key="clear" label="Clear finished" plain onPress={() => update($, runs, prev => prev.filter(isLive))} />
      </Box>
    )

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const row = (r: AgentRun) => (
        <Svg key={r.id} source={runSvg(r, W, at)} alt={`${r.description}: ${r.status}, ${runStats(r, at)}`} width={W} height={ROW_H} />
      )
      return (
        <Box flexDirection="column">
          {planView}
          {empty}
          {summary}
          {running.map(row)}
          {controls}
          {!isCollapsed && finished.map(row)}
        </Box>
      )
    }

    const row = (r: AgentRun) => (
      <Box key={r.id} flexDirection="column" marginTop={1}>
        <Text wrap="truncate-end">
          <Text color={STATUS_COLOR[r.status]}>{STATUS_GLYPH[r.status]}</Text> <Text bold>{r.description || r.type}</Text>
        </Text>
        <Text dimColor wrap="truncate-end">
          {'  '}
          {runMeta(r)}
        </Text>
        <Text dimColor wrap="truncate-end">
          {'  '}
          {runStats(r, at)}
        </Text>
      </Box>
    )
    return (
      <Box flexDirection="column">
        {planView}
        {empty}
        {summary}
        {running.map(row)}
        {controls && <Box marginTop={1}>{controls}</Box>}
        {!isCollapsed && finished.map(row)}
      </Box>
    )
  })
}
