#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs/promises"));
const core_1 = require("@agent-smith/core");
const transport_local_1 = require("@agent-smith/transport-local");
const lima_1 = require("@agent-smith/lima");
async function openBrowser(url) {
    const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
    const platform = process.platform;
    let cmd;
    let args;
    if (platform === 'win32') {
        cmd = 'cmd';
        args = ['/c', 'start', '', url];
    }
    else if (platform === 'darwin') {
        cmd = 'open';
        args = [url];
    }
    else {
        cmd = 'xdg-open';
        args = [url];
    }
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}
async function preventSleep(pid) {
    const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
    if (process.platform === 'darwin') {
        spawn('caffeinate', ['-i', '-w', String(pid)], {
            detached: true,
            stdio: 'ignore',
        }).unref();
    }
    else if (process.platform === 'win32') {
        // Keep system awake using SetThreadExecutionState via PowerShell
        const psScript = [
            'Add-Type -Name "Power" -Namespace "" -MemberDefinition \'[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);\'',
            '[Power]::SetThreadExecutionState(0x80000003) | Out-Null',
            `Start-Sleep -Seconds ${24 * 60 * 60}`,
        ].join('; ');
        spawn('powershell', ['-NoProfile', '-Command', psScript], {
            detached: true,
            stdio: 'ignore',
        }).unref();
    }
    // Linux: process managed by systemd — no action needed
}
// Install a skill from a local path or a GitHub/ClawHub URL
async function installSkill(source, skillsDir) {
    await fs.mkdir(skillsDir, { recursive: true });
    if (source.startsWith('http://') || source.startsWith('https://')) {
        // Treat as a raw SKILL.md URL or a GitHub repo/directory URL
        const { default: https } = await Promise.resolve().then(() => __importStar(require('https')));
        const { default: http } = await Promise.resolve().then(() => __importStar(require('http')));
        // Normalize GitHub tree URLs to raw content URLs
        let rawUrl = source;
        if (rawUrl.includes('github.com') && !rawUrl.includes('raw.githubusercontent.com')) {
            rawUrl = rawUrl
                .replace('github.com', 'raw.githubusercontent.com')
                .replace('/blob/', '/')
                .replace('/tree/', '/');
        }
        // Ensure it points to SKILL.md
        if (!rawUrl.endsWith('SKILL.md')) {
            rawUrl = rawUrl.replace(/\/$/, '') + '/SKILL.md';
        }
        const content = await new Promise((resolve, reject) => {
            const client = rawUrl.startsWith('https') ? https : http;
            client.get(rawUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch ${rawUrl}: HTTP ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', (chunk) => { data += chunk.toString(); });
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
        // Extract skill name from frontmatter
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        const skillName = nameMatch ? nameMatch[1].trim() : `skill-${Date.now()}`;
        const skillDir = path.join(skillsDir, skillName);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
        console.log(`✓ Skill "${skillName}" installed to ${skillDir}`);
    }
    else {
        // Local path — copy the directory
        const srcPath = path.resolve(source);
        const skillMdPath = path.join(srcPath, 'SKILL.md');
        const raw = await fs.readFile(skillMdPath, 'utf-8');
        const nameMatch = raw.match(/^name:\s*(.+)$/m);
        const skillName = nameMatch ? nameMatch[1].trim() : path.basename(srcPath);
        const skillDir = path.join(skillsDir, skillName);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), raw, 'utf-8');
        console.log(`✓ Skill "${skillName}" installed to ${skillDir}`);
    }
}
async function main() {
    const args = process.argv.slice(2);
    const agentSmithHome = path.join(os.homedir(), '.agent-smith');
    const userSkillsDir = path.join(agentSmithHome, 'skills');
    // Handle subcommands
    if (args[0] === 'skills' && args[1] === 'install') {
        const source = args[2];
        if (!source) {
            console.error('Usage: agent-smith skills install <url-or-path>');
            process.exit(1);
        }
        await installSkill(source, userSkillsDir);
        return;
    }
    const configManager = new core_1.ConfigManager(agentSmithHome);
    const config = await configManager.load();
    // Data storage directory
    const dataDir = path.join(agentSmithHome, 'data');
    // __dirname = cli/dist — go up two levels to reach the monorepo root
    const repoRoot = path.join(__dirname, '..', '..');
    // Skill search dirs (priority: workspace > user > built-in)
    const builtinSkillsDir = path.join(repoRoot, 'skills');
    const workspaceSkillsDir = path.join(agentSmithHome, 'workspace', 'skills');
    const skillDirs = [builtinSkillsDir, userSkillsDir, workspaceSkillsDir];
    // Extension search dirs
    const builtinExtensionsDir = path.join(repoRoot, 'extensions');
    const userExtensionsDir = path.join(agentSmithHome, 'extensions');
    const extensionDirs = [builtinExtensionsDir, userExtensionsDir];
    // Style search dirs (priority: user > built-in)
    const builtinStylesDir = path.join(repoRoot, 'styles');
    const userStylesDir = path.join(agentSmithHome, 'styles');
    const styleDirs = [builtinStylesDir, userStylesDir];
    // UI static files (built by Vite)
    const uiDir = path.join(repoRoot, 'ui', 'dist');
    const storage = new transport_local_1.LocalStorage(dataDir);
    const scheduler = new transport_local_1.LocalScheduler();
    const gateway = new transport_local_1.LocalGateway(config.transport.port, configManager, uiDir, userSkillsDir);
    const lima = new lima_1.LimaMemory(path.join(agentSmithHome, 'lima.db'));
    const history = new lima_1.SqliteHistory(lima.getDb());
    // Migrate existing JSON history to SQLite (one-time)
    const legacyHistoryPath = path.join(dataDir, 'memory', 'history.json');
    try {
        const raw = await fs.readFile(legacyHistoryPath, 'utf-8');
        const messages = JSON.parse(raw);
        if (Array.isArray(messages) && messages.length > 0 && (await history.count()) === 0) {
            for (const m of messages) {
                if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
                    await history.add({ role: m.role, content: m.content ?? '', agentId: m.agentId });
                }
            }
            console.log(`Migrated ${messages.length} messages from JSON to SQLite.`);
            await fs.rename(legacyHistoryPath, legacyHistoryPath + '.migrated');
        }
    }
    catch {
        // No legacy file — nothing to migrate
    }
    const smith = new core_1.AgentSmith(storage, gateway, scheduler, config, skillDirs, extensionDirs, configManager, styleDirs, lima, history);
    const hostname = config.transport.localhostOnly !== false ? '127.0.0.1' : '0.0.0.0';
    gateway.start(hostname);
    await smith.start();
    // Register live skill/extension providers so the UI always shows current data
    gateway.setSkillsProvider(() => smith.getSkills().map((s) => ({
        name: s.name,
        description: s.description,
        enabled: s.enabled,
        requires: s.requires,
        config: s.config,
    })));
    gateway.setExtensionsProvider(() => smith.getDiscoveredExtensionNames().map((name) => ({
        name,
        enabled: config.extensions[name]?.enabled !== false,
    })));
    gateway.setStylesProvider(() => smith.getStyles());
    gateway.setSetStyleHandler((name) => smith.setStyle(name));
    // Initialize agent registry
    const registry = new core_1.AgentRegistry();
    // Register main agent (Smith)
    registry.register({
        id: 'main',
        name: config.agent.name,
        type: 'main',
        status: 'idle',
        model: config.agent.model,
        createdAt: new Date().toISOString(),
    });
    // Restore user agents from config
    const userAgents = config.multiAgent.agents ?? {};
    for (const def of Object.values(userAgents)) {
        registry.register({
            id: def.id,
            name: def.name,
            type: 'user',
            status: 'idle',
            model: def.model,
            createdAt: def.createdAt,
            systemPrompt: def.systemPrompt,
        });
    }
    gateway.setAgentRegistry(registry);
    gateway.setLima(lima);
    // Wire registry into smith so it can update agent statuses and create agents via tool
    smith.setRegistry(registry);
    const documentsDir = path.join(agentSmithHome, 'documents');
    await fs.mkdir(documentsDir, { recursive: true });
    gateway.setDocumentsDir(documentsDir);
    // Main chat history — only messages without agentId
    gateway.setHistoryProvider(async () => {
        const msgs = await history.getRecentMain(50);
        return msgs
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
        }));
    });
    // Per-agent chat history
    gateway.setAgentHistoryProvider(async (agentId) => {
        const msgs = await history.getRecentForAgent(50, agentId);
        return msgs
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
        }));
    });
    // Load and schedule persisted tasks
    const tasks = await configManager.getTasks();
    for (const task of tasks) {
        if (task.enabled) {
            scheduler.schedule(task.id, task.cron, () => {
                smith.runScheduledTask(task.id, task.instructions).catch(console.error);
            });
            console.log(`Scheduled task "${task.name}" loaded (${task.cron})`);
        }
    }
    if (config.system?.preventSleep) {
        await preventSleep(process.pid);
    }
    if (config.system?.autoOpenBrowser !== false) {
        const url = `http://localhost:${config.transport.port}`;
        setTimeout(() => openBrowser(url), 1500);
        console.log(`Opening browser at ${url}`);
    }
    // Heartbeat — proactive background agent checks
    smith.startHeartbeat();
    // Daily briefing — trigger on first open of the day
    const today = new Date().toISOString().slice(0, 10);
    if (config.system?.dailyBriefing !== false && config.system?.lastOpenedDate !== today) {
        await configManager.save({ system: { preventSleep: false, autoOpenBrowser: true, darkTheme: true, language: 'en', ...config.system, lastOpenedDate: today } });
        // Delay to allow the browser/UI to connect via WebSocket before the broadcast
        setTimeout(() => {
            smith.runDailyBriefing().catch(console.error);
        }, 4000);
        console.log('Daily briefing scheduled');
    }
    // Graceful shutdown
    const shutdown = async () => {
        console.log('\nShutting down Agent Smith...');
        await smith.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map