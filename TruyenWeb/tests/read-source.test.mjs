import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLocalFirst } from '../src/domain/read-source.ts';

test('local reading returns without contacting an unavailable backend', async () => {
  let calls = 0;
  const chapter = { id: 'chapter-1', content: 'Nội dung đã lưu' };
  const result = await readLocalFirst(
    async () => chapter,
    async () => {
      calls++;
      throw new Error('API unavailable');
    },
  );
  assert.equal(result, chapter);
  assert.equal(calls, 0);
});

test('missing local data falls back to the API', async () => {
  const calls = [];
  const result = await readLocalFirst(
    async () => {
      calls.push('json');
      throw new Error('Missing chunk');
    },
    async () => {
      calls.push('api');
      return 'Chương trên máy chủ';
    },
  );
  assert.equal(result, 'Chương trên máy chủ');
  assert.deepEqual(calls, ['json', 'api']);
});

test('missing JSON and unavailable API produce a retryable error', async () => {
  await assert.rejects(
    readLocalFirst(
      async () => {
        throw new Error('Missing JSON');
      },
      async () => {
        throw new Error('API unavailable');
      },
    ),
    /API unavailable/,
  );
});
