const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
const P=__dirname;
(async()=>{const s=await serve(8995);const b=await chromium.launch();
 const p=await open(b,{session:true,email:'b@u.edu',tr:{thrombocytopenia:['قلة الصفيحات','انخفاض عدد الصفائح الدموية مما يزيد خطر النزف.']},state:{courses:[],saved:[],settings:{name:'Ali'},lastStudy:null,nextId:1},sub:{plan:'month',status:'cancelled',source:'apple',period_end:new Date(Date.now()-9e6).toISOString()}},{ctx:{viewport:{width:1180,height:820},hasTouch:true}});
 await p.goto('http://localhost:8995/app.html');await p.waitForTimeout(1800);await dismiss(p);
 await p.click('[data-act=openModal]');await p.fill('#fName','Hematology');await p.click('[data-field="الطب"]');await p.click('#courseForm button[type=submit]');await p.waitForTimeout(500);
 await p.fill('#chName','Blood');await p.click('#chForm button[type=submit]');await p.waitForTimeout(500);
 const [fc]=await Promise.all([p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null),p.click('[data-act=upload]')]);if(fc)await fc.setFiles(P+'/med.pdf');await p.waitForTimeout(4000);
 console.log('upload view:',(await p.textContent('#view')).replace(/\s+/g,' ').slice(0,160));
 await p.click('[data-act=study]').catch(e=>console.log('nostudy'));await p.waitForTimeout(3500);
 for(const e of await p.$$('[data-k],[data-x]')){const t=((await e.getAttribute('data-k'))||'').toLowerCase();if(t.includes('thrombocytopenia')){await e.tap();break;}}
 await p.waitForTimeout(1200);
 console.log('CARD:',(await p.textContent('#side')).replace(/\s+/g,' ').slice(0,300));
 await p.screenshot({path:'t88-card.png'});
 await p.click('#inkTog');await p.waitForTimeout(600);await p.screenshot({path:'t88-ink.png'});console.log('after ink tap:',(await p.evaluate(()=>{const t=document.querySelector('#toast');return (t&&!t.hidden?t.textContent:'')+' | modal:'+((document.querySelector('#tzm')||{}).textContent||'').slice(0,400)+' BTNS:'+[...document.querySelectorAll('#tzm button')].map(b=>b.textContent).join(' / ')+' | inkbar:'+!!(document.querySelector('#inkbar')&&!document.querySelector('#inkbar').hidden)})));
 await p.keyboard.press('Escape');await p.evaluate(()=>{const m=document.querySelector('#tzm');if(m)m.remove();});
 await p.click('#notesTog').catch(e=>console.log('notesTog',e.message.slice(0,50)));await p.waitForTimeout(600);console.log('after notes tap:',(await p.evaluate(()=>{const t=document.querySelector('#toast');return (t&&!t.hidden?t.textContent:'')+' | modal:'+((document.querySelector('#tzm')||{}).textContent||'').slice(0,120)+' | notes open:'+!!(document.querySelector('#notes')&&!document.querySelector('#notes').hidden)})));
 console.log(p.errs);await b.close();s.close();})();
