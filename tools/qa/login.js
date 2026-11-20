const {open}=require('./h');
exports.dismiss=async p=>{await p.evaluate(()=>{const m=document.querySelector('#tzm');if(m){const bs=m.querySelectorAll('button');if(bs.length)bs[bs.length-1].click();}});await p.waitForTimeout(300);};
exports.home=async(b,port,cfg,opt)=>{const p=await open(b,Object.assign({session:true,email:'sara@uni.edu',state:{courses:[],saved:[],settings:{name:'سارة'},lastStudy:null,nextId:1},sub:{plan:'trial',status:'active',source:'trial',period_end:new Date(Date.now()+10*864e5).toISOString()}},cfg||{}),opt||{});
 await p.goto('http://localhost:'+port+'/app.html');await p.waitForTimeout(1500);if(!(opt&&opt.keepWelcome))await exports.dismiss(p);return p;};
