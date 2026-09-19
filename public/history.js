export const HISTORY_KEY = 'bootprint-proposal-history-v2';
export const LEGACY_KEY = 'bootprint-proposal-draft-v1';
export function isDraft(value, requiredKeys) {
  return value?.version === 1 && value.fields && typeof value.fields === 'object' && !Array.isArray(value.fields)
    && Object.keys(value.fields).length < 250 && requiredKeys.every(key => typeof value.fields[key] === 'string')
    && Object.values(value.fields).every(text => typeof text === 'string' && text.length < 30000)
    && Array.isArray(value.review) && value.review.length <= 20
    && value.review.every(note => typeof note?.kind === 'string' && typeof note.detail === 'string' && typeof note.evidence === 'string');
}
export function createRecord(draft, {id = crypto.randomUUID(), now = new Date().toISOString(), origin = 'generated'} = {}) {
  // Deliberately allowlist fields: source transcripts and pasted instructions never enter history.
  return {id, version:1, fields:{...draft.fields}, original:draft.original || null, review:structuredClone(draft.review),
    reviewed:false, model:typeof draft.model === 'string' ? draft.model : null, usage:draft.usage || null,
    generatedAt:draft.generatedAt || null, createdAt:now, updatedAt:now, origin};
}
export function readHistory(storage, requiredKeys) {
  const saved = storage.getItem(HISTORY_KEY);
  if (saved !== null) {
    const data = JSON.parse(saved);
    if (data?.version !== 2 || !Array.isArray(data.items) || !data.items.every(x => isDraft(x, requiredKeys) && typeof x.id === 'string' && /^[a-zA-Z0-9-]+$/.test(x.id))) throw Error('Saved history could not be read. It has not been overwritten.');
    if(new Set(data.items.map(x=>x.id)).size !== data.items.length) throw Error('History contains duplicate IDs. It has not been overwritten.');
    return {items:data.items, migrated:false};
  }
  const old = storage.getItem(LEGACY_KEY);
  if (!old) return {items:[], migrated:false};
  const draft = JSON.parse(old);
  if (!isDraft(draft, requiredKeys)) throw Error('Your earlier draft could not be migrated. It has not been overwritten.');
  return {items:[createRecord(draft, {id:'recovered-draft', origin:'recovered'})], migrated:true};
}
export function writeHistory(storage, items) { storage.setItem(HISTORY_KEY, JSON.stringify({version:2,items})); }
export function upsert(items, record) {
  const previous=items.findIndex(x=>x.id===record.id);
  return previous < 0 ? [...items, record] : items.map((x,i)=>i===previous?record:x);
}
export function findHistory(items, query='', filter='all') {
  return items.filter(x => (x.fields.company || '').toLowerCase().includes(query.trim().toLowerCase())
    && (filter === 'all' || (filter === 'ready' ? x.reviewed : !x.reviewed)))
    .sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
}

export function mergeHistory(existing, incoming) {
  const merged=new Map(existing.map(record=>[record.id,record]));
  for(const record of incoming){const old=merged.get(record.id);if(!old||(record.updatedAt||'') >= (old.updatedAt||''))merged.set(record.id,record);}
  return [...merged.values()];
}
