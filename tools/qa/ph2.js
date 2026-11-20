const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
(async()=>{const s=await serve(8999);const b=await chromium.launch();
 const act={plan:'month',status:'active',source:'apple',period_end:new Date(Date.now()+9e9).toISOString()};
 const p=await open(b,{session:true,email:'sara@uni.edu',state:{courses:[],saved:[],settings:{name:'سارة'},lastStudy:null,nextId:1},sub:act},{ctx:{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}});
 await p.goto('http://localhost:8999/app.html');await p.waitForTimeout(1800);await dismiss(p);
 await p.evaluate(()=>{window.__SV='paper';});await p.click('[data-tab=solve]:visible');await p.waitForTimeout(600);
 await p.evaluate(()=>{document.getElementById('tabsBot').style.display='none';document.querySelector('.app').classList.remove('has-nav');});
 await p.screenshot({path:'ph-paper.png',fullPage:true});console.log(p.errs);await b.close();s.close();})();
