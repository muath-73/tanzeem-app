// v76 «صوّر وحل»: real screen with the stubbed `solve` function. Run from tools/qa: V=../www node sv3.js
const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');const path=require('path');
const S=f=>path.join(__dirname,'solve-samples',f);
(async()=>{const s=await serve(8997);const b=await chromium.launch();const out=[];
 const act={plan:'month',status:'active',source:'apple',period_end:new Date(Date.now()+9e9).toISOString()};
 const exp={plan:'month',status:'cancelled',source:'apple',period_end:new Date(Date.now()-9e6).toISOString()};
 async function pg(vp,sub,cfg,lang,theme){const p=await open(b,Object.assign({session:true,email:'b@u.edu',state:{courses:[],saved:[],settings:{name:'Ali',lang:lang||'ar',theme:theme||'light'},lastStudy:null,nextId:1},sub},cfg||{}),{ctx:{viewport:vp,hasTouch:true,deviceScaleFactor:1}});
  await p.goto('http://localhost:8997/index.html');await p.waitForTimeout(1500);await dismiss(p);await p.click('[data-tab=solve]:visible');await p.waitForTimeout(400);return p;}
 async function pick(p,btn,files){const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click(btn)]);out.push('chooser multiple='+fc.isMultiple());await fc.setFiles(files);}
 async function waitAns(p){await p.waitForSelector('.sv-res-h',{timeout:15000});await p.waitForTimeout(900);}
 const shot=(p,n,full)=>p.screenshot({path:'/home/claude/work/shots/'+n+'.png',fullPage:!!full});
 require('fs').mkdirSync('/home/claude/work/shots',{recursive:true});
 const P={width:820,height:1180},L={width:1180,height:820},PH={width:390,height:844};
 // iPad portrait: start, short x2 pages, long
 let p=await pg(P,act);await shot(p,'1-start');
 out.push('pill: '+await p.textContent('.sv-pill'));
 await pick(p,'[data-act=svAlbum]',[S('scm_photo.jpg'),S('stat_photo.jpg')]);await p.waitForTimeout(150);await shot(p,'2-loading');
 await waitAns(p);await shot(p,'3-short-2pages',true);
 out.push('head: '+await p.textContent('.sv-res-t b'));out.push('rows: '+await p.$$eval('.sv-row',r=>r.length)+' katex: '+await p.$$eval('.katex',r=>r.length)+' raw-left: '+await p.$$eval('.tex[data-tex]',r=>r.length));
 out.push('first rows: '+(await p.$$eval('.sv-a',r=>r.slice(0,6).map(x=>x.textContent).join(' | '))));
 out.push('bodies: '+JSON.stringify(await p.evaluate(()=>window.__svBodies)));
 await p.click('[data-act=svAgain]');await p.waitForTimeout(300);out.push('pill after: '+await p.textContent('.sv-pill'));
 await p.click('[data-act=svMode][data-m=long]');await pick(p,'[data-act=svCam]',[S('math_photo.jpg')]);await waitAns(p);await shot(p,'4-long-math',true);
 out.push('long head: '+await p.textContent('.sv-res-t'));out.push('errs '+p.errs);await p.context().close();
 // landscape answers
 p=await pg(L,act);await pick(p,'[data-act=svAlbum]',[S('med_photo.jpg')]);await waitAns(p);await shot(p,'5-landscape',true);out.push('L errs '+p.errs);await p.context().close();
 // phone
 p=await pg(PH,act);await shot(p,'6-phone-start');await pick(p,'[data-act=svAlbum]',[S('scm_photo.jpg')]);await waitAns(p);await shot(p,'7-phone-answers',true);
 out.push('phone overflow: '+await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));out.push('tabs: '+await p.$$eval('#tabsBot .tab',t=>t.map(x=>x.textContent).join(',')));out.push('P errs '+p.errs);await p.context().close();
 // free, limit, partial-limit, failure+unclear, English, dark
 p=await pg(P,exp);await shot(p,'8-free');out.push('free: '+await p.textContent('.sv-lock h2'));await p.context().close();
 p=await pg(P,act,{svLeft:0});await p.waitForTimeout(300);await shot(p,'9-limit');out.push('limit: '+await p.textContent('.sv-lock'));await p.context().close();
 p=await pg(P,act,{svLeft:1});await pick(p,'[data-act=svAlbum]',[S('scm_photo.jpg'),S('med_photo.jpg')]);await waitAns(p);out.push('partial: '+await p.$$eval('.sv-perr',e=>e.map(x=>x.textContent).join('|'))+' calls='+(await p.evaluate(()=>window.__svBodies.filter(x=>!x.status).length)));await shot(p,'10-partial',true);await p.context().close();
 p=await pg(P,act,{svUnclear:true});await pick(p,'[data-act=svAlbum]',[S('scm_photo.jpg'),S('med_photo.jpg')]);await waitAns(p);out.push('unclear: '+await p.$$eval('.sv-perr',e=>e.map(x=>x.textContent).join('|')));await p.context().close();
 p=await pg(P,act,{svFail:true});await pick(p,'[data-act=svAlbum]',[S('scm_photo.jpg')]);await waitAns(p);out.push('fail: '+await p.$$eval('.sv-perr',e=>e.map(x=>x.textContent).join('|')));await p.context().close();
 p=await pg(P,act,{},'en');await shot(p,'11-en-start');await pick(p,'[data-act=svAlbum]',[S('med_photo.jpg')]);await waitAns(p);await shot(p,'12-en-answers',true);out.push('EN: '+await p.textContent('.sv-res-t')+' / '+await p.$$eval('.sv-a',r=>r.map(x=>x.textContent).join(' | ')));out.push('EN errs '+p.errs);await p.context().close();
 p=await pg(P,act,{},'ar','dark');await pick(p,'[data-act=svAlbum]',[S('scm_photo.jpg')]);await waitAns(p);await shot(p,'13-dark');await p.context().close();
 console.log(out.join('\n'));await b.close();s.close();})();
