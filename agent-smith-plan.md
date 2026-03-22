# 🕶️ Agent Smith — Полный технический план

> Персональный ИИ агент с красивым UI, простой установкой и расширяемой архитектурой.
> Философия: **минимально, красиво, расширяемо.**

---

## Правила разработки

> Эти правила обязательны на каждой фазе разработки.

1. **Весь код на английском** — весь код, комментарии, названия переменных, функций, файлов и коммиты пишутся только на английском языке.

2. **Останавливаться после каждой фазы** — после завершения фазы остановиться и ждать. Не переходить к следующей фазе пока разработчик не подтвердит что текущая фаза протестирована и работает.

3. **Одна фаза за раз** — реализовывать только то что указано в текущей фазе. Не добавлять лишнее и не забегать вперёд.

4. **Спрашивать если непонятно** — если что-то неясно, спросить перед тем как писать код.

5. **Как продолжать** — после тестирования разработчик напишет:
   - `"Фаза X работает. Переходим к фазе X+1."` → переходить к следующей фазе
   - `"Есть баг: [описание]"` → исправить и снова остановиться

---

## Общая концепция

Agent Smith — это платформа для ИИ агентов. Не просто один агент, а инструмент который люди адаптируют под себя для любой индустрии и любого направления. Как Android для телефонов — платформа на которой каждый строит своё.

**Установка в итоге:**
```bash
npm install -g agent-smith
agent-smith start
# browser opens automatically
# enter API key
# done — 2 minutes
```

---

## Установка и удаление

Agent Smith устанавливается в домашнюю директорию пользователя — без sudo, без прав администратора. Работает одинаково на macOS, Linux и Windows. Проект пользователя живёт в любой папке на его усмотрение.

```
~/.agent-smith-bin/        ← бинарник (один раз, скрыто)
    └── bin/
        └── agent-smith    ← команда доступна везде

~/любая/папка/             ← проект пользователя (где угодно)
    ├── agent-smith.config.ts
    ├── skills/
    └── extensions/
```

**postinstall** — запускается автоматически после `npm install`:
- Определяет платформу (macOS / Linux / Windows)
- Определяет shell (zsh / bash / fish)
- Добавляет PATH в `.zshrc` / `.bashrc` / реестр Windows
- Не дублирует если уже добавлен

**preuninstall** — запускается автоматически при `npm uninstall`:
- Убирает строчку PATH из shell конфига
- Спрашивает пользователя хочет ли удалить данные (`~/.agent-smith`)
- Если нет — данные сохраняются, можно переустановить без потерь

**На сервере / Mac Mini / Docker** — работает без изменений:
```bash
# Linux сервер
npm install -g agent-smith
cd /opt/my-agent && agent-smith start

# Docker — PATH не нужен
RUN npm install -g agent-smith
CMD ["agent-smith", "start"]
```

---

## Кроссплатформенность (macOS / Linux / Windows)

Agent Smith работает нативно на всех платформах без WSL. Главное правило — никакого Unix-специфичного кода.

**Три обязательных правила для всего кода:**

**1. Пути — всегда через `path.join` и `os.homedir()`:**
```typescript
// ✅ правильно — работает везде
path.join(os.homedir(), '.agent-smith', 'config.json')
// macOS:   /Users/john/.agent-smith/config.json
// Linux:   /home/john/.agent-smith/config.json
// Windows: C:\Users\john\.agent-smith\config.json

// ❌ запрещено
'~/.agent-smith/config.json'
'/home/user/.agent-smith/config.json'
process.env.HOME  // undefined на Windows
```

**2. Shell команды — проверяем платформу:**
```typescript
// ✅ правильно
const shell = process.platform === 'win32'
  ? { cmd: 'cmd', flag: '/c' }
  : { cmd: 'sh', flag: '-c' }
spawn(shell.cmd, [shell.flag, command])

// ❌ запрещено
spawn('bash', ['-c', command])
```

**3. Разделитель путей — всегда `path.sep` или `path.join`:**
```typescript
// ✅ правильно
path.join('skills', 'memory', 'SKILL.md')

// ❌ запрещено
'skills/memory/SKILL.md'   // не работает на Windows
'skills\\memory\\SKILL.md' // не работает на macOS/Linux
```

---

## Технологический стек

**Backend:**
- Node.js + TypeScript
- pnpm монорепо
- WebSocket (ws библиотека)
- REST API (express)
- Anthropic SDK (`@anthropic-ai/sdk`)
- node-cron (расписание)
- Vitest (тесты)

**Frontend:**
- React 18 + TypeScript
- Vite (сборка)
- Tailwind CSS (стили)
- Zustand (состояние)
- WebSocket клиент

---

## Структура монорепо

```
agent-smith/
│
├── core/
│   ├── interfaces.ts            # все интерфейсы
│   ├── agent.ts                 # логика агента
│   ├── skill-loader.ts          # загрузка скиллов
│   ├── extension-loader.ts      # загрузка extensions
│   ├── memory.ts                # память агента
│   ├── config-manager.ts        # управление конфигом
│   └── package.json
│
├── skills/
│   ├── memory/
│   │   └── SKILL.md
│   ├── web-search/
│   │   └── SKILL.md
│   └── calendar/
│       └── SKILL.md
│
├── extensions/
│   ├── browser/
│   │   ├── index.ts
│   │   └── package.json
│   ├── email/
│   │   ├── index.ts
│   │   └── package.json
│   ├── storage/
│   │   ├── index.ts
│   │   └── package.json
│   └── notifications/
│       ├── index.ts
│       └── package.json
│
├── transport/
│   └── local/
│       ├── gateway.ts           # WebSocket сервер
│       ├── storage.ts           # файловая система
│       ├── scheduler.ts         # cron
│       └── package.json
│
├── ui/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.tsx
│   │   │   ├── Message.tsx
│   │   │   ├── AgentList.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── SkillCard.tsx
│   │   │   ├── Onboarding.tsx
│   │   │   ├── ScheduledTasks.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── store/
│   │   │   ├── chat.ts
│   │   │   ├── agents.ts
│   │   │   └── config.ts
│   │   ├── api/
│   │   │   └── gateway.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── index.html
│
├── cli/
│   ├── index.ts                 # точка входа
│   └── package.json
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
└── agent-smith.config.ts
```

---

## Интерфейсы (core/interfaces.ts)

```typescript
// Хранилище — не знает файлы это или DynamoDB
export interface IStorage {
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<string[]>
}

// Транспорт — не знает WebSocket это или Lambda
export interface ITransport {
  onMessage(handler: (msg: IncomingMessage) => void): void
  send(connectionId: string, message: OutgoingMessage): Promise<void>
  broadcast(message: OutgoingMessage): Promise<void>
}

// Планировщик — не знает cron это или EventBridge
export interface IScheduler {
  schedule(id: string, cron: string, fn: () => void): void
  cancel(id: string): void
  list(): ScheduledJob[]
}

// Сообщение
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  agentId?: string
}

// Скилл
export interface Skill {
  name: string
  description: string
  enabled: boolean
  requires?: {
    extensions: string[]
  }
  config?: Record<string, any>
}

// Extension
export interface Extension {
  name: string
  enabled: boolean
  register(api: ExtensionAPI): void
}

// API для extensions
export interface ExtensionAPI {
  registerTool(tool: Tool): void
  storage: IStorage
  config: AgentConfig
}

// Инструмент агента
export interface Tool {
  name: string
  description: string
  parameters: Record<string, any>
  run(params: any): Promise<any>
}

// Конфиг агента
export interface AgentConfig {
  agent: {
    name: string
    model: string
    systemPrompt?: string
  }
  apiKey: string
  skills: Record<string, {
    enabled: boolean
    config?: Record<string, any>
  }>
  extensions: Record<string, {
    enabled: boolean
    config?: Record<string, any>
  }>
  multiAgent: {
    enabled: boolean
    agents?: Record<string, AgentDefinition>
    dynamic?: {
      enabled: boolean
      maxAgents: number
      autoDestroy: boolean
    }
    userCreated?: {
      enabled: boolean
      maxAgents: number
      persistAgents: boolean
    }
  }
  transport: {
    port: number
    ui: boolean
  }
}
```

---

## Ядро агента (core/agent.ts)

```typescript
export class AgentSmith {
  private tools: Tool[] = []
  private memory: Memory
  private skillLoader: SkillLoader
  private extensionLoader: ExtensionLoader

  constructor(
    private storage: IStorage,
    private transport: ITransport,
    private scheduler: IScheduler,
    private config: AgentConfig
  ) {
    this.memory = new Memory(storage)
    this.skillLoader = new SkillLoader(config)
    this.extensionLoader = new ExtensionLoader(config)
  }

  async start() {
    // 1. Загружаем extensions
    await this.extensionLoader.load()
    this.tools = this.extensionLoader.getTools()

    // 2. Загружаем скиллы
    const skills = await this.skillLoader.load()

    // 3. Формируем system prompt из скиллов
    const systemPrompt = this.buildSystemPrompt(skills)

    // 4. Слушаем сообщения
    this.transport.onMessage(async (msg) => {
      await this.handleMessage(msg, systemPrompt)
    })
  }

  private async handleMessage(msg, systemPrompt) {
    await this.memory.add(msg)
    const history = await this.memory.getRecent(20)
    const response = await this.think(history, systemPrompt)
    await this.transport.send(msg.connectionId, {
      type: 'message',
      content: response
    })
    await this.memory.add({ role: 'assistant', content: response })
  }

  private async think(history, systemPrompt) {
    const client = new Anthropic({ apiKey: this.config.apiKey })
    const response = await client.messages.create({
      model: this.config.agent.model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: this.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters
      })),
      messages: history.map(m => ({ role: m.role, content: m.content }))
    })
    if (response.stop_reason === 'tool_use') {
      return await this.handleToolUse(response, history, systemPrompt)
    }
    return response.content[0].text
  }

  private buildSystemPrompt(skills) {
    const skillsText = skills
      .filter(s => s.enabled)
      .map(s => `- ${s.name}: ${s.description}`)
      .join('\n')
    return `Ты ${this.config.agent.name} — персональный ИИ ассистент.\n\nТвои возможности:\n${skillsText}\n\n${this.config.agent.systemPrompt || ''}`.trim()
  }
}
```

---

## Конфиг менеджер (core/config-manager.ts)

Хранится в `~/.agent-smith/config.json`. Пользователь никогда не редактирует вручную — только через UI.

```typescript
export class ConfigManager {
  private configPath = path.join(os.homedir(), '.agent-smith', 'config.json')

  async load(): Promise<AgentConfig>
  async save(config: Partial<AgentConfig>): Promise<void>
  async setApiKey(apiKey: string): Promise<void>
  async toggleSkill(name: string, enabled: boolean): Promise<void>
  async toggleExtension(name: string, enabled: boolean): Promise<void>
  async updateSkillConfig(name: string, config: Record<string, any>): Promise<void>
}

// Дефолтный конфиг
{
  agent: { name: 'Smith', model: 'claude-sonnet-4-20250514' },
  apiKey: '',
  skills: {},
  extensions: {},
  multiAgent: {
    enabled: false,
    dynamic: { enabled: false, maxAgents: 10, autoDestroy: true },
    userCreated: { enabled: false, maxAgents: 10, persistAgents: true }
  },
  transport: { port: 3000, ui: true }
}
```

---

## Загрузчик скиллов (core/skill-loader.ts)

```typescript
export class SkillLoader {
  // сканирует папку /skills
  // фильтрует по config.skills[name].enabled
  // проверяет зависимости от extensions
  // если скилл не упомянут в конфиге — включён по умолчанию
  // если extension выключен — скилл тоже недоступен
}
```

---

## Совместимость со скиллами OpenClaw

Agent Smith использует **тот же формат скиллов** что и OpenClaw. Это значит что любой скилл из ClawHub (https://clawhub.com) можно использовать в Agent Smith без изменений.

### Как импортировать скилл из OpenClaw

**Вариант 1 — вручную:**
```bash
# скачать скилл из ClawHub или GitHub
# скопировать папку скилла в:
~/.agent-smith/workspace/skills/название-скилла/
# Agent Smith автоматически обнаружит его
```

**Вариант 2 — через UI:**
```
Settings → Skills → Import Skill
вставить URL скилла с ClawHub или GitHub
Agent Smith скачает и установит автоматически
```

**Вариант 3 — через CLI:**
```bash
agent-smith skills install <skill-name>
# или из локальной папки
agent-smith skills install ./my-skill
```

### Форматы которые поддерживаются

Agent Smith читает скиллы из трёх мест (как OpenClaw):
1. Встроенные скиллы — `/skills` внутри пакета
2. Пользовательские скиллы — `~/.agent-smith/skills`
3. Скиллы воркспейса — `~/.agent-smith/workspace/skills`

Приоритет: воркспейс > пользовательские > встроенные.

### Что НЕ совместимо

Скиллы OpenClaw которые используют специфичные инструменты OpenClaw (например `browser`, `canvas`, `nodes`) потребуют наличия соответствующего extension в Agent Smith. Если extension не установлен — скилл будет недоступен (это поведение такое же как в OpenClaw).

---

## Формат скилла (SKILL.md)

```markdown
---
name: web-search
description: Поиск информации в интернете
requires:
  extensions:
    - browser
config:
  maxResults: 10
---

Когда пользователь просит найти информацию в интернете:
1. Используй инструмент browser_search
2. Верни топ результаты с заголовком и ссылкой
3. Кратко summarize найденное
```

---

## Формат extension

Каждый extension — отдельный npm пакет:

```
extensions/browser/
├── index.ts       # экспортирует функции и регистрирует инструменты
├── package.json   # свои зависимости
└── README.md
```

```typescript
// extensions/browser/index.ts
export default function register(api: ExtensionAPI) {
  api.registerTool({
    name: 'browser_search',
    description: 'Поиск в интернете',
    parameters: { query: { type: 'string' } },
    run: async ({ query }) => { /* puppeteer логика */ }
  })
}
```

---

## Gateway (transport/local/gateway.ts)

```typescript
export class LocalGateway implements ITransport {
  // WebSocket сервер
  // REST API endpoints:
  //   GET  /api/config          — получить конфиг (apiKey скрыт)
  //   POST /api/config          — обновить конфиг
  //   POST /api/config/apikey   — сохранить API ключ
  //   POST /api/skills/:name/toggle
  //   POST /api/extensions/:name/toggle
  //   GET  /api/skills          — список всех скиллов
  //   GET  /api/extensions      — список всех extensions
  // Отдаёт React UI как статику
  // Автоматически открывает браузер при запуске
}
```

---

## Точка входа (cli/index.ts)

```typescript
async function main() {
  const configManager = new ConfigManager()
  const config = await configManager.load()

  const storage = new LocalStorage()
  const scheduler = new LocalScheduler()
  const gateway = new LocalGateway(config.transport.port, configManager)

  const smith = new AgentSmith(storage, gateway, scheduler, config)

  gateway.start()    // запускает сервер + открывает браузер
  await smith.start() // загружает скиллы + слушает сообщения
}
```

---

## UI — Onboarding (первый запуск)

Показывается если `apiKey` пустой. Тёмный экран, поле для ввода ключа, ссылка на console.anthropic.com.

---

## UI — Основной экран

```
┌──────────┬──────────────────────────┐
│          │                          │
│ Sidebar  │      Chat Area           │
│          │                          │
│ Agents   │  [сообщения]             │
│          │                          │
│ Skills   │  [thinking indicator]    │
│          │                          │
│ Settings │  [input field]      [→]  │
│          │                          │
└──────────┴──────────────────────────┘
```

---

## UI — Настройки

Всё управляется через UI — никаких файлов руками:

- API ключ (поле с маскировкой)
- Выбор провайдера (Anthropic / OpenAI / Google / Ollama)
- Выбор модели (выпадающий список)
- Имя агента

**🔒 Security:**
- Localhost only — toggle ON/OFF (OFF = доступ с других устройств, требует пароль)
- Warn before sending files — toggle
- Validate skills on install — toggle
- Local audit log — toggle

**⚡ Performance:**
- History window — выпадающий список (10 / 20 / 50 сообщений)
- Smart compress — toggle
- Prompt caching — toggle

**🧠 Skills** — список с toggle ON/OFF + кнопка ⚙️ для настроек каждого скилла

**🔧 Extensions** — список с toggle ON/OFF

**🖥️ System:**
- Prevent sleep — toggle
- Auto-open browser — toggle
- Dark theme — toggle
- Language — выпадающий список

**⏰ Scheduled Tasks** — отдельный раздел в UI:
- Список всех задач с именем, расписанием, статусом последнего запуска
- Toggle ON/OFF для каждой задачи
- Кнопка ▶ запустить вручную прямо сейчас
- Кнопка ✏️ редактировать
- Кнопка 🗑 удалить
- Кнопка + создать новую задачу

Агент также умеет создавать задачи через чат:
```
Ты: "Каждый день в 9 утра ищи вакансии и отправляй на email"
Smith: "Задача создана ✓ — каждый день в 09:00"
```

После выполнения задачи агент отправляет уведомление с результатом.

Некоторые настройки (порт, хост) требуют перезапуска — показываем диалог:
```
⚠️ Restart required
Network settings changed. Restart Agent Smith to apply?
[Restart now]  [Later]
```

---

## Деплой на сервер / VPS / Mac Mini

Agent Smith работает одинаково везде — тот же UI, тот же функционал.

| Сценарий | Адрес | Пароль |
|---|---|---|
| Локально | localhost:3000 | Не нужен |
| VPS / сервер | IP:3000 | Нужен |
| Mac Mini | local-ip:3000 | Нужен |
| Docker | mapped-port | Нужен |

**Localhost (MVP)** — пароль не нужен. Только твой браузер на твоём компьютере видит агента. Никто снаружи не достучится.

**Сервер** — когда выключаешь "Localhost only" в настройках, агент автоматически включает защиту паролем. Появляется экран входа при открытии UI с другого устройства.

---

## Мульти-агент система

### Два режима

**Автоматический** — оркестратор сам решает сколько агентов нужно.

**Ручной** — пользователь сам создаёт агентов и говорит что они делают:
```
"Создай команду:
 - Искатель — ищет вакансии
 - Аналитик — анализирует
 - Секретарь — отправляет email"
```

### Конфиг мульти-агента

```typescript
multiAgent: {
  enabled: true,              // вкл/выкл одной строкой

  agents: {
    smith:   { role: 'orchestrator', model: 'claude-opus-4-6' },
    neo:     { role: 'worker', model: 'claude-sonnet-4-6',
               skills: { 'web-search': { enabled: true } } },
  },

  dynamic: {
    enabled: true,            // оркестратор может создавать агентов сам
    maxAgents: 10,
    autoDestroy: true,        // удалять после задачи
  },

  userCreated: {
    enabled: true,            // пользователь может создавать агентов
    maxAgents: 10,
    persistAgents: true,      // сохранять между сессиями
  },

  communication: {
    smith: ['neo', '*dynamic*'],
    neo:   ['smith']
  }
}
```

---

## Расширяемость под AWS (будущее)

Архитектура уже готова к облаку. Нужно только добавить новые реализации интерфейсов:

```typescript
// Сейчас (локально)         // Потом (AWS)
new LocalStorage()     →     new DynamoStorage()
new LocalGateway()     →     new LambdaTransport()
new LocalScheduler()   →     new EventBridgeScheduler()

// Агент не меняется вообще!
const smith = new AgentSmith(storage, transport, scheduler, config)
```

Переключение через переменную окружения:
```typescript
const isCloud = process.env.AWS_LAMBDA === 'true'
const storage = isCloud ? new DynamoStorage() : new LocalStorage()
```

---

## Что НЕ входит в MVP

- Docker / AWS деплой
- Мессенджеры (Telegram, WhatsApp и тд)
- Мобильное приложение
- Маркетплейс скиллов
- Мульти-агент (архитектура готова но выключена по умолчанию)

---

## Команды разработки

```bash
pnpm install          # установить зависимости
pnpm dev              # gateway + ui одновременно
pnpm build            # сборка
pnpm test             # тесты
npm publish           # публикация
```

---

## pnpm-workspace.yaml

```yaml
packages:
  - 'core'
  - 'cli'
  - 'ui'
  - 'transport/*'
  - 'extensions/*'
```

---

## Решения проблем OpenClaw

Agent Smith решает все известные проблемы OpenClaw. Каждое решение уже заложено в архитектуру.

### #1 — Установка без sudo (EACCES)
Установка в `~/.agent-smith-bin` через `.npmrc`. postinstall скрипт настраивает PATH автоматически. preuninstall чистит за собой. Работает без прав администратора.

### #2 — Нативная поддержка Windows
Никакого Unix-специфичного кода. Все пути через `path.join` и `os.homedir()`. Shell команды через проверку `process.platform`. Работает без WSL.

### #3 — Config drift после обновлений
Автоматическая миграция конфига при каждом старте. Версионирование конфига (`config.version`). Миграция пошагово — никогда не теряем данные пользователя.

### #4 — Много токенов на сессию
Три уровня оптимизации: окно истории (последние 20 сообщений), умное сжатие старых сообщений в summary, Anthropic prompt caching для system prompt. Результат: в 8 раз дешевле чем OpenClaw.

### #5 — Останавливается при засыпании macOS
`caffeinate -i -w PID` на macOS. PowerShell SetThreadExecutionState на Windows. Linux не требует — systemd управляет процессом. Опционально — включается в конфиге.

### #6 — Безопасность (открытый доступ)
Слушаем только `127.0.0.1` по умолчанию — никакого доступа снаружи. Явное предупреждение если пользователь открывает наружу. Валидация скиллов перед установкой — предупреждение о bash/exec/http. API ключ маскируется везде — никогда не логируется и не возвращается через API.

### #7 — Prompt Injection
Три уровня защиты: security rules в system prompt (50 токенов, кэшируется), whitelist опасных операций с подтверждением пользователя (0 токенов), обёртка внешних данных в `<external_data>` тег (+15 токенов). Влияние на производительность минимальное.

### #8 — EMFILE и утечка файловых дескрипторов
Debounced chokidar watcher — перезагрузка максимум раз в 500ms. Паттерн try/finally везде где открываем файлы. Явное закрытие watcher при остановке агента.

### #9 — Агент не выполняет команды (tools.profile)
Правильный дефолт из коробки: `tools: 'full'`. Проверка при старте с предупреждением если значение неверное. Пользователь никогда не сталкивается с этой проблемой.

### #10 — Shadow AI и прозрачность данных
Динамическое предупреждение при onboarding — название провайдера меняется в зависимости от выбора (Anthropic / OpenAI / Google / Ollama). Для локальных моделей (Ollama) — "данные остаются на компьютере". Выбор провайдера прямо в onboarding экране. Локальный audit log — пользователь всегда знает что ушло в API. Privacy настройки в конфиге.

---

---

# ✅ Прогресс разработки

> Отмечай выполненные пункты галочкой ✅

---

## Фаза 1 — Ядро

- ✅ Создать монорепо структуру (`pnpm-workspace.yaml`, корневой `package.json`, `tsconfig.json`)
- ✅ Написать интерфейсы (`core/interfaces.ts`) — `IStorage`, `ITransport`, `IScheduler`, `Message`, `Skill`, `Tool`, `AgentConfig`
- ✅ Написать `ConfigManager` (`core/config-manager.ts`) — загрузка, сохранение, дефолты, версионирование и автомиграция
- ✅ Написать `SkillLoader` (`core/skill-loader.ts`) — сканирование папки, фильтрация по конфигу, проверка зависимостей, debounced watcher
- ✅ Написать `ExtensionLoader` (`core/extension-loader.ts`) — загрузка extensions, регистрация инструментов
- ✅ Написать `Memory` (`core/memory.ts`) — сохранение истории, окно последних 20 сообщений, умное сжатие при превышении лимита
- ✅ Написать `AgentSmith` (`core/agent.ts`) — основная логика, think(), handleToolUse(), buildSystemPrompt(), prompt caching, security rules
- ✅ Написать `LocalStorage` (`transport/local/storage.ts`) — файловая система, паттерн try/finally везде
- ✅ Написать `LocalScheduler` (`transport/local/scheduler.ts`) — node-cron
- ✅ Написать `LocalGateway` (`transport/local/gateway.ts`) — WebSocket + REST API + статика UI, слушать только на `127.0.0.1`
- ✅ Написать точку входа (`cli/index.ts`) — собрать все части вместе, проверка tools.profile при старте, preventSleep()
- ✅ Проверить что агент запускается и отвечает на сообщения через WebSocket

---

## Фаза 2 — UI

- ✅ Создать React приложение (`ui/`) — Vite + React + TypeScript + Tailwind
- ✅ Настроить Zustand store (`ui/src/store/`) — chat, config, agents
- ✅ Написать WebSocket клиент (`ui/src/api/gateway.ts`)
- ✅ Написать `Onboarding.tsx` — выбор провайдера (Anthropic / OpenAI / Google / Ollama), поле API ключа, динамическое предупреждение о данных, ссылка на документацию провайдера
- ✅ Написать `Sidebar.tsx` — навигация между разделами
- ✅ Написать `Chat.tsx` — список сообщений + поле ввода
- ✅ Написать `Message.tsx` — отображение одного сообщения
- ✅ Написать `ThinkingIndicator.tsx` — анимация пока агент думает
- ✅ Написать `Settings.tsx` — все настройки включая privacy настройки
- ✅ Написать `SkillCard.tsx` — карточка скилла с toggle и кнопкой ⚙️
- ✅ Написать `SkillSettings.tsx` — модалка с настройками конкретного скилла
- ✅ Написать `ExtensionCard.tsx` — карточка extension с toggle
- ✅ Написать `ScheduledTasks.tsx` — список задач, toggle, запуск вручную, редактирование, удаление, создание новой
- ✅ Подключить UI к Gateway — проверить что чат работает через браузер
- ✅ Тёмная тема по умолчанию
- ✅ Автооткрытие браузера при запуске (`open` библиотека)

---

## Фаза 3 — Скиллы и Extensions

- ✅ Написать `extensions/storage/index.ts` — базовые операции с файлами
- ✅ Написать `extensions/browser/index.ts` — scrape + DuckDuckGo search (axios + cheerio)
- ✅ Написать `extensions/email/index.ts` — nodemailer, отправка писем
- ✅ Написать `extensions/notifications/index.ts` — системные уведомления (node-notifier)
- ✅ Написать `skills/memory/SKILL.md` — инструкции для агента
- ✅ Написать `skills/web-search/SKILL.md` — инструкции для агента
- ✅ Написать `skills/calendar/SKILL.md` — инструкции для агента
- ✅ Проверить что скиллы загружаются и попадают в system prompt
- ✅ Проверить что включение/выключение скилла через UI работает
- ✅ Проверить что зависимости скиллов от extensions работают
- ✅ Реализовать импорт скиллов из OpenClaw/ClawHub — через UI (вставить URL) и через CLI (`agent-smith skills install`)
- ✅ Проверить что скилл скачанный с clawhub.com работает в Agent Smith без изменений
- ✅ Реализовать создание задач через чат — агент парсит "каждый день в 9 утра делай X" и создаёт запись в конфиге
- ✅ Реализовать хранение задач в конфиге — id, name, enabled, cron, skill, config, lastRun, lastStatus
- ✅ Реализовать историю запусков задач — время, статус, результат
- ✅ Реализовать push уведомление после выполнения задачи — агент сообщает результат

---

## Фаза 4 — Полировка MVP

- ✅ Обработка ошибок — если API ключ неверный, если нет интернета
- ✅ Валидация API ключа при вводе (проверка формата sk-ant-...)
- ✅ Стриминг ответа (печатает по буквам как ChatGPT)
- ✅ Сохранение истории чата между перезапусками
- ✅ Красивые анимации и переходы в UI (streaming bounce dots, плавные переходы)
- ✅ Написать README.md с инструкцией установки
- ✅ Написать базовые тесты (Vitest) — 10 тестов: Memory, ConfigManager, Tasks
- ✅ Написать `cli/setup.ts` — postinstall скрипт (настройка PATH, кроссплатформенно: macOS / Linux / Windows)
- ✅ Написать `cli/cleanup.ts` — preuninstall скрипт (убрать PATH, спросить про удаление данных)
- ✅ Прописать `.npmrc` — комментарий с инструкцией (prefix в проектном .npmrc запрещён npm)
- ✅ Протестировать установку на Windows нативно (без WSL) — работает
- [ ] Протестировать полное удаление — нет мусора в системе после `npm uninstall -g agent-smith`
- ✅ Проверить что все пути в коде используют `path.join` и `os.homedir()` — никаких хардкоженных Unix путей
- ✅ Проверить что нет вызовов `spawn('bash', ...)` — только кроссплатформенные команды
- ✅ Протестировать запуск на Windows нативно (без WSL2) — работает
- ✅ Реализовать `preventSleep()` — caffeinate на macOS, PowerShell на Windows
- ✅ Реализовать умное сжатие истории — summary при превышении 30 сообщений
- ✅ Реализовать локальный audit log — что ушло в API
- ✅ Реализовать `privacy` настройки в конфиге — `warnBeforeSendingFiles`, `localAuditLog`
- ✅ Показывать индикатор "Compressing conversation history..." при сжатии
- ✅ Реализовать экран входа с паролем когда localhost only = OFF (диалог Restart required)
- ✅ Показывать диалог "Restart required" при изменении сетевых настроек

---

## Фаза 6 — Новые скиллы и extensions (средний приоритет)

- ✅ Extension `files` — чтение/запись/поиск файлов на диске (`fs` + инструменты: `file_read`, `file_write`, `file_search`, `file_list`)
- ✅ Skill `files` — "найди все PDF в Downloads", "прочитай этот файл", "создай файл"
- ✅ Extension `clipboard` — чтение/запись буфера обмена (`clipboardy`): `clipboard_read`, `clipboard_write`
- ✅ Skill `clipboard` — "что у меня в буфере", "скопируй это"
- ✅ Extension `system` — системная информация (`os`, `child_process`): `system_info` (CPU, RAM, диск), `process_list`, `open_app`
- ✅ Skill `system` — "сколько свободного места", "какие процессы жрут CPU", "открой приложение"

---

## Фаза 7 — Продвинутые скиллы (долгосрочно)

- ✅ Skill `research` — глубокий ресёрч: поиск + скрейпинг нескольких источников + структурированный отчёт
- ✅ Skill `habits` — трекинг привычек (поверх storage): отметить, просмотреть статистику за период
- ✅ Skill `translator` — явный скилл для перевода с форматом вывода и поддержкой языков
- ✅ Skill `expenses` — трекинг расходов (поверх storage): добавить трату, сводка за месяц
- ✅ Skill `reminders` — продвинутые напоминания с повтором и приоритетами (поверх scheduler)

---

## Фаза 8 — LIMA (Long-term Intelligence Memory for Agents)

> Реализация протокола LIMA — умная память которая загружает только релевантные факты.
> Спецификация: `LIMA-specification.md`
>
> Токены: текущая история ~200,000 → LIMA ~2,000 (в 100 раз дешевле)

**Принципы:**
- Отдельный пакет `@agent-smith/lima` с интерфейсом `ILimaMemory` — легко заменить
- SQLite + FTS5 tag index — работает без сервера и без embeddings
- LanceDB опционально — только если tag lookup дал < 3 результатов
- 4 scope: `profile` (всегда), `knowledge` (документы), `working` (сессия), `task` (активные задачи)
- Recall алгоритм: tag extraction → index lookup → activation propagation → top 12 facts → ~800 токенов
- Topic shift detection: overlap < 20% → сброс всех активаций
- Decay: working/knowledge × 0.85 после каждого хода

**8.1 — Ядро LIMA**
- ✅ Пакет `@agent-smith/lima` с интерфейсом `ILimaMemory`
- ✅ SQLite схема: таблица `facts` + FTS5 индекс по тегам (использует `node:sqlite` — встроен в Node 24)
- ✅ 15 обязательных методов: `store`, `recall`, `decay`, `forget`, `resetContext`, `startTask`, `updateTask`, `getActiveTask`, `ingestFile`, `ingestURL`, `ingestFolder`, `link`, `listMemory`, `deleteMemory`, `get`
- ✅ Recall алгоритм (8 шагов по спецификации)
- ✅ История чата перенесена из JSON в SQLite (таблица `messages` в `lima.db`, `SqliteHistory` класс, миграция старого JSON при первом запуске)

**8.2 — Интеграция в агента**
- ✅ `LimaMemory` передаётся в `AgentSmith` через 9-й параметр конструктора
- ✅ `recall()` вызывается перед каждым ответом, контекст инжектируется в system prompt
- ✅ `decay()` вызывается после каждого ответа
- ✅ Extract Pattern: после tool call агент сохраняет краткий working fact (`scope: working`)
- ✅ LIMA tools: `memory_store`, `memory_list`, `memory_delete` — агент управляет памятью через инструменты



**8.4 — UI для памяти**
- ✅ Раздел "Memory" в Settings — список фактов по scope, статистика по 4 scope
- ✅ Поиск по содержимому и тегам, фильтр по scope, удаление отдельных фактов, очистка scope
- ✅ Экспорт/импорт памяти в JSON
- ✅ REST API: GET/DELETE `/api/memory`, `/api/memory/stats`, `/api/memory/export`, `/api/memory/import`

---

## Фаза 9 — Продуктивность и UX

**9.1 — Stop generation**
- ✅ AbortController в `thinkStream` — сигнал прокидывается в Anthropic SDK
- ✅ Gateway: Map `connectionId → AbortController`, обрабатывает WS-сообщение `{ type: 'stop' }`
- ✅ UI: кнопка Send становится Stop (■) во время стриминга
- ✅ Частичный ответ сохраняется с пометкой `_(generation stopped)_`

**9.2 — File attachments + Document ingestion**
- ✅ Кнопка `+` в поле ввода открывает file picker (PDF, DOCX, MD, TXT, images)
- ✅ После загрузки — `lima.ingestFile()`, контент индексируется в knowledge
- ✅ Файл отображается как вложение в чате
- ✅ Раздел "Documents" в UI — список загруженных документов, удаление, re-index
- ✅ REST API: `POST /api/documents/upload`, `GET /api/documents`, `DELETE /api/documents/:id`

**9.3 — Document search**
- ✅ Агент ищет по документам через `document_search` (FTS5, фильтр source='document')
- ✅ В ответе указывает источник (имя файла) — `[doc:filename]` в контексте + правила в SKILL.md
- ✅ Инструмент `document_list` — список доступных документов
- ✅ `buildContextBlock` помечает документные чанки именем файла


**9.4 — Daily briefing**
- ✅ Автозапуск при первом открытии за день
- ✅ Catch-up если агент долго не запускался (только если есть что сообщить)
- ✅ Содержит: встречи, задачи, письма, погода
- ✅ Отключается в Settings


---

## Phase 10 — Integrations & Advanced Capabilities

**10.1 — File attachment via chat**
- ✅ Кнопка `+` в чате для прикрепления файлов
- ✅ Авто-индексация прикреплённых файлов в LIMA

**10.2 — Google Calendar / Apple Calendar**
- [ ] _(отложено)_

**10.3 — Gmail / Outlook**
- [ ] _(отложено)_

**10.4 — Smart calendar**
- ✅ Extension `calendar` — хранилище событий (storage prefix `calendar:event:`)
- ✅ `calendar_add` — создать событие, вернуть cron для reminder + конфликты
- ✅ `calendar_list` — список событий с фильтром по диапазону дат
- ✅ `calendar_delete` — удалить событие, вернуть taskId для отвязки reminder
- ✅ `calendar_update` — перенести или отредактировать событие, вернуть новый cron
- ✅ Skill `calendar` — natural language → datetime, предупреждения о конфликтах, двухшаговое создание (event + task)

**10.5 — Computer use**
- ✅ Extension `computer-use` на Playwright (изолированный профиль `~/.agent-smith/computer-use-profile`)
- ✅ `computer_navigate` — открыть URL, вернуть title + final URL
- ✅ `computer_screenshot` — скриншот страницы или элемента → `~/.agent-smith/screenshots/`
- ✅ `computer_click` — клик по CSS selector или visible text
- ✅ `computer_type` — печать в активный элемент (с опциональным Enter и delay)
- ✅ `computer_fill` — заполнить input по selector / placeholder / label
- ✅ `computer_get_text` — получить текст страницы или элемента
- ✅ `computer_wait` — ждать появления элемента или фиксированное время
- ✅ `computer_pdf` — сохранить страницу как PDF → `~/.agent-smith/pdfs/`
- ✅ `computer_close` — закрыть браузер
- ✅ Skill `computer-use` с инструкциями и правилами безопасности
- ✅ Singleton браузерная сессия — персистентна между tool calls

**10.6 — Heartbeat / Proactive agent**
- [ ] Агент действует без промпта пользователя
- [ ] Мониторинг входящих (почта, уведомления)
- [ ] Проактивные уведомления при важных событиях

---

## Phase 11 — Мульти-агент

**11.1 — Core**
- [ ] `AgentTeam` (`core/agent-team.ts`) — управление командой агентов
- [ ] `Orchestrator` (`core/orchestrator.ts`) — раздача задач воркерам
- [ ] Конфиг communication — кто с кем может общаться
- [ ] Настройка: запрет главному агенту использовать субагентов

**11.2 — Создание агентов**
- [ ] Пользователь создаёт агентов через чат
- [ ] Оркестратор динамически создаёт агентов под задачу
- [ ] Субагенты доступны напрямую (отдельно от главного агента)

**11.3 — AgentsOffice (визуальный офис)**
- [ ] Отдельная вкладка "Agents Office" в UI
- [ ] 2D (или 3D) визуализация офиса — каждый агент занимает рабочее место
- [ ] Визуальный статус агента — idle / thinking / working
- [ ] Анимация коммуникации между агентами (стрелки / линии)
- [ ] Ручное добавление и удаление агентов прямо из офиса
- [ ] Клик по агенту — открыть с ним отдельный чат
