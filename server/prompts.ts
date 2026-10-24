// One entry per AI feature. `paper: false` skips attaching the PDF.
export type Prompt = {
  system: (lang: string) => string;
  user: (args: Record<string, any>) => string;
  paper?: false;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
};

const base = (lang: string) => `You are an AI research colleague helping a reader understand an academic paper. Answer in ${lang}. Be accurate and grounded in the paper; say so when the paper does not cover something. Use Markdown, and LaTeX between $...$ for math.`;

export const PROMPTS: Record<string, Prompt> = {
  summary: {
    system: base,
    user: ({ lang }) => `Read the paper and produce:
- keywords: 6-10 important technical terms in the paper, each with a one-sentence definition in ${lang} specific to how this paper uses it.
- summary: a Markdown summary in ${lang} with sections "## Problem", "## Method", "## Results", "## Contributions", "## Limitations".
- questions: 3 short questions a reader might want to ask about this paper, in ${lang}.`,
  },
  explain: {
    system: base, effort: 'low',
    user: ({ text, lang }) => `Explain this passage from the paper in plain ${lang}. Break down difficult terms and formulas step by step, and connect it to the surrounding context of the paper.\n\n<passage>\n${text}\n</passage>`,
  },
  explainImage: {
    system: base,
    user: ({ lang }) => `The image is a region the reader selected from the paper (a figure, table, or equation). Explain in ${lang} what it shows, how to read it, and what it means for the paper's argument.`,
  },
  translate: {
    paper: false, effort: 'low',
    system: (lang: string) => `You are a professional translator of academic papers. Translate into natural, fluent ${lang}, keeping technical terms accurate (keep the original term in parentheses on first use when helpful). Output only the translation.`,
    user: ({ text }) => text,
  },
  translateBlocks: {
    paper: false, effort: 'low',
    system: (lang: string) => `You translate academic paper text blocks into natural ${lang}. Keep math, citations like [12], and numbers unchanged.`,
    user: ({ blocks }) => `Translate each block. Return the same number of items in the same order.\n\n${JSON.stringify(blocks)}`,
  },
  autoHighlight: {
    system: base,
    user: () => `Pick the 12-20 most important sentences of the paper and copy each one VERBATIM from the paper text (exact characters, a single sentence, no ellipsis). Categorize each as "novelty" (main contribution/innovation), "method" (key method detail) or "result" (key finding/result).`,
  },
  chat: {
    system: base,
    user: () => '',
  },
  discussion: {
    system: base,
    user: ({ lang }) => `Act as a critical but fair peer reviewer. In ${lang}, write a discussion of this paper in Markdown with sections: "## Strengths", "## Weaknesses & open questions", "## How it relates to prior work", "## Ideas for follow-up research". Be specific and cite sections, figures, or tables.`,
  },
  citation: {
    system: base, effort: 'low',
    user: ({ text, context, lang }) => `The reader clicked the citation "${text}" in this sentence:\n"${context}"\n\nFind the matching entry in the paper's reference list. Reply in ${lang} with Markdown:\n**Reference:** the full reference entry as written\n**What it is:** one or two sentences on what that cited work is about (say if you are unsure)\n**Why it is cited here:** how this paper uses it in that sentence.`,
  },
  infographic: {
    effort: 'medium',
    system: (lang: string) => `You design clear, compact educational infographics. Output ONLY one self-contained <svg> element (viewBox 0 0 800 600, no scripts, no external resources, system-ui font). Text in ${lang}.`,
    user: ({ text, palette = '#135D66 (accent), #252B2A (text), #E3FEF7 (highlight), #F7F6F2 (background)' }) => `Use the palette ${palette}. Make an infographic that visually explains this concept from the paper (flow, comparison, or structure diagram as fits):\n\n${text}`,
  },
};

export const SCHEMAS: Record<string, object> = {
  summary: {
    type: 'object', additionalProperties: false, required: ['keywords', 'summary', 'questions'],
    properties: {
      keywords: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['term', 'definition'], properties: { term: { type: 'string' }, definition: { type: 'string' } } } },
      summary: { type: 'string' },
      questions: { type: 'array', items: { type: 'string' } },
    },
  },
  autoHighlight: {
    type: 'object', additionalProperties: false, required: ['highlights'],
    properties: { highlights: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'category'], properties: { text: { type: 'string' }, category: { type: 'string', enum: ['novelty', 'method', 'result'] } } } } },
  },
  translateBlocks: {
    type: 'object', additionalProperties: false, required: ['translations'],
    properties: { translations: { type: 'array', items: { type: 'string' } } },
  },
};
