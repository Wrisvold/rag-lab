import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileExtension, isAcceptedFile } from '../js/fileReader.js';
import { ACCEPTED_UPLOAD_EXTENSIONS } from '../js/constants.js';

test('fileExtension', () => {
  assert.equal(fileExtension('Handbook.DOCX'), '.docx');
  assert.equal(fileExtension('notes.md'), '.md');
  assert.equal(fileExtension('archive.tar.gz'), '.gz');
  assert.equal(fileExtension('noextension'), '');
  assert.equal(fileExtension(''), '');
});

test('isAcceptedFile against the configured list', () => {
  assert.equal(isAcceptedFile('a.txt', ACCEPTED_UPLOAD_EXTENSIONS), true);
  assert.equal(isAcceptedFile('a.docx', ACCEPTED_UPLOAD_EXTENSIONS), true);
  assert.equal(isAcceptedFile('a.pdf', ACCEPTED_UPLOAD_EXTENSIONS), false);
  assert.equal(isAcceptedFile('a.doc', ACCEPTED_UPLOAD_EXTENSIONS), false);
});
