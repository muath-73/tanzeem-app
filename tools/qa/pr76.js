// v76 prices 20/170 and privacy section. Run: V=../site node pr76.js
const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
(async()=>{const s=await serve(8998);const b=await chromium.launch();const out=[];
 const exp={plan:'month',status:'cancelled',source:'moyasar',period_end:new Date(Date.now()-9e6).toISOString()};
 for(const lang of ['ar','en']){
  const p=await open(b,{session:true,email:'b@u.edu',state:{courses:[],saved:[],settings:{name:'Ali',lang},lastStudy:null,nextId:1},sub:exp});
  await p.goto('http://localhost:8998/app.html');await p.waitForTimeout(1500);await dismiss(p);
  await p.click('[data-tab=plan]:visible');await p.waitForTimeout(400);
  out.push(lang+' plan: '+(await p.$$eval('.price, .price-n',e=>e.map(x=>x.textContent.trim()).join(' | '))));
  const y=await p.$('[data-act=subscribe][data-plc=year]'); if(y){await y.click();await p.waitForTimeout(600);out.push(lang+' pay: '+(await p.textContent('#view')).replace(/\s+/g,' ').slice(0,260));out.push('payBodies '+JSON.stringify(await p.evaluate(()=>window.__payBodies)));}
  await p.click('[data-tab=settings]:visible');await p.waitForTimeout(300);
  await p.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(b=>/الخصوصية|Privacy/.test(b.textContent));x&&x.click();});await p.waitForTimeout(300);
  out.push(lang+' privacy: '+(await p.textContent('.legal')).replace(/\s+/g,' ').match(/(صوّر وحل|Snap)[^]{0,200}/)?.[0]);
  out.push('errs '+p.errs);await p.context().close();}
 console.log(out.join('\n'));await b.close();s.close();})();
