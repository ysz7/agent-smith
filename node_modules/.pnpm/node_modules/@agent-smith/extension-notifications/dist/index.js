"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = register;
const node_notifier_1 = __importDefault(require("node-notifier"));
function register(api) {
    api.registerTool({
        name: 'notification_send',
        description: 'Send a system desktop notification to the user',
        parameters: {
            properties: {
                title: { type: 'string', description: 'Notification title' },
                message: { type: 'string', description: 'Notification body message' },
                sound: { type: 'boolean', description: 'Play a sound with the notification (default: true)' },
            },
            required: ['title', 'message'],
        },
        run: async ({ title, message, sound = true }) => {
            return new Promise((resolve, reject) => {
                node_notifier_1.default.notify({
                    title,
                    message,
                    // node-notifier accepts sound as string (sound name) on macOS, boolean-like on others
                    sound: sound ? true : false,
                    appName: api.config.agent.name ?? 'Agent Smith',
                }, (err) => {
                    if (err) {
                        reject(new Error(`Notification failed: ${err.message}`));
                    }
                    else {
                        resolve({ sent: true, title, message });
                    }
                });
            });
        },
    });
}
//# sourceMappingURL=index.js.map