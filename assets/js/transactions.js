const API_BASE='https://api.subhub.com.ng/api';
const TOKEN_KEY='sh_access_token';
const REFRESH_KEY='sh_refresh_token';
const $=id=>document.getElementById(id);
const fmt=n=>parseFloat(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate=d=>new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const fmtDateGroup=d=>new Date(d).toLocaleDateString('en-NG',{weekday:'short',day:'numeric',month:'long',year:'numeric'});

const TX_META={
  data:          {icon:'wifi',           bg:'ico-sky'},
  airtime:       {icon:'phone',          bg:'ico-grn'},
  cable:         {icon:'tv',             bg:'ico-pur'},
  electricity:   {icon:'bolt',           bg:'ico-amb'},
  exam:          {icon:'graduation-cap', bg:'ico-org'},
  rc:            {icon:'id-card',        bg:'ico-tel'},
  sms:           {icon:'comment-dots',   bg:'ico-pnk'},
  wallet_fund:   {icon:'plus-circle',    bg:'ico-grn'},
  wallet_transfer:{icon:'paper-plane',  bg:'ico-sky'},
  earncial_transfer:{icon:'plus-circle',  bg:'ico-grn'},
  refund:        {icon:'rotate-left',    bg:'ico-pur'},
};

const TYPE_LABELS={
  data:'Data',airtime:'Airtime',cable:'Cable TV',electricity:'Electricity',
  exam:'Exam Pins',rc:'Recharge Card',sms:'Bulk SMS',
  wallet_fund:'Wallet Fund',refund:'Refund',earncial_transfer:'Earncial Transfer'
};

let allTxns=[],filteredTxns=[],shownCount=20;
let curType='all',curStatus='all',searchQ='';
let receiptData=null;

// DARK MODE
function applyDark(on){document.documentElement.setAttribute('data-theme',on?'dark':'light');const i=$('dmIco');if(i)i.className='fas fa-'+(on?'sun':'moon');}
const isDark=()=>localStorage.getItem('sh_dark')==='1';
applyDark(isDark());
$('dmBtn')?.addEventListener('click',()=>{const nd=!isDark();localStorage.setItem('sh_dark',nd?'1':'0');applyDark(nd);});

// PROC
function showProc(t,s){if($('procTitle'))$('procTitle').textContent=t||'Loading…';if($('procSub'))$('procSub').textContent=s||'Please wait';$('procOv')?.classList.add('show');}
function hideProc(){$('procOv')?.classList.remove('show');}

// TOAST
const TICONS={green:{icon:'fa-circle-check',cls:'green',title:'Success'},red:{icon:'fa-circle-xmark',cls:'red',title:'Error'},blue:{icon:'fa-circle-info',cls:'blue',title:'Info'},warn:{icon:'fa-triangle-exclamation',cls:'warn',title:'Warning'}};
function toast(msg,type,title){
  const con=$('toastContainer');if(!con)return;
  type=type||'blue';const cfg=TICONS[type]||TICONS.blue;
  const id='t'+Date.now();const el=document.createElement('div');
  el.className='toast-item';el.id=id;el.style.cssText='position:relative;overflow:hidden';
  el.innerHTML='<div class="toast-ico '+cfg.cls+'"><i class="fas '+cfg.icon+'"></i></div><div class="toast-body"><div class="toast-title">'+(title||cfg.title)+'</div><div class="toast-msg">'+msg+'</div></div><button class="toast-close" onclick="dismissToast(\''+id+'\')"><i class="fas fa-times"></i></button><div class="toast-progress '+cfg.cls+'" id="prog_'+id+'" style="width:100%"></div>';
  $('toastContainer').appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.classList.add('show');const p=$('prog_'+id);if(p){p.style.transition='width 4000ms linear';requestAnimationFrame(()=>requestAnimationFrame(()=>p.style.width='0%'));}}));
  el._timer=setTimeout(()=>dismissToast(id),4000);
}
function dismissToast(id){const el=$(id);if(!el)return;clearTimeout(el._timer);el.classList.remove('show');el.classList.add('hide');setTimeout(()=>el.remove(),350);}

// MODALS
function openModal(id){const el=$(id);if(!el)return;el.classList.add('show');document.body.style.overflow='hidden';}
function closeModal(id){const el=$(id);if(!el)return;el.classList.remove('show');if(!document.querySelectorAll('.ov.show').length)document.body.style.overflow='';}

// API
async function apiCall(ep,opts={}){
  const tk=localStorage.getItem(TOKEN_KEY);
  const headers={'Content-Type':'application/json'};
  if(tk)headers['Authorization']='Bearer '+tk;
  try{
    const r=await fetch(API_BASE+ep,{...opts,headers:{...headers,...(opts.headers||{})}});
    if(r.status===401){
      const body=await r.json().catch(()=>null);
      if(r.status===401){
        const body=await r.json().catch(()=>null);
        if(body?.code==='ACCESS_TOKEN_EXPIRED'||body?.code==='INVALID_TOKEN'){
          const refreshed=await refreshToken();
          if(refreshed)return apiCall(ep,opts);
          return null;
        }
        window.location.replace('/login.html');
        return null;
      }
    return await r.json();
  }catch{toast('Network error','red','Error');return null;}
}

async function refreshToken(){
  const rt=localStorage.getItem(REFRESH_KEY);
  if(!rt)return false;
  try{
    const res=await fetch(`${API_BASE}/auth/refresh-token`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({refreshToken:rt}),
    });
    const data=await res.json();
    if(data?.success){localStorage.setItem(TOKEN_KEY,data.accessToken);return true;}
    if(data?.code==='REFRESH_TOKEN_EXPIRED'||data?.code==='INVALID_TOKEN'){
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      toast('Session expired, please login again','red','Session Expired');
      setTimeout(()=>window.location.replace('/login.html'),2000);
    }
    return false;
  }catch{return false;}
}

// INIT
document.addEventListener('DOMContentLoaded',async()=>{
  if(!localStorage.getItem(TOKEN_KEY)){location.href='/login.html';return;}
  buildTypeFilters();
  await fetchTxns();
  checkVerified();
  // search
  $('searchInp')?.addEventListener('input',e=>{
    searchQ=e.target.value.toLowerCase();
    const cl=$('searchClear');
    if(cl)cl.style.display=searchQ?'block':'none';
    applyFilters();
  });
  // modal close
  document.addEventListener('click',e=>{const cl=e.target.closest('[data-close]');if(cl)closeModal(cl.dataset.close);});
  document.querySelectorAll('.ov').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)closeModal(ov.id);}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.ov.show').forEach(o=>closeModal(o.id));});
});

function buildTypeFilters(){
  const types=['all','data','airtime','cable','electricity','exam','rc','sms','wallet_fund','earncial_transfer','refund'];
  $('typeFilters').innerHTML=types.map(t=>
    '<button class="fchip'+(t==='all'?' on':'')+'" data-type="'+t+'" onclick="setType(\''+t+'\',this)">'+(TYPE_LABELS[t]||'All')+'</button>'
  ).join('');
}

let currentUser=null;

async function fetchTxns(){
  const [txRes,meRes]=await Promise.all([
    apiCall('/transactions?limit=200'),
    apiCall('/auth/me')
  ]);
  if(!txRes||!txRes.success){$('txPageList').innerHTML='<div class="tx-empty"><i class="fas fa-exclamation-triangle"></i><p>Failed to load</p><small>Pull down to retry</small></div>';return;}
  currentUser=meRes?.user||null;
  allTxns=txRes.transactions||[];
  updateSummary();
  applyFilters();
}

function updateSummary(){
  if($('sumTotal'))$('sumTotal').textContent=allTxns.length.toLocaleString();
  if($('sumSuccess'))$('sumSuccess').textContent=allTxns.filter(t=>t.status==='success').length.toLocaleString();
  if($('sumFailed'))$('sumFailed').textContent=allTxns.filter(t=>t.status==='failed').length.toLocaleString();
}

function setType(type,btn){
  curType=type;shownCount=20;
  document.querySelectorAll('.fchip').forEach(c=>c.classList.toggle('on',c.dataset.type===type));
  applyFilters();
}

function setStatus(status,btn){
  curStatus=status;shownCount=20;
  document.querySelectorAll('.sfchip').forEach(c=>{
    c.classList.remove('on');
    if(c.dataset.sf===status)c.classList.add('on');
  });
  applyFilters();
}

function clearSearch(){
  searchQ='';if($('searchInp'))$('searchInp').value='';
  if($('searchClear'))$('searchClear').style.display='none';
  applyFilters();
}

function applyFilters(){
  filteredTxns=allTxns.filter(tx=>{
    if(curType!=='all'&&tx.type!==curType)return false;
    if(curStatus!=='all'&&tx.status!==curStatus)return false;
    if(searchQ){
      const hay=(tx.requestId+tx.type+(tx.phone||'')+(tx.dataPlan||'')+(tx.network||'')+(tx.discoName||'')).toLowerCase();
      if(!hay.includes(searchQ))return false;
    }
    return true;
  });
  renderList();
}

function loadMore(){shownCount+=20;renderList();}

function renderList(){
  const list=$('txPageList');const more=$('loadMoreBtn');
  if(!filteredTxns.length){
    list.innerHTML='<div class="tx-empty"><i class="fas fa-receipt"></i><p>No transactions found</p><small>Try changing filters</small></div>';
    if(more)more.style.display='none';return;
  }

  const visible=filteredTxns.slice(0,shownCount);
  if(more)more.style.display=filteredTxns.length>shownCount?'flex':'none';
  if(more&&filteredTxns.length>shownCount)more.innerHTML='<i class="fas fa-chevron-down"></i>Load More ('+(filteredTxns.length-shownCount)+' remaining)';

  // Group by date
  const groups={};
  visible.forEach(tx=>{
    const day=new Date(tx.createdAt).toDateString();
    if(!groups[day])groups[day]=[];
    groups[day].push(tx);
  });

  list.innerHTML=Object.entries(groups).map(([day,txs])=>{
    const label=new Date(day).toDateString()===new Date().toDateString()?'Today':
      new Date(day).toDateString()===new Date(Date.now()-86400000).toDateString()?'Yesterday':
      fmtDateGroup(day);
    return '<div class="date-sep">'+label+'</div>'+
    txs.map(tx=>{
      const m=TX_META[tx.type]||{icon:'circle',bg:'ico-sky'};
      const desc=tx.dataPlan||tx.cablePlan||tx.discoName||tx.examType||TYPE_LABELS[tx.type]||tx.type;
      const isCr = tx.type === 'wallet_fund' || tx.type === 'refund' || tx.type === 'earncial_transfer';
      const sub=tx.phone||tx.smartCardNumber||tx.meterNumber||tx.network||'';
      return '<div class="txp" onclick="showTxDetail(\''+tx.requestId+'\')" data-txid="'+tx.requestId+'">'+
        '<div class="txp-ico '+m.bg+'"><i class="fas fa-'+m.icon+'"></i></div>'+
        '<div class="txp-body">'+
          '<div class="txp-desc">'+desc+'</div>'+
          '<div class="txp-meta">'+
            '<i class="fas fa-clock"></i>'+fmtDate(tx.createdAt)+
            (sub?'<span>·</span>'+sub:'')+
          '</div>'+
          '<div class="txp-ref">'+tx.requestId+'</div>'+
        '</div>'+
        '<div class="txp-r">'+
          '<div class="txp-amt '+(isCr?'crd':'dbt')+'">'+(isCr?'+':'-')+'₦'+fmt(tx.amount)+'</div>'+
          '<span class="bdg '+tx.status+'">'+tx.status+'</span>'+
        '</div>'+
      '</div>';
    }).join('');
  }).join('');
}

function showTxDetail(requestId){
  const tx=allTxns.find(t=>t.requestId===requestId);if(!tx)return;
  const fmt2=n=>parseFloat(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
  receiptData={txId:tx.requestId,service:tx.type,amt:tx.amount,status:tx.status,
    details:{
      ...(tx.phone   ?{Phone:tx.phone}:{}),
      ...(tx.network ?{Network:tx.network}:{}),
      ...(tx.dataPlan?{Plan:tx.dataPlan}:{}),
      ...(tx.cablePlan?{'Cable Plan':tx.cablePlan}:{}),
      ...(tx.discoName?{DISCO:tx.discoName}:{}),
      ...(tx.meterNumber?{'Meter':tx.meterNumber}:{}),
      ...(tx.smartCardNumber?{'Smart Card':tx.smartCardNumber}:{}),
      ...(tx.token?{'Token 🔑':tx.token}:{}),
      Date:fmtDate(tx.createdAt),
    },
    balBefore:tx.oldBalance,
    balAfter:tx.newBalance,
  };
  const ok=tx.status==='success';
  if($('recAmt'))$('recAmt').textContent='₦'+fmt2(tx.amount);
  if($('recRing'))$('recRing').className='rec-ring '+(ok?'ok':'fail');
  if($('recRingIco'))$('recRingIco').className='fas fa-'+(ok?'check':'times');
  if($('recStat')){$('recStat').className='rec-stat '+(ok?'ok':'fail');$('recStat').textContent=ok?'Transaction Successful!':'Transaction Failed';}

  const rows=[
    {l:'Reference',v:'<span class="rrv txid">'+tx.requestId+'</span>'},
    {l:'Service',v:(TYPE_LABELS[tx.type]||tx.type)},
    ...Object.entries(receiptData.details).map(([k,v])=>({l:k,v})),
    ...(tx.oldBalance!==undefined?[{l:'Balance Before',v:'₦'+fmt2(tx.oldBalance)}]:[]),
    ...(tx.newBalance!==undefined?[{l:'Balance After',v:'<span style="color:var(--pr);font-weight:800">₦'+fmt2(tx.newBalance)+'</span>'}]:[]),
    {l:'Status',v:'<span class="bdg '+tx.status+'">'+tx.status+'</span>'},
  ];
  if($('recRows'))$('recRows').innerHTML=rows.map(r=>'<div class="rr"><span class="rrl">'+r.l+'</span><span class="rrv">'+r.v+'</span></div>').join('');
  openModal('receiptModal');
}

function downloadReceipt(){
  if(!receiptData)return;
  const r=receiptData;
  const fmt2=n=>parseFloat(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
  const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SubHub Receipt</title><style>*{margin:0;padding:0;box-sizing:border-box;font-family:sans-serif}body{background:#f0f7ff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#fff;border-radius:20px;padding:28px;max-width:380px;width:100%;border:1px solid #e0eaf5}.logo{text-align:center;margin-bottom:18px}.logo h1{color:#00aaff;font-size:1.3rem;font-weight:800}.ring{width:58px;height:58px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:#fff;background:'+(r.status==='success'?'#10b981':'#ef4444')+'}.amt{text-align:center;font-size:1.9rem;font-weight:800}.stat{text-align:center;font-size:.78rem;font-weight:700;color:'+(r.status==='success'?'#10b981':'#ef4444')+';margin:3px 0 14px}table{width:100%;border-collapse:collapse}td{padding:8px 5px;border-bottom:1px solid #e0eaf5;font-size:.78rem}td:first-child{color:#64748b;font-weight:600}td:last-child{text-align:right;font-weight:700}.footer{text-align:center;margin-top:16px;font-size:.66rem;color:#94a3b8}</style></head><body><div class="card"><div class="logo"><h1>SubHub</h1><p style="color:#64748b;font-size:.72rem">Official Receipt</p></div><div class="ring">'+(r.status==='success'?'✓':'✗')+'</div><div class="amt">₦'+fmt2(r.amt)+'</div><div class="stat">'+(r.status==='success'?'Transaction Successful':'Transaction Failed')+'</div><table>'+Object.entries(r.details).map(([k,v])=>'<tr><td>'+k+'</td><td>'+v+'</td></tr>').join('')+(r.balBefore!==undefined?'<tr><td>Balance Before</td><td>₦'+fmt2(r.balBefore)+'</td></tr><tr><td>Balance After</td><td>₦'+fmt2(r.balAfter)+'</td></tr>':'')+'<tr><td>Reference</td><td style="font-family:monospace;font-size:.68rem">'+r.txId+'</td></tr></table><div class="footer">SubHub VTU Platform · Thank you!</div></div></body></html>';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download='SubHub-'+r.txId+'.html';document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast('Receipt downloaded!','green');
}

async function openFundModal(){
  const d=await apiCall('/auth/me');
  if(!d||!d.success)return;
  const va=d.user?.virtualAccount;
  if(va&&va.accountNumber){
    if($('fundVABank'))$('fundVABank').textContent=va.bankName||'—';
    if($('fundVANumber'))$('fundVANumber').textContent=va.accountNumber;
    if($('fundVAName'))$('fundVAName').textContent=va.accountName||'—';
    if($('fundVAContent'))$('fundVAContent').style.display='block';
    if($('fundNoVA'))$('fundNoVA').style.display='none';
  }else{
    if($('fundVAContent'))$('fundVAContent').style.display='none';
    if($('fundNoVA'))$('fundNoVA').style.display='block';
    const genBtn=$('fundGenVA');
    if(genBtn)genBtn.onclick=async()=>{
      genBtn.disabled=true;genBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i><span>Generating…</span>';
      const r=await apiCall('/wallet/virtual-account',{method:'POST'});
      if(r?.success){
        const v=r.virtualAccount;
        if($('fundVABank'))$('fundVABank').textContent=v.bankName||'—';
        if($('fundVANumber'))$('fundVANumber').textContent=v.accountNumber;
        if($('fundVAName'))$('fundVAName').textContent=v.accountName||'—';
        if($('fundVAContent'))$('fundVAContent').style.display='block';
        if($('fundNoVA'))$('fundNoVA').style.display='none';
        toast('Virtual account generated!','green','Done!');
      }else{
        genBtn.disabled=false;genBtn.innerHTML='<i class="fas fa-plus"></i><span>Generate Virtual Account</span>';
        toast(r?.message||'Failed','red','Error');
      }
    };
  }
  openModal('fundModal');
}

function copyFundVA(){
  const num=$('fundVANumber')?.textContent;if(!num||num==='—')return;
  navigator.clipboard?.writeText(num).then(()=>toast('Account number copied!','green','Copied!'));
}

function shareReceipt(){
  if(!receiptData)return;
  const r=receiptData;
  const fmt2=n=>parseFloat(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
  const text='SubHub Receipt\n\nService: '+(TYPE_LABELS[r.service]||r.service)+'\nAmount: ₦'+fmt2(r.amt)+'\nRef: '+r.txId+'\nStatus: '+r.status+'\nDate: '+new Date().toLocaleString('en-NG');
  if(navigator.share)navigator.share({title:'SubHub Receipt',text});
  else{navigator.clipboard?.writeText(text);toast('Receipt copied!','green');}
}

// VERIFY BANNER
let resendCooldown=0,resendTimer=null;

function checkVerified(){
  // USER is already loaded from fetchTxns — no extra API call needed
  if(currentUser&&!currentUser.isVerified){
    const b=$('verifyBanner');if(b)b.style.display='block';
  }
}

async function resendVerification(){
  const btn=$('vbResendBtn');if(!btn||btn.disabled)return;
  btn.disabled=true;
  btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>Sending…';
  const d=await apiCall('/auth/resend-verification',{method:'POST',body:JSON.stringify({email:currentUser?.email||''})});
  if(d?.success){
    toast(d.message||'Verification email sent!','green','Sent!');
    startResendCooldown(60);
  }else{
    toast(d?.message||'Failed to send','red','Error');
    btn.disabled=false;
    btn.innerHTML='<i class="fas fa-paper-plane"></i>Resend Email';
  }
}

function startResendCooldown(secs){
  resendCooldown=secs;
  const btn=$('vbResendBtn'),cd=$('vbCountdown');
  if(btn)btn.innerHTML='<i class="fas fa-clock"></i>Wait '+secs+'s';
  if(resendTimer)clearInterval(resendTimer);
  resendTimer=setInterval(()=>{
    resendCooldown--;
    if(btn)btn.innerHTML='<i class="fas fa-clock"></i>Wait '+resendCooldown+'s';
    if(cd)cd.textContent='('+resendCooldown+'s)';
    if(resendCooldown<=0){
      clearInterval(resendTimer);
      if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i>Resend Email';}
      if(cd)cd.textContent='';
    }
  },1000);
}
