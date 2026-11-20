const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
const P=__dirname;
const VP={ctx:{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}};
const act={plan:'month',status:'active',source:'apple',period_end:new Date(Date.now()+9e9).toISOString()};
const exp={plan:'month',status:'cancelled',source:'apple',period_end:new Date(Date.now()-9e6).toISOString()};
const TR={thrombocytopenia:['قلة الصفيحات','انخفاض عدد الصفائح الدموية مما يزيد خطر النزف.'],platelets:['الصفائح الدموية','خلايا صغيرة في الدم تساعد على وقف النزف.'],hemostasis:['الإرقاء (وقف النزف)','العمليات اللي توقف النزف بعد إصابة الوعاء الدموي.']};
let n=0;async function shot(p,name,full){n++;const f='ph-'+String(n).padStart(2,'0')+'-'+name+'.png';await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(250);await p.screenshot({path:f,fullPage:!!full});console.log(f);}
async function tab(p,t){await p.click('[data-tab='+t+']:visible');await p.waitForTimeout(600);}
(async()=>{const s=await serve(8998);const b=await chromium.launch();
 // login
 let p=await open(b,{session:false,state:null},VP);await p.goto('http://localhost:8998/app.html');await p.waitForTimeout(2500);await shot(p,'login');await p.context().close();
 // subscriber
 p=await open(b,{session:true,email:'sara@uni.edu',tr:TR,state:{courses:[],saved:[],settings:{name:'سارة'},lastStudy:null,nextId:1},sub:act},VP);
 await p.goto('http://localhost:8998/app.html');await p.waitForTimeout(1800);await dismiss(p);
 await shot(p,'home-empty');
 await p.click('[data-act=openModal]');await p.waitForTimeout(400);await shot(p,'add-course');
 await p.fill('#fName','Hematology');await p.click('[data-field="الطب"]');await p.click('#courseForm button[type=submit]');await p.waitForTimeout(500);
 await p.fill('#chName','Blood Disorders');await p.click('#chForm button[type=submit]');await p.waitForTimeout(500);
 const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.click('[data-act=upload]')]);if(fc)await fc.setFiles(P+'/med.pdf');await p.waitForTimeout(4000);
 await shot(p,'course',true);
 await p.click('[data-act=study]').catch(()=>{});await p.waitForTimeout(3500);await shot(p,'study');
 for(const e of await p.$$('[data-k],[data-x]')){const t=((await e.getAttribute('data-k'))||'').toLowerCase();if(t.includes('thrombocytopenia')){await e.tap();break;}}
 await p.waitForTimeout(1200);await shot(p,'translate');
 await p.click('[data-act=saveWord]').catch(()=>{});await p.waitForTimeout(400);
 await p.click('[data-act=closeTr]').catch(()=>{});await p.waitForTimeout(300);
 await p.click('#notesTog').catch(()=>{});await p.waitForTimeout(500);await shot(p,'notes');
 await p.click('#notesTog').catch(()=>{});await p.waitForTimeout(300);
 await p.click('#inkTog').catch(()=>{});await p.waitForTimeout(500);await shot(p,'write');
 await p.click('#inkTog').catch(()=>{});
 await p.click('#bar [data-act=course]');await p.waitForTimeout(800);
 await tab(p,'home');await shot(p,'home',true);
 await tab(p,'words');await shot(p,'words',true);
 await tab(p,'plan');await shot(p,'plan',true);
 await tab(p,'settings');await shot(p,'settings',true);
 for(const [st,m,nm] of [['start','short','solve-start'],['loading','short','solve-loading'],['answers','short','solve-answers'],['answers','long','solve-explain'],['limit','short','solve-limit']]){await p.evaluate(([a,c])=>{window.__SV=a;window.__SVM=c;},[st,m]);await tab(p,'solve');await p.evaluate(()=>document.getElementById('tabsBot').style.visibility='');await shot(p,nm,st==='answers');}
 console.log('errs',p.errs);await p.context().close();
 p=await open(b,{session:true,email:'sara@uni.edu',state:{courses:[],saved:[],settings:{name:'سارة'},lastStudy:null,nextId:1},sub:exp},VP);
 await p.goto('http://localhost:8998/app.html');await p.waitForTimeout(1800);await dismiss(p);
 await p.evaluate(()=>{window.__SV='free';});await tab(p,'solve');await shot(p,'solve-free');
 await p.context().close();await b.close();s.close();})();
