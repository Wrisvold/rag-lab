// Tiny pure text helpers shared by several stations.

/** Count words the way a word processor would: runs of non-space characters. */
export function countWords(text) {
  const trimmed = (text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Convert Windows and old Mac line endings to plain newlines so character
 *  positions are the same on every computer. */
export function normalizeNewlines(text) {
  return (text || '').replace(/\r\n?/g, '\n');
}

/** 1284 -> "1,284" */
export function formatNumber(value) {
  return Number(value).toLocaleString('en-US');
}

/** Pad a chunk number so lists line up: (7, 20) -> "07" */
export function padNumber(value, total) {
  return String(value).padStart(String(total).length, '0');
}
