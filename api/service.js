import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {generate} from '../lib/generation.mjs';
import {assertDemoActive,reserveRun,demoAvailability} from '../lib/demo-limits.mjs';
const COOKIE='bootprint_session';
function equal(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&timingSafeEqual(aa,bb);}
function sign(s){return createHmac('sha256',process.env.DEMO_PASSWORD).update(s).digest('base64url');}
function session(req){try{const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);const [body,sig]=token.split('.');if(!equal(sign(body),sig))return false;const data=JSON.parse(Buffer.from(body,'base64url'));return data.exp>Date.now()&&data.exp<Date.now()+13*3600000;}catch{return false;}}
function cookie(value,age){return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.VERCEL?' ; Secure':''}`;}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const send=(status,data)=>res.status(status).json(data);
 if(!process.env.DEMO_PASSWORD||process.env.DEMO_PASSWORD.length<20)return send(503,{error:'Demo access is not configured.'});
 const action=new URL(req.url,'http://localhost').searchParams.get('action');
 if(req.method==='GET'&&action==='status')return send(200,{authenticated:session(req),configured:!!process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-5.4',demo:session(req)?await demoAvailability('proposal'):undefined});
 if(req.method!=='POST')return send(405,{error:'Method not allowed.'});
 const origin=req.headers.origin;const host=req.headers.host;
 let sameOrigin=false;try{sameOrigin=!!origin&&new URL(origin).host===host;}catch{}
 if(!sameOrigin)return send(403,{error:'Request origin is not allowed.'});
 if(!(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'JSON required.'});
 if(Number(req.headers['content-length'])>220000)return send(413,{error:'Input is too large.'});
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return send(400,{error:'Invalid JSON.'});}
 if(action==='login'){
  if(typeof body?.password!=='string'||body.password.length>256||!equal(body.password,process.env.DEMO_PASSWORD))return send(401,{error:'Incorrect demo password.'});
  const token=Buffer.from(JSON.stringify({exp:Date.now()+12*3600000,id:randomBytes(16).toString('hex')})).toString('base64url');res.setHeader('Set-Cookie',cookie(token+'.'+sign(token),43200));return send(200,{ok:true});
 }
 if(!session(req))return send(401,{error:'Sign in to generate proposals.'});
 if(action==='logout'){res.setHeader('Set-Cookie',cookie('',0));return send(200,{ok:true});}
 if(action!=='generate')return send(404,{error:'Not found.'});
 try{assertDemoActive();}catch(err){return send(err.status,{error:err.message});}
 if(!process.env.OPENAI_API_KEY)return send(503,{error:'Add OPENAI_API_KEY to this Vercel project, then redeploy.'});
 if(typeof body?.transcript!=='string'||body.transcript.trim().length<80||body.transcript.length>100000||typeof body.notes!=='string'||body.notes.length>4000)return send(400,{error:'Use a transcript of 80–100,000 characters and notes of at most 4,000 characters.'});
 try{await reserveRun('proposal');assertDemoActive();return send(200,await generate(body.transcript,body.notes));}catch(err){return send(err.status||502,{error:err.name==='TimeoutError'?'Generation timed out. Your draft is unchanged. Try shorter input.':err.message});}
}
