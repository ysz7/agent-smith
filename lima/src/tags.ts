// Simple tag extraction — no API calls, no external models
// Extracts meaningful English keywords from text

const STOP_WORDS = new Set([
  // English
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','can',
  'not','no','nor','so','yet','both','either','neither','each','few','more',
  'most','other','some','such','than','then','that','this','these','those',
  'i','me','my','we','our','you','your','he','him','his','she','her','it',
  'its','they','them','their','what','which','who','whom','when','where',
  'why','how','all','any','there','here','about','just','also','very',
  'up','out','if','as','into','through','after','before','between','same',
  // Russian
  'и','в','на','с','по','за','из','к','о','об','от','до','при','что','как',
  'это','не','но','а','же','ли','бы','то','все','я','ты','он','она','мы',
  'вы','они','мне','тебе','ему','ей','нам','вам','им','меня','тебя','его',
  'её','нас','вас','их','был','была','было','были','быть','есть','нет',
])

export function extractTags(text: string, maxTags = 10): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-zа-яёa-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))

  // Count frequency
  const freq = new Map<string, number>()
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1)
  }

  // Sort by frequency, return top N
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([word]) => word)
}

export function chunkText(text: string, chunkSize = 200, overlap = 20): string[] {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim()) chunks.push(chunk)
    i += chunkSize - overlap
  }
  return chunks
}
