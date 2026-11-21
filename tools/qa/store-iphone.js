// App Store screenshots for iPhone 6.9" (1320 x 2868), from the real app with the stubbed backend.
// Run from tools/qa: V=../www node store-iphone.js  -> /home/claude/work/store-iphone/*.png
const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');const path=require('path'),fs=require('fs');
const OUT='/home/claude/work/store-iphone';fs.mkdirSync(OUT,{recursive:true});
const VP={ctx:{viewport:{width:440,height:956},deviceScaleFactor:3,isMobile:true,hasTouch:true}};
const act={plan:'year',status:'active',source:'apple',period_end:new Date(Date.now()+9e9).toISOString()};
const TR={thrombocytopenia:['قلة الصفيحات','انخفاض عدد الصفائح الدموية مما يزيد خطر النزف.'],platelets:['الصفائح الدموية','خلايا صغيرة في الدم تساعد على وقف النزف.'],hemostasis:['الإرقاء (وقف النزف)','العمليات اللي توقف النزف بعد إصابة الوعاء الدموي.'],anemia:['فقر الدم','نقص في كريات الدم الحمراء أو الهيموغلوبين.'],coagulation:['التخثر','تحوّل الدم من سائل إلى جلطة لوقف النزف.']};
async function shot(p,name){await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(400);await p.screenshot({path:path.join(OUT,name+'.png')});console.log(name);}
async function tab(p,t){await p.click('[data-tab='+t+']:visible');await p.waitForTimeout(700);}
(async()=>{const s=await serve(8995);const b=await chromium.launch();
 const p=await open(b,{session:true,email:'sara@uni.edu',tr:TR,state:{courses:[],saved:[],settings:{name:'سارة'},lastStudy:null,nextId:1},sub:act},VP);
 await p.goto('http://localhost:8995/index.html');await p.waitForTimeout(1800);await dismiss(p);
 // a course with a chapter and real slides
 await p.click('[data-act=openModal]');await p.waitForTimeout(400);
 await p.fill('#fName','Hematology');await p.click('[data-field="الطب"]');await p.click('#courseForm button[type=submit]');await p.waitForTimeout(500);
 await p.fill('#chName','Blood Disorders');await p.click('#chForm button[type=submit]');await p.waitForTimeout(500);
 const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.click('[data-act=upload]')]);if(fc)await fc.setFiles(path.join(__dirname,'med.pdf'));await p.waitForTimeout(4000);
 // translation on the slide
 await p.click('[data-act=study]').catch(()=>{});await p.waitForTimeout(3500);
 for(const k of ['platelets','hemostasis','anemia','coagulation','thrombocytopenia']){for(const e of await p.$$('[data-k],[data-x]')){const t=((await e.getAttribute('data-k'))||'').toLowerCase();if(t===k||t.includes(k)){await e.tap();await p.waitForTimeout(700);await p.click('[data-act=saveWord]').catch(()=>{});await p.waitForTimeout(300);break;}}}
 await p.waitForTimeout(800);await shot(p,'2-translate');
 await p.click('[data-act=closeTr]').catch(()=>{});await p.waitForTimeout(300);
 await p.click('#bar [data-act=course]').catch(()=>{});await p.waitForTimeout(800);
 await tab(p,'home');await shot(p,'1-home');
 // snap & solve, real flow
 await tab(p,'solve');await shot(p,'3-solve-start');
 const [f2]=await Promise.all([p.waitForEvent('filechooser'),p.click('[data-act=svAlbum]')]);await f2.setFiles([path.join(__dirname,'solve-samples','scm_photo.jpg')]);
 await p.waitForSelector('.sv-res-h',{timeout:15000});await p.waitForTimeout(1200);await shot(p,'4-solve-answers');
 await tab(p,'words');await shot(p,'5-words');
 await tab(p,'plan');await shot(p,'6-plan');
 console.log('errs',p.errs);await b.close();s.close();})();
