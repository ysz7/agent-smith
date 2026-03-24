"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectProvider = detectProvider;
/** Detect provider from model name */
function detectProvider(model) {
    if (model.startsWith('claude'))
        return 'anthropic';
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4'))
        return 'openai';
    if (model.startsWith('gemini') || model.startsWith('models/gemini'))
        return 'google';
    if (model.startsWith('llama') || model.startsWith('mistral') || model.startsWith('qwen') || model.startsWith('phi') || model.startsWith('gemma'))
        return 'ollama';
    return 'anthropic'; // default fallback
}
//# sourceMappingURL=interfaces.js.map