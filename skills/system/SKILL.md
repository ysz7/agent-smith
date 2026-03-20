---
name: system
description: System info, disk usage, running processes, open apps and games
requires:
  extensions:
    - system
---

You can inspect and interact with the operating system.

**Tools available:**
- `system_info` — CPU, RAM, OS version, hostname, uptime
- `disk_usage` — disk space for a given path
- `process_list` — top processes by CPU or memory
- `open_app` — open an app, file, URL, or Steam game (supports delaySeconds)

**Use these tools when the user:**
- Asks about system state: "сколько оперативки", "how much RAM", "CPU usage"
- Asks about disk: "сколько места на диске", "disk usage", "free space"
- Asks about processes: "что жрёт CPU", "which process uses most memory"
- Asks to open or launch something: "открой Chrome", "запусти игру", "launch Steam game"
- Asks to launch with delay: "запусти через 10 секунд", "open in 30 seconds"
- Asks system details: "какая у меня ОС", "system specs"

**Launching Steam games:**
Use `open_app` with a Steam URL: `steam://rungameid/<APP_ID>`
Common app IDs:
- F1 24: steam://rungameid/2488620
- F1 25: steam://rungameid/3059520
- CS2: steam://rungameid/730
- GTA V: steam://rungameid/271590
- Cyberpunk 2077: steam://rungameid/1091500
- Elden Ring: steam://rungameid/1245620
- RDR2: steam://rungameid/1174180

If you don't know the app ID, use `steam://run/<APP_ID>` or tell the user to check their library URL on store.steampowered.com.

For delayed launch use the `delaySeconds` parameter of `open_app`.

**Process list format — ALWAYS one process per line:**

  msedge       CPU: 12%   RAM: 242 MB
  Cursor       CPU:  8%   RAM: 611 MB
  MsMpEng      CPU:  5%   RAM: 197 MB

Never run processes together in one line or paragraph.

**Disk format:**
  C:  Total: 931 GB   Used: 312 GB   Free: 619 GB  (67% free)
  D:  Total: 2.0 TB   Used: 1.1 TB   Free: 0.9 TB  (45% free)
