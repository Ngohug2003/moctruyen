import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloud } from '../src/api/client.ts';

test('sync preserves queued offline progress and uses compare-and-set revisions', async () => {
  const values = new Map();
  const storage = {
    get: async (k) => values.get(k) || null,
    set: async (k, v) => {
      values.set(k, v);
    },
  };
  const original = globalThis.fetch;
  let offline = false,
    revision = 0,
    received = [];
  globalThis.fetch = async (url, options) => {
    if (offline) throw new Error('offline');
    let data;
    if (url.endsWith('/auth/login'))
      data = { token: 'secret', user: { id: 'u', email: 'a@example.com', name: 'A' } };
    else if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body.expected_revision, revision);
      revision++;
      data = { revision };
    } else
      data = {
        items: revision ? [{ book_id: 'b', revision, chapter_id: 'c' }] : [],
        total: revision ? 1 : 0,
      };
    return { ok: true, json: async () => ({ data }) };
  };
  try {
    const cloud = createCloud(storage, storage, 'http://localhost:8000');
    cloud.receive((rows) => {
      received = rows;
    });
    await cloud.login('a@example.com', 'password');
    await cloud.sync();
    offline = true;
    await cloud.queue('b', {
      chapter_id: 'c',
      version: 'v',
      location_kind: 'ratio',
      location_value: 0.2,
    });
    await cloud.sync();
    assert.match(cloud.message, /thiết bị/);
    assert.equal(JSON.parse(values.get('moc-sync-u')).pending.b.location_value, 0.2);
    offline = false;
    await cloud.sync();
    assert.equal(revision, 1);
    assert.equal(received[0].revision, 1);
    assert.deepEqual(JSON.parse(values.get('moc-sync-u')).pending, {});
  } finally {
    globalThis.fetch = original;
  }
});
