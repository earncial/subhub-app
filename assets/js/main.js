/* ════════════════════════════════════════════════════
   CURSOR
════════════════════════════════════════════════════ */
const ring = document.getElementById('cursorRing');
const dot  = document.getElementById('cursorDot');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.left=mx+'px';dot.style.top=my+'px';});
(function raf(){rx+=(mx-rx)*.12;ry+=(my-ry)*.12;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(raf)})();
document.querySelectorAll('a,button,.svc-card,.bento-card,.price-card,.testi-card,.faq-q,.float-card').forEach(el=>{
  el.addEventListener('mouseenter',()=>ring.classList.add('hover'));
  el.addEventListener('mouseleave',()=>ring.classList.remove('hover'));
});
document.addEventListener('mousedown',()=>ring.classList.add('click'));
document.addEventListener('mouseup',()=>ring.classList.remove('click'));

/* ════════════════════════════════════════════════════
   NAV
════════════════════════════════════════════════════ */
const nav = document.getElementById('mainNav');
const sections = ['about','services','how','features','pricing','faq'];
window.addEventListener('scroll',()=>{
  nav.classList.toggle('scrolled',window.scrollY > 40);
  document.getElementById('floatingCta').classList.toggle('show',window.scrollY > 600);
  // Active nav link
  let cur = '';
  sections.forEach(id=>{
    const el = document.getElementById(id);
    if(el && window.scrollY >= el.offsetTop - 120) cur = id;
  });
  document.querySelectorAll('.nav-link').forEach(l=>{
    l.classList.remove('active');
    const attr = l.getAttribute('onclick');
    if(attr && (attr.includes("scrollToSection('"+cur+"')") || attr.includes("'"+cur+"'"))) l.classList.add('active');
  });
});

const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');
const mobOverlay = document.getElementById('mobOverlay');
const nmClose = document.getElementById('nmClose');
function openMobileNav(){
  hamburger.classList.add('open');
  mobileNav.classList.add('open');
  mobOverlay.classList.add('show');
  document.body.style.overflow='hidden';
}
function closeMobileNav(){
  hamburger.classList.remove('open');
  mobileNav.classList.remove('open');
  mobOverlay.classList.remove('show');
  document.body.style.overflow='';
}
hamburger.addEventListener('click', openMobileNav);
if(nmClose) nmClose.addEventListener('click', closeMobileNav);
mobOverlay.addEventListener('click', closeMobileNav);

function scrollToSection(id){
  document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  closeMobileNav();
}

/* ════════════════════════════════════════════════════
   PHONE TIME
════════════════════════════════════════════════════ */
function updatePhoneTime(){
  const d=new Date();
  document.getElementById('phoneTime').textContent=d.toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit',hour12:false});
}
updatePhoneTime();setInterval(updatePhoneTime,30000);

/* ════════════════════════════════════════════════════
   ONLINE COUNT FLICKER
════════════════════════════════════════════════════ */
setInterval(()=>{
  const base=2841;
  const n=base+Math.floor(Math.random()*60)-30;
  const el=document.getElementById('onlineCount');
  if(el)el.textContent=n.toLocaleString();
},4000);

/* ════════════════════════════════════════════════════
   TICKER
════════════════════════════════════════════════════ */
const tickerItems=[
  {icon:'fas fa-wifi',text:'MTN 1GB - ₦420'},
  {icon:'fas fa-wifi',text:'Airtel 2GB - ₦570'},
  {icon:'fas fa-phone',text:'Instant Airtime - All Networks'},
  {icon:'fas fa-tv',text:'DStv Compact - ₦9,000'},
  {icon:'fas fa-bolt',text:'Electricity Tokens - All DISCOs'},
  {icon:'fas fa-graduation-cap',text:'WAEC Checker - ₦3,350'},
  {icon:'fas fa-id-card',text:'Recharge Cards - Bulk Discounts'},
  {icon:'fas fa-comment-dots',text:'Bulk SMS - ₦4 per unit'},
  {icon:'fas fa-shield-halved',text:'100% Secure & Trusted'},
  {icon:'fas fa-bolt',text:'1.2s Average Delivery'},
];
const doubled=[...tickerItems,...tickerItems];
const track=document.getElementById('tickerTrack');
if(track){
  track.innerHTML=doubled.map(t=>`
    <div class="ticker-item">
      <i class="${t.icon}"></i>${t.text}
      <div class="ticker-dot"></div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════════════════ */
const observer=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('visible');
      // Trigger stat counters when in view
      if(e.target.dataset.target)animateCounter(e.target);
      // Trigger savings fill
      if(e.target.id==='savingsFill'){setTimeout(()=>{e.target.style.width='84%'},200);}
      observer.unobserve(e.target);
    }
  });
},{threshold:.1,rootMargin:'0px 0px -50px 0px'});
document.querySelectorAll('.reveal,[data-target]').forEach(el=>observer.observe(el));

/* ════════════════════════════════════════════════════
   COUNTER ANIMATION
════════════════════════════════════════════════════ */
function animateCounter(el){
  const target=parseInt(el.dataset.target);
  const prefix=el.dataset.prefix||'';
  const suffix=el.dataset.suffix||'';
  const duration=2000;
  const start=Date.now();
  function tick(){
    const t=Math.min((Date.now()-start)/duration,1);
    const ease=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    const cur=Math.floor(ease*target);
    const fmt=cur>=1000?cur.toLocaleString():cur.toString();
    el.textContent=prefix+fmt+suffix;
    if(t<1)requestAnimationFrame(tick);
    else el.textContent=prefix+target.toLocaleString()+suffix;
  }
  tick();
}
document.querySelectorAll('[data-target]').forEach(el=>observer.observe(el));

/* ════════════════════════════════════════════════════
   PRICING DATA
════════════════════════════════════════════════════ */
const PRICING_DATA = {
  data: [
    {
      name:'Starter Data',
      amount:'₦300',period:'per 1GB',
      desc:'Best for casual users fast, reliable SME data.',
      popular:false,
      features:[
        {text:'MTN / Airtel / Glo / 9Mobile',yes:true},
        {text:'30-day validity',yes:true},
        {text:'Instant delivery',yes:true},
        {text:'Gifting included',yes:false},
        {text:'Cooperative plans',yes:false},
      ],
      btn:'class="btn-price btn-price-outline"',
    },
    {
      name:'Popular Bundle',
      amount:'₦550',period:'per 2GB',
      desc:'Best value — most popular among SubHub users.',
      popular:true,
      features:[
        {text:'All 4 networks',yes:true},
        {text:'30-day validity',yes:true},
        {text:'Instant delivery',yes:true},
        {text:'Data gifting available',yes:true},
        {text:'Priority routing',yes:true},
      ],
      btn:'class="btn-price btn-price-solid"',
    },
    {
      name:'Power Bundle',
      amount:'₦1,300',period:'per 5GB',
      desc:'For heavy users and resellers who need more.',
      popular:false,
      features:[
        {text:'All 4 networks',yes:true},
        {text:'30-day validity',yes:true},
        {text:'Instant delivery',yes:true},
        {text:'Cooperative & gifting',yes:true},
        {text:'Print voucher cards',yes:true},
      ],
      btn:'class="btn-price btn-price-outline"',
    },
  ],
  airtime:[
    {name:'Small Top-Up',amount:'₦50',period:'minimum',desc:'Quick airtime for emergencies. All networks, no minimum.',popular:false,features:[{text:'Any Nigerian network',yes:true},{text:'Instant delivery',yes:true},{text:'No extra charge',yes:true},{text:'Bulk purchase',yes:false},{text:'Reseller pricing',yes:false}],btn:'class="btn-price btn-price-outline"'},
    {name:'Standard',amount:'₦200',period:'and above',desc:'Most common top-up amount — great for daily use.',popular:true,features:[{text:'All 4 networks',yes:true},{text:'Instant delivery',yes:true},{text:'No hidden fees',yes:true},{text:'Transaction receipt',yes:true},{text:'Auto re-charge option',yes:true}],btn:'class="btn-price btn-price-solid"'},
    {name:'Bulk Airtime',amount:'₦1,000',period:'and above',desc:'For resellers — discounted rates on large purchases.',popular:false,features:[{text:'Reseller discounts',yes:true},{text:'All networks',yes:true},{text:'Instant delivery',yes:true},{text:'Printable receipts',yes:true},{text:'Dedicated support',yes:true}],btn:'class="btn-price btn-price-outline"'},
  ],
  cable:[
    {name:'GOtv',amount:'₦1,575',period:'Smallie',desc:'Affordable TV for homes and personal use.',popular:false,features:[{text:'GOtv Smallie plan',yes:true},{text:'Instant activation',yes:true},{text:'Smart card number',yes:true},{text:'Premium channels',yes:false},{text:'Multiple bouquets',yes:false}],btn:'class="btn-price btn-price-outline"'},
    {name:'DStv Compact',amount:'₦9,000',period:'monthly',desc:'Most popular DStv plan — great value entertainment.',popular:true,features:[{text:'100+ channels',yes:true},{text:'Instant activation',yes:true},{text:'MultiChoice backed',yes:true},{text:'Sports channels',yes:true},{text:'Auto renewal option',yes:true}],btn:'class="btn-price btn-price-solid"'},
    {name:'DStv Premium',amount:'₦21,000',period:'monthly',desc:'The ultimate entertainment experience — all channels.',popular:false,features:[{text:'All 200+ channels',yes:true},{text:'Instant activation',yes:true},{text:'EPL & Sports pack',yes:true},{text:'4K content',yes:true},{text:'Priority support',yes:true}],btn:'class="btn-price btn-price-outline"'},
  ],
  elec:[
    {name:'Prepaid Token',amount:'₦1,000',period:'minimum',desc:'Minimum top-up for any prepaid meter in Nigeria.',popular:false,features:[{text:'All 10 DISCOs',yes:true},{text:'Token via SMS',yes:true},{text:'Instant vending',yes:true},{text:'Bulk purchase',yes:false},{text:'Postpaid supported',yes:false}],btn:'class="btn-price btn-price-outline"'},
    {name:'Standard Recharge',amount:'₦5,000',period:'popular',desc:'Most popular electricity recharge amount for homes.',popular:true,features:[{text:'All 10 DISCOs',yes:true},{text:'Prepaid & postpaid',yes:true},{text:'Token via SMS/app',yes:true},{text:'Receipt download',yes:true},{text:'Transaction history',yes:true}],btn:'class="btn-price btn-price-solid"'},
    {name:'Business Load',amount:'₦20,000',period:'and above',desc:'For businesses and commercial meter top-ups.',popular:false,features:[{text:'Commercial meters',yes:true},{text:'All DISCOs covered',yes:true},{text:'Bulk discounts',yes:true},{text:'Invoice generation',yes:true},{text:'Dedicated account',yes:true}],btn:'class="btn-price btn-price-outline"'},
  ],
};

let currentPricing='data';
function switchPricing(type){
  currentPricing=type;
  document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('active'));
  document.getElementById('ptab-'+type)?.classList.add('active');
  renderPricing(type);
}
function renderPricing(type){
  const plans=PRICING_DATA[type]||[];
  document.getElementById('pricingGrid').innerHTML=plans.map(p=>`
    <div class="price-card ${p.popular?'popular':''}">
      ${p.popular?'<div class="popular-badge">🔥 Most Popular</div>':''}
      <div class="price-name">${p.name}</div>
      <div class="price-amount">
        <span class="price-cur">₦</span>
        <span class="price-val">${p.amount.replace('₦','')}</span>
        <span class="price-period">${p.period}</span>
      </div>
      <div class="price-desc">${p.desc}</div>
      <div class="price-divider"></div>
      <div class="price-features">
        ${p.features.map(f=>`
          <div class="price-feature ${f.yes?'yes':'no'}">
            <i class="fas fa-${f.yes?'check':'times'}"></i>
            ${f.text}
          </div>
        `).join('')}
      </div>
      <button ${p.btn}>${p.popular?'<i class="fas fa-rocket"></i> Get Started':'Choose Plan'}</button>
    </div>
  `).join('');
}
renderPricing('data');

/* ════════════════════════════════════════════════════
   TESTIMONIALS
════════════════════════════════════════════════════ */
const TESTIS=[
  {name:'Aisha Musa',location:'Kano, Nigeria',rating:5,text:'SubHub is the best VTU app I\'ve ever used. I top up my family\'s phones and pay electricity bills every week. Never had a failed transaction!'},
  {name:'Chukwuemeka O.',location:'Lagos, Nigeria',rating:5,text:'The data prices are unbeatable. I\'ve been buying MTN data here for months and I save at least ₦2,000 a month compared to buying directly.'},
  {name:'Fatima Bello',location:'Abuja, Nigeria',rating:5,text:'SubHub has made paying bills so easy. I pay my electricity and cable TV every month — it takes less than 30 seconds and always works perfectly!'},
  {name:'Taiwo Adeleke',location:'Ibadan, Nigeria',rating:5,text:'As a data reseller, SubHub is my go-to platform. The bulk pricing and print data feature makes it easy to run my business profitably.'},
  {name:'Musa Garba',location:'Kaduna, Nigeria',rating:5,text:'I was skeptical at first but SubHub proved me wrong. Bought DStv and my electricity token at the same time — both delivered in under 2 minutes!'},
  {name:'Ngozi Okonkwo',location:'Enugu, Nigeria',rating:5,text:'Customer service is top-notch. I had an issue once and it was resolved in 5 minutes on WhatsApp. The platform is so fast and reliable.'},
  {name:'Ibrahim Sule',location:'Sokoto, Nigeria',rating:4,text:'Best app for students! Cheap data, no hidden charges. I use it every day for my MTN data and it always works. Highly recommend SubHub.'},
  {name:'Blessing Eze',location:'Port Harcourt',rating:5,text:'I\'ve tried many VTU apps but SubHub is a class apart. The interface is clean, the prices are fair and delivery is always instant.'},
];
const doubled2=[...TESTIS,...TESTIS];
const track2=document.getElementById('testiTrack');
if(track2){
  track2.innerHTML=doubled2.map(t=>`
    <div class="testi-card">
      <div class="testi-stars">${Array(t.rating).fill('<i class="fas fa-star"></i>').join('')}</div>
      <div class="testi-text">"${t.text}"</div>
      <div class="testi-author">
        <div class="testi-av">${t.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
        <div>
          <div class="testi-name">${t.name}</div>
          <div class="testi-location"><i class="fas fa-map-pin" style="font-size:.58rem;color:var(--sky)"></i> ${t.location}</div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════════════
   FAQ
════════════════════════════════════════════════════ */
const FAQS=[
  {q:'Is SubHub safe to use?',a:'Absolutely. SubHub uses 256-bit SSL encryption, two-factor authentication, and a 4-digit transaction PIN to protect every transaction. We also have real-time fraud detection. Your money is 100% safe with us.'},
  {q:'How fast are transactions processed?',a:'Most transactions complete in under 2 seconds. Data, airtime and cable subscriptions are delivered instantly. Electricity tokens may take up to 60 seconds in rare cases. We maintain a 99.8% success rate.'},
  {q:'What happens if a transaction fails?',a:'If a transaction fails, your wallet balance is never deducted. If money was deducted before a failure, it is automatically reversed within 24 hours. You can also contact our support team for immediate resolution.'},
  {q:'How do I fund my wallet?',a:'You can fund your SubHub wallet via bank transfer (we issue you a unique virtual account number), debit/credit card, USSD, or through a direct bank transfer to our official account. Funds reflect instantly.'},
  {q:'Can I use SubHub for my reselling business?',a:'Yes! SubHub has dedicated features for resellers including bulk data purchase, print data voucher cards, recharge card generation, and bulk SMS sending. Many Nigerians run profitable businesses using SubHub.'},
  {q:'What networks does SubHub support?',a:'SubHub supports MTN, Airtel, Glo and 9Mobile for data and airtime. For cable TV, we support DStv, GOtv and StarTimes. For electricity, we cover all 10 DISCOs in Nigeria including AEDC, IKEDC, EKEDC, Kano, PHED and more.'},
  {q:'Is there a minimum amount to buy?',a:'For airtime, the minimum is ₦50. For electricity, the minimum is ₦1,000. Data plans start from just ₦190 (500MB Glo). There is no minimum for cable TV you just select your plan.'},
  {q:'Is SubHub available on all devices?',a:'Yes! SubHub works perfectly as a web app on any device phone, tablet or computer. Just visit the website on your browser and you can use all features.'},
  {q:'Does SubHub have an app?',a:'Yes! SubHub has an Android app available on the Google Play Store. Simply search for "SubHub" and download the official app.'},
  {q:'Is SubHub available on iPhone?',a:'Yes! iPhone users can access SubHub through any web browser. The iOS app is coming soon.'},
];
const faqWrap=document.getElementById('faqWrap');
if(faqWrap){
  faqWrap.innerHTML=FAQS.map((f,i)=>`
    <div class="faq-item" id="faq-${i}">
      <button class="faq-q" onclick="toggleFAQ(${i})">
        <span class="faq-q-text">${f.q}</span>
        <div class="faq-icon"><i class="fas fa-plus"></i></div>
      </button>
      <div class="faq-a"><div class="faq-a-inner">${f.a}</div></div>
    </div>
  `).join('');
}
function toggleFAQ(i){
  const item=document.getElementById('faq-'+i);
  const wasOpen=item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(x=>x.classList.remove('open'));
  if(!wasOpen)item.classList.add('open');
}

/* ════════════════════════════════════════════════════
   SAVINGS FILL OBSERVER
════════════════════════════════════════════════════ */
const sf=document.getElementById('savingsFill');
if(sf){
  const sfObs=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting){setTimeout(()=>sf.style.width='84%',300);sfObs.disconnect();}
  },{threshold:.5});
  sfObs.observe(sf);
}
