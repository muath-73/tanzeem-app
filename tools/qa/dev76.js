// v76: one phone + one other device. Run: V=../site node dev76.js
const {chromium,serve,open}=require('./h');const {dismiss}=require('./login');
const IPH='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPAD='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
(async()=>{const s=await serve(8994);const b=await chromium.launch();const out=[];
 const set=(p,k,v)=>p.evaluate(([k,v])=>{const d=JSON.parse(localStorage.getItem('__stubdb'));d.devs=d.devs||{};d.devs[k]=v;localStorage.setItem('__stubdb',JSON.stringify(d));},[k,v]);
 const devs=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('__stubdb')).devs);
 const poke=async p=>{await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(800);};
 const onLogin=p=>p.evaluate(()=>!!document.querySelector('#view') && /تسجيل الدخول|Sign in|أهلاً/.test(document.body.innerText) && !document.querySelector('[data-tab=home]:not([hidden])'));
 for(const [name,ua] of [['iphone',IPH],['ipad',IPAD]]){
  const p=await open(b,{session:true,email:'b@u.edu',state:{courses:[],saved:[],settings:{name:'Ali'},lastStudy:null,nextId:1},sub:null},{ctx:{userAgent:ua,viewport:{width:600,height:900}}});
  await p.goto('http://localhost:8994/app.html');await p.waitForTimeout(1800);await dismiss(p);await p.waitForTimeout(500);
  const kind=await p.evaluate(()=>typeof DEVKIND!=='undefined'?DEVKIND:'(scoped)');
  let d=await devs(p);out.push(name+' slots after open: '+JSON.stringify(d));
  const mine=name==='iphone'?'phone':'other', otherK=name==='iphone'?'other':'phone';
  await set(p,otherK,'another-device-123');await poke(p);out.push(name+' other slot taken -> kicked? '+(await p.evaluate(()=>localStorage.getItem('tz_kicked')))+' view='+(await p.evaluate(()=>document.querySelector('.tabs-bot')&&!document.querySelector('.tabs-bot').hidden?'app':'login')));
  await set(p,mine,'new-same-kind-456');await poke(p);out.push(name+' same slot taken -> kicked? '+(await p.evaluate(()=>localStorage.getItem('tz_kicked')))+' view='+(await p.evaluate(()=>document.querySelector('.tabs-bot')&&!document.querySelector('.tabs-bot').hidden?'app':'login')));
  out.push(name+' ops '+JSON.stringify(await p.evaluate(()=>window.__devOps))+' errs '+p.errs);await p.context().close();}
 console.log(out.join('\n'));await b.close();s.close();})();
