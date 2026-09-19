import { put, list, BlobError } from '@vercel/blob';

export const DAILY_RUN_LIMIT = 20;
export const DEMO_TIME_ZONE = 'America/New_York';
// Available through September 25, 2026, inclusive (EDT).
export const DEMO_EXPIRES_AT = '2026-09-26T04:00:00.000Z';
export class DemoLimitError extends Error {
  constructor(message, status) { super(message); this.name = 'DemoLimitError'; this.status = status; }
}
export function assertDemoActive(now = Date.now()) {
  if (now >= Date.parse(DEMO_EXPIRES_AT)) throw new DemoLimitError('This demo expired on September 25, 2026. New runs are disabled.', 410);
}
export function dayKey(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DEMO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
function prefix(project, now) {
  if (!/^[a-z0-9-]+$/.test(project)) throw new Error('Invalid quota project.');
  return `demo-quota-v1-${project}-${dayKey(now)}-slot-`;
}
// Twenty immutable slots make the limit atomic across browsers, instances and deploys.
// Reserve before paid work; failed/abandoned starts keep their slot to bound spend.
export async function reserveRun(project, { now = Date.now, putBlob = put } = {}) {
  assertDemoActive(now());
  const keyPrefix = prefix(project, now());
  for (let slot = 1; slot <= DAILY_RUN_LIMIT; slot++) {
    assertDemoActive(now());
    try {
      await putBlob(`${keyPrefix}${String(slot).padStart(2, '0')}.json`, JSON.stringify({ reservedAt: new Date(now()).toISOString() }), {
        access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', abortSignal: AbortSignal.timeout(10000),
      });
      assertDemoActive(now());
      if (keyPrefix !== prefix(project, now())) return reserveRun(project, { now, putBlob });
      return { slot, day: dayKey(now()) };
    } catch (error) {
      if (error instanceof BlobError && error.message.startsWith('Vercel Blob: This blob already exists,')) continue;
      if (error instanceof DemoLimitError) throw error;
      throw new DemoLimitError('The run limit could not be checked. No run was started. Please try again later.', 503);
    }
  }
  throw new DemoLimitError('The daily limit of 20 runs has been reached. It resets at midnight New York time.', 429);
}
export async function demoAvailability(project, { now = Date.now(), listBlobs = list } = {}) {
  const base = { limit: DAILY_RUN_LIMIT, timeZone: DEMO_TIME_ZONE, expiresAt: DEMO_EXPIRES_AT };
  if (now >= Date.parse(DEMO_EXPIRES_AT)) return { ...base, available: false, expired: true, remaining: 0, message: 'Demo expired · September 25, 2026' };
  try {
    const result = await listBlobs({ prefix: prefix(project, now), limit: 100, abortSignal: AbortSignal.timeout(10000) });
    const used = result.blobs.filter(blob => /-slot-(0[1-9]|1[0-9]|20)\.json$/.test(blob.pathname)).length;
    const remaining = Math.max(0, DAILY_RUN_LIMIT - used);
    return { ...base, available: remaining > 0, expired: false, remaining, message: remaining ? `${remaining} of 20 runs left today · Ends Sep 25 · New York time` : 'Daily limit reached · Resets at midnight New York time' };
  } catch {
    return { ...base, available: false, expired: false, remaining: null, message: 'Run limit unavailable. Please try again later.' };
  }
}
