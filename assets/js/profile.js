
const API_BASE  = 'https://api.subhub.com.ng/api';
const TOKEN_KEY = 'sh_access_token';
const REFRESH_KEY='sh_refresh_token';
const $         = id => document.getElementById(id);
const fmt       = n  => parseFloat(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtK      = n  => n>=1e6?'₦'+(n/1e6).toFixed(1)+'M':n>=1e3?'₦'+(n/1e3).toFixed(0)+'K':'₦'+fmt(n);
const fmtD      = d  => new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});

let USER=null, WALLET=null;
let cpPhase=1, cpBuf='', cpNewPIN='', cpCurrentPIN=''; // FIX: added cpCurrentPIN

// DARK MODE
function applyDark(on){document.documentElement.setAttribute('data-theme',on?'dark':'light');const i=$('dmIco');if(i)i.className='fas fa-'+(on?'sun':'moon');}
const isDark=()=>localStorage.getItem('sh_dark')==='1';
applyDark(isDark());
$('dmBtn')?.addEventListener('click',()=>{const nd=!isDark();localStorage.setItem('sh_dark',nd?'1':'0');applyDark(nd);});

// PROC OVERLAY
function showProc(title,sub){if($('procTitle'))$('procTitle').textContent=title||'Processing…';if($('procSub'))$('procSub').textContent=sub||'Please wait';$('procOv')?.classList.add('show');}
function hideProc(){$('procOv')?.classList.remove('show');}

// TOAST
const TICONS={green:{icon:'fa-circle-check',cls:'green',title:'Success'},red:{icon:'fa-circle-xmark',cls:'red',title:'Error'},blue:{icon:'fa-circle-info',cls:'blue',title:'Info'},warn:{icon:'fa-triangle-exclamation',cls:'warn',title:'Warning'}};
function toast(msg,type,title){
  const con=$('toastContainer');if(!con)return;
  type=type||'blue';const cfg=TICONS[type]||TICONS.blue;
  const id='toast_'+Date.now();const el=document.createElement('div');
  el.className='toast-item';el.id=id;el.style.cssText='position:relative;overflow:hidden';
  el.innerHTML='<div class="toast-ico '+cfg.cls+'"><i class="fas '+cfg.icon+'"></i></div><div class="toast-body"><div class="toast-title">'+(title||cfg.title)+'</div><div class="toast-msg">'+msg+'</div></div><button class="toast-close" onclick="dismissToast(\''+id+'\')"><i class="fas fa-times"></i></button><div class="toast-progress '+cfg.cls+'" id="prog_'+id+'" style="width:100%"></div>';
  con.appendChild(el);
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
  }catch{toast('Network error, please check connection','red','Error');return null;}
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

// SKELETON
function showSkeleton(){
  $('pgBody').innerHTML=
  '<div class="sk-hero">'+
  '<div class="sk sk-av"></div>'+
  '<div class="sk sk-line" style="width:55%"></div>'+
  '<div class="sk sk-line" style="width:35%"></div>'+
  '<div style="margin-top:8px"><span class="sk sk-badge"></span><span class="sk sk-badge"></span></div>'+
  '</div>'+
  '<div class="sk-w3"><div class="sk-wc"><div class="sk"></div><div class="sk"></div></div><div class="sk-wc"><div class="sk"></div><div class="sk"></div></div><div class="sk-wc"><div class="sk"></div><div class="sk"></div></div></div>'+
  '<div class="sk-card">'+
  skrow()+skrow()+skrow()+
  '</div>'+
  '<div class="sk-card">'+
  skrow()+skrow()+skrow()+skrow()+skrow()+
  '</div>'+
  '<div class="sk-card">'+skrow()+skrow()+'</div>';
}
function skrow(){return '<div class="sk-row"><div class="sk sk-ico"></div><div class="sk-body"><div class="sk sk-line" style="width:40%;margin-bottom:6px"></div><div class="sk sk-line" style="width:70%;margin:0"></div></div></div>';}

// INIT
document.addEventListener('DOMContentLoaded',async()=>{
  if(!localStorage.getItem(TOKEN_KEY)){location.href='login.html';return;}
  showSkeleton();
  const d=await apiCall('/auth/me');
  if(!d){toast('Could not load profile, please try again','red','Error');return;}
  if(!d.success){toast(d.message||'Session expired','red','Error');return;}
  USER=d.user;
  WALLET={balance:d.wallet.balance,totalFunded:d.wallet.totalFunded,totalSpent:d.wallet.totalSpent};
  renderPage();

  document.addEventListener('click',e=>{
    const cl=e.target.closest('[data-close]');if(cl)closeModal(cl.dataset.close);
  });
  document.querySelectorAll('.ov').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)closeModal(ov.id);}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.ov.show').forEach(o=>closeModal(o.id));});
  $('pwdSubmit')?.addEventListener('click',doChangePwd);
  $('cpKp')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-cpk]');if(!btn)return;
    const k=btn.dataset.cpk;
    if(k==='del'){cpBuf=cpBuf.slice(0,-1);updateCpDots();}
    else if(k!=='fp'&&cpBuf.length<4){cpBuf+=k;updateCpDots();if(cpBuf.length===4)setTimeout(procCP,150);}
  });
});

// RENDER
function renderPage(){
  const u=USER, w=WALLET;
  const isVerified = u.isVerified !== undefined ? u.isVerified : true;
  const avHtml=u.profilePicture
    ?'<img class="prof-av-img" src="'+u.profilePicture+'" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/><div class="prof-av-fb" style="display:none">'+u.fullName[0].toUpperCase()+'</div>'
    :'<div class="prof-av-fb">'+u.fullName[0].toUpperCase()+'</div>';

  $('pgBody').innerHTML=
  '<div class="prof-hero">'+
  '<div class="prof-av-wrap">'+avHtml+'</div>'+
  '<div class="prof-name">'+u.fullName+'</div>'+
  '<div class="prof-username">@'+u.username+'</div>'+
  '<div class="prof-badges">'+
  '<span class="pb active"><i class="fas fa-circle-check"></i>Active</span>'+
  '<span class="pb '+(isVerified?'verified':'unverified')+'"><i class="fas fa-'+(isVerified?'shield-check':'shield-xmark')+'"></i>'+(isVerified?'Email Verified':'Not Verified')+'</span>'+
  '</div></div>'+

  // FIX: Email verification banner — only shows if not verified
  (!isVerified?
  '<div class="ev-banner" id="evBanner">'+
  '<div class="ev-banner-top">'+
  '<div class="ev-banner-icon"><i class="fas fa-envelope-open-text"></i></div>'+
  '<div>'+
  '<div class="ev-banner-title">Verify your email address</div>'+
  '<div class="ev-banner-desc">A verification link was sent to <strong style="color:var(--text)">'+u.email+'</strong>. Verify to unlock all features.</div>'+
  '</div></div>'+
  '<div class="ev-perks">'+
  '<div class="ev-perk"><i class="fas fa-bell"></i>Get notified on every successful or failed transaction</div>'+
  '<div class="ev-perk"><i class="fas fa-rocket"></i>Early access to new features and updates</div>'+
  '<div class="ev-perk"><i class="fas fa-shield-halved"></i>Receive security alerts and login notifications</div>'+
  '</div>'+
  '<div class="ev-banner-foot">'+
  '<span class="ev-no-email">Didn\'t get the email?</span>'+
  '<button class="ev-resend-btn" id="evResendBtn" onclick="resendVerification()"><i class="fas fa-paper-plane"></i>Resend Email</button>'+
  '</div></div>':'')+

  '<div class="w3">'+
  '<div class="wc"><div class="wc-v" style="color:var(--pr)">'+fmtK(w.balance)+'</div><div class="wc-l">Balance</div></div>'+
  '<div class="wc"><div class="wc-v" style="color:var(--success)">'+fmtK(w.totalFunded)+'</div><div class="wc-l">Funded</div></div>'+
  '<div class="wc"><div class="wc-v" style="color:var(--danger)">'+fmtK(w.totalSpent)+'</div><div class="wc-l">Spent</div></div>'+
  '</div>'+

  (u.virtualAccount?.accountNumber?
  '<div class="va-card"><div class="va-in">'+
  '<div class="va-top">'+
  '<div><div class="va-lbl">Virtual Account</div><div class="va-bank">'+u.virtualAccount.bankName+'</div></div>'+
  '<button class="va-copy-btn" id="vaCopyBtn" onclick="copyVA()"><i class="fas fa-copy"></i>Copy</button>'+
  '</div>'+
  '<div class="va-num">'+u.virtualAccount.accountNumber+'</div>'+
  '<div class="va-name">'+u.virtualAccount.accountName+'</div>'+
  '<div class="va-fee"><i class="fas fa-circle-info"></i>1.5% fee applies per transaction</div>'+
  '</div></div>':'')+

  '<div class="info-sec">'+
  '<div class="info-sec-title"><i class="fas fa-user"></i>Personal Information</div>'+
  ir('fa-user','Full Name',u.fullName)+
  ir('fa-at','Username','@'+u.username)+
  ir('fa-envelope','Email',u.email)+
  ir('fa-phone','Phone',u.phone||'—')+
  ir('fa-calendar','Member Since',fmtD(u.createdAt))+
  '</div>'+

  '<div class="info-sec">'+
  '<div class="info-sec-title"><i class="fas fa-shield-halved"></i>Security</div>'+
  sr('fa-lock','rgba(0,170,255,.1)','var(--pr)','Change Password','Update your login password',"openModal('pwdModal')")+
  sr('fa-key','rgba(245,158,11,.1)','var(--warning)','Change PIN','Update your 4-digit transaction PIN','openChangePIN()')+
  '</div>';
}

function ir(ico,lbl,val){
  return '<div class="irow"><div class="ir-ico"><i class="fas '+ico+'"></i></div><div class="ir-body"><div class="ir-lbl">'+lbl+'</div><div class="ir-val">'+val+'</div></div></div>';
}
function sr(ico,bg,color,title,sub,fn){
  return '<div class="sec-row"><div class="sr-left"><div class="sr-ico" style="background:'+bg+';color:'+color+'"><i class="fas '+ico+'"></i></div><div><div class="sr-title">'+title+'</div><div class="sr-sub">'+sub+'</div></div></div><button class="sr-btn" onclick="'+fn+'"><i class="fas fa-chevron-right"></i></button></div>';
}

// RESEND VERIFICATION — NEW
async function resendVerification(){
  const btn=$('evResendBtn');
  if(!btn||btn.disabled)return;
  const email=USER?.email;if(!email)return;
  btn.disabled=true;
  btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i>Sending…';
  const d=await apiCall('/auth/resend-verification',{method:'POST',body:JSON.stringify({email})});
  if(d?.success){
    btn.classList.add('sent');
    btn.innerHTML='<i class="fas fa-check"></i>Email Sent!';
    toast('Verification email sent!','green','Sent!');
    setTimeout(()=>{if(btn){btn.disabled=false;btn.classList.remove('sent');btn.innerHTML='<i class="fas fa-paper-plane"></i>Resend Email';}},60000);
  }else{
    btn.disabled=false;
    btn.innerHTML='<i class="fas fa-paper-plane"></i>Resend Email';
    toast(d?.message||'Failed to send email','red','Error');
  }
}

// OPEN VA MODAL (Fund button)
function openVAModal(){
  const u=USER;
  if(!u?.virtualAccount?.accountNumber){
    toast('Virtual account not set up yet','warn','Notice');return;
  }
  const va=u.virtualAccount;
  $('vaModalBody').innerHTML=
    '<div class="va-card" style="margin-bottom:0"><div class="va-in">'+
    '<div class="va-top">'+
    '<div><div class="va-lbl">Bank</div><div class="va-bank">'+va.bankName+'</div></div>'+
    '<button class="va-copy-btn" id="vaCopyBtn2" onclick="copyVAModal()"><i class="fas fa-copy"></i>Copy</button>'+
    '</div>'+
    '<div class="va-num">'+va.accountNumber+'</div>'+
    '<div class="va-name">'+va.accountName+'</div>'+
    '<div class="va-fee"><i class="fas fa-circle-info"></i>1.5% fee applies per transaction</div>'+
    '</div></div>';
  openModal('vaModal');
}

function copyVAModal(){
  const num=USER?.virtualAccount?.accountNumber;if(!num)return;
  navigator.clipboard.writeText(num).then(()=>{
    const btn=$('vaCopyBtn2');
    if(btn){btn.className='va-copy-btn copied';btn.innerHTML='<i class="fas fa-check"></i>Copied!';}
    toast('Account number copied!','green','Copied!');
    setTimeout(()=>{if(btn){btn.className='va-copy-btn';btn.innerHTML='<i class="fas fa-copy"></i>Copy';}},2000);
  }).catch(()=>toast('Copy failed','red',''));
}

// VA COPY
function copyVA(){
  const num=USER?.virtualAccount?.accountNumber;if(!num)return;
  navigator.clipboard.writeText(num).then(()=>{
    const btn=$('vaCopyBtn');
    if(btn){btn.className='va-copy-btn copied';btn.innerHTML='<i class="fas fa-check"></i>Copied!';}
    toast('Account number copied!','green','Copied!');
    setTimeout(()=>{if(btn){btn.className='va-copy-btn';btn.innerHTML='<i class="fas fa-copy"></i>Copy';}},2000);
  }).catch(()=>toast('Copy failed','red',''));
}

// EYE TOGGLE
function toggleEye(id,btn){
  const inp=$(id);if(!inp)return;
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.innerHTML='<i class="fas fa-'+(show?'eye-slash':'eye')+'"></i>';
}

// CHANGE PASSWORD — FIX: method PUT, fields currentPassword/newPassword
async function doChangePwd(){
  const old=$('pwdOld')?.value?.trim();
  const n1=$('pwdNew')?.value?.trim();
  const n2=$('pwdConf')?.value?.trim();
  const errEl=$('pwdErr');
  if(errEl)errEl.textContent='';
  if(!old||!n1||!n2){if(errEl)errEl.textContent='All fields are required';return;}
  if(n1.length<6){if(errEl)errEl.textContent='New password must be at least 6 characters';return;}
  if(n1!==n2){if(errEl)errEl.textContent='Passwords do not match';return;}
  const btn=$('pwdSubmit');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i><span>Saving…</span>';}
  showProc('Changing Password…','Please wait');
  const d=await apiCall('/auth/change-password',{method:'PUT',body:JSON.stringify({currentPassword:old,newPassword:n1})});
  hideProc();
  if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i><span>Save Password</span>';}
  if(d?.success){
    toast(d.message||'Password changed!','green','Done!');
    closeModal('pwdModal');
    $('pwdOld').value='';$('pwdNew').value='';$('pwdConf').value='';
  }else{
    if(errEl)errEl.textContent=d?.message||'Failed to change password';
  }
}

// CHANGE PIN
function openChangePIN(){
  cpPhase=1;cpBuf='';cpNewPIN='';cpCurrentPIN=''; // FIX: reset cpCurrentPIN
  if($('cpInstr'))$('cpInstr').textContent='Enter your current PIN';
  if($('cpErr'))$('cpErr').textContent='';
  updateCpDots();
  for(let i=1;i<=3;i++){const s=$('cps'+i);if(s)s.classList.toggle('on',i<=1);}
  openModal('cpModal');
}

function updateCpDots(){
  for(let i=0;i<4;i++){const d=$('cpd'+i);if(d)d.classList.toggle('on',i<cpBuf.length);}
}

function updateCPSteps(){
  for(let i=1;i<=3;i++){const s=$('cps'+i);if(s)s.classList.toggle('on',i<=cpPhase);}
}

async function procCP(){
  if(cpPhase===1){
    const d=await apiCall('/auth/verify-pin',{method:'POST',body:JSON.stringify({pin:cpBuf})});
    if(!d||!d.success){
      if($('cpErr'))$('cpErr').textContent='Incorrect PIN';
      cpBuf='';updateCpDots();return;
    }
    cpCurrentPIN=cpBuf; // FIX: save verified current PIN
    cpPhase=2;cpBuf='';
    if($('cpInstr'))$('cpInstr').textContent='Enter your new PIN';
    if($('cpErr'))$('cpErr').textContent='';
    updateCPSteps();updateCpDots();
  } else if(cpPhase===2){
    cpNewPIN=cpBuf;cpBuf='';cpPhase=3;
    if($('cpInstr'))$('cpInstr').textContent='Confirm your new PIN';
    updateCPSteps();updateCpDots();
  } else {
    if(cpBuf!==cpNewPIN){
      if($('cpErr'))$('cpErr').textContent='PINs do not match';
      cpBuf='';cpPhase=2;cpNewPIN='';
      if($('cpInstr'))$('cpInstr').textContent='Enter your new PIN';
      updateCPSteps();updateCpDots();return;
    }
    showProc('Changing PIN…','Please wait');
    // FIX: send cpCurrentPIN (phase 1 verified), not cpBuf (confirm input)
    const d=await apiCall('/auth/change-pin',{method:'PUT',body:JSON.stringify({currentPin:cpCurrentPIN,newPin:cpNewPIN})});
    hideProc();
    if(!d||!d.success){if($('cpErr'))$('cpErr').textContent=d?.message||'Failed to change PIN';return;}
    closeModal('cpModal');
    toast('PIN changed successfully!','green');
  }
}
