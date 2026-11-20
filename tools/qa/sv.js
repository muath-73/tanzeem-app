const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
(async()=>{const s=await serve(8996);const b=await chromium.launch();
 const act={plan:'month',status:'active',source:'apple',period_end:new Date(Date.now()+9e9).toISOString()};
 const exp={plan:'month',status:'cancelled',source:'apple',period_end:new Date(Date.now()-9e6).toISOString()};
 async function shots(vp,tag,sub,list){
  const p=await open(b,{session:true,email:'b@u.edu',state:{courses:[],saved:[],settings:{name:'Ali'},lastStudy:null,nextId:1},sub},{ctx:{viewport:vp,hasTouch:true,deviceScaleFactor:2}});
  await p.goto('http://localhost:8996/app.html');await p.waitForTimeout(1800);await dismiss(p);
  for(const [st,m] of list){await p.evaluate(([a,c])=>{window.__SV=a;window.__SVM=c;},[st,m]);await p.click('[data-tab=solve]:visible');await p.waitForTimeout(500);await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'sv-'+tag+'-'+st+'-'+m+'.png'});}
  console.log(tag,p.errs);await p.context().close();}
 await shots({width:820,height:1180},'P',act,[['start','short'],['loading','short'],['answers','short'],['answers','long'],['limit','short']]);
 await shots({width:820,height:1180},'P',exp,[['free','short']]);
 await shots({width:1180,height:820},'L',act,[['start','short'],['answers','short']]);
 await b.close();s.close();})();
