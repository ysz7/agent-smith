#!/usr/bin/env node
/**
 * postinstall script — runs automatically after npm install -g agent-smith
 * Adds the Agent Smith bin directory to PATH on macOS, Linux, and Windows.
 */
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execSync } from 'child_process'

const BIN_DIR = path.join(os.homedir(), '.agent-smith-bin', 'bin')
const MARKER = '# agent-smith PATH'

function ensureBinDir(): void {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true })
  }
}

function addToShellConfig(rcFile: string): void {
  if (!fs.existsSync(rcFile)) return

  const content = fs.readFileSync(rcFile, 'utf-8')
  if (content.includes(MARKER)) return  // Already added

  const lines = [
    '',
    MARKER,
    `export PATH="$PATH:${BIN_DIR}"`,
  ].join('\n')

  fs.appendFileSync(rcFile, lines + '\n', 'utf-8')
  console.log(`✓ Added Agent Smith to PATH in ${rcFile}`)
}

function addToWindowsPath(): void {
  try {
    // Read current user PATH from registry
    const currentPath = execSync(
      'reg query "HKCU\\Environment" /v Path',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] },
    ).toString()

    if (currentPath.includes(BIN_DIR)) return  // Already in PATH

    const match = currentPath.match(/Path\s+REG_(?:SZ|EXPAND_SZ)\s+(.+)/)
    if (!match) return

    const existing = match[1].trim()
    const newPath = existing ? `${existing};${BIN_DIR}` : BIN_DIR

    execSync(
      `reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`,
      { stdio: 'ignore' },
    )
    console.log(`✓ Added Agent Smith to Windows PATH`)
    console.log('  Restart your terminal for the changes to take effect.')
  } catch {
    console.log(`ℹ️  Could not update PATH automatically.`)
    console.log(`   Add this to your PATH manually: ${BIN_DIR}`)
  }
}

function installPlaywrightChromium(): void {
  console.log('Installing Playwright Chromium browser...')
  try {
    // Search for playwright CLI in common locations relative to this package
    const searchRoots = [
      // Same node_modules as this package (global install)
      path.join(__dirname, '..', 'node_modules', 'playwright', 'cli.js'),
      // Monorepo: computer-use extension node_modules
      path.join(__dirname, '..', '..', 'extensions', 'computer-use', 'node_modules', 'playwright', 'cli.js'),
      // Hoisted to workspace root
      path.join(__dirname, '..', '..', 'node_modules', 'playwright', 'cli.js'),
    ]

    const playwrightBin = searchRoots.find(p => fs.existsSync(p)) ?? null

    if (playwrightBin) {
      execSync(`node "${playwrightBin}" install chromium`, { stdio: 'inherit', timeout: 300000 })
    } else {
      // Fallback: npx (works if playwright is anywhere in PATH or npx cache)
      execSync('npx --yes playwright install chromium', { stdio: 'inherit', timeout: 300000 })
    }
    console.log('✓ Playwright Chromium installed')
  } catch {
    console.log('⚠  Could not install Playwright Chromium automatically.')
    console.log('   Run manually: cd extensions/computer-use && npx playwright install chromium')
  }
}

function main(): void {
  ensureBinDir()

  if (process.platform === 'win32') {
    addToWindowsPath()
    installPlaywrightChromium()
    console.log('✓ Agent Smith installed successfully!')
    console.log('  Run: agent-smith start')
    return
  }

  const home = os.homedir()

  // Try common shell config files
  const rcFiles = [
    path.join(home, '.zshrc'),
    path.join(home, '.bashrc'),
    path.join(home, '.bash_profile'),
    path.join(home, '.profile'),
  ]

  let added = false
  for (const rcFile of rcFiles) {
    if (fs.existsSync(rcFile)) {
      addToShellConfig(rcFile)
      added = true
    }
  }

  if (!added) {
    // Create .profile as fallback
    addToShellConfig(path.join(home, '.profile'))
  }

  installPlaywrightChromium()

  console.log('✓ Agent Smith installed successfully!')
  console.log('  Run: agent-smith start')
  console.log('  (You may need to restart your terminal or run: source ~/.zshrc)')
}

main()
