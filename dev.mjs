import http from 'node:http';
import {readFile} from 'node:fs/promises';
import handler from './api/service.js';
const port=Number(process.env.PORT||8780);
http.createServer(async(req,res)=>{
 res.status=n=>(res.statusCode=n,res);res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(req.url.startsWith('/api/service')){let raw='';for await(const part of req){raw+=part;if(raw.length>220000){res.status(413).json({error:'Too large'});return;}}req.body=raw;return handler(req,res);}
 const path=new URL(req.url,'http://localhost').pathname;const files={'/':'index.html','/app.js':'app.js','/history.js':'history.js','/app.css':'app.css','/editor.html':'editor.html','/editor.js':'editor.js','/proposal.css':'proposal.css','/defaults.json':'defaults.json'};
 if(!files[path])return res.status(404).end();
 const ext=files[path].split('.').pop();res.setHeader('Content-Type',{html:'text/html',js:'text/javascript',css:'text/css',json:'application/json'}[ext]);res.setHeader('Cache-Control','no-store');res.end(await readFile(new URL('./public/'+files[path],import.meta.url)));
}).listen(port,'127.0.0.1',()=>console.log(`Bootprint demo at http://127.0.0.1:${port}`));
