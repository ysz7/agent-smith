#!/usr/bin/env node
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { ConfigManager, AgentSmith } from '@agent-smith/core'
import { LocalStorage, LocalScheduler, LocalGateway } from '@agent-smith/transport-local'

async function openBrowser(url: string): Promise<void> {
  const { spawn } = await import('child_process')
  const platform = process.platform

  let cmd: string
  let args: string[]

  if (platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '', url]
  } else if (platform === 'darwin') {
    cmd = 'open'
    args = [url]
  } else {
    cmd = 'xdg-open'
    args = [url]
  }

  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
}

async function preventSleep(pid: number): Promise<void> {
  const { spawn } = await import('child_process')

  if (process.platform === 'darwin') {
    spawn('caffeinate', ['-i', '-w', String(pid)], {
      detached: true,
      stdio: 'ignore',
    }).unref()
  } else if (process.platform === 'win32') {
    // Keep system awake using SetThreadExecutionState via PowerShell
    const psScript = [
      'Add-Type -Name "Power" -Namespace "" -MemberDefinition \'[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);\'',
      '[Power]::SetThreadExecutionState(0x80000003) | Out-Null',
      `Start-Sleep -Seconds ${24 * 60 * 60}`,
    ].join('; ')

    spawn('powershell', ['-NoProfile', '-Command', psScript], {
      detached: true,
      stdio: 'ignore',
    }).unref()
  }
  // Linux: process managed by systemd — no action needed
}

// Install a skill from a local path or a GitHub/ClawHub URL
async function installSkill(source: string, skillsDir: string): Promise<void> {
  await fs.mkdir(skillsDir, { recursive: true })

  if (source.startsWith('http://') || source.startsWith('https://')) {
    // Treat as a raw SKILL.md URL or a GitHub repo/directory URL
    const { default: https } = await import('https')
    const { default: http } = await import('http')

    // Normalize GitHub tree URLs to raw content URLs
    let rawUrl = source
    if (rawUrl.includes('github.com') && !rawUrl.includes('raw.githubusercontent.com')) {
      rawUrl = rawUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/')
        .replace('/tree/', '/')
    }

    // Ensure it points to SKILL.md
    if (!rawUrl.endsWith('SKILL.md')) {
      rawUrl = rawUrl.replace(/\/$/, '') + '/SKILL.md'
    }

    const content = await new Promise<string>((resolve, reject) => {
      const client = rawUrl.startsWith('https') ? https : http
      client.get(rawUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${rawUrl}: HTTP ${res.statusCode}`))
          return
        }
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => resolve(data))
      }).on('error', reject)
    })

    // Extract skill name from frontmatter
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    const skillName = nameMatch ? nameMatch[1].trim() : `skill-${Date.now()}`

    const skillDir = path.join(skillsDir, skillName)
    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8')
    console.log(`✓ Skill "${skillName}" installed to ${skillDir}`)
  } else {
    // Local path — copy the directory
    const srcPath = path.resolve(source)
    const skillMdPath = path.join(srcPath, 'SKILL.md')

    const raw = await fs.readFile(skillMdPath, 'utf-8')
    const nameMatch = raw.match(/^name:\s*(.+)$/m)
    const skillName = nameMatch ? nameMatch[1].trim() : path.basename(srcPath)

    const skillDir = path.join(skillsDir, skillName)
    await fs.mkdir(skillDir, { recursive: true })
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), raw, 'utf-8')
    console.log(`✓ Skill "${skillName}" installed to ${skillDir}`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const agentSmithHome = path.join(os.homedir(), '.agent-smith')
  const userSkillsDir = path.join(agentSmithHome, 'skills')

  // Handle subcommands
  if (args[0] === 'skills' && args[1] === 'install') {
    const source = args[2]
    if (!source) {
      console.error('Usage: agent-smith skills install <url-or-path>')
      process.exit(1)
    }
    await installSkill(source, userSkillsDir)
    return
  }

  const configManager = new ConfigManager(agentSmithHome)
  const config = await configManager.load()

  // Data storage directory
  const dataDir = path.join(agentSmithHome, 'data')

  // __dirname = cli/dist — go up two levels to reach the monorepo root
  const repoRoot = path.join(__dirname, '..', '..')

  // Skill search dirs (priority: workspace > user > built-in)
  const builtinSkillsDir = path.join(repoRoot, 'skills')
  const workspaceSkillsDir = path.join(agentSmithHome, 'workspace', 'skills')
  const skillDirs = [builtinSkillsDir, userSkillsDir, workspaceSkillsDir]

  // Extension search dirs
  const builtinExtensionsDir = path.join(repoRoot, 'extensions')
  const userExtensionsDir = path.join(agentSmithHome, 'extensions')
  const extensionDirs = [builtinExtensionsDir, userExtensionsDir]

  // UI static files (built by Vite)
  const uiDir = path.join(repoRoot, 'ui', 'dist')

  const storage = new LocalStorage(dataDir)
  const scheduler = new LocalScheduler()
  const gateway = new LocalGateway(config.transport.port, configManager, uiDir, userSkillsDir)

  const smith = new AgentSmith(
    storage,
    gateway,
    scheduler,
    config,
    skillDirs,
    extensionDirs,
    configManager,
  )

  const hostname = config.transport.localhostOnly !== false ? '127.0.0.1' : '0.0.0.0'
  gateway.start(hostname)

  await smith.start()

  // Register live skill/extension providers so the UI always shows current data
  gateway.setSkillsProvider(() =>
    smith.getSkills().map((s) => ({
      name: s.name,
      description: s.description,
      enabled: s.enabled,
      requires: s.requires,
      config: s.config,
    })),
  )
  gateway.setExtensionsProvider(() =>
    smith.getExtensionNames().map((name) => ({
      name,
      enabled: config.extensions[name]?.enabled !== false,
    })),
  )
  gateway.setHistoryProvider(async () => {
    const msgs = await storage.get('memory:history')
    if (!Array.isArray(msgs)) return []
    return msgs
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .slice(-50) // last 50 messages
      .map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }))
  })

  // Load and schedule persisted tasks
  const tasks = await configManager.getTasks()
  for (const task of tasks) {
    if (task.enabled) {
      scheduler.schedule(task.id, task.cron, () => {
        smith.runScheduledTask(task.id, task.instructions).catch(console.error)
      })
      console.log(`Scheduled task "${task.name}" loaded (${task.cron})`)
    }
  }

  if (config.system?.preventSleep) {
    await preventSleep(process.pid)
  }

  if (config.system?.autoOpenBrowser !== false) {
    const url = `http://localhost:${config.transport.port}`
    setTimeout(() => openBrowser(url), 1500)
    console.log(`Opening browser at ${url}`)
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down Agent Smith...')
    await smith.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
