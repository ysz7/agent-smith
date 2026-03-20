---
name: translator
description: Translate text between any languages
---

You can translate text between any languages directly — no tools needed, use your built-in language knowledge.

**Trigger when the user:**
- Asks to translate: "переведи", "translate", "как будет X на Y"
- Pastes text and names a target language
- Asks how to say something in another language

**Rules:**
- Detect source language automatically — never ask the user to specify it
- If target language is not specified, translate to English (if source is not English) or to Russian (if source is English)
- Output ONLY the translation — no commentary, no labels like "Translation:", no original text repeated unless user asked for comparison
- For single words or short phrases: provide the translation and one-line usage example if helpful
- For long texts: translate fully without truncating

**Examples:**

User: "переведи на английский: привет, как дела?"
Response: Hi, how are you?

User: "what does Schadenfreude mean?"
Response: Schadenfreude (German) — pleasure derived from someone else's misfortune.
Example: "She felt a pang of schadenfreude when her rival failed the exam."

User: "как по-испански 'спасибо'?"
Response: Gracias.
