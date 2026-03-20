import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import type { ExtensionAPI } from '@agent-smith/core'

function resolvePath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1))
  }
  return path.resolve(filePath)
}

export default function register(api: ExtensionAPI): void {
  api.registerTool({
    name: 'file_read',
    description: 'Read the contents of a file from disk',
    parameters: {
      properties: {
        path: { type: 'string', description: 'Absolute or ~ path to the file' },
        encoding: { type: 'string', description: 'File encoding (default: utf-8)' },
      },
      required: ['path'],
    },
    run: async ({ path: filePath, encoding = 'utf-8' }: { path: string; encoding?: BufferEncoding }) => {
      const resolved = resolvePath(filePath)
      const content = await fs.readFile(resolved, encoding)
      const stat = await fs.stat(resolved)
      return {
        path: resolved,
        content,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      }
    },
  })

  api.registerTool({
    name: 'file_write',
    description: 'Write content to a file on disk. Creates the file and any missing parent directories.',
    parameters: {
      properties: {
        path: { type: 'string', description: 'Absolute or ~ path to the file' },
        content: { type: 'string', description: 'Content to write' },
        append: { type: 'boolean', description: 'Append to existing file instead of overwriting (default: false)' },
      },
      required: ['path', 'content'],
    },
    run: async ({ path: filePath, content, append = false }: { path: string; content: string; append?: boolean }) => {
      const resolved = resolvePath(filePath)
      await fs.mkdir(path.dirname(resolved), { recursive: true })
      if (append) {
        await fs.appendFile(resolved, content, 'utf-8')
      } else {
        await fs.writeFile(resolved, content, 'utf-8')
      }
      const stat = await fs.stat(resolved)
      return { path: resolved, size: stat.size, ok: true }
    },
  })

  api.registerTool({
    name: 'file_list',
    description: 'List files and directories at a given path',
    parameters: {
      properties: {
        path: { type: 'string', description: 'Directory path to list (default: home directory)' },
        pattern: { type: 'string', description: 'Filter by extension or name fragment, e.g. ".pdf" or "report"' },
      },
      required: [],
    },
    run: async ({ path: dirPath = '~', pattern }: { path?: string; pattern?: string }) => {
      const resolved = resolvePath(dirPath)
      const entries = await fs.readdir(resolved, { withFileTypes: true })

      const items = await Promise.all(
        entries
          .filter(e => !pattern || e.name.toLowerCase().includes(pattern.toLowerCase()))
          .map(async (e) => {
            const fullPath = path.join(resolved, e.name)
            try {
              const stat = await fs.stat(fullPath)
              return {
                name: e.name,
                type: e.isDirectory() ? 'dir' : 'file',
                size: e.isFile() ? stat.size : undefined,
                modified: stat.mtime.toISOString(),
              }
            } catch {
              return { name: e.name, type: e.isDirectory() ? 'dir' : 'file' }
            }
          }),
      )

      return { path: resolved, count: items.length, items }
    },
  })

  api.registerTool({
    name: 'file_search',
    description: 'Recursively search for files by name pattern within a directory',
    parameters: {
      properties: {
        directory: { type: 'string', description: 'Directory to search in (default: home directory)' },
        pattern: { type: 'string', description: 'Filename pattern to match (case-insensitive substring or extension like ".pdf")' },
        maxResults: { type: 'number', description: 'Max results to return (default: 20)' },
      },
      required: ['pattern'],
    },
    run: async ({ directory = '~', pattern, maxResults = 20 }: { directory?: string; pattern: string; maxResults?: number }) => {
      const resolved = resolvePath(directory)
      const results: { path: string; name: string; size?: number }[] = []

      async function walk(dir: string, depth: number): Promise<void> {
        if (depth > 5 || results.length >= maxResults) return
        let entries: string[]
        try {
          entries = await fs.readdir(dir)
        } catch {
          return
        }
        for (const entry of entries) {
          if (results.length >= maxResults) return
          if (entry.startsWith('.')) continue
          const fullPath = path.join(dir, entry)
          let stat: Awaited<ReturnType<typeof fs.stat>>
          try {
            stat = await fs.stat(fullPath)
          } catch {
            continue
          }
          if (stat.isDirectory()) {
            await walk(fullPath, depth + 1)
          } else if (entry.toLowerCase().includes(pattern.toLowerCase())) {
            results.push({ path: fullPath, name: entry, size: stat.size })
          }
        }
      }

      await walk(resolved, 0)
      return { pattern, directory: resolved, count: results.length, results }
    },
  })

  api.registerTool({
    name: 'file_delete',
    description: 'Delete a file from disk',
    parameters: {
      properties: {
        path: { type: 'string', description: 'Absolute or ~ path to the file to delete' },
      },
      required: ['path'],
    },
    run: async ({ path: filePath }: { path: string }) => {
      const resolved = resolvePath(filePath)
      await fs.unlink(resolved)
      return { path: resolved, deleted: true }
    },
  })
}
