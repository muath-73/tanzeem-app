const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
(async()=>{const s=await serve(8999);const b=await chromium.launch();const out=[];
 for(const lang of ['ar','en']){const p=await open(b,{session:true,email:'b@u.edu',state:{courses:[],saved:[],settings:{name:'Ali',lang},lastStudy:null,nextId:1},sub:null});
  await p.goto('http://localhost:8999/app.html');await p.waitForTimeout(1500);await dismiss(p);await p.click('[data-tab=plan]:visible');await p.waitForTimeout(400);
  out.push(lang+': '+(await p.$$eval('.feats',f=>f.map(u=>u.innerText.replace(/\n/g,' / ')).join(' || '))));
  await p.screenshot({path:'/home/claude/work/shots/plan-'+lang+'.png',fullPage:true});out.push('errs '+p.errs);await p.context().close();}
 console.log(out.join('\n'));await b.close();s.close();})();
