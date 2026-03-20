#!/usr/bin/env node
/**
 * preuninstall script — runs automatically before npm uninstall -g agent-smith
 * Removes the Agent Smith PATH entry from shell configs.
 * Optionally removes user data (~/.agent-smith).
 */
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as readline from 'readline'
import { execSync } from 'child_process'

const BIN_DIR = path.join(os.homedir(), '.agent-smith-bin', 'bin')
const DATA_DIR = path.join(os.homedir(), '.agent-smith')
const MARKER = '# agent-smith PATH'

function removeFromShellConfig(rcFile: string): void {
  if (!fs.existsSync(rcFile)) return

  const content = fs.readFileSync(rcFile, 'utf-8')
  if (!content.includes(MARKER)) return

  const lines = content.split('\n')
  const filtered = lines.filter(
    (line) => !line.includes(MARKER) && !line.includes(BIN_DIR),
  )

  // Remove trailing blank lines that we added
  while (filtered.length > 0 && filtered[filtered.length - 1].trim() === '') {
    filtered.pop()
  }

  fs.writeFileSync(rcFile, filtered.join('\n') + '\n', 'utf-8')
  console.log(`✓ Removed Agent Smith from PATH in ${rcFile}`)
}

function removeFromWindowsPath(): void {
  try {
    const currentPath = execSync(
      'reg query "HKCU\\Environment" /v Path',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
    ).toString()

    const match = currentPath.match(/Path\s+REG_(?:SZ|EXPAND_SZ)\s+(.+)/)
    if (!match) return

    const existing = match[1].trim()
    if (!existing.includes(BIN_DIR)) return

    const newPath = existing
      .split(';')
      .filter((p) => p.trim() !== BIN_DIR)
      .join(';')

    execSync(
      `reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`,
      { stdio: 'ignore' },
    )
    console.log('✓ Removed Agent Smith from Windows PATH')
  } catch {
    // Non-fatal
  }
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main(): Promise<void> {
  // Remove from PATH
  if (process.platform === 'win32') {
    removeFromWindowsPath()
  } else {
    const home = os.homedir()
    for (const rcFile of [
      path.join(home, '.zshrc'),
      path.join(home, '.bashrc'),
      path.join(home, '.bash_profile'),
      path.join(home, '.profile'),
    ]) {
      removeFromShellConfig(rcFile)
    }
  }

  // Ask about data deletion
  if (fs.existsSync(DATA_DIR)) {
    let answer = 'n'
    try {
      answer = await ask('\nDelete Agent Smith data (~/.agent-smith)? [y/N] ')
    } catch {
      // Non-interactive environment — skip
    }

    if (answer.toLowerCase() === 'y') {
      fs.rmSync(DATA_DIR, { recursive: true, force: true })
      console.log('✓ User data deleted.')
    } else {
      console.log('ℹ️  User data kept at ~/.agent-smith — reinstall anytime without losing data.')
    }
  }

  console.log('✓ Agent Smith uninstalled.')
}

main().catch(() => {
  // Cleanup errors are non-fatal
})
