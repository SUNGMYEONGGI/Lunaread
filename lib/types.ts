export type Rect = { x: number; y: number; w: number; h: number };
export type Item = Rect & { str: string; eol?: boolean; rot?: boolean };
export type Mark = { id: string; page: number; rects: Rect[]; text: string; color: string; note: string; at: number };
export type CardType = 'explain' | 'translate' | 'image' | 'citation' | 'infographic';
export type Card = { id: string; type: CardType; src?: string; image?: string; page?: number; at: number; pending?: boolean; body?: string; error?: string };
export type ChatMsg = { role: 'user' | 'assistant'; content: string; at: number; error?: string };
export type Summary = { keywords: { term: string; definition: string }[]; summary: string; questions: string[] };
export type AutoHl = { text: string; category: 'novelty' | 'method' | 'result'; page?: number; rects?: Rect[] };
export type Block = Rect & { text: string; lineH: number };
export type Doc = {
  id: string; title: string; url?: string; addedAt: number; openedAt?: number; folder: string;
  marks: Mark[]; chat: ChatMsg[]; cards: Card[]; translations: Record<number, string>;
  thumb?: string; pages?: number; lastPage?: number; summary?: Summary; auto?: AutoHl[]; discussion?: string;
  citations?: Record<string, string>; fileId?: string; fullText?: string;
};
export type Provider = 'claude-sub' | 'codex-sub' | 'anthropic-api' | 'openai-api';
export type ModelChoice = { provider: Provider; model: string };
export type Settings = ModelChoice & { apiKey: string; openaiKey: string; lang: string; theme: 'light' | 'dark'; palette: string | null; server: string };
export type ProviderInfo = { id: Provider; label: string; models: { id: string; label: string }[]; error?: string };
