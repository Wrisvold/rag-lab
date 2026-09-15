// Artifact 4: the assembled prompt. Pure, no DOM.
//
// The prompt is three blocks, in this order, exactly as the course teaches:
//   1. the instruction
//   2. the retrieved passages, each labelled [Passage n]
//   3. the question
// Nothing else goes in. This text is what a language model would receive.

/**
 * @param {{ instruction: string, passages: { text: string }[], question: string }} parts
 * @returns {string}
 */
export function buildPrompt({ instruction, passages, question }) {
  const blocks = [];
  blocks.push((instruction || '').trim());
  blocks.push(formatPassages(passages));
  blocks.push(`Question: ${(question || '').trim()}`);
  return blocks.filter((block) => block.length > 0).join('\n\n');
}

/** The passages block on its own: "[Passage 1]\ntext\n\n[Passage 2]\ntext" */
export function formatPassages(passages) {
  return (passages || [])
    .map((passage, i) => `[Passage ${i + 1}]\n${(passage.text || '').trim()}`)
    .join('\n\n');
}

/**
 * A rough token count. Language models split text into tokens of about four
 * characters of English each; the exact number depends on the model.
 */
export function estimateTokens(text, charsPerToken = 4) {
  const length = (text || '').length;
  return length === 0 ? 0 : Math.ceil(length / charsPerToken);
}
