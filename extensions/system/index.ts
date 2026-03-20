import * as os from 'os'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ExtensionAPI } from '@agent-smith/core'

const execFileAsync = promisify(execFile)

function bytesToHuman(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let val = bytes
  let i = 0
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++ }
  return `${val.toFixed(1)} ${units[i]}`
}

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'system_info',
    description: 'Get system information: CPU, RAM, disk usage, OS details, uptime',
    parameters: {
      properties: {},
      required: [],
    },
    run: async () => {
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const usedMem = totalMem - freeMem

      const cpus = os.cpus()
      const cpuModel = cpus[0]?.model ?? 'Unknown'
      const cpuCount = cpus.length

      const uptimeSec = os.uptime()
      const uptimeHours = Math.floor(uptimeSec / 3600)
      const uptimeMin = Math.floor((uptimeSec % 3600) / 60)

      return {
        platform: process.platform,
        os: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        hostname: os.hostname(),
        cpu: { model: cpuModel, cores: cpuCount },
        memory: {
          total: bytesToHuman(totalMem),
          used: bytesToHuman(usedMem),
          free: bytesToHuman(freeMem),
          usedPercent: `${Math.round((usedMem / totalMem) * 100)}%`,
        },
        uptime: `${uptimeHours}h ${uptimeMin}m`,
        homeDir: os.homedir(),
        tempDir: os.tmpdir(),
      }
    },
  })

  api.registerTool({
    name: 'disk_usage',
    description: 'Get disk usage for a given path (default: home directory)',
    parameters: {
      properties: {
        path: { type: 'string', description: 'Path to check disk usage for (default: home directory)' },
      },
      required: [],
    },
    run: async ({ path: targetPath = os.homedir() }: { path?: string }) => {
      try {
        if (process.platform === 'win32') {
          const script = `Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | Select-Object Name, @{N='Total';E={$_.Used+$_.Free}}, Used, Free | ConvertTo-Json`
          const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script])
          const drives = JSON.parse(stdout.trim())
          const list = Array.isArray(drives) ? drives : [drives]
          return list.map((d: any) => ({
            drive: `${d.Name}:`,
            total: bytesToHuman(d.Total),
            used: bytesToHuman(d.Used),
            free: bytesToHuman(d.Free),
            usedPercent: `${Math.round((d.Used / d.Total) * 100)}%`,
          }))
        } else {
          const { stdout } = await execFileAsync('df', ['-k', targetPath])
          const lines = stdout.trim().split('\n')
          const parts = lines[1]?.split(/\s+/) ?? []
          const total = parseInt(parts[1] ?? '0', 10) * 1024
          const used = parseInt(parts[2] ?? '0', 10) * 1024
          const free = parseInt(parts[3] ?? '0', 10) * 1024
          return {
            path: targetPath,
            total: bytesToHuman(total),
            used: bytesToHuman(used),
            free: bytesToHuman(free),
            usedPercent: parts[4] ?? '?',
          }
        }
      } catch (err: any) {
        return { error: `Could not get disk usage: ${err?.message}` }
      }
    },
  })

  api.registerTool({
    name: 'process_list',
    description: 'List running processes sorted by CPU or memory usage',
    parameters: {
      properties: {
        sortBy: { type: 'string', description: 'Sort by "cpu" or "memory" (default: cpu)' },
        limit: { type: 'number', description: 'Number of top processes to return (default: 10)' },
      },
      required: [],
    },
    run: async ({ sortBy = 'cpu', limit = 10 }: { sortBy?: string; limit?: number }) => {
      try {
        if (process.platform === 'win32') {
          const sortField = sortBy === 'memory' ? 'WorkingSetPrivate' : 'PercentProcessorTime'
          const script = `Get-WmiObject Win32_PerfFormattedData_PerfProc_Process | Where-Object { $_.Name -ne '_Total' -and $_.Name -ne 'Idle' } | Sort-Object ${sortField} -Descending | Select-Object -First ${limit} Name, IDProcess, PercentProcessorTime, WorkingSetPrivate | ConvertTo-Json`
          const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script])
          const raw = JSON.parse(stdout.trim())
          const list = Array.isArray(raw) ? raw : [raw]
          const procs = list.map((p: any) => ({
            name: (p.Name as string).replace(/#\d+$/, ''),
            pid: p.IDProcess,
            cpu: `${p.PercentProcessorTime}%`,
            ram: bytesToHuman(p.WorkingSetPrivate),
          }))
          return { processes: procs }
        } else {
          const args = sortBy === 'memory'
            ? ['-eo', 'pid,comm,pcpu,pmem,rss', '--sort=-pmem']
            : ['-eo', 'pid,comm,pcpu,pmem,rss', '--sort=-pcpu']
          const { stdout } = await execFileAsync('ps', args)
          const lines = stdout.trim().split('\n').slice(1, limit + 1)
          const procs = lines.map(line => {
            const parts = line.trim().split(/\s+/)
            return {
              pid: parts[0],
              name: parts[1],
              cpu: `${parts[2]}%`,
              memory: `${parts[3]}%`,
              rss: bytesToHuman(parseInt(parts[4] ?? '0', 10) * 1024),
            }
          })
          return { processes: procs }
        }
      } catch (err: any) {
        return { error: `Could not list processes: ${err?.message}` }
      }
    },
  })

  api.registerTool({
    name: 'open_app',
    description: 'Open an application, file, URL, or Steam game (steam://rungameid/<id>) using the system default handler. Supports optional delay.',
    parameters: {
      properties: {
        target: { type: 'string', description: 'App name, file path, URL, or Steam URL (steam://rungameid/<id>)' },
        delaySeconds: { type: 'number', description: 'Wait this many seconds before opening (default: 0)' },
      },
      required: ['target'],
    },
    run: async ({ target, delaySeconds = 0 }: { target: string; delaySeconds?: number }) => {
      if (delaySeconds > 0) {
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
      }
      try {
        if (process.platform === 'win32') {
          await execFileAsync('cmd', ['/c', 'start', '', target])
        } else if (process.platform === 'darwin') {
          await execFileAsync('open', [target])
        } else {
          await execFileAsync('xdg-open', [target])
        }
        return { ok: true, opened: target, delayedBy: delaySeconds > 0 ? `${delaySeconds}s` : undefined }
      } catch (err: any) {
        return { error: `Could not open "${target}": ${err?.message}` }
      }
    },
  })
}
