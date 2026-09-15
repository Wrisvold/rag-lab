// Reads an uploaded .txt, .md, or .docx file into plain text.
// The .docx path loads mammoth from the CDN the first time it is needed.

import { normalizeNewlines } from './text.js';

/** ".docx" from "Handbook.DOCX"; "" when there is no extension. */
export function fileExtension(name) {
  const match = /\.[^./\\]+$/.exec(name || '');
  return match ? match[0].toLowerCase() : '';
}

export function isAcceptedFile(name, acceptedExtensions) {
  return acceptedExtensions.includes(fileExtension(name));
}

/**
 * @param {File} file
 * @param {{ mammothUrl: string }} options
 * @returns {Promise<string>}
 */
export async function readTextFromFile(file, { mammothUrl }) {
  if (fileExtension(file.name) === '.docx') {
    const mammoth = await loadMammoth(mammothUrl);
    const arrayBuffer = await file.arrayBuffer();
    // extractRawText walks every paragraph, including the ones inside table
    // cells, and separates paragraphs with blank lines.
    const result = await mammoth.extractRawText({ arrayBuffer });
    return normalizeNewlines(result.value);
  }
  return normalizeNewlines(await file.text());
}

let mammothLoading = null;

function loadMammoth(url) {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothLoading) {
    mammothLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => (window.mammoth ? resolve(window.mammoth) : reject(new Error('mammoth did not initialise')));
      script.onerror = () => {
        mammothLoading = null;
        reject(new Error('mammoth failed to load'));
      };
      document.head.append(script);
    });
  }
  return mammothLoading;
}
