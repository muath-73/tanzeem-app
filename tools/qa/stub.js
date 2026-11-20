(function(){
  var CFG = window.__CFG || {};
  var LS='__stubdb';
  function db(){ try{return JSON.parse(localStorage.getItem(LS))||{}}catch(e){return {}} }
  function sv(d){ localStorage.setItem(LS,JSON.stringify(d)); }
  var d0=db(); if(!d0.init){ d0={init:1,app_state:CFG.state||null,sub:CFG.sub||null,ink:[],files:{},session:CFG.session?{user:{id:'u-1',email:CFG.email||'t@t.com'}}:null,dev:null}; sv(d0); }
  window.__calls=[];
  function Q(table){ var q={t:table,op:'select',f:{},single:false};
    var api={
      select:function(){ if(q.op==='upsert'||q.op==='delete'){} else q.op='select'; return api; },
      upsert:function(row){ q.op='upsert'; q.row=row; return api; },
      insert:function(row){ q.op='upsert'; q.row=row; return api; },
      update:function(row){ q.op='upsert'; q.row=row; return api; },
      delete:function(){ q.op='delete'; return api; },
      eq:function(k,v){ q.f[k]=v; return api; },
      order:function(){return api}, limit:function(){return api},
      maybeSingle:function(){ q.single=true; return api; }, single:function(){ q.single=true; return api; },
      then:function(a,b){ return run().then(a,b); }
    };
    function run(){ window.__calls.push(q.t+':'+q.op); var d=db(); var res={data:null,error:null};
      if(CFG.offline) return Promise.reject(new Error('net'));
      if(q.t==='app_state'){ if(q.op==='select') res.data=d.app_state?{data:d.app_state}:null; else if(q.op==='upsert'){ d.app_state=q.row.data; sv(d);} }
      else if(q.t==='subscriptions'){ res.data=d.sub; }
      else if(q.t==='active_device'){ if(q.op==='select') res.data=d.dev?{device_id:d.dev}:null; else { d.dev=q.row.device_id; sv(d);} }
      else if(q.t==='ink'){ if(q.op==='select') res.data=d.ink.filter(function(x){return x.deck===q.f.deck}); else if(q.op==='upsert'){ if(CFG.inkDeny){res.error={message:'denied'};} else { d.ink=d.ink.filter(function(x){return !(x.deck===q.row.deck&&x.slide===q.row.slide)}); d.ink.push(q.row); sv(d);} } else { d.ink=d.ink.filter(function(x){return !(x.deck===q.f.deck&&(q.f.slide==null||x.slide===q.f.slide))}); sv(d);} }
      return new Promise(function(r){ setTimeout(function(){r(res)}, CFG.lag||30); });
    }
    return api; }
  var listeners=[];
  var client={
    from:Q,
    rpc:function(n,a){ window.__calls.push('rpc:'+n); var r={data:null,error:null};
      if(n==='my_referral') r.data={code:'TZ7K2M',count:CFG.refCount||0,rewarded:0,can_redeem:true};
      if(n==='redeem_referral') r.data={ok:true};
      return Promise.resolve(r); },
    auth:{
      getSession:function(){ if(CFG.hangSession) return new Promise(function(){}); var se=db().session; if(se&&!CFG.deadSession) se=Object.assign({expires_at:Math.floor(Date.now()/1000)+3600},se); else if(se) se=Object.assign({expires_at:Math.floor(Date.now()/1000)-60},se); return Promise.resolve({data:{session:se}}); },
      refreshSession:function(){ if(CFG.deadSession) return Promise.resolve({data:{session:null},error:{message:'Invalid Refresh Token'}}); return Promise.resolve({data:{session:db().session},error:null}); },
      onAuthStateChange:function(f){ listeners.push(f); return {data:{subscription:{unsubscribe:function(){}}}}; },
      signInWithPassword:function(c){ window.__calls.push('auth:signin'); if(CFG.badPw||c.password==='wrongpass1') return Promise.resolve({data:{session:null},error:{message:'Invalid login credentials'}}); var d=db(); d.session={user:{id:'u-1',email:c.email}}; sv(d); return Promise.resolve({data:{session:d.session},error:null}); },
      signOut:function(){ var d=db(); d.session=null; sv(d); return Promise.resolve({error:null}); },
      updateUser:function(){ return Promise.resolve({data:{},error:null}); },
      resetPasswordForEmail:function(){ window.__calls.push('auth:reset'); return Promise.resolve({data:{},error:null}); },
      signInWithOtp:function(){ return Promise.resolve({data:{},error:null}); },
      verifyOtp:function(){ return Promise.resolve({data:{session:null},error:{message:'x'}}); }
    },
    functions:{ invoke:function(n,o){ var b=(o&&o.body)||{}; window.__calls.push('fn:'+n+':'+(b.task||b.action||''));
      var res={data:null,error:null};
      if(n==='signup'){ if(CFG.signupErr) res.data={error:CFG.signupErr}; else { res.data={ok:true}; var d=db(); if(!d.sub){ d.sub={plan:'trial',status:'active',source:'trial',period_end:new Date(Date.now()+10*864e5).toISOString()}; sv(d);} } }
      else if(n==='ai'){ if(CFG.aiLimit) res={data:null,error:{context:{status:429}}}; else if(b.task==='translate'){ var tk=String(b.text||'').toLowerCase().replace(/[^a-z0-9 -]/g,''); var tv=(CFG.tr||{})[tk]; res.data={data:tv?{ar:tv[0],mean:tv[1]}:{ar:'ترجمة: '+b.text,mean:'شرح مبسط لكلمة '+b.text}}; } else res.data={data:{questions:[]}}; }
      else if(n==='convert-pptx'){ if(CFG.convFail) res.data={error:'convert'}; else res.data={ok:true,pdfPath:'u-1/conv.pdf',pages:3}; }
      else if(n==='pay'){ window.__payBodies=(window.__payBodies||[]).concat([b]); var cp=(b.coupon||'').toUpperCase(); var base=b.v===4?(b.cycle==='month'?20:170):(b.cycle==='month'?18:159), amt=base, kind='', cerr=false; if(cp){ if(false){amt=19;kind='coupon'} else cerr=true } if(CFG.referred&&b.cycle==='month'&&kind!=='coupon'){amt=22;kind='ref'}
        if(b.action==='quote') res.data={cycle:b.cycle,amount:amt,base:base,kind:kind,coupon:kind==='coupon'?cp:'',couponErr:cerr};
        else if(b.action==='create') res.data={id:'inv_test12345',url:'https://checkout.moyasar.com/invoices/inv_test12345',amount:amt}; else res.data={activated:!!CFG.payOk,sub:db().sub}; if(b.action==='check'&&CFG.payOk){ var d2=db(); d2.sub={plan:'year',status:'active',source:'moyasar',period_end:new Date(Date.now()+365*864e5).toISOString()}; sv(d2);} }
      else if(n==='solve'){ window.__svBodies=(window.__svBodies||[]).concat([{status:!!b.status,mode:b.mode,len:(b.image||'').length,mt:b.media_type}]); var d4=db(); if(d4.svLeft==null) d4.svLeft=(CFG.svLeft!=null?CFG.svLeft:15);
        if(b.status) res.data={subscribed:true,left:d4.svLeft,limit:15};
        else if(CFG.svFail){ res={data:null,error:{context:{status:502,json:function(){return Promise.resolve({error:'parse',left:d4.svLeft});}}}}; }
        else if(d4.svLeft<=0){ res={data:null,error:{context:{status:429,json:function(){return Promise.resolve({error:'limit',left:0});}}}}; }
        else { d4.svLeft--; var F=(window.__SVFIX||{})[b.mode==='long'?'long':'short']||[]; var k=(window.__svI=(window.__svI||0)+1)-1; var fx=CFG.svUnclear&&k===1?{ok:false,reason:'unclear'}:F[k%F.length]; if(fx&&fx.ok===false) d4.svLeft++; res.data=Object.assign({},fx,{left:d4.svLeft}); }
        sv(d4); }
      else if(n==='delete-account'){ res.data={ok:true}; }
      else if(n==='iap'){ var m=CFG.iapMode||''; window.__iapBodies=(window.__iapBodies||[]).concat([JSON.stringify(b)]); if(m==='owner'&&b&&b.claim===true) m='active'; if(m==='active'){ var d3=db(); d3.sub={plan:'month',status:'active',source:'apple',period_end:new Date(Date.now()+30*864e5).toISOString()}; sv(d3); res.data={active:true,why:''}; } else res.data={active:false,why:m||'expired'}; }
      return new Promise(function(r){ setTimeout(function(){r(res)}, CFG.lag||60); }); } },
    storage:{ from:function(){ return {
      upload:function(p,file){ window.__calls.push('st:upload'); return new Promise(function(r){ var fr=new FileReader(); fr.onload=function(){ window.__files=window.__files||{}; window.__files[p]=fr.result; r({data:{path:p},error:CFG.upFail?{message:'x'}:null}); }; fr.readAsArrayBuffer(file); }); },
      download:function(p){ window.__calls.push('st:download'); var f=(window.__files||{})[p]; if(!f&&window.__PDF){ var bin=atob(window.__PDF),u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i); f=u.buffer; } if(!f) return Promise.resolve({data:null,error:{message:'nf'}}); return Promise.resolve({data:new Blob([f],{type:'application/pdf'}),error:null}); },
      remove:function(){ return Promise.resolve({data:[],error:null}); } }; } }
  };
  window.supabase={createClient:function(){return client;}};
})();
