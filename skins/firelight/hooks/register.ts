import type { EngineInterface as Engine, Register } from 'claude-code'

const THEME_PREFIX = 'custom:firelight:'
const ANSI = [
  'black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightPurple', 'brightCyan', 'brightWhite',
] as const

export type Scheme = { name: string; background: string; foreground: string; cursorColor: string } & Record<(typeof ANSI)[number], string>
export const RESET = '\x1b]104\x07\x1b]110\x07\x1b]111\x07\x1b]112\x07'

const osc = (code: string, value: string): string => `\x1b]${code};${value}\x07`
const rgb = (hex: string): string => `rgb:${hex.slice(1, 3)}/${hex.slice(3, 5)}/${hex.slice(5, 7)}`

export const colorSequence = (s: Scheme): string =>
  osc('11', rgb(s.background)) +
  osc('10', rgb(s.foreground)) +
  osc('12', rgb(s.cursorColor)) +
  osc('4', ANSI.map((name, i) => `${i};${rgb(s[name])}`).join(';'))

export const variantOf = (theme: unknown): string | undefined =>
  typeof theme === 'string' && theme.startsWith(THEME_PREFIX) ? theme.slice(THEME_PREFIX.length) : undefined

let schemes: Record<string, Scheme> | undefined
let painted = false
let queue: Promise<void> = Promise.resolve()

async function loadSchemes($: Engine): Promise<Record<string, Scheme>> {
  const file = JSON.parse(await $.fs.read(`${$.plugin.root}/windows-terminal/firelight.json`)) as { schemes: Scheme[] }
  return Object.fromEntries(file.schemes.map(s => [s.name.replace(/^Firelight /, '').toLowerCase(), s]))
}

// Claude Code starts helpers with a hidden console of their own, so on Windows the helper attaches to Claude Code's.
async function writeToTerminal($: Engine, text: string): Promise<void> {
  const argv = (await $.env.get('OS')) === 'Windows_NT'
    ? ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${$.plugin.root}/hooks/paint-console.ps1`]
    : ['sh', '-c', 'cat > /dev/tty']
  try {
    const { exitCode, stderr } = await $.process.run(argv, { stdin: text, timeoutMs: 5000 })
    if (exitCode !== 0) $.ui.log(`could not set the terminal colors (exit ${exitCode}): ${stderr.trim()}`, { to: 'debug' })
  } catch (err) {
    $.ui.log(`could not set the terminal colors: ${err}`, { to: 'debug' })
  }
}

async function currentTheme($: Engine): Promise<unknown> {
  return (await $.config.list()).find(row => row.key === 'theme')?.value
}

async function follow($: Engine, theme: unknown): Promise<void> {
  const variant = variantOf(theme)
  if (variant) {
    schemes ??= await loadSchemes($)
    const scheme = schemes[variant]
    if (!scheme) return
    await writeToTerminal($, colorSequence(scheme))
    painted = true
  } else if (painted) {
    await writeToTerminal($, RESET)
    painted = false
  }
}

async function followCurrentTheme($: Engine): Promise<void> {
  await follow($, await currentTheme($))
}

function enqueue($: Engine, work: () => Promise<void>): void {
  queue = queue.then(work).catch(err => $.ui.log(`could not set the terminal colors: ${err}`, { to: 'debug' }))
}

async function restore($: Engine): Promise<void> {
  await queue
  if (painted) await writeToTerminal($, RESET)
  painted = false
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    if (e.surface === 'terminal' && e.isInteractive) enqueue($, () => followCurrentTheme($))
    return started
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    if (!result.deny) enqueue($, () => follow($, result.value))
    return result
  })

  on('session.end', async ($, e, next) => {
    if (e.reason !== 'clear' && e.reason !== 'resume') await restore($)
    return next(e)
  })
}
