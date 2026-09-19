import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobError } from '@vercel/blob';
import { reserveRun, assertDemoActive, dayKey, demoAvailability } from './demo-limits.mjs';
const now = () => Date.parse('2026-09-22T12:00:00Z');
function store() {
  const files = new Map();
  return { files, putBlob: async (path, value, options) => {
    assert.equal(options.allowOverwrite, false); assert.equal(options.addRandomSuffix, false); assert.equal(options.access, 'private');
    if (files.has(path)) throw new BlobError('This blob already exists, use allowOverwrite');
    files.set(path, value);
    await new Promise(resolve => setImmediate(resolve));
  } };
}
test('concurrent starts across instances admit exactly 20 and never overwrite reservations', async () => {
  const s = store();
  const results = await Promise.allSettled(Array.from({ length: 35 }, () => reserveRun('proposal', { now, putBlob: s.putBlob })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 20);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.status === 429).length, 15);
  assert.equal(s.files.size, 20);
  await assert.rejects(reserveRun('proposal', { now, putBlob: s.putBlob }), { status: 429 });
});
test('date rolls over at New York midnight and expiry is inclusive of September 25', async () => {
  assert.equal(dayKey(Date.parse('2026-09-23T03:59:59Z')), '2026-09-22');
  assert.equal(dayKey(Date.parse('2026-09-23T04:00:00Z')), '2026-09-23');
  assert.doesNotThrow(() => assertDemoActive(Date.parse('2026-09-26T03:59:59.999Z')));
  assert.throws(() => assertDemoActive(Date.parse('2026-09-26T04:00:00Z')), { status: 410 });
  let writes = 0;
  await assert.rejects(reserveRun('proposal', { now: () => Date.parse('2026-09-26T04:00:00Z'), putBlob: async () => { writes++; } }), { status: 410 });
  assert.equal(writes, 0);
});
test('new day gets a new allowance; projects have independent allowances', async () => {
  const s = store();
  for (let i = 0; i < 20; i++) await reserveRun('proposal', { now, putBlob: s.putBlob });
  assert.equal((await reserveRun('sdr', { now, putBlob: s.putBlob })).slot, 1);
  assert.equal((await reserveRun('proposal', { now: () => now() + 86400000, putBlob: s.putBlob })).slot, 1);
});
test('storage outages fail closed and status cannot misreport them as free capacity', async () => {
  const fail = async () => { throw Error('private backend detail'); };
  await assert.rejects(reserveRun('proposal', { now, putBlob: fail }), error => error.status === 503 && !error.message.includes('private'));
  const state = await demoAvailability('proposal', { now: now(), listBlobs: fail });
  assert.equal(state.available, false); assert.equal(state.remaining, null);
});
test('expiry crossing during reservation blocks paid work and status needs no storage after expiry', async () => {
  let clock = Date.parse('2026-09-26T03:59:59Z');
  await assert.rejects(reserveRun('proposal', { now: () => clock, putBlob: async () => { clock += 1000; } }), { status: 410 });
  const state = await demoAvailability('proposal', { now: clock, listBlobs: async () => { throw Error('must not call'); } });
  assert.equal(state.expired, true); assert.equal(state.available, false);
});
