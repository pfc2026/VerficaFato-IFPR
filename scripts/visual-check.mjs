// Local visual QA fixture. No database, secrets, Google or LLM calls.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { analisarConteudo } from '../services/analysis.js';
import { generateExplanation } from '../services/explanation.js';
const root = process.cwd();
const artifacts = path.join(root,'.artifacts');
await mkdir(artifacts,{recursive:true});
const example='O museu anunciou uma exposição de história local em 2026.';
const result=await analisarConteudo({texto:example},{
  check:async()=>({apiDisponivel:true,status:'ok',resultados:[]}),
  nlp:async()=>({indicadores:[],tensorflow:{disponivel:false,metodo:'fixture visual',modelo:null,limitacoes:['Este é um cenário de teste visual, sem chamadas a serviços externos.']},comparacoes:[]}),
  explain:result=>generateExplanation(result,{enabled:false})
});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=createServer(async(req,res)=>{
  if(req.url==='/api/verificar') {res.setHeader('content-type','application/json');res.end(JSON.stringify({sucesso:true,dados:result}));return;}
  let relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(relative==='/')relative='/html/index.html';
  const file=path.resolve(root,'public','.'+relative);
  if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
  try{const content=await readFile(file);res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(content);}
  catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=path.join(artifacts,'chrome-qa-profile-'+process.pid);
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-allow-origins=*',
  '--user-data-dir='+profile,'--disable-background-networking','--disable-component-update','about:blank'
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='';
chrome.stderr.on('data',chunk=>{stderr+=chunk.toString();});
let socket,commandId=0;
const requests=new Map();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  let debugPort;
  for(let i=0;i<80;i++){try{debugPort=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(125);}}
  if(!debugPort)throw new Error('Chrome debugging unavailable: '+stderr.slice(-500));
  const targets=await (await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();
  const target=targets.find(item=>item.type==='page');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id&&requests.has(message.id)){const pending=requests.get(message.id);requests.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++commandId;requests.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression)=>{const data=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(data.exceptionDetails)throw new Error(JSON.stringify(data.exceptionDetails));return data.result.value;};
  const ready=async(expression)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('Browser readiness timeout: '+expression);};
  const screenshot=async(name)=>{
    const metrics=await send('Page.getLayoutMetrics');
    const clip={x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1};
    const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
    await writeFile(path.join(artifacts,name),Buffer.from(png.data,'base64'));
    console.log(name+' '+clip.width+'x'+clip.height);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin});
  await ready("document.readyState === 'complete' && document.querySelector('#siteNav').textContent.includes('Entrar') && Boolean(window.bootstrap?.Modal)");
  await evaluate('document.fonts.ready.then(()=>true)');
  await screenshot('home-desktop.png');
  console.log('Desktop layout '+JSON.stringify(await evaluate("({body:document.body.scrollWidth,viewport:innerWidth,columns:getComputedStyle(document.querySelector('.hero-shell')).gridTemplateColumns})")));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await pause(200);
  await screenshot('home-mobile.png');
  console.log('Mobile layout '+JSON.stringify(await evaluate("({body:document.body.scrollWidth,viewport:innerWidth,columns:getComputedStyle(document.querySelector('.hero-shell')).gridTemplateColumns})")));
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate("document.getElementById('newsText').value="+JSON.stringify(example)+"; document.getElementById('verificationForm').requestSubmit(); true");
  await ready("Boolean(document.querySelector('#resultsModal.show')) && document.querySelectorAll('#modalContent h3').length === 7");
  await pause(350);
  await screenshot('result-desktop.png');
  await evaluate("document.querySelector('#resultsModal .modal-body').scrollTop=document.querySelector('#resultsModal .modal-body').scrollHeight;true");
  await screenshot('result-desktop-bottom.png');
  console.log('Result rendered '+JSON.stringify(await evaluate("[...document.querySelectorAll('#modalContent h3')].map(node=>node.textContent)")));
  await send('Browser.close').catch(()=>{});
}catch(error){console.error(error.message);process.exitCode=1;}
finally{socket?.close();chrome.kill();await new Promise(resolve=>server.close(resolve));}
