// Station 0 — Your document. Paste, upload, or load the sample.

import { el, fill } from '../dom.js';
import { isAcceptedFile, readTextFromFile } from '../fileReader.js';
import { formatNumber } from '../text.js';

export function renderDocumentStation(panel, app) {
  const { state, copy, constants } = app;
  const text = copy.STATION_DOCUMENT;

  const textarea = el('textarea', {
    class: 'document-input',
    id: 'document-text',
    placeholder: text.placeholder,
    'aria-label': text.heading,
    spellcheck: 'false',
  });
  textarea.value = state.document.text;
  textarea.addEventListener('input', () => {
    app.setDocument(textarea.value, text.pastedName);
  });

  const message = el('p', { class: 'message--error', id: 'document-message', role: 'alert' });
  const status = el('span', { class: 'count', id: 'document-count', role: 'status', 'aria-live': 'polite' });

  const fileInput = el('input', {
    type: 'file',
    accept: constants.ACCEPTED_UPLOAD_EXTENSIONS.join(','),
    'aria-label': text.uploadButton,
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    message.textContent = '';
    if (!isAcceptedFile(file.name, constants.ACCEPTED_UPLOAD_EXTENSIONS)) {
      message.textContent = text.rejectedFile;
      return;
    }
    status.textContent = fill(text.reading, { name: file.name });
    try {
      const content = await readTextFromFile(file, { mammothUrl: constants.MAMMOTH_URL });
      textarea.value = content;
      app.setDocument(content, file.name);
    } catch {
      message.textContent = text.readError;
      app.refreshDocumentStatus();
    }
  });

  const sampleButton = el('button', { type: 'button', class: 'button', text: text.sampleButton });
  sampleButton.addEventListener('click', async () => {
    message.textContent = '';
    status.textContent = fill(text.reading, { name: constants.SAMPLE_DOCUMENT_NAME });
    try {
      const response = await fetch(constants.SAMPLE_DOCUMENT_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      textarea.value = content;
      app.setDocument(content, constants.SAMPLE_DOCUMENT_NAME);
    } catch {
      message.textContent = text.sampleError;
      app.refreshDocumentStatus();
    }
  });

  const continueButton = el('button', {
    type: 'button',
    class: 'button button--primary',
    id: 'document-continue',
    text: text.continueButton,
    onclick: () => app.runChunking({ goToStation: true }),
  });

  panel.append(
    el('div', { class: 'callout', role: 'note', text: copy.CALLOUTS.privacy }),
    textarea,
    el('div', { class: 'toolbar' }, [
      el('label', { class: 'button button--file' }, [text.uploadButton, fileInput]),
      sampleButton,
      el('span', { class: 'hint', text: text.uploadHint }),
      el('span', { class: 'toolbar__spacer' }),
      status,
    ]),
    message,
    el('div', { class: 'toolbar' }, [continueButton]),
  );

  app.refreshDocumentStatus();
}

/** Called by main.js whenever the document changes, so the counts stay live
 *  without re-rendering the textarea (which would lose the cursor). */
export function updateDocumentStatus(app) {
  const { state, copy } = app;
  const text = copy.STATION_DOCUMENT;
  const status = document.getElementById('document-count');
  const continueButton = document.getElementById('document-continue');
  if (status) {
    status.textContent = state.document.chars === 0
      ? text.emptyCount
      : fill(text.wordCount, {
        words: formatNumber(state.document.words),
        chars: formatNumber(state.document.chars),
        name: state.document.name,
      });
  }
  if (continueButton) continueButton.disabled = state.document.chars === 0 || !state.dialsValid;
}
