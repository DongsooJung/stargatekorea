// The line ending rule of the repository.
//
// Text files are written with CRLF, so the working tree on Windows stays as it
// was written and `git add` does not warn that LF will be replaced by CRLF.
// The repository itself stores them with LF, so the same file has one shape on
// every machine. These tests keep the writers honest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonText, toEol } from '../scripts/text-format.mjs';

test('json is written with CRLF, one trailing newline and no BOM', () => {
  const text = jsonText({ a: 1, b: 'two' });
  assert.equal(/(?<!\r)\n/.test(text), false, 'no bare LF is left in the file');
  assert.equal(text.endsWith('\r\n'), true, 'the file ends with one newline');
  assert.equal(text.startsWith('\uFEFF'), false, 'no BOM');
  assert.deepEqual(JSON.parse(text), { a: 1, b: 'two' }, 'the file is still valid JSON');
});

test('toEol normalises any mix of endings into one ending', () => {
  assert.equal(toEol('a\nb\r\nc'), 'a\r\nb\r\nc');
  assert.equal(toEol('a\r\nb\nc', '\n'), 'a\nb\nc');
  assert.equal(toEol('a\r\nb', '\r\n'), 'a\r\nb', 'an already normalised file is left alone');
});
