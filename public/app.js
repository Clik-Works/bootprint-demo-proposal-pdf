import {isDraft,createRecord,readHistory,writeHistory,upsert,findHistory,mergeHistory} from './history.js';
const $=id=>document.getElementById(id);
let items=[],requiredKeys=[],activeId=null,editorReady=false,valid=false,busy=false,authenticated=false,configured=false,storageBlocked=false,reviewOpen=true,startedAt=0,ticker,unsaved=false;
const current=()=>items.find(x=>x.id===activeId);
const post=(type,data={})=>$('editor').contentWindow?.postMessage({source:'bootprint-app',type,...data},location.origin);
function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
function persist(){
  try{items=mergeHistory(readHistory(localStorage,requiredKeys).items,items);writeHistory(localStorage,items);unsaved=false;storageBlocked=false;$('draftStatus').textContent='All changes saved';$('saveIndicator').textContent='Saved in this browser';$('saveIndicator').classList.remove('unsaved');if($('notice').textContent.startsWith('Your changes could not be saved'))notice('');}
  catch{unsaved=true;$('draftStatus').textContent='Not saved';$('saveIndicator').textContent='Changes not saved';$('saveIndicator').classList.add('unsaved');notice('Your changes could not be saved in this browser. Try Save again, or download a backup from History before closing this tab.');}
  drawSidebarHistory();
  return !unsaved;
}
function updateRecord(patch,{edited=false}={}){const record=current();if(!record)return;items=upsert(items,{...record,...patch,...(edited?{updatedAt:new Date().toISOString()}: {})});persist();controls();}
function controls(){const r=current();$('export').disabled=!r||!valid;$('reviewed').checked=!!r?.reviewed;$('generate').disabled=busy||!configured;$('generate').textContent=busy?'Proposal in progress…':'Create proposal →';$('runningLink').hidden=!busy;}
function reviewUI(){
  const r=current();if(!r)return;$('reviewList').replaceChildren();
  if(!r.review.length){const p=document.createElement('p');p.className='muted small';p.textContent='No source notes were included in this draft. Check the scope, timeline, and costs before sharing.';$('reviewList').append(p);}
  for(const note of r.review){const item=document.createElement('div');item.className='review-item '+(note.kind==='conflict'?'conflict':note.kind==='source'?'source':'assumption');const kind=document.createElement('span');kind.className='note-kind';kind.textContent=note.kind.replaceAll('_',' ');const detail=document.createElement('p');detail.textContent=note.detail;const evidence=document.createElement('small');evidence.textContent=note.evidence;item.append(kind,detail,evidence);$('reviewList').append(item);}
  $('reviewCount').textContent=r.review.length;$('proposalTitle').textContent=r.fields.company||'Untitled proposal';$('resultDate').textContent='Created '+formatDate(r.createdAt);controls();
}
function setReview(open){reviewOpen=open;$('reviewPanel').hidden=!open;$('reviewToggle').setAttribute('aria-expanded',String(open));$('resultLayout').classList.toggle('review-hidden',!open);}
function formatDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
function formatUpdated(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return 'Date unavailable';const today=new Date();return d.toDateString()===today.toDateString()?'Today, '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}):formatDate(value);}
function makeText(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
function drawSidebarHistory(){
  $('historyCount').textContent=items.length;
  $('sidebarHistory').hidden=!items.length;
  $('allHistory').hidden=items.length<=5;
  const list=$('recentCompanies');list.replaceChildren();
  for(const row of findHistory(items).slice(0,5)){
    const item=document.createElement('li'),link=document.createElement('a');
    const company=row.fields.company||'Untitled proposal',date=new Date(row.updatedAt);
    const stamp=Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',...(date.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})});
    link.href='#/proposal/'+row.id;link.title=company+' · Edited '+stamp;
    const time=makeText('time',stamp);time.dateTime=row.updatedAt||'';
    link.append(makeText('span',company),time);item.append(link);list.append(item);
  }
}
function drawHistory(){
  const rows=findHistory(items,$('search').value,$('historyFilter').value);$('historyList').replaceChildren();$('historyEmpty').hidden=items.length!==0;$('noResults').hidden=items.length===0||rows.length!==0;$('resultCount').textContent=rows.length+' proposal'+(rows.length===1?'':'s');drawSidebarHistory();
  for(const row of rows){const card=document.createElement('article');card.className='proposal-card';const top=makeText('div','','proposal-card-top');top.append(makeText('span','▤','doc-icon'),makeText('span',row.reviewed?'Reviewed':'Draft','status-pill'+(row.reviewed?' reviewed':'')));const heading=document.createElement('h2'),link=makeText('a',row.fields.company||'Untitled proposal');link.href='#/proposal/'+row.id;heading.append(link);const sub=makeText('p',row.origin==='recovered'?'Recovered from your earlier draft':row.origin==='imported'?'Imported proposal · 4 A4 pages':'Cold email marketing pilot · 4 A4 pages','subtitle');const metrics=makeText('div','','card-metrics');for(const [field,label]of [['leads','Leads'],['duration','Duration'],['fee','Pilot fee']]){const metric=document.createElement('div');metric.append(makeText('b',row.fields[field]||'—'),makeText('span',label));metrics.append(metric);}const footer=makeText('div','','card-footer');const time=makeText('time','Edited '+formatUpdated(row.updatedAt));time.dateTime=row.updatedAt||'';const open=makeText('a','Open proposal →');open.href=link.href;const backup=makeText('button','Download draft');backup.className='history-download';backup.onclick=()=>downloadDraft(row);footer.append(time,backup,open);card.append(top,heading,sub,metrics,footer);$('historyList').append(card);}
}
function loadEditor(){
  const r=current();if(!r)return;valid=false;controls();$('fitMessage').textContent='Preparing the document…';
  if($('editor').getAttribute('src')==='about:blank'){$('editor').src='/editor.html';editorReady=false;}
  else if(editorReady)post('load',{fields:r.fields,reviewed:r.reviewed,documentId:r.id});
}
function navigate(route){if(location.hash===route)renderRoute();else location.hash=route;}
function renderRoute(){
  if(!authenticated)return;
  if(activeId&&unsaved&&(location.hash||'#/new')!=='#/proposal/'+activeId){if(!confirm('Your latest changes have not been saved. Stay here and try Save again, or leave anyway? Choose Cancel to stay.')){history.replaceState(null,'','#/proposal/'+activeId);return;}}
  for(const id of ['newPage','historyPage','preparingPage','resultPage','missingPage'])$(id).hidden=true;
  const route=location.hash||'#/new';let label='New proposal';$('navNew').classList.toggle('active',route==='#/new'||route==='#/preparing');$('navHistory').classList.toggle('active',route==='#/history'||route.startsWith('#/proposal/'));
  if(route==='#/history'){$('historyPage').hidden=false;label='History';activeId=null;drawHistory();}
  else if(route==='#/preparing'&&busy){$('preparingPage').hidden=false;label='Preparing proposal';activeId=null;}
  else if(route.startsWith('#/proposal/')){const id=route.slice(11),record=items.find(x=>x.id===id);if(record){const changed=activeId!==id;activeId=id;$('resultPage').hidden=false;label='Proposal';reviewUI();if(changed||!editorReady)loadEditor();else post('review',{reviewed:record.reviewed});setReview(reviewOpen);}else{$('missingPage').hidden=false;label='Proposal not found';activeId=null;}}
  else{$('newPage').hidden=false;activeId=null;if(route==='#/preparing')notice('The generation session is no longer active. Check History for completed proposals, or start a new one.');}
  document.body.classList.toggle('document-mode',!$('resultPage').hidden);$('routeLabel').textContent=label;document.title=(current()?.fields.company||label)+' · Clickworks';window.scrollTo(0,0);controls();
}
window.addEventListener('hashchange',renderRoute);
window.addEventListener('storage',event=>{if(event.key!=='bootprint-proposal-history-v2')return;try{items=mergeHistory(items,readHistory(localStorage,requiredKeys).items);drawSidebarHistory();if(location.hash==='#/history')drawHistory();else if(activeId)notice('History changed in another tab. Reopen this proposal from History to load the latest saved version.');}catch{notice('Could not refresh history from another tab. Your open draft is unchanged.');}});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==$('editor').contentWindow||e.data?.source!=='bootprint-editor')return;const m=e.data;
  if(m.type==='ready'){editorReady=true;if(current())loadEditor();return;}
  if(!activeId||m.documentId!==activeId)return;
  if(m.type==='snapshot')updateRecord({fields:m.fields});
  if(m.type==='changed'){updateRecord({fields:m.fields,reviewed:false},{edited:true});$('proposalTitle').textContent=m.fields.company||'Untitled proposal';document.title=(m.fields.company||'Proposal')+' · Clickworks';}
  if(m.type==='fit'){valid=m.valid;$('fitMessage').textContent=m.text;$('fitMessage').classList.toggle('invalid',!valid);controls();}
  if(m.type==='page')for(const b of document.querySelectorAll('[data-page]'))b.classList.toggle('active',Number(b.dataset.page)===m.page);
});
async function api(action,data){const r=await fetch('/api/service?action='+action,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});let result;try{result=await r.json();}catch{throw Error('The server could not complete this request. Please try again.');}if(!r.ok)throw Error(result.error||'Request failed');return result;}
async function status(){const s=await api('status');authenticated=s.authenticated;configured=s.configured;if(!authenticated)document.body.classList.remove('document-mode');$('loginPanel').hidden=authenticated;$('app').hidden=!authenticated;$('connection').textContent=configured?'Ready to create':'API key needed';if(authenticated)renderRoute();}
$('loginForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await api('login',{password:$('password').value});$('password').value='';$('loginError').textContent='';await status();}catch(err){$('loginError').textContent=err.message;}finally{button.disabled=false;}};
$('logout').onclick=async()=>{if(busy){notice('Wait for the active proposal to finish before signing out.');return;}try{await api('logout',{});$('transcript').value='';$('notes').value='';$('company').value='';$('transcript').oninput();activeId=null;editorReady=false;$('editor').src='about:blank';await status();}catch(err){notice(err.message);}};
$('transcript').oninput=()=>{$('charCount').textContent=$('transcript').value.length.toLocaleString()+' / 100,000';};
async function acceptTranscript(file){if(!file)return;if(!file.name.toLowerCase().endsWith('.txt')){$('generationStatus').textContent='Choose a plain-text (.txt) transcript.';return;}if(file.size>400000){$('generationStatus').textContent='Use a text file under 400 KB.';return;}const text=await file.text();if(text.length>100000){$('generationStatus').textContent='The transcript exceeds 100,000 characters.';return;}$('transcript').value=text;$('transcript').oninput();$('fileName').textContent=file.name;$('generationStatus').textContent='';}
$('transcriptFile').onchange=async e=>{try{await acceptTranscript(e.target.files[0]);}catch{$('generationStatus').textContent='The file could not be read. Try pasting the text instead.';}e.target.value='';};
for(const event of ['dragenter','dragover'])$('generateForm').addEventListener(event,e=>{e.preventDefault();$('generateForm').classList.add('dragging');});
$('generateForm').addEventListener('dragleave',()=>$('generateForm').classList.remove('dragging'));
$('generateForm').addEventListener('drop',async e=>{e.preventDefault();$('generateForm').classList.remove('dragging');try{await acceptTranscript(e.dataTransfer.files[0]);}catch{$('generationStatus').textContent='Could not read that file.';}});
$('generateForm').onsubmit=async e=>{
  e.preventDefault();if(busy)return;const transcript=$('transcript').value.trim();if(transcript.length<80){$('generationStatus').textContent='Add at least 80 characters of call notes.';$('transcript').focus();return;}
  const notes=[$('company').value.trim()?'Client company name: '+$('company').value.trim():'',$('notes').value.trim()].filter(Boolean).join('\n');
  busy=true;startedAt=Date.now();$('generationStatus').textContent='';notice('');controls();navigate('#/preparing');$('elapsed').textContent='0:00';ticker=setInterval(()=>{const s=Math.floor((Date.now()-startedAt)/1000);$('elapsed').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');},1000);
  try{const result=await api('generate',{transcript,notes});const draft={version:1,fields:result.proposal,original:result.proposal,review:result.review,model:result.model,usage:result.usage,generatedAt:new Date().toISOString()};if(!isDraft(draft,requiredKeys))throw Error('The draft could not be opened. Your earlier proposals are unchanged.');const record=createRecord(draft);items=upsert(items,record);persist();busy=false;reviewOpen=true;$('transcript').value='';$('notes').value='';$('company').value='';$('fileName').textContent='Paste notes or drop a .txt file here';$('transcript').oninput();navigate('#/proposal/'+record.id);}
  catch(err){busy=false;navigate('#/new');$('generationStatus').textContent=err.message;notice('We couldn’t finish this proposal. Your input is still here, and your saved proposals are unchanged.');}
  finally{busy=false;clearInterval(ticker);controls();}
};
$('reviewed').onchange=()=>{if(!current())return;updateRecord({reviewed:$('reviewed').checked},{edited:true});post('review',{reviewed:current().reviewed});};
$('reviewToggle').onclick=()=>setReview(!reviewOpen);
$('export').onclick=()=>post('print');$('undo').onclick=()=>post('undo');$('restore').onclick=()=>post('restore');$('zoom').onchange=()=>post('zoom',{value:$('zoom').value});
for(const b of document.querySelectorAll('[data-page]'))b.onclick=()=>post('page',{page:Number(b.dataset.page)});
function downloadDraft(record){if(!record)return;const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=(record.fields.company||'proposal').replace(/[^a-zA-Z0-9_-]/g,'-')+'-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>{persist();};
$('homeButton').onclick=()=>navigate('#/new');
for(const id of ['importNew','importHistory'])$(id).onclick=()=>$('draftFile').click();
$('draftFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>1500000)throw Error('Draft file is too large.');const data=JSON.parse(await f.text());if(!isDraft(data,requiredKeys))throw Error('Choose a valid Clickworks draft JSON file.');const record=createRecord(data,{origin:'imported'});items=upsert(items,record);persist();reviewOpen=true;navigate('#/proposal/'+record.id);}catch(err){notice(err.message);}e.target.value='';};
$('search').oninput=drawHistory;$('historyFilter').onchange=drawHistory;$('resetSearch').onclick=()=>{$('search').value='';$('historyFilter').value='all';drawHistory();};
window.addEventListener('beforeunload',e=>{if(busy||unsaved){e.preventDefault();e.returnValue='';}});
async function init(){
  requiredKeys=Object.keys(await(await fetch('/defaults.json')).json());
  try{const saved=readHistory(localStorage,requiredKeys);items=saved.items;if(saved.migrated){persist();notice('Your previous browser draft is now in History.');}}
  catch(err){storageBlocked=true;notice(err.message||'Browser history is unavailable. Download drafts to keep them.');}
  drawSidebarHistory();await status();
}
init().catch(err=>{$('loginPanel').hidden=false;$('loginError').textContent=err.message;$('connection').textContent='Connection unavailable';});
