const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
(async()=>{const s=await serve(8997);const b=await chromium.launch();
 const act={plan:'month',status:'active',source:'apple',period_end:new Date(Date.now()+9e9).toISOString()};
 for(const [vp,tag] of [[{width:820,height:1180},'P'],[{width:1180,height:820},'L']]){
  const p=await open(b,{session:true,email:'b@u.edu',state:{courses:[],saved:[],settings:{name:'Ali'},lastStudy:null,nextId:1},sub:act},{ctx:{viewport:vp,hasTouch:true,deviceScaleFactor:2}});
  await p.goto('http://localhost:8997/app.html');await p.waitForTimeout(1800);await dismiss(p);
  for(const m of ['short','long']){await p.evaluate(c=>{window.__SV='answers';window.__SVM=c;},m);await p.click('[data-tab=solve]:visible');await p.waitForTimeout(500);await p.evaluate(()=>document.getElementById('tabsBot').style.visibility='hidden');await p.screenshot({path:'sv2-'+tag+'-'+m+'.png',fullPage:true});await p.evaluate(()=>document.getElementById('tabsBot').style.visibility='');}
  console.log(tag,p.errs);await p.context().close();}
 await b.close();s.close();})();
