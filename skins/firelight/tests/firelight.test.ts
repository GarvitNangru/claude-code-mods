import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { colorSequence, RESET, variantOf, type Scheme } from '../hooks/register'

declare const setTimeout: (callback: () => void, ms: number) => unknown

const COAL: Scheme = {
  name: 'Firelight Coal', background: '#232222', foreground: '#E6D7CD', cursorColor: '#F06B8A',
  black: '#1B1A19', red: '#FF7C78', green: '#99CC78', yellow: '#F8DC99', blue: '#8DB6FF', purple: '#D5A3F5',
  cyan: '#62D4C5', white: '#E6D7CD', brightBlack: '#777676', brightRed: '#FF936F', brightGreen: '#99CC78',
  brightYellow: '#FFB57A', brightBlue: '#C9C6F8', brightPurple: '#F06B8A', brightCyan: '#62D4C5', brightWhite: '#F8EAE0',
}

type Terminal = { writes: string[]; argv: (readonly string[])[] }

function fakeHost(on: On, theme: string, os = 'Windows_NT'): Terminal {
  const terminal: Terminal = { writes: [], argv: [] }
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('config.set', (_$, e) => ({ value: e.value }))
  on('fs.read', (_$, e) => {
    expect(e.path.replaceAll('\\', '/').endsWith('/windows-terminal/firelight.json')).toBe(true)
    return { value: JSON.stringify({ schemes: [COAL] }) }
  })
  on('env.get', (_$, e) => ({ value: e.name === 'OS' ? os : undefined }))
  on('config.list', () => ({
    value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: theme, provider: { plugin: 'engine', tier: 'core' }, isLocked: false }],
  }))
  on('process.run', (_$, e) => {
    terminal.argv.push(e.argv)
    terminal.writes.push(e.init?.stdin ?? '')
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return terminal
}

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 30))

const pickTheme = async ($: Engine, value: string, previous = 'dark') => {
  await $.config.set({ key: 'theme', value, previous, provider: { plugin: 'engine', tier: 'core' }, origin: { kind: 'composer' } })
  await settle()
}

const startSession = async ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') => {
  await $.session.start({ cwd: '.', surface, isInteractive: true })
  await settle()
}

const endSession = ($: Engine, reason: 'prompt_input_exit' | 'clear') =>
  $.session.end({ reason, sessionId: 'test', resume: { id: 'test' } })

describe('the escape codes', () => {
  test('set the background, text, cursor and all 16 ANSI colors', () => {
    const codes = colorSequence(COAL)
    expect(codes.startsWith('\x1b]11;rgb:23/22/22\x07\x1b]10;rgb:E6/D7/CD\x07\x1b]12;rgb:F0/6B/8A\x07')).toBe(true)
    expect(codes).toContain('\x1b]4;0;rgb:1B/1A/19;1;rgb:FF/7C/78;')
    expect(codes.endsWith(';15;rgb:F8/EA/E0\x07')).toBe(true)
  })

  test('only Firelight themes name a variant', () => {
    expect(variantOf('custom:firelight:smoulder')).toBe('smoulder')
    expect(variantOf('dark')).toBeUndefined()
    expect(variantOf('custom:ember:ember')).toBeUndefined()
  })
})

describe('the terminal follows the theme', () => {
  test('a session that starts on a Firelight theme paints the terminal', async ($, on) => {
    const terminal = fakeHost(on, 'custom:firelight:coal')
    await startSession($)
    expect(terminal.writes).toEqual([colorSequence(COAL)])
    expect(terminal.argv[0]?.[0]).toBe('powershell.exe')
  })

  test('picking a Firelight theme paints it, and leaving it resets the terminal', async ($, on) => {
    const terminal = fakeHost(on, 'dark')
    await startSession($)
    expect(terminal.writes).toEqual([])
    await pickTheme($, 'custom:firelight:coal')
    await pickTheme($, 'dark', 'custom:firelight:coal')
    expect(terminal.writes).toEqual([colorSequence(COAL), RESET])
  })

  test('exiting resets the terminal, but /clear keeps the colors', async ($, on) => {
    const terminal = fakeHost(on, 'custom:firelight:coal')
    await startSession($)
    await endSession($, 'clear')
    expect(terminal.writes).toEqual([colorSequence(COAL)])
    await endSession($, 'prompt_input_exit')
    expect(terminal.writes).toEqual([colorSequence(COAL), RESET])
  })

  test('Mac and Linux write to the controlling terminal', async ($, on) => {
    const terminal = fakeHost(on, 'custom:firelight:coal', 'Darwin')
    await startSession($)
    expect(terminal.argv[0]).toEqual(['sh', '-c', 'cat > /dev/tty'])
  })

  test('the desktop app is left alone', async ($, on) => {
    const terminal = fakeHost(on, 'custom:firelight:coal')
    await startSession($, 'desktop')
    expect(terminal.writes).toEqual([])
  })
})
