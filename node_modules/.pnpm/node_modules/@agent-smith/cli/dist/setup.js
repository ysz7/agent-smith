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
/**
 * postinstall script — runs automatically after npm install -g agent-smith
 * Adds the Agent Smith bin directory to PATH on macOS, Linux, and Windows.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const BIN_DIR = path.join(os.homedir(), '.agent-smith-bin', 'bin');
const MARKER = '# agent-smith PATH';
function ensureBinDir() {
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
    }
}
function addToShellConfig(rcFile) {
    if (!fs.existsSync(rcFile))
        return;
    const content = fs.readFileSync(rcFile, 'utf-8');
    if (content.includes(MARKER))
        return; // Already added
    const lines = [
        '',
        MARKER,
        `export PATH="$PATH:${BIN_DIR}"`,
    ].join('\n');
    fs.appendFileSync(rcFile, lines + '\n', 'utf-8');
    console.log(`✓ Added Agent Smith to PATH in ${rcFile}`);
}
function addToWindowsPath() {
    try {
        // Read current user PATH from registry
        const currentPath = (0, child_process_1.execSync)('reg query "HKCU\\Environment" /v Path', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        if (currentPath.includes(BIN_DIR))
            return; // Already in PATH
        const match = currentPath.match(/Path\s+REG_(?:SZ|EXPAND_SZ)\s+(.+)/);
        if (!match)
            return;
        const existing = match[1].trim();
        const newPath = existing ? `${existing};${BIN_DIR}` : BIN_DIR;
        (0, child_process_1.execSync)(`reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`, { stdio: 'ignore' });
        console.log(`✓ Added Agent Smith to Windows PATH`);
        console.log('  Restart your terminal for the changes to take effect.');
    }
    catch {
        console.log(`ℹ️  Could not update PATH automatically.`);
        console.log(`   Add this to your PATH manually: ${BIN_DIR}`);
    }
}
function main() {
    ensureBinDir();
    if (process.platform === 'win32') {
        addToWindowsPath();
        return;
    }
    const home = os.homedir();
    // Try common shell config files
    const rcFiles = [
        path.join(home, '.zshrc'),
        path.join(home, '.bashrc'),
        path.join(home, '.bash_profile'),
        path.join(home, '.profile'),
    ];
    let added = false;
    for (const rcFile of rcFiles) {
        if (fs.existsSync(rcFile)) {
            addToShellConfig(rcFile);
            added = true;
        }
    }
    if (!added) {
        // Create .profile as fallback
        addToShellConfig(path.join(home, '.profile'));
    }
    console.log('✓ Agent Smith installed successfully!');
    console.log('  Run: agent-smith start');
    console.log('  (You may need to restart your terminal or run: source ~/.zshrc)');
}
main();
//# sourceMappingURL=setup.js.map