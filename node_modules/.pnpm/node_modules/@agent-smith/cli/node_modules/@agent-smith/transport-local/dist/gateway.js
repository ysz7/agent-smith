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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalGateway = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const fsp = __importStar(require("fs/promises"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
class LocalGateway {
    port;
    configManager;
    uiDir;
    app = (0, express_1.default)();
    server = (0, http_1.createServer)(this.app);
    wss = new ws_1.WebSocketServer({ server: this.server });
    connections = new Map();
    abortControllers = new Map();
    messageHandler;
    userSkillsDir;
    skillsProvider;
    extensionsProvider;
    historyProvider;
    stylesProvider;
    setStyleHandler;
    lima;
    documentsDir;
    constructor(port, configManager, uiDir, userSkillsDir) {
        this.port = port;
        this.configManager = configManager;
        this.uiDir = uiDir;
        this.userSkillsDir = userSkillsDir;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    async send(connectionId, message) {
        const ws = this.connections.get(connectionId);
        if (ws?.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    async broadcast(message) {
        const payload = JSON.stringify(message);
        for (const [, ws] of this.connections) {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }
    setSkillsProvider(fn) {
        this.skillsProvider = fn;
    }
    setExtensionsProvider(fn) {
        this.extensionsProvider = fn;
    }
    setHistoryProvider(fn) {
        this.historyProvider = fn;
    }
    setStylesProvider(fn) {
        this.stylesProvider = fn;
    }
    setSetStyleHandler(fn) {
        this.setStyleHandler = fn;
    }
    setLima(lima) {
        this.lima = lima;
    }
    setDocumentsDir(dir) {
        this.documentsDir = dir;
    }
    start(hostname = '127.0.0.1') {
        this.server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\n❌ Port ${this.port} is already in use.`);
                console.error(`   Run this to free it: npx kill-port ${this.port}`);
                console.error(`   Or change the port in ~/.agent-smith/config.json\n`);
                process.exit(1);
            }
            else {
                throw err;
            }
        });
        this.server.listen(this.port, hostname, () => {
            console.log(`Agent Smith listening at http://${hostname}:${this.port}`);
        });
    }
    setupMiddleware() {
        this.app.use(express_1.default.json());
        if (this.uiDir && fs.existsSync(this.uiDir)) {
            this.app.use(express_1.default.static(this.uiDir));
        }
    }
    setupRoutes() {
        // GET /api/config — returns config with apiKey masked
        this.app.get('/api/config', async (_req, res) => {
            try {
                const config = await this.configManager.load();
                res.json({ ...config, apiKey: config.apiKey ? '***' : '' });
            }
            catch {
                res.status(500).json({ error: 'Failed to load config' });
            }
        });
        // POST /api/config — update config fields
        this.app.post('/api/config', async (req, res) => {
            try {
                await this.configManager.save(req.body);
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Failed to save config' });
            }
        });
        // POST /api/config/apikey — save Anthropic API key (legacy)
        this.app.post('/api/config/apikey', async (req, res) => {
            try {
                const { apiKey } = req.body;
                if (typeof apiKey !== 'string' || !apiKey.trim()) {
                    res.status(400).json({ error: 'apiKey is required' });
                    return;
                }
                await this.configManager.setApiKey(apiKey.trim());
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Failed to save API key' });
            }
        });
        // POST /api/config/apikeys/:provider — save API key for a specific provider
        this.app.post('/api/config/apikeys/:provider', async (req, res) => {
            try {
                const { provider } = req.params;
                const { apiKey } = req.body;
                if (typeof apiKey !== 'string') {
                    res.status(400).json({ error: 'apiKey is required' });
                    return;
                }
                const value = apiKey.trim();
                // Also sync legacy apiKey for anthropic
                if (provider === 'anthropic' && value) {
                    await this.configManager.setApiKey(value);
                }
                else {
                    await this.configManager.save({ apiKeys: { [provider]: value || undefined } });
                }
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Failed to save API key' });
            }
        });
        // POST /api/skills/:name/toggle
        this.app.post('/api/skills/:name/toggle', async (req, res) => {
            try {
                const { enabled } = req.body;
                await this.configManager.toggleSkill(req.params.name, Boolean(enabled));
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Failed to toggle skill' });
            }
        });
        // POST /api/extensions/:name/toggle
        this.app.post('/api/extensions/:name/toggle', async (req, res) => {
            try {
                const { enabled } = req.body;
                await this.configManager.toggleExtension(req.params.name, Boolean(enabled));
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Failed to toggle extension' });
            }
        });
        // POST /api/extensions/:name/config — save extension-specific config fields
        this.app.post('/api/extensions/:name/config', async (req, res) => {
            try {
                await this.configManager.updateExtensionConfig(req.params.name, req.body);
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Failed to save extension config' });
            }
        });
        // GET /api/skills — returns full list of discovered skills with enabled status
        this.app.get('/api/skills', async (_req, res) => {
            try {
                if (this.skillsProvider) {
                    const skills = this.skillsProvider();
                    // Merge with fresh config so toggles are reflected immediately
                    const config = await this.configManager.load();
                    res.json(skills.map(s => ({
                        ...s,
                        enabled: config.skills[s.name]?.enabled ?? true,
                    })));
                }
                else {
                    const config = await this.configManager.load();
                    res.json(Object.entries(config.skills).map(([name, entry]) => ({ name, ...entry })));
                }
            }
            catch {
                res.status(500).json({ error: 'Failed to load skills' });
            }
        });
        // GET /api/extensions — returns full list of discovered extensions with enabled status and config
        this.app.get('/api/extensions', async (_req, res) => {
            try {
                if (this.extensionsProvider) {
                    const exts = this.extensionsProvider();
                    const config = await this.configManager.load();
                    res.json(exts.map(e => ({
                        ...e,
                        enabled: config.extensions[e.name]?.enabled ?? true,
                        config: config.extensions[e.name]?.config ?? {},
                    })));
                }
                else {
                    const config = await this.configManager.load();
                    res.json(Object.entries(config.extensions).map(([name, entry]) => ({ name, ...entry })));
                }
            }
            catch {
                res.status(500).json({ error: 'Failed to load extensions' });
            }
        });
        // GET /api/history — recent chat history for UI on reconnect
        this.app.get('/api/history', async (_req, res) => {
            try {
                if (this.historyProvider) {
                    res.json(await this.historyProvider());
                }
                else {
                    res.json([]);
                }
            }
            catch {
                res.status(500).json({ error: 'Failed to load history' });
            }
        });
        // GET /api/styles — list available response styles
        this.app.get('/api/styles', async (_req, res) => {
            try {
                const styles = this.stylesProvider ? await this.stylesProvider() : [];
                const config = await this.configManager.load();
                res.json({ styles, active: config.activeStyle ?? 'default' });
            }
            catch {
                res.status(500).json({ error: 'Failed to load styles' });
            }
        });
        // POST /api/styles/active — set active response style
        this.app.post('/api/styles/active', async (req, res) => {
            try {
                const { name } = req.body;
                if (typeof name !== 'string' || !name.trim()) {
                    res.status(400).json({ error: 'name is required' });
                    return;
                }
                await this.configManager.save({ activeStyle: name });
                if (this.setStyleHandler)
                    await this.setStyleHandler(name);
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Failed to set style' });
            }
        });
        // GET /api/tasks — list all scheduled tasks
        this.app.get('/api/tasks', async (_req, res) => {
            try {
                const tasks = await this.configManager.getTasks();
                res.json(tasks);
            }
            catch {
                res.status(500).json({ error: 'Failed to load tasks' });
            }
        });
        // POST /api/tasks — create a new scheduled task
        this.app.post('/api/tasks', async (req, res) => {
            try {
                const { name, cron, instructions, enabled = true } = req.body;
                if (!name || !cron || !instructions) {
                    res.status(400).json({ error: 'name, cron, and instructions are required' });
                    return;
                }
                const id = await this.configManager.createTask({ name, cron, instructions, enabled });
                res.json({ ok: true, id });
            }
            catch {
                res.status(500).json({ error: 'Failed to create task' });
            }
        });
        // PUT /api/tasks/:id — update an existing task
        this.app.put('/api/tasks/:id', async (req, res) => {
            try {
                await this.configManager.updateTask(req.params.id, req.body);
                res.json({ ok: true });
            }
            catch (err) {
                res.status(500).json({ error: err?.message ?? 'Failed to update task' });
            }
        });
        // DELETE /api/tasks/:id — delete a task
        this.app.delete('/api/tasks/:id', async (req, res) => {
            try {
                await this.configManager.deleteTask(req.params.id);
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Failed to delete task' });
            }
        });
        // POST /api/skills/install — install a skill from a URL or local path
        this.app.post('/api/skills/install', async (req, res) => {
            try {
                const { source } = req.body;
                if (!source || typeof source !== 'string') {
                    res.status(400).json({ error: 'source is required' });
                    return;
                }
                const skillsDir = this.userSkillsDir;
                if (!skillsDir) {
                    res.status(503).json({ error: 'Skill install directory not configured' });
                    return;
                }
                await fsp.mkdir(skillsDir, { recursive: true });
                if (source.startsWith('http://') || source.startsWith('https://')) {
                    let rawUrl = source;
                    if (rawUrl.includes('github.com') && !rawUrl.includes('raw.githubusercontent.com')) {
                        rawUrl = rawUrl
                            .replace('github.com', 'raw.githubusercontent.com')
                            .replace('/blob/', '/')
                            .replace('/tree/', '/');
                    }
                    if (!rawUrl.endsWith('SKILL.md')) {
                        rawUrl = rawUrl.replace(/\/$/, '') + '/SKILL.md';
                    }
                    const { default: https } = await Promise.resolve().then(() => __importStar(require('https')));
                    const { default: http } = await Promise.resolve().then(() => __importStar(require('http')));
                    const content = await new Promise((resolve, reject) => {
                        const client = rawUrl.startsWith('https') ? https : http;
                        client.get(rawUrl, (fetchRes) => {
                            if (fetchRes.statusCode !== 200) {
                                reject(new Error(`HTTP ${fetchRes.statusCode}`));
                                return;
                            }
                            let data = '';
                            fetchRes.on('data', (chunk) => { data += chunk.toString(); });
                            fetchRes.on('end', () => resolve(data));
                        }).on('error', reject);
                    });
                    const nameMatch = content.match(/^name:\s*(.+)$/m);
                    const skillName = nameMatch ? nameMatch[1].trim() : `skill-${Date.now()}`;
                    const skillDir = path.join(skillsDir, skillName);
                    await fsp.mkdir(skillDir, { recursive: true });
                    await fsp.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
                    res.json({ ok: true, skillName });
                }
                else {
                    res.status(400).json({ error: 'Local path install not supported via UI. Use CLI: agent-smith skills install <path>' });
                }
            }
            catch (err) {
                res.status(500).json({ error: err?.message ?? 'Failed to install skill' });
            }
        });
        // GET /api/memory — list facts (query: scope, source, limit)
        this.app.get('/api/memory', async (req, res) => {
            if (!this.lima) {
                res.json([]);
                return;
            }
            try {
                const { scope, source, limit } = req.query;
                const facts = await this.lima.listMemory({
                    scope: scope ?? undefined,
                    source: source ?? undefined,
                    limit: limit ? parseInt(limit, 10) : 50,
                });
                res.json(facts);
            }
            catch {
                res.status(500).json({ error: 'Failed to load memory' });
            }
        });
        // GET /api/memory/stats — memory statistics
        this.app.get('/api/memory/stats', async (_req, res) => {
            if (!this.lima) {
                res.json({ total: 0, byScope: {}, bySource: {}, dbSizeBytes: 0 });
                return;
            }
            try {
                const stats = this.lima.stats ? await this.lima.stats() : { total: 0, byScope: {}, bySource: {}, dbSizeBytes: 0 };
                res.json(stats);
            }
            catch {
                res.status(500).json({ error: 'Failed to load stats' });
            }
        });
        // GET /api/memory/export — export all facts as JSON file
        this.app.get('/api/memory/export', async (_req, res) => {
            if (!this.lima || !this.lima.export) {
                res.status(503).json({ error: 'Export not available' });
                return;
            }
            try {
                const tmpPath = path.join(os.tmpdir(), `lima-export-${Date.now()}.json`);
                await this.lima.export(tmpPath);
                res.download(tmpPath, 'memory-export.json', () => {
                    fsp.unlink(tmpPath).catch(() => { });
                });
            }
            catch {
                res.status(500).json({ error: 'Export failed' });
            }
        });
        // POST /api/memory/import — import facts from JSON
        this.app.post('/api/memory/import', async (req, res) => {
            if (!this.lima || !this.lima.import) {
                res.status(503).json({ error: 'Import not available' });
                return;
            }
            try {
                const tmpPath = path.join(os.tmpdir(), `lima-import-${Date.now()}.json`);
                await fsp.writeFile(tmpPath, JSON.stringify(req.body), 'utf-8');
                const count = await this.lima.import(tmpPath);
                await fsp.unlink(tmpPath).catch(() => { });
                res.json({ ok: true, imported: count });
            }
            catch {
                res.status(500).json({ error: 'Import failed' });
            }
        });
        // DELETE /api/memory/:id — delete a single fact
        this.app.delete('/api/memory/:id', async (req, res) => {
            if (!this.lima) {
                res.status(503).json({ error: 'Memory not available' });
                return;
            }
            try {
                const deleted = await this.lima.deleteMemory(req.params.id);
                res.json({ ok: true, deleted });
            }
            catch {
                res.status(500).json({ error: 'Failed to delete fact' });
            }
        });
        // DELETE /api/memory — bulk delete by filter (body: { scope?, source? })
        this.app.delete('/api/memory', async (req, res) => {
            if (!this.lima) {
                res.status(503).json({ error: 'Memory not available' });
                return;
            }
            try {
                const { scope, source } = req.body ?? {};
                const deleted = await this.lima.deleteMemory({ scope, source });
                res.json({ ok: true, deleted });
            }
            catch {
                res.status(500).json({ error: 'Failed to delete memory' });
            }
        });
        // POST /api/memory/reset — wipe all facts AND conversation history
        this.app.post('/api/memory/reset', async (_req, res) => {
            if (!this.lima) {
                res.status(503).json({ error: 'Memory not available' });
                return;
            }
            try {
                if (this.lima.resetAll)
                    await this.lima.resetAll();
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Reset failed' });
            }
        });
        // POST /api/memory/reset-history — wipe only conversation history
        this.app.post('/api/memory/reset-history', async (_req, res) => {
            if (!this.lima) {
                res.status(503).json({ error: 'Memory not available' });
                return;
            }
            try {
                if (this.lima.resetHistory)
                    await this.lima.resetHistory();
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Reset failed' });
            }
        });
        // POST /api/memory/reset-facts — wipe only LIMA facts
        this.app.post('/api/memory/reset-facts', async (_req, res) => {
            if (!this.lima) {
                res.status(503).json({ error: 'Memory not available' });
                return;
            }
            try {
                if (this.lima.resetFacts)
                    await this.lima.resetFacts();
                res.json({ ok: true });
            }
            catch {
                res.status(500).json({ error: 'Reset failed' });
            }
        });
        // POST /api/documents/upload — upload and index a document
        this.app.post('/api/documents/upload', (req, res) => {
            if (!this.lima || !this.documentsDir) {
                res.status(503).json({ error: 'Documents not configured' });
                return;
            }
            const storage = multer_1.default.diskStorage({
                destination: (_req, _file, cb) => cb(null, this.documentsDir),
                filename: (_req, file, cb) => {
                    const ext = path.extname(file.originalname);
                    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
                    cb(null, `${base}-${Date.now()}${ext}`);
                },
            });
            const upload = (0, multer_1.default)({
                storage,
                limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
                fileFilter: (_req, file, cb) => {
                    const allowed = ['.pdf', '.docx', '.txt', '.md'];
                    const ext = path.extname(file.originalname).toLowerCase();
                    cb(null, allowed.includes(ext));
                },
            }).single('file');
            upload(req, res, async (err) => {
                if (err) {
                    res.status(400).json({ error: err.message });
                    return;
                }
                if (!req.file) {
                    res.status(400).json({ error: 'No file or unsupported format (allowed: PDF, DOCX, TXT, MD)' });
                    return;
                }
                try {
                    const chunks = await this.lima.ingestFile(req.file.path);
                    res.json({
                        ok: true,
                        name: req.file.originalname,
                        savedAs: req.file.filename,
                        path: req.file.path,
                        chunks,
                    });
                }
                catch (ingestErr) {
                    await fsp.unlink(req.file.path).catch(() => { });
                    res.status(500).json({ error: ingestErr?.message ?? 'Ingestion failed' });
                }
            });
        });
        // GET /api/documents — list indexed documents
        this.app.get('/api/documents', async (_req, res) => {
            if (!this.lima) {
                res.json([]);
                return;
            }
            try {
                const docs = this.lima.listDocuments ? await this.lima.listDocuments() : [];
                res.json(docs);
            }
            catch {
                res.status(500).json({ error: 'Failed to list documents' });
            }
        });
        // DELETE /api/documents — delete document facts + file (body: { source_url })
        this.app.delete('/api/documents', async (req, res) => {
            if (!this.lima) {
                res.status(503).json({ error: 'Memory not available' });
                return;
            }
            try {
                const { source_url } = req.body ?? {};
                if (!source_url) {
                    res.status(400).json({ error: 'source_url required' });
                    return;
                }
                const deleted = this.lima.deleteDocument ? await this.lima.deleteDocument(source_url) : 0;
                // Delete physical file if it lives in our documents dir
                if (this.documentsDir && source_url.startsWith(this.documentsDir)) {
                    await fsp.unlink(source_url).catch(() => { });
                }
                res.json({ ok: true, deleted });
            }
            catch {
                res.status(500).json({ error: 'Failed to delete document' });
            }
        });
        // POST /api/documents/reindex — re-ingest a document (body: { source_url })
        this.app.post('/api/documents/reindex', async (req, res) => {
            if (!this.lima) {
                res.status(503).json({ error: 'Memory not available' });
                return;
            }
            try {
                const { source_url } = req.body ?? {};
                if (!source_url) {
                    res.status(400).json({ error: 'source_url required' });
                    return;
                }
                if (this.lima.deleteDocument)
                    await this.lima.deleteDocument(source_url);
                const chunks = await this.lima.ingestFile(source_url);
                res.json({ ok: true, chunks });
            }
            catch (err) {
                res.status(500).json({ error: err?.message ?? 'Re-index failed' });
            }
        });
        // GET /api/screenshots/:filename — serve screenshot files
        const screenshotsDir = path.join(os.homedir(), '.agent-smith', 'screenshots');
        this.app.get('/api/screenshots/:filename', (req, res) => {
            const filename = path.basename(req.params.filename); // prevent path traversal
            const filePath = path.join(screenshotsDir, filename);
            if (!fs.existsSync(filePath)) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            res.sendFile(filePath);
        });
        // POST /api/reveal — open file location in system file manager
        this.app.post('/api/reveal', async (req, res) => {
            const { filePath } = req.body;
            if (typeof filePath !== 'string') {
                res.status(400).json({ error: 'filePath required' });
                return;
            }
            const agentSmithDir = path.join(os.homedir(), '.agent-smith');
            const normalized = path.normalize(filePath);
            if (!normalized.startsWith(agentSmithDir)) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            const { spawn } = await Promise.resolve().then(() => __importStar(require('child_process')));
            if (process.platform === 'win32') {
                spawn('explorer', ['/select,', normalized], { detached: true, stdio: 'ignore' }).unref();
            }
            else if (process.platform === 'darwin') {
                spawn('open', ['-R', normalized], { detached: true, stdio: 'ignore' }).unref();
            }
            else {
                spawn('xdg-open', [path.dirname(normalized)], { detached: true, stdio: 'ignore' }).unref();
            }
            res.json({ ok: true });
        });
        // SPA catch-all — serve index.html for unknown routes
        if (this.uiDir && fs.existsSync(this.uiDir)) {
            this.app.get('*', (_req, res) => {
                res.sendFile(path.join(this.uiDir, 'index.html'));
            });
        }
        else {
            this.app.get('/', (_req, res) => {
                res.send(`
          <html><body style="font-family:sans-serif;padding:2rem">
            <h1>Agent Smith</h1>
            <p>Backend is running. UI not built yet.</p>
            <p>Connect via WebSocket at <code>ws://localhost:${this.port}</code></p>
          </body></html>
        `);
            });
        }
    }
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            const connectionId = (0, crypto_1.randomUUID)();
            this.connections.set(connectionId, ws);
            ws.send(JSON.stringify({ type: 'connected', data: { connectionId } }));
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'stop') {
                        this.abortControllers.get(connectionId)?.abort();
                        return;
                    }
                    const controller = new AbortController();
                    this.abortControllers.set(connectionId, controller);
                    this.messageHandler?.({
                        connectionId,
                        type: msg.type ?? 'message',
                        content: msg.content ?? '',
                        agentId: msg.agentId,
                        signal: controller.signal,
                        image: msg.image,
                    });
                }
                catch {
                    // Invalid JSON — ignore silently
                }
            });
            ws.on('close', () => {
                this.connections.delete(connectionId);
                this.abortControllers.delete(connectionId);
            });
            ws.on('error', () => this.connections.delete(connectionId));
        });
    }
}
exports.LocalGateway = LocalGateway;
//# sourceMappingURL=gateway.js.map