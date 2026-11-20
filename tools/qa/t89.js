const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
const P=__dirname;
async function run(b,sub,lang,tag){
 const st={courses:[],saved:[],settings:{name:'Ali'},lastStudy:null,nextId:1}; if(lang) st.settings.lang=lang;
 const p=await open(b,{session:true,email:'b@u.edu',state:st,sub},{ctx:{viewport:{width:1180,height:820},hasTouch:true}});
 if(lang) await p.addInitScript(l=>{try{localStorage.setItem('tz_lang',l)}catch(e){}},lang);
 await p.goto('http://localhost:8995/app.html');await p.waitForTimeout(1800);await dismiss(p);
 await p.click('[data-act=openModal]');await p.fill('#fName','Hematology');await p.click('[data-field="الطب"]');await p.click('#courseForm button[type=submit]');await p.waitForTimeout(500);
 await p.fill('#chName','Blood');await p.click('#chForm button[type=submit]');await p.waitForTimeout(500);
 const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.click('[data-act=upload]')]);if(fc)await fc.setFiles(P+'/med.pdf');await p.waitForTimeout(4000);
 await p.click('[data-act=study]').catch(()=>{});await p.waitForTimeout(3000);
 await p.click('#notesTog');await p.waitForTimeout(500);
 await p.click('#nTxt');await p.waitForTimeout(300);
 await p.keyboard.type('ملاحظة تجربة');await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>({modal:!!document.querySelector('#tzm'),val:document.querySelector('#nTxt').value,ro:document.querySelector('#nTxt').readOnly,warn:document.querySelector('#nWarn').hidden?'(hidden)':document.querySelector('#nWarn').textContent,st:document.querySelector('#nSt').textContent,ph:document.querySelector('#nTxt').placeholder,inkWrites:window.__calls.filter(c=>c==='ink:upsert').length}));
 console.log(tag,JSON.stringify(r));
 await p.screenshot({path:'t89-'+tag+'.png'}); if(tag==='free'){await p.click('#nWarn button');await p.waitForTimeout(800);console.log('after link:',(await p.textContent('#view')).replace(/\s+/g,' ').slice(0,60));} 
 // switch slide and back: text kept in session?
 console.log(tag,'errs',p.errs);await p.context().close();
}
(async()=>{const s=await serve(8995);const b=await chromium.launch();
 const exp={plan:'month',status:'cancelled',source:'apple',period_end:new Date(Date.now()-9e6).toISOString()};
 const act={plan:'year',status:'active',source:'apple',period_end:new Date(Date.now()+9e9).toISOString()};
 await run(b,exp,null,'free');await run(b,act,null,'sub');await run(b,exp,'en','free-en');
 await b.close();s.close();})();
