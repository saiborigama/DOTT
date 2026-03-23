import { useState, useEffect, useRef, useCallback } from 'react'
import { api, setTokens, clearTokens, hasToken } from './api.js'

// ─── SVG Icon System ─────────────────────────────────────────────────────────
const Ic = {
  Home:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Search:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Box:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Heart:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  HeartFill:(p={}) => <svg {...p} viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  User:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Cart:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  Bell:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  ChevR:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevL:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  X:       (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Star:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  StarO:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Map:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Truck:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  Tag:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Share:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Shop:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><rect x="9" y="14" width="6" height="7" rx="1"/></svg>,
  Return:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>,
  Shield:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Phone:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.07 6.07l1.06-.97a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Mail:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Lock:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Plus:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Minus:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Gift:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  Sun:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>,
  Clock:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Repeat:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  Flash:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Settings:(p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
}
// Ripple button helper
function RippleBtn({children, onClick, className='', style={}, disabled=false, type='button'}) {
  const [rips, setRips] = useState([])
  const fire = e => {
    if (disabled) return
    const r = e.currentTarget.getBoundingClientRect()
    const id = Date.now()
    const x = e.clientX - r.left, y = e.clientY - r.top
    setRips(p => [...p, {id, x, y}])
    setTimeout(() => setRips(p => p.filter(r => r.id !== id)), 600)
    onClick && onClick(e)
  }
  return (
    <button type={type} className={className} style={{...style, position:'relative', overflow:'hidden'}} onClick={fire} disabled={disabled}>
      {rips.map(r => (
        <span key={r.id} style={{position:'absolute',borderRadius:'50%',background:'rgba(255,255,255,.35)',width:80,height:80,marginLeft:-40,marginTop:-40,left:r.x,top:r.y,animation:'rippleAnim .6s ease both',pointerEvents:'none'}}/>
      ))}
      {children}
    </button>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function haversine(a,b,c,d){if(!a||!c)return null;const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180;const q=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
const PLATFORM_FEE = 10
const FREE_DELIVERY_THRESHOLD = 999
const RETURN_REASONS = [
  {code:'WRONG_SIZE',label:'Wrong size delivered',type:'exchange'},
  {code:'DAMAGED',label:'Damaged item',type:'refund'},
  {code:'WRONG_PRODUCT',label:'Wrong product delivered',type:'refund'},
  {code:'CHANGED_MIND',label:'Changed my mind',type:'refund'},
]

function fuzzyProductScore(product, query=''){
  const q=(query||'').trim().toLowerCase()
  if(!q) return 0
  const name=(product.name||'').toLowerCase()
  const category=(product.category||'').toLowerCase()
  const brand=(product.brand||'').toLowerCase()
  const shop=(product.shopName||'').toLowerCase()
  const tags=(Array.isArray(product.tags)?product.tags:[]).filter(Boolean).join(' ').toLowerCase()
  const hay=[name,category,brand,shop,tags].filter(Boolean).join(' ')
  if(!hay) return 0
  let score=0
  if(hay.includes(q)) score+=8
  if(name.startsWith(q)) score+=10
  if(category.startsWith(q) || brand.startsWith(q)) score+=5
  q.split(/\s+/).filter(Boolean).forEach(word=>{
    if(name.includes(word))score+=4
    else if(category.includes(word) || brand.includes(word))score+=3
    else if(hay.includes(word))score+=2
  })
  return score
}

const CATS = [
  {id:'All',icon:'All'},         {id:'Fashion',icon:'Fashion'},    {id:'Kurtas',icon:'Kurtas'},
  {id:'Kurtis',icon:'Kurtis'},   {id:'Sarees',icon:'Sarees'},      {id:'Jeans',icon:'Jeans'},
  {id:'Dresses',icon:'Dresses'}, {id:'T-Shirts',icon:'T-Shirts'},  {id:'Footwear',icon:'Footwear'},
  {id:'Jackets',icon:'Jackets'}, {id:'Kids',icon:'Kids'},          {id:'Accessories',icon:'Acc.'},
]

const BANNERS = [
  {bg:'linear-gradient(120deg,#101e33 0%,#163654 100%)',title:'Everyday Fashion, Delivered Fast',sub:'Trusted local stores, polished listings, and doorstep delivery across Hyderabad.',badge:'DOTT STYLE',img:'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=900&q=80',accent:'#ffb84d'},
  {bg:'linear-gradient(120deg,#1b3b5a 0%,#235784 100%)',title:'Ethnic Wear With Premium Finish',sub:'Sarees, kurtas, and festive looks from verified neighbourhood sellers.',badge:'ETHNIC EDIT',img:'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=80',accent:'#ffd27a'},
  {bg:'linear-gradient(120deg,#25344d 0%,#3a567a 100%)',title:'Fresh Arrivals This Week',sub:'New drops in dresses, denim, jackets, and elevated daily essentials.',badge:'NEW IN',img:'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80',accent:'#ffe0a3'},
  {bg:'linear-gradient(120deg,#11314a 0%,#1f5d7c 100%)',title:'Verified Shops You Can Trust',sub:'Authentic products, transparent ratings, and faster delivery from nearby stores.',badge:'VERIFIED SELLERS',img:'https://images.unsplash.com/photo-1445205170230-053b83016050?w=900&q=80',accent:'#c9f0ff'},
]

const STATUS_META = {
  PENDING:          {label:'Order Placed',    color:'#b45309', bg:'#fffbeb'},
  CONFIRMED:        {label:'Confirmed',       color:'#1d4ed8', bg:'#eff6ff'},
  PACKING:          {label:'Preparing',       color:'#6d28d9', bg:'#f5f3ff'},
  PICKED_UP:        {label:'Picked Up',       color:'#0e7490', bg:'#ecfeff'},
  OUT_FOR_DELIVERY: {label:'Out for Delivery',color:'#c2410c', bg:'#fff7ed'},
  DELIVERED:        {label:'Delivered',       color:'#15803d', bg:'#f0fdf4'},
  CANCELLED:        {label:'Cancelled',       color:'#dc2626', bg:'#fef2f2'},
}

// ─── global toast ─────────────────────────────────────────────────────────────
let _setToasts, _tid = 0
function showToast(msg, type='info'){
  if(_setToasts){const id=++_tid;_setToasts(t=>[...t,{id,msg,type}]);setTimeout(()=>_setToasts(t=>t.filter(x=>x.id!==id)),3000)}
}
function Toasts(){
  const [ts,setTs]=useState([]);_setToasts=setTs
  if(!ts.length) return null
  return(
    <div style={{position:'fixed',top:70,right:16,zIndex:10000,display:'flex',flexDirection:'column',gap:8,pointerEvents:'none'}}>
      {ts.map(t=>(
        <div key={t.id} style={{
          padding:'11px 18px',borderRadius:12,fontSize:13,fontWeight:600,maxWidth:340,
          background:t.type==='success'?'#f0fdf4':t.type==='error'?'#fef2f2':'#eff6ff',
          color:t.type==='success'?'#166534':t.type==='error'?'#991b1b':'#1e40af',
          boxShadow:'0 8px 32px rgba(0,0,0,.15)',
          borderLeft:`4px solid ${t.type==='success'?'#22c55e':t.type==='error'?'#ef4444':'#60a5fa'}`,
          animation:'toastIn .3s cubic-bezier(.22,1,.36,1)',fontFamily:"'Plus Jakarta Sans',sans-serif"
        }}>{t.msg}</div>
      ))}
    </div>
  )
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
/* ════════════════════════════════════════════════════════════
   DOTT CUSTOMER — PREMIUM UI v4
   Design: Dark navy + Vibrant orange + Clean whites
════════════════════════════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap');

*{box-sizing:border-box;margin:0;padding:0}
:root{
  --or:#ff9900;--ord:#e47911;--orl:#fff4df;--orm:#ffd087;--or2:#ffb84d;
  --nv:#131921;--nv2:#232f3e;--nv3:#37475a;
  --bg:#eaeded;--surface:#ffffff;--br:#d5d9d9;--br2:#eef2f2;
  --tx:#0f1111;--mu:#565959;--mu2:#879596;
  --gn:#16a34a;--gnl:#f0fdf4;--gn2:#22c55e;
  --rd:#dc2626;--rdl:#fef2f2;
  --bl:#007185;--bll:#e6f7fb;--bl2:#008296;
  --pu:#7c3aed;--pul:#f5f3ff;--pu2:#8b5cf6;
  --fn:'Plus Jakarta Sans',sans-serif;
  --sh0:0 1px 2px rgba(15,17,17,.08);
  --sh1:0 2px 8px rgba(15,17,17,.1);
  --sh2:0 8px 24px rgba(15,17,17,.12);
  --sh3:0 18px 46px rgba(15,17,17,.16);
  --r4:4px;--r8:8px;--r12:12px;--r16:14px;--r20:18px;--r24:22px;--r100:100px;
  --or-grad:linear-gradient(135deg,#ffb84d,#ff9900);
  --nv-grad:linear-gradient(135deg,#131921,#232f3e);
  --gold-grad:linear-gradient(135deg,#f59e0b,#d97706);
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--tx);font-family:var(--fn);-webkit-font-smoothing:antialiased;overflow-x:hidden}
input,textarea,select,button{font-family:var(--fn)}
img{display:block}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}::-webkit-scrollbar-track{background:transparent}

/* ANIMATIONS */
@keyframes toastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.94) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes slideRight{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:-800px 0}100%{background-position:800px 0}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes heartPop{0%{transform:scale(1)}40%{transform:scale(1.5)}70%{transform:scale(.9)}100%{transform:scale(1)}}
@keyframes bannerIn{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:scale(1)}}
@keyframes countPulse{0%,100%{transform:scale(1);color:var(--or)}50%{transform:scale(1.04);color:var(--ord)}}
@keyframes checkBounce{0%{transform:scale(0) rotate(-45deg);opacity:0}60%{transform:scale(1.2) rotate(3deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes progressFill{from{width:0}to{width:var(--w)}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,.4)}60%{box-shadow:0 0 0 10px rgba(249,115,22,0)}}
@keyframes ripple{0%{transform:scale(0);opacity:.5}100%{transform:scale(4);opacity:0}}
@keyframes confetti{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
@keyframes tickDown{0%{transform:scaleY(1)}50%{transform:scaleY(.85)}100%{transform:scaleY(1)}}

/* LAYOUT */
.wrap{max-width:1500px;margin:0 auto;padding:0 18px}
.page{min-height:80vh;padding-bottom:80px}

/* TOP NAV */
.topnav{background:linear-gradient(180deg,#101722 0%,#172231 58%,#101722 100%);position:sticky;top:0;z-index:300;box-shadow:0 10px 34px rgba(0,0,0,.22);border-bottom:1px solid rgba(255,255,255,.05)}
.topnav-inner{max-width:1400px;margin:0 auto;padding:0 16px;display:flex;align-items:center;gap:14px;height:68px}
.nav-logo{font-size:24px;font-weight:900;color:#fff;cursor:pointer;flex-shrink:0;letter-spacing:-1px}
.nav-logo span{color:var(--or)}
.search-box{flex:1;max-width:790px;display:flex;background:linear-gradient(180deg,#fff,#f9fafb);border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(15,17,17,.16);transition:box-shadow .2s,transform .2s;border:1px solid rgba(255,255,255,.08)}
.search-box:focus-within{box-shadow:0 0 0 4px rgba(255,153,0,.22),0 16px 36px rgba(0,0,0,.22);transform:translateY(-1px)}
.search-cat{border:none;background:linear-gradient(180deg,#f7f7f7,#eceff2);padding:0 14px;font-size:12px;font-weight:800;color:#37475a;cursor:pointer;border-right:1px solid var(--br);font-family:var(--fn);min-width:92px}
.search-inp{flex:1;border:none;padding:13px 14px;font-size:14px;font-family:var(--fn);color:var(--tx);outline:none;background:transparent}
.search-btn{background:linear-gradient(135deg,#ffb84d,#ff9900);border:none;padding:0 18px;cursor:pointer;color:#111;display:flex;align-items:center;transition:.2s}
.search-btn:hover{filter:brightness(.97)}
.search-sugg{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border-radius:var(--r12);box-shadow:var(--sh2);border:1px solid var(--br);overflow:hidden;z-index:400;animation:slideDown .2s ease}
.ss-row{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;font-size:14px;font-weight:500;transition:.15s;border-bottom:1px solid var(--br2)}
.ss-row:hover{background:var(--orl)}
.ss-row:last-child{border-bottom:none}
.nav-acts{display:flex;align-items:center;gap:8px;flex-shrink:0}
.nav-act{display:flex;align-items:center;gap:9px;padding:9px 12px;background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.08);border-radius:16px;cursor:pointer;color:rgba(255,255,255,.86);transition:.22s;min-width:64px;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.nav-act:hover{background:linear-gradient(180deg,rgba(255,255,255,.15),rgba(255,255,255,.08));color:#fff;transform:translateY(-1px);box-shadow:0 10px 22px rgba(0,0,0,.14)}
.nav-act-icon{font-size:17px;position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-act-copy{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.nav-act-copy strong{font-size:11px;font-weight:800;line-height:1.1;letter-spacing:.18px;color:#fff}
.nav-act-copy span{font-size:10px;font-weight:700;line-height:1.1;color:rgba(255,255,255,.58)}
.nav-act-lbl{font-size:10px;font-weight:700;letter-spacing:.2px}
.nav-badge{position:absolute;top:-5px;right:-7px;background:var(--or);color:#fff;font-size:9px;font-weight:900;padding:1px 5px;border-radius:100px;min-width:15px;text-align:center;border:1.5px solid var(--nv)}

/* SEARCH EXPERIENCE */
.search-shell{padding-bottom:56px;background:linear-gradient(180deg,#eef3f7 0%,#f8fafc 18%,#f8fafc 100%)}
.search-hero{background:linear-gradient(135deg,#111827 0%,#17283b 48%,#233753 100%);padding:26px 0 24px;position:relative;overflow:hidden}
.search-hero::after{content:'';position:absolute;right:-140px;top:-100px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(255,216,20,.18),transparent 68%)}
.search-hero-card{position:relative;z-index:1;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.08);border-radius:28px;padding:24px;box-shadow:0 22px 56px rgba(0,0,0,.22)}
.search-kicker{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(255,184,77,.14);color:#ffd27a;font-size:11px;font-weight:800;letter-spacing:.42px;text-transform:uppercase;margin-bottom:14px}
.search-title{font-size:clamp(28px,4vw,42px);line-height:1.02;font-weight:900;color:#fff;letter-spacing:-1px;max-width:13ch}
.search-copy{margin-top:10px;color:rgba(255,255,255,.74);font-size:14px;line-height:1.75;max-width:58ch}
.search-input-shell{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0;background:linear-gradient(180deg,#fff,#fbfdff);border-radius:22px;overflow:hidden;box-shadow:0 18px 42px rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.1);margin-top:20px}
.search-input-shell input{border:none;padding:16px 18px;font-size:15px;outline:none;font-family:var(--fn);background:transparent}
.search-input-shell button{background:linear-gradient(135deg,#ffb84d,#ff9900);border:none;padding:0 24px;cursor:pointer;height:54px;display:flex;align-items:center;justify-content:center;transition:.18s}
.search-input-shell button:hover{filter:brightness(.98)}
.search-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.search-chip{padding:9px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:#fff;font-size:12px;font-weight:700;cursor:pointer;transition:.18s}
.search-chip:hover{background:rgba(255,255,255,.14);transform:translateY(-1px)}
.search-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}
.search-overview-card{padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08)}
.search-overview-card strong{display:block;color:#fff;font-size:18px;font-weight:900}
.search-overview-card span{display:block;font-size:12px;color:rgba(255,255,255,.62);margin-top:4px}
.search-body{padding-top:22px}
.filterbar{position:sticky;top:68px;z-index:190;background:rgba(248,250,252,.88);backdrop-filter:blur(12px);border-bottom:1px solid var(--br)}
.filterbar-inner{max-width:1500px;margin:0 auto;padding:14px 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.fselect{border:1px solid #d7dde2;background:#fff;border-radius:999px;padding:10px 14px;font-family:var(--fn);font-size:13px;font-weight:700;color:#334155;min-width:150px;box-shadow:var(--sh0)}
.res-count{margin-left:auto;padding:8px 12px;border-radius:999px;background:#fff7ed;color:#c2410c;font-size:12px;font-weight:800;border:1px solid #fed7aa}
.search-panel{background:#fff;border:1px solid var(--br);border-radius:24px;padding:22px;box-shadow:var(--sh0)}
.search-empty{padding:30px 24px;border-radius:22px;background:linear-gradient(135deg,#fff,#fff8ee);border:1px solid #fde7c2;box-shadow:0 16px 36px rgba(255,184,77,.12)}
.search-empty-title{font-size:24px;font-weight:900;color:#0f172a;letter-spacing:-.5px}
.search-empty-copy{font-size:14px;color:var(--mu);line-height:1.7;margin-top:8px;max-width:60ch}
.search-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:16px}
.search-section-head strong{font-size:18px;font-weight:900;color:var(--nv)}
.search-section-head span{font-size:12px;color:var(--mu);font-weight:700}

/* ACCOUNT */
.acct-shell{background:linear-gradient(180deg,#f2f6fa 0%,#f8fafc 28%,#f8fafc 100%);min-height:100vh;padding-bottom:60px}
.acct-wrap{max-width:1120px;margin:0 auto;padding:0 16px}
.acct-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
.acct-stat-card{background:#fff;border:1px solid var(--br);border-radius:18px;padding:16px 18px;box-shadow:var(--sh0)}
.acct-stat-card strong{display:block;font-size:24px;font-weight:900;color:#0f172a}
.acct-stat-card span{display:block;margin-top:5px;font-size:12px;color:var(--mu);font-weight:700}
.acct-media-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-bottom:16px}
.acct-style-card{background:linear-gradient(135deg,#fff,#fff8ee);border:1px solid #f5d8a8;border-radius:24px;padding:24px;box-shadow:0 18px 40px rgba(255,184,77,.12)}
.acct-style-card h3{font-size:30px;line-height:1.08;font-weight:900;letter-spacing:-.9px;color:#0f172a;margin-bottom:12px}
.acct-style-card p{font-size:14px;color:var(--mu);line-height:1.75;margin-bottom:18px;max-width:58ch}
.acct-style-actions{display:flex;gap:10px;flex-wrap:wrap}
.acct-visual-card{background:linear-gradient(145deg,#0f172a,#223552);border-radius:24px;padding:16px;box-shadow:0 18px 40px rgba(15,23,42,.2);display:grid;grid-template-columns:1fr 1fr;gap:10px;min-height:260px}
.acct-visual-slot{border-radius:18px;overflow:hidden;background:rgba(255,255,255,.08);min-height:120px}
.acct-visual-slot img{width:100%;height:100%;object-fit:cover}
.acct-fallback{grid-column:1 / -1;display:flex;align-items:center;justify-content:center;text-align:center;color:rgba(255,255,255,.74);padding:22px;font-weight:700;line-height:1.6}

/* PROMO BAR */
.promo-bar{background:linear-gradient(90deg,#232f3e 0%,#2c3f55 50%,#232f3e 100%);padding:0;overflow:hidden}
.promo-inner{display:flex;white-space:nowrap;animation:marquee 24s linear infinite;width:max-content}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.promo-item{display:inline-flex;align-items:center;gap:8px;padding:9px 28px;border-right:1px solid rgba(255,255,255,.1);flex-shrink:0}

/* BANNER */
.banner-wrap{position:relative;overflow:hidden;background:var(--nv);border-radius:0 0 18px 18px}
.banner-slide{position:relative;min-height:320px;display:flex;align-items:center;overflow:hidden}
.banner-img{position:absolute;inset:0;object-fit:cover;width:100%;height:100%;opacity:.28;mix-blend-mode:screen}
.banner-body{position:relative;z-index:2;padding:36px 42px;max-width:640px}
.banner-badge{display:inline-block;background:var(--or);color:#fff;font-size:10px;font-weight:800;padding:4px 12px;border-radius:100px;letter-spacing:.8px;margin-bottom:12px;text-transform:uppercase}
.banner-title{font-size:clamp(26px,4vw,44px);font-weight:900;color:#fff;line-height:1.08;letter-spacing:-.8px;margin-bottom:10px;max-width:12ch}
.banner-sub{font-size:15px;color:rgba(255,255,255,.82);margin-bottom:22px;line-height:1.65;max-width:48ch}
.banner-cta{display:inline-flex;align-items:center;gap:8px;background:#ffd814;color:#111;padding:12px 22px;border-radius:999px;font-weight:800;font-size:14px;cursor:pointer;border:none;box-shadow:0 6px 18px rgba(0,0,0,.18);transition:all .2s}
.banner-cta:hover{transform:translateY(-1px);background:#f7ca00}
.banner-progress{position:absolute;left:0;bottom:0;height:4px;width:100%;animation:progressFill 4.1s linear;transform-origin:left center;opacity:.95}
.banner-dots{position:absolute;bottom:16px;left:40px;display:flex;gap:6px;z-index:3}
.banner-dot{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.4);transition:all .3s;cursor:pointer}
.banner-dot.on{width:22px;background:var(--or)}

/* CATEGORY BAR */
.catbar{background:#fff;border-bottom:1px solid var(--br);overflow-x:auto;scrollbar-width:none;position:sticky;top:62px;z-index:200;box-shadow:var(--sh0)}
.catbar::-webkit-scrollbar{display:none}
.catbar-inner{max-width:1400px;margin:0 auto;padding:0 16px;display:flex;min-width:max-content}
.cat-btn{display:flex;align-items:center;gap:6px;padding:14px 18px;cursor:pointer;border-bottom:3px solid transparent;transition:all .2s;font-size:13px;font-weight:600;color:var(--mu);flex-shrink:0;white-space:nowrap;position:relative}
.cat-btn:hover{color:var(--or);border-bottom-color:var(--orm)}
.cat-btn.on{color:var(--or);border-bottom-color:var(--or);font-weight:800}
.cat-btn.on::after{content:'';position:absolute;bottom:-1px;left:0;right:0;height:3px;background:var(--or);border-radius:2px 2px 0 0}

/* SECTION TITLES */
.home-hero{display:grid;grid-template-columns:2fr 1fr;gap:16px;padding:18px 0 6px}
.hero-panel{background:linear-gradient(135deg,#fff,#f7fbff);border:1px solid var(--br);border-radius:18px;padding:22px 24px;box-shadow:var(--sh0)}
.hero-kicker{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:#e6f7fb;color:var(--bl2);font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;margin-bottom:12px}
.hero-title{font-size:31px;line-height:1.1;font-weight:900;letter-spacing:-.8px;color:var(--nv);max-width:14ch;margin-bottom:10px}
.hero-copy{font-size:14px;line-height:1.7;color:var(--mu);max-width:54ch}
.hero-points{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.hero-point{background:#fff;border:1px solid var(--br);border-radius:14px;padding:12px 14px}
.hero-point strong{display:block;font-size:16px;color:var(--nv);font-weight:900}
.hero-point span{display:block;font-size:12px;color:var(--mu);margin-top:3px}
.hero-side{display:grid;gap:12px}
.hero-mini{background:linear-gradient(180deg,#232f3e,#314761);color:#fff;border-radius:18px;padding:18px;box-shadow:var(--sh1)}
.hero-mini.light{background:linear-gradient(180deg,#fff8ea,#fff);color:var(--tx);border:1px solid var(--br);box-shadow:var(--sh0)}
.hero-mini h3{font-size:16px;font-weight:900;margin-bottom:6px}
.hero-mini p{font-size:12px;line-height:1.6;opacity:.82}
.sec-wrap{padding:22px 0 6px;background:#fff;border:1px solid var(--br);border-radius:18px;box-shadow:var(--sh0);margin-top:18px}
.sec-hd{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:18px;padding:0 20px}
.sec-title{font-size:20px;font-weight:900;color:var(--nv);letter-spacing:-.4px}
.sec-sub{font-size:13px;color:var(--mu);margin-top:2px}
.sec-link{font-size:13px;font-weight:700;color:var(--bl2);cursor:pointer;text-decoration:none;transition:.15s;padding:4px 10px;background:#edf8fb;border-radius:100px}
.sec-link:hover{background:#d9f1f7}

/* HORIZONTAL SCROLL */
.hscroll{overflow-x:auto;scrollbar-width:none;padding:0 20px 6px}
.hscroll::-webkit-scrollbar{display:none}
.hs-inner{display:flex;gap:16px;min-width:max-content}

/* PRODUCT GRID */
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;padding:0 16px}

/* PRODUCT CARD */
.pc{width:196px;flex-shrink:0;border-radius:14px;overflow:hidden;cursor:pointer;background:var(--surface);border:1px solid #d5d9d9;transition:all .2s cubic-bezier(.22,1,.36,1);box-shadow:var(--sh0);animation:fadeUp .4s ease both}
.pc:hover{transform:translateY(-2px);box-shadow:var(--sh2);border-color:#ff9900}
.pc-img-wrap{position:relative;aspect-ratio:1 / .92;overflow:hidden;background:#f7f8f8;border-bottom:1px solid #eef1f1}
.pc-img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease}
.pc:hover .pc-img{transform:scale(1.03)}
.pc-badge{position:absolute;top:10px;left:10px;background:#cc0c39;color:#fff;font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;letter-spacing:.25px}
.pc-wish{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);border:1px solid rgba(15,17,17,.06);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all .2s;box-shadow:var(--sh0)}
.pc-wish:hover{transform:scale(1.15)}
.pc-wish.on{animation:heartPop .35s ease}
.pc-body{padding:12px 12px 14px}
.pc-name{font-size:14px;font-weight:700;line-height:1.4;margin-bottom:6px;color:var(--tx);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:39px}
.pc-shop{font-size:10px;color:var(--bl2);margin-bottom:5px;display:flex;align-items:center;gap:4px;font-weight:700}
.pc-stars{margin-bottom:7px}
.pc-colors{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}
.pc-cdot{width:12px;height:12px;border-radius:3px;border:1px solid rgba(0,0,0,.1);cursor:pointer;transition:.15s}
.pc-cdot:hover{transform:scale(1.3)}
.pc-price-row{display:flex;align-items:baseline;gap:6px}
.pc-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:8px}
.pc-price{font-size:20px;font-weight:900;color:var(--tx)}
.pc-mrp{display:block;font-size:11px;color:var(--mu);text-decoration:line-through;margin-top:2px}
.pc-disc{display:inline-flex;font-size:11px;font-weight:800;color:#067d62;background:#e7f8f4;padding:2px 6px;border-radius:999px;margin-top:4px}
.pc-addbtn{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 14px;background:#ffd814;border:1px solid #fcd200;border-radius:999px;cursor:pointer;font-size:12px;font-weight:800;color:#111;transition:all .18s}
.pc-addbtn:hover{background:#f7ca00}
.pc-addbtn:disabled{opacity:.5;cursor:not-allowed}
.pc-qty{display:flex;align-items:center;gap:0;border:1px solid #ff9900;border-radius:999px;overflow:hidden;background:#fff7e8;min-width:92px}
.pc-qty button{width:30px;height:34px;background:#fff2d8;border:none;cursor:pointer;color:#a15c00;display:flex;align-items:center;justify-content:center}
.pc-qty button:hover{background:#ffd48c}
.pc-qty span{flex:1;text-align:center;font-size:13px;font-weight:900;color:#111}
.pc-v{background:var(--bll);color:var(--bl2);font-size:9px;font-weight:800;padding:1px 6px;border-radius:4px;letter-spacing:.3px}

/* SHOP CARD */
.scard{border-radius:16px;overflow:hidden;cursor:pointer;background:var(--surface);border:1px solid var(--br);transition:all .2s cubic-bezier(.22,1,.36,1);width:252px;flex-shrink:0;box-shadow:var(--sh0)}
.scard:hover{transform:translateY(-2px);box-shadow:var(--sh2);border-color:#ff9900}
.scard-img{width:100%;height:146px;object-fit:cover}
.scard-body{padding:14px}
.scard-name{font-size:15px;font-weight:800;margin-bottom:5px;color:var(--nv);display:flex;align-items:center;gap:6px}
.scard-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mu);flex-wrap:wrap}
.vbadge{background:linear-gradient(135deg,#eff6ff,#dbeafe);color:#1d4ed8;font-size:9px;font-weight:800;padding:2px 7px;border-radius:100px;letter-spacing:.5px}

/* DEAL GRID */
.deal-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:0 20px}
@media(max-width:768px){.deal-grid{grid-template-columns:repeat(2,1fr)}}
.deal-card{border-radius:16px;overflow:hidden;cursor:pointer;aspect-ratio:1;position:relative;background:var(--nv2);transition:all .2s;border:1px solid rgba(255,255,255,.1)}
.deal-card:hover{transform:translateY(-3px);box-shadow:var(--sh2)}
.deal-imgs{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;gap:2px}
.deal-imgs img{width:100%;height:100%;object-fit:cover}
.deal-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,rgba(0,0,0,.2) 50%,transparent 100%)}
.deal-title{position:absolute;bottom:12px;left:12px;color:#fff;font-weight:800;font-size:13px;z-index:2;line-height:1.3}
.deal-cta{position:absolute;bottom:12px;right:12px;background:var(--or);color:#fff;font-size:10px;font-weight:800;padding:4px 10px;border-radius:100px;z-index:2}

/* SKELETON */
.skel{background:linear-gradient(90deg,#f1f5f9 25%,#e9edf2 50%,#f1f5f9 75%);background-size:800px 100%;animation:shimmer 1.5s infinite}
.skel-card{border-radius:var(--r16);overflow:hidden;flex-shrink:0;width:180px}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 20px;border-radius:var(--r8);border:none;cursor:pointer;font-size:14px;font-weight:700;transition:all .18s cubic-bezier(.22,1,.36,1);font-family:var(--fn);letter-spacing:.1px;position:relative;overflow:hidden}
.btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,0);transition:background .15s}
.btn:hover::after{background:rgba(255,255,255,.1)}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn-or{background:var(--or-grad);color:#fff;box-shadow:0 4px 16px rgba(249,115,22,.3)}
.btn-or:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(249,115,22,.4)}
.btn-out{background:transparent;color:var(--tx);border:1.5px solid var(--br)}
.btn-out:hover{border-color:var(--or);color:var(--or)}
.btn-nv{background:var(--nv-grad);color:#fff}
.btn-gn{background:linear-gradient(135deg,var(--gn),var(--gn2));color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.25)}
.btn-sm{padding:7px 14px;font-size:12px;border-radius:var(--r8)}
.btn-xs{padding:5px 10px;font-size:11px;border-radius:var(--r4)}
.rip-dot{position:absolute;border-radius:50%;background:rgba(255,255,255,.4);animation:ripple .6s ease both;pointer-events:none;width:80px;height:80px;margin:-40px}

/* INPUT */
.inp{width:100%;padding:11px 14px;border:1.5px solid var(--br);border-radius:var(--r8);font-size:14px;font-family:var(--fn);color:var(--tx);background:#fff;outline:none;transition:all .2s}
.inp:focus{border-color:var(--or);box-shadow:0 0 0 3px rgba(249,115,22,.08)}
.inp::placeholder{color:var(--mu2)}
.inp-grp{margin-bottom:18px}
.inp-lbl{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--mu);margin-bottom:7px}

/* STARS */
.stars{display:inline-flex;align-items:center;gap:1px}
.star-f{color:#f59e0b;font-size:11px}
.star-e{color:#d1d5db;font-size:11px}

/* ══════════════════════════════════════
   CHECKOUT - Premium Multi-Step
══════════════════════════════════════ */
.co-overlay{position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .2s ease;backdrop-filter:blur(6px)}
.co-modal{background:var(--surface);border-radius:var(--r24);width:100%;max-width:520px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;animation:scaleIn .3s cubic-bezier(.22,1,.36,1);box-shadow:var(--sh3)}
.co-head{background:var(--nv);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.co-body{flex:1;overflow-y:auto;padding:24px}
.co-body::-webkit-scrollbar{width:3px}
.co-body::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:2px}
.co-steps{display:flex;background:var(--br2);flex-shrink:0;border-bottom:1px solid var(--br)}
.co-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;cursor:pointer;border-bottom:3px solid transparent;transition:.2s;position:relative}
.co-step.on{border-bottom-color:var(--or)}
.co-step.done{border-bottom-color:var(--gn)}
.co-step-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;transition:.2s}
.co-step.on .co-step-num{background:var(--or);color:#fff}
.co-step.done .co-step-num{background:var(--gn);color:#fff}
.co-step.pending .co-step-num{background:var(--br);color:var(--mu)}
.co-step-label{font-size:11px;font-weight:700;color:var(--mu)}
.co-step.on .co-step-label,.co-step.done .co-step-label{color:var(--tx)}
/* Address card */
.addr-card{border:1.5px solid var(--br);border-radius:var(--r12);padding:13px 15px;cursor:pointer;transition:all .2s;margin-bottom:8px;display:flex;align-items:center;gap:12px}
.addr-card:hover{border-color:var(--orm)}
.addr-card.on{border-color:var(--or);background:var(--orl)}
/* Payment option */
.pay-opt{display:flex;align-items:center;gap:13px;padding:14px 16px;border-radius:var(--r12);border:1.5px solid var(--br);margin-bottom:10px;cursor:pointer;transition:all .2s;background:var(--surface)}
.pay-opt:hover{border-color:var(--orm);background:var(--orl)}
.pay-opt.on{border-color:var(--or);background:var(--orl);box-shadow:0 0 0 3px rgba(249,115,22,.08)}
.pay-icon{width:44px;height:44px;border-radius:var(--r8);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;font-weight:800;font-size:12px}
.pay-lbl{font-size:14px;font-weight:700;margin-bottom:2px;color:var(--tx)}
.pay-sub{font-size:11px;color:var(--mu)}
.pay-check{width:22px;height:22px;border-radius:50%;border:2px solid var(--br);display:flex;align-items:center;justify-content:center;transition:.2s;flex-shrink:0}
.pay-check.on{background:var(--or);border-color:var(--or);color:#fff}
/* Order summary */
.summary-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--br2);font-size:14px}
.summary-row:last-child{border-bottom:none;padding-top:12px;font-size:17px;font-weight:900}
/* Map */
.map-panel{position:absolute;inset:0;background:var(--surface);z-index:20;border-radius:var(--r24);overflow:hidden;display:flex;flex-direction:column;animation:slideUp .3s ease}

/* ══════════════════════════════════════
   CART DRAWER
══════════════════════════════════════ */
.cart-overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);animation:fadeIn .2s ease}
.cart-drawer{position:fixed;right:0;top:0;bottom:0;width:min(420px,100vw);background:var(--surface);box-shadow:var(--sh3);display:flex;flex-direction:column;animation:slideRight .3s cubic-bezier(.22,1,.36,1)}
.cart-hd{padding:20px 22px;border-bottom:1px solid var(--br);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--surface)}
.cart-items{flex:1;overflow-y:auto;padding:16px}
.cart-items::-webkit-scrollbar{width:3px}
.cart-item{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--br2);animation:fadeUp .3s ease}
.cart-item:last-child{border-bottom:none}
.cart-img{width:72px;height:72px;border-radius:var(--r12);object-fit:cover;background:#f8fafc;flex-shrink:0;border:1px solid var(--br)}
.cart-foot{padding:20px;border-top:1px solid var(--br);background:var(--br2);flex-shrink:0}
.cart-total-row{display:flex;justify-content:space-between;margin-bottom:5px;font-size:14px}
.cart-total-row.main{font-size:18px;font-weight:900;border-top:1px solid var(--br);padding-top:10px;margin-top:6px}

/* ══════════════════════════════════════
   60-MIN COUNTDOWN TIMER
══════════════════════════════════════ */
.countdown-wrap{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:var(--r12);background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid rgba(249,115,22,.25);box-shadow:0 4px 16px rgba(0,0,0,.15)}
.countdown-ring{position:relative;width:52px;height:52px;flex-shrink:0}
.countdown-svg{transform:rotate(-90deg)}
.countdown-track{fill:none;stroke:rgba(255,255,255,.1);stroke-width:4}
.countdown-fill{fill:none;stroke:var(--or);stroke-width:4;stroke-linecap:round;transition:stroke-dashoffset .5s ease;stroke-dasharray:125.6}
.countdown-fill.urgent{stroke:var(--rd);animation:glow 1s ease infinite}
.countdown-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;font-family:var(--fn)}
.countdown-label{font-size:12px;font-weight:700;color:rgba(255,255,255,.6);margin-top:1px}
.countdown-time-left{font-size:22px;font-weight:900;color:var(--or);font-family:var(--fn);animation:countPulse 2s ease infinite}
.countdown-urgent .countdown-time-left{color:var(--rd)}

/* ══════════════════════════════════════
   ORDER TRACKING - Premium
══════════════════════════════════════ */
.track-overlay{position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);animation:fadeIn .2s ease;display:flex;align-items:flex-end;justify-content:center;padding:0}
.track-sheet{background:var(--surface);border-radius:var(--r24) var(--r24) 0 0;width:100%;max-width:600px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;animation:slideUp .4s cubic-bezier(.22,1,.36,1)}
.track-map{height:200px;background:#e2e8f0;flex-shrink:0;position:relative;overflow:hidden}
.track-body{flex:1;overflow-y:auto;padding:20px}
.track-steps{position:relative;padding-left:32px;margin:4px 0}
.track-step-line{position:absolute;left:11px;top:20px;bottom:20px;width:2px;background:var(--br)}
.track-step-fill{position:absolute;left:11px;top:20px;width:2px;background:linear-gradient(to bottom,var(--gn),var(--or));transition:height .6s ease}
.track-step{display:flex;align-items:flex-start;gap:14px;padding:14px 0;position:relative}
.track-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0;position:absolute;left:-32px;top:14px;transition:.3s}
.track-dot.done{background:var(--gn);color:#fff;box-shadow:0 0 0 4px rgba(22,163,74,.15)}
.track-dot.active{background:var(--or);color:#fff;box-shadow:0 0 0 6px rgba(249,115,22,.15);animation:glow 2s ease infinite}
.track-dot.pending{background:var(--br);color:var(--mu)}
.track-step-info{flex:1;padding-top:2px}
.track-step-title{font-size:14px;font-weight:700;color:var(--tx);margin-bottom:2px}
.track-step-title.active{color:var(--or);font-size:15px;font-weight:800}
.track-step-sub{font-size:12px;color:var(--mu)}
.track-step-sub.active{color:var(--or)}

/* ══════════════════════════════════════
   ORDERS PAGE
══════════════════════════════════════ */
.orders-hd{background:var(--nv-grad);padding:28px 0 22px;color:#fff}
.order-card{background:var(--surface);border-radius:var(--r16);border:1px solid var(--br);margin-bottom:14px;overflow:hidden;transition:all .2s cubic-bezier(.22,1,.36,1);box-shadow:var(--sh0)}
.order-card:hover{box-shadow:var(--sh2);border-color:rgba(249,115,22,.2);transform:translateY(-1px)}
.order-card-hd{display:flex;align-items:flex-start;justify-content:space-between;padding:14px 18px;background:var(--br2);border-bottom:1px solid var(--br);gap:10px}
.order-code{font-size:16px;font-weight:900;color:var(--nv);font-family:var(--fn)}
.order-status{padding:4px 12px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.3px}
.order-card-body{padding:14px 18px}
.order-item-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--br2)}
.order-item-row:last-child{border-bottom:none}
.order-item-img{width:42px;height:42px;border-radius:var(--r8);object-fit:cover;background:#f8fafc;border:1px solid var(--br);flex-shrink:0}

/* ══════════════════════════════════════
   AUTH MODAL
══════════════════════════════════════ */
.auth-overlay{position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);animation:fadeIn .2s ease;display:flex;align-items:center;justify-content:center;padding:16px}
.auth-page{display:flex;min-height:100vh;overflow:hidden;position:relative;background:var(--nv)}
.auth-left{width:45%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;position:relative;background:linear-gradient(160deg,#0f172a 0%,#1a2540 50%,#0f172a 100%);border-right:1px solid rgba(255,255,255,.07)}
.auth-dots{position:absolute;inset:0;background-image:radial-gradient(rgba(249,115,22,.15) 1px,transparent 1px);background-size:28px 28px;animation:float 20s linear infinite;pointer-events:none}
.auth-right{flex:1;display:flex;align-items:center;justify-content:center;padding:32px 24px;background:var(--surface);overflow-y:auto}
.auth-form-box{width:100%;max-width:400px;position:relative}
.auth-tab-row{display:flex;background:var(--br2);border-radius:var(--r12);padding:4px;gap:4px;margin-bottom:22px}
.auth-tab{flex:1;padding:10px;border-radius:var(--r8);border:none;cursor:pointer;font-family:var(--fn);font-weight:700;font-size:14px;transition:.2s}
.auth-tab.on{background:var(--surface);color:var(--or);box-shadow:var(--sh0)}
.auth-tab.off{background:transparent;color:var(--mu)}
.auth-submit-btn{width:100%;padding:14px;background:var(--or-grad);color:#fff;border:none;border-radius:var(--r12);font-weight:800;font-size:15px;cursor:pointer;transition:all .2s;box-shadow:0 4px 16px rgba(249,115,22,.3)}
.auth-submit-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(249,115,22,.4)}
.auth-submit-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
.auth-otp-box{display:flex;gap:8px;justify-content:center;margin-bottom:18px}
.auth-otp-input{width:46px;height:54px;text-align:center;font-size:22px;font-weight:900;border:2px solid var(--br);border-radius:var(--r12);background:var(--br2);color:var(--nv);outline:none;transition:.2s;font-family:var(--fn)}
.auth-otp-input:focus{border-color:var(--or);box-shadow:0 0 0 3px rgba(249,115,22,.12);background:#fff}
.auth-floating-label{position:relative;margin-bottom:14px}
.auth-floating-label input{width:100%;padding:16px 14px 8px;border:1.5px solid var(--br);border-radius:var(--r12);font-size:15px;background:var(--br2);color:var(--tx);outline:none;transition:.2s;font-family:var(--fn)}
.auth-floating-label input:focus,.auth-floating-label input:not(:placeholder-shown){border-color:var(--or);background:#fff}
.auth-floating-label label{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--mu);pointer-events:none;transition:.2s;font-weight:500}
.auth-floating-label input:focus ~ label,.auth-floating-label input:not(:placeholder-shown) ~ label{top:10px;transform:none;font-size:10px;font-weight:700;color:var(--or);text-transform:uppercase;letter-spacing:.5px}
.auth-card{background:var(--surface);border-radius:var(--r20);padding:28px;width:100%;max-width:460px;box-shadow:var(--sh3);animation:scaleIn .3s ease}

/* ══════════════════════════════════════
   PRODUCT DETAIL
══════════════════════════════════════ */
.pd-overlay{position:fixed;inset:0;z-index:550;background:rgba(0,0,0,.6);backdrop-filter:blur(5px);animation:fadeIn .2s ease;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px}
.pd-modal{background:var(--surface);border-radius:var(--r20);width:100%;max-width:640px;overflow:hidden;animation:scaleIn .3s cubic-bezier(.22,1,.36,1);box-shadow:var(--sh3);margin:auto}
.pd-imgs{position:relative;background:#f8fafc;aspect-ratio:1;overflow:hidden;max-height:320px}
.pd-main-img{width:100%;height:100%;object-fit:cover;transition:transform .3s ease}
.pd-zoom-overlay{position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center}
#zoom-overlay{display:none}
#zoom-overlay:not(.hidden){display:flex!important}
.pd-thumb-row{display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid var(--br)}
.pd-thumb{width:56px;height:56px;border-radius:var(--r8);object-fit:cover;cursor:pointer;border:2px solid transparent;transition:.2s}
.pd-thumb.on{border-color:var(--or)}
.pd-body{padding:20px}
.pd-title{font-size:20px;font-weight:900;margin-bottom:8px;line-height:1.3;color:var(--nv)}
.pd-price{font-size:28px;font-weight:900;color:var(--or);letter-spacing:-.5px}
.pd-mrp{font-size:15px;color:var(--mu);text-decoration:line-through;margin-left:8px}
.pd-disc{font-size:13px;font-weight:800;color:var(--rd);background:var(--rdl);padding:2px 8px;border-radius:4px;margin-left:6px}
.pd-wish-btn{width:44px;height:44px;border-radius:50%;border:1.5px solid var(--br);background:var(--surface);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;transition:.2s;flex-shrink:0}
.pd-wish-btn:hover{border-color:var(--rd);transform:scale(1.1)}
.pd-wish-btn.on{animation:heartPop .35s ease;border-color:var(--rd)}
.size-btn{padding:9px 16px;border-radius:var(--r8);border:1.5px solid var(--br);cursor:pointer;font-size:13px;font-weight:700;transition:.2s;background:var(--surface)}
.size-btn:hover,.size-btn.on{border-color:var(--or);background:var(--orl);color:var(--or)}
.size-btn.oos{opacity:.35;cursor:not-allowed;text-decoration:line-through}
.color-dot{width:30px;height:30px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:.2s;position:relative}
.color-dot:hover,.color-dot.on{outline:3px solid var(--or);outline-offset:2px}
.qty-ctrl{display:flex;align-items:center;border:1.5px solid var(--br);border-radius:var(--r8);overflow:hidden}
.qty-btn{width:36px;height:36px;background:var(--br2);border:none;cursor:pointer;font-size:17px;font-weight:800;color:var(--tx);transition:.15s;display:flex;align-items:center;justify-content:center}
.qty-btn:hover{background:var(--orl);color:var(--or)}
.qty-n{width:40px;text-align:center;font-size:15px;font-weight:800}

/* ══════════════════════════════════════
   MISC
══════════════════════════════════════ */
.spin{width:22px;height:22px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;vertical-align:middle}
.spin.dark{border-color:rgba(0,0,0,.1);border-top-color:var(--or)}
.empty{text-align:center;padding:56px 20px;color:var(--mu)}
.empty-title{font-size:18px;font-weight:800;color:var(--nv);margin-bottom:6px}
.toast-wrap{position:fixed;top:72px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast-item{display:flex;align-items:center;gap:10px;padding:11px 18px;border-radius:var(--r12);font-size:13px;font-weight:600;max-width:340px;box-shadow:var(--sh2);animation:toastIn .3s cubic-bezier(.22,1,.36,1);pointer-events:auto;cursor:pointer}
@media(max-width:900px){.home-hero{grid-template-columns:1fr}.hero-points{grid-template-columns:1fr 1fr}.hero-side{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.auth-left{display:none}.auth-right{min-height:100vh}.deal-grid{grid-template-columns:1fr 1fr}.pd-overlay{padding:0;align-items:flex-end}.pd-modal{border-radius:var(--r24) var(--r24) 0 0}.banner-slide{min-height:240px}.banner-body{padding:24px 20px}.banner-title{max-width:none;font-size:30px}.home-hero{gap:12px;padding-top:14px}.hero-panel,.hero-mini{padding:16px}.hero-points{grid-template-columns:1fr}.hero-side{grid-template-columns:1fr}.pgrid{grid-template-columns:repeat(2,1fr)}.topnav-inner{gap:8px}.search-cat{display:none}.wrap{padding:0 12px}.sec-wrap{margin-top:14px;border-radius:14px;padding-top:18px}.sec-hd,.hscroll,.deal-grid{padding-left:14px;padding-right:14px}.pc{width:166px}.scard{width:220px}}
.promo-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--gnl);border:1px solid rgba(22,163,74,.2);border-radius:100px;font-size:12px;font-weight:700;color:var(--gn);margin-top:8px}
.order-timeline{background:var(--nv);border-radius:var(--r16);padding:18px;margin-top:12px;color:#fff}
.rate-stars{display:flex;gap:6px}
.rate-star{font-size:28px;cursor:pointer;transition:.2s;filter:grayscale(1)}
.rate-star.on{filter:none;animation:heartPop .2s ease}
/* Confetti for order success */
.confetti-piece{position:fixed;width:8px;height:8px;border-radius:2px;animation:confetti 3s ease forwards;pointer-events:none;z-index:9999}

/* AUTH REDESIGN */
.auth-page{min-height:100vh;display:grid;grid-template-columns:1.08fr .92fr;background:
  radial-gradient(circle at top left, rgba(255,184,77,.18), transparent 28%),
  linear-gradient(135deg,#101721 0%,#162230 48%,#0f1a24 100%);overflow:hidden}
.auth-left{position:relative;padding:56px 48px 64px;display:flex;align-items:stretch;justify-content:center;border-right:1px solid rgba(255,255,255,.08)}
.auth-left::after{content:'';position:absolute;inset:0;background:
  linear-gradient(0deg,rgba(255,255,255,.02),rgba(255,255,255,0)),
  radial-gradient(circle at 20% 20%, rgba(255,216,20,.12), transparent 25%),
  radial-gradient(circle at 80% 80%, rgba(0,113,133,.2), transparent 28%);pointer-events:none}
.auth-dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.11) 1px,transparent 1px);background-size:30px 30px;mask-image:linear-gradient(180deg,rgba(0,0,0,.95),transparent)}
.auth-right{position:relative;background:linear-gradient(180deg,#f6f8fb 0%,#eef3f6 100%);overflow:auto;padding:0}
.auth-form-box{width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 24px}
.auth-card{width:min(100%,540px);background:rgba(255,255,255,.86);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.75);border-radius:28px;box-shadow:0 24px 80px rgba(15,17,17,.16);padding:34px 30px;animation:scaleIn .35s cubic-bezier(.22,1,.36,1)}
.auth-story{position:relative;z-index:1;max-width:620px;display:flex;flex-direction:column;gap:24px;justify-content:center}
.auth-story-top{display:flex;align-items:center;gap:14px}
.auth-logo-box{width:78px;height:78px;border-radius:24px;background:linear-gradient(135deg,#ffb84d,#ff9900);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px rgba(255,153,0,.32)}
.auth-kicker{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.08);color:#ffe29b;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;border:1px solid rgba(255,255,255,.08);width:max-content}
.auth-hero-title{font-size:clamp(34px,5vw,54px);line-height:1.04;font-weight:900;color:#fff;letter-spacing:-1.3px;max-width:11ch}
.auth-hero-copy{font-size:15px;line-height:1.8;color:rgba(255,255,255,.78);max-width:54ch}
.auth-story-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.auth-story-card{padding:18px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
.auth-story-card strong{display:block;font-size:21px;color:#fff;font-weight:900}
.auth-story-card span{display:block;font-size:12px;color:rgba(255,255,255,.68);margin-top:5px;line-height:1.6}
.auth-story-list{display:grid;gap:12px}
.auth-story-item{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:16px;animation:fadeUp .45s ease both}
.auth-story-ico{width:36px;height:36px;border-radius:12px;background:rgba(255,216,20,.14);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.auth-pane-head{margin-bottom:24px}
.auth-pane-eyebrow{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--bl2);margin-bottom:8px}
.auth-pane-title{font-size:32px;font-weight:900;letter-spacing:-.9px;color:var(--nv);line-height:1.05}
.auth-pane-sub{font-size:14px;color:var(--mu);line-height:1.7;margin-top:8px}
.auth-tab-row{display:grid;grid-template-columns:1fr 1fr;background:#e8eef2;border-radius:16px;padding:5px;gap:5px;margin-bottom:22px}
.auth-tab{padding:12px 14px;border-radius:12px;border:none;cursor:pointer;font-family:var(--fn);font-weight:800;font-size:14px;transition:.22s}
.auth-tab.on{background:#fff;color:var(--nv);box-shadow:0 6px 18px rgba(15,17,17,.08)}
.auth-tab.off{background:transparent;color:var(--mu)}
.auth-scroll-panel{max-height:68vh;overflow:auto;padding-right:4px}
.auth-scroll-panel::-webkit-scrollbar{width:6px}
.auth-scroll-panel::-webkit-scrollbar-thumb{background:#d7e2e7;border-radius:999px}
.auth-floating-label input{background:#fff;border:1.5px solid #d5d9d9}
.auth-floating-label input:focus,.auth-floating-label input:not(:placeholder-shown){box-shadow:0 0 0 4px rgba(255,153,0,.14)}
.auth-submit-btn{border-radius:16px;background:linear-gradient(135deg,#ffd814,#ffb84d);color:#111;box-shadow:0 8px 24px rgba(255,184,77,.32)}
.auth-submit-btn:hover{background:linear-gradient(135deg,#f7ca00,#ffb84d)}
.auth-otp-box{gap:10px}
.auth-otp-input{background:#fff;border:2px solid #d5d9d9}
.auth-switch-note{margin-top:16px;font-size:13px;color:var(--mu);text-align:center}
.auth-text-btn{background:none;border:none;color:var(--bl2);font-weight:800;cursor:pointer}

/* PRODUCT DETAIL REDESIGN */
.pd-page{background:linear-gradient(180deg,#f4f7f8 0%,#eef2f4 100%);min-height:100vh}
.pd-topbar{position:sticky;top:62px;z-index:120;background:rgba(255,255,255,.82);backdrop-filter:blur(16px);border-bottom:1px solid rgba(213,217,217,.9)}
.pd-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);gap:24px;align-items:start}
.pd-imgs-col,.pd-info-col{min-width:0}
.pd-main-card,.pd-section-box{background:#fff;border:1px solid var(--br);border-radius:20px;box-shadow:var(--sh0)}
.pd-main-card{padding:18px}
.pd-main-stage{position:relative;border-radius:18px;overflow:hidden;border:1px solid #eef2f2;background:#f7f8f8;min-height:520px}
.pd-main-img{width:100%;height:100%;object-fit:contain}
.pd-thumbs{display:flex;gap:10px;overflow-x:auto;padding-top:12px}
.pd-thumb{width:74px;height:74px;border-radius:14px;border:2px solid transparent;background:#fff;box-shadow:var(--sh0)}
.pd-thumb.on{border-color:#ff9900;transform:translateY(-1px)}
.pd-info-col{position:sticky;top:116px}
.pd-section-box{padding:20px}
.pd-shop-card{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#f7fafb;border:1px solid #e7edef;border-radius:16px;margin-bottom:18px}
.pd-name{font-size:32px;line-height:1.15;letter-spacing:-1px;color:var(--nv)}
.pd-section-box .rpill{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:999px;background:#e7f8f4;color:#067d62;font-size:12px;font-weight:800}
.pd-trust-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.pd-trust-chip{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px}
.pd-cpill{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border:1.5px solid #d5d9d9;border-radius:999px;background:#fff;cursor:pointer;font-size:13px;font-weight:700;transition:.18s}
.pd-cpill.on{border-color:#ff9900;background:#fff8ea;color:#111}
.pd-cdot{width:16px;height:16px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(15,17,17,.12)}
.pd-size{min-width:72px;padding:11px 14px;border-radius:14px;border:1.5px solid #d5d9d9;background:#fff;display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:.18s}
.pd-size.on{border-color:#ff9900;background:#fff4df;transform:translateY(-1px)}
.pd-size.oos{opacity:.42;cursor:not-allowed}
.pd-add-btn{min-height:54px;border:none;border-radius:999px;background:linear-gradient(135deg,#ffd814,#ffb84d);font-weight:900;color:#111;cursor:pointer;box-shadow:0 10px 28px rgba(255,184,77,.28)}
.pd-add-btn:disabled{opacity:.55;cursor:not-allowed}
.pd-tabs{display:flex;gap:10px;overflow-x:auto}
.pd-tab{padding:14px 2px;background:none;border:none;color:var(--mu);font-size:13px;font-weight:800;cursor:pointer;border-bottom:3px solid transparent}
.pd-tab.on{color:var(--nv);border-bottom-color:#ff9900}
.pd-sticky-buy{display:none}
.back-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:#fff;border:1px solid var(--br);border-radius:999px;font-weight:800;color:var(--nv);cursor:pointer;box-shadow:var(--sh0)}
.rev-row{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #eef2f2}
.rev-avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;flex-shrink:0}

/* ORDERS / TRACKING REDESIGN */
.orders-shell{padding:22px 0 56px;background:linear-gradient(180deg,#f3f6f8 0%,#eef2f4 100%);min-height:100vh}
.orders-head-card{background:linear-gradient(135deg,#182433,#24384c);color:#fff;border-radius:24px;padding:28px 30px;box-shadow:var(--sh2);position:relative;overflow:hidden}
.orders-head-card::after{content:'';position:absolute;right:-70px;top:-70px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(255,216,20,.18),transparent 65%)}
.orders-list{display:grid;gap:18px;margin-top:20px}
.order-card{background:#fff;border:1px solid var(--br);border-radius:20px;box-shadow:var(--sh0);overflow:hidden}
.order-card-hd{padding:18px 20px;background:linear-gradient(180deg,#fcfdfd,#f5f8f9);border-bottom:1px solid #edf1f1}
.order-card-body{padding:18px 20px}
.oi-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f4f4}
.oi-row:last-child{border-bottom:none}
.oi-img{width:58px;height:58px;border-radius:14px;object-fit:cover;border:1px solid var(--br);background:#f7f8f8}
.order-status{border-radius:999px;padding:7px 12px}
.track-panel{margin-top:18px;padding:20px;border-top:1px solid #eef2f2;background:#fbfcfd}
.track-hero{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;margin-bottom:16px}
.track-stat-card{background:#fff;border:1px solid var(--br);border-radius:18px;padding:16px;box-shadow:var(--sh0)}
.track-mini-title{font-size:11px;font-weight:800;letter-spacing:.45px;text-transform:uppercase;color:var(--mu2);margin-bottom:6px}
.track-step-list{position:relative;padding-left:34px}
.track-step-list::before{content:'';position:absolute;left:11px;top:10px;bottom:10px;width:2px;background:#e7ecef}
.track-step-row{position:relative;padding:0 0 16px}
.track-step-dot{position:absolute;left:-34px;top:2px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900}

/* CHECKOUT / PAYMENT REDESIGN */
.co-overlay{position:fixed;inset:0;z-index:600;background:rgba(16,23,33,.58);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(10px)}
.co-modal{width:min(1080px,100%);max-height:94vh;background:#fff;border-radius:28px;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) 360px;box-shadow:0 30px 90px rgba(15,17,17,.26);animation:scaleIn .32s cubic-bezier(.22,1,.36,1)}
.co-main{display:flex;flex-direction:column;min-width:0}
.co-head{padding:22px 26px;background:linear-gradient(135deg,#182433,#24384c);color:#fff}
.co-body{padding:24px 26px;overflow:auto;background:linear-gradient(180deg,#fbfcfd 0%,#f4f7f8 100%)}
.co-side{border-left:1px solid #e7ecef;background:#fff;padding:24px 22px;overflow:auto}
.co-stepbar{display:flex;gap:10px;margin-top:18px}
.co-stepchip{flex:1;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08)}
.co-stepchip.on{background:rgba(255,216,20,.14);border-color:rgba(255,216,20,.18)}
.co-panel{background:#fff;border:1px solid var(--br);border-radius:20px;padding:18px;box-shadow:var(--sh0);margin-bottom:16px}
.co-section-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--mu2);margin-bottom:14px}
.co-payopt{display:flex;align-items:center;gap:14px;padding:16px;border:1.5px solid #d5d9d9;border-radius:18px;background:#fff;cursor:pointer;transition:.18s;margin-bottom:10px}
.co-payopt.on{border-color:#ff9900;background:#fff7e8;box-shadow:0 0 0 4px rgba(255,153,0,.1)}
.co-summary-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;font-size:14px;border-bottom:1px solid #eef2f2}
.co-summary-row:last-child{border-bottom:none}
.co-summary-total{font-size:24px;font-weight:900;color:var(--nv)}
.co-cta{width:100%;min-height:52px;border:none;border-radius:999px;background:linear-gradient(135deg,#ffd814,#ffb84d);font-weight:900;color:#111;cursor:pointer;box-shadow:0 12px 30px rgba(255,184,77,.26)}
.co-cta.secondary{background:#fff;border:1px solid var(--br);box-shadow:none}

@media(max-width:1100px){
  .pd-grid{grid-template-columns:1fr}
  .pd-info-col{position:static}
  .co-modal{grid-template-columns:1fr}
  .co-side{border-left:none;border-top:1px solid #e7ecef}
}
@media(max-width:720px){
  .auth-page{grid-template-columns:1fr}
  .auth-left{padding:28px 22px;border-right:none;min-height:auto}
  .auth-story-grid{grid-template-columns:1fr 1fr}
  .auth-form-box{padding:14px}
  .auth-card{padding:24px 18px;border-radius:22px}
  .orders-head-card{padding:22px 20px}
  .track-hero{grid-template-columns:1fr}
  .search-overview{grid-template-columns:1fr}
  .acct-media-grid,.acct-stat-grid{grid-template-columns:1fr}
}
@media(max-width:600px){
  .auth-story-grid{grid-template-columns:1fr}
  .pd-topbar{top:62px}
  .pd-main-card,.pd-section-box,.order-card,.sec-wrap{border-radius:16px}
  .pd-main-stage{min-height:360px}
  .pd-name{font-size:26px}
  .co-head,.co-body,.co-side{padding:18px}
  .search-hero-card,.search-panel,.acct-style-card{padding:18px}
  .nav-act-copy span{display:none}
  .nav-act{padding:9px 10px}
}

`

// ─── utility components ────────────────────────────────────────────────────────
function Stars({r,n}){
  if(!r&&!n) return null
  return(
    <span className="stars" style={{display:'inline-flex',alignItems:'center',gap:1}}>
      {[1,2,3,4,5].map(i=>(
        i<=Math.round(r)
          ? <Ic.Star  key={i} width={12} height={12}/>
          : <Ic.StarO key={i} width={12} height={12}/>
      ))}
      {r>0&&<span style={{fontSize:11,fontWeight:700,color:'#92400e',marginLeft:3}}>{r.toFixed(1)}</span>}
      {n>0&&<span style={{fontSize:10,color:'#94a3b8',marginLeft:2}}>({n})</span>}
    </span>
  )
}
function Spin(){return <div className="spin"/>}
function SkeletonCard(){
  return(
    <div style={{width:196,flexShrink:0,borderRadius:12,overflow:'hidden',border:'1px solid var(--br)'}}>
      <div className="skel" style={{height:200}}/>
      <div style={{padding:12}}>
        <div className="skel" style={{height:11,marginBottom:7}}/>
        <div className="skel" style={{height:11,width:'70%',marginBottom:7}}/>
        <div className="skel" style={{height:14,width:'50%'}}/>
      </div>
    </div>
  )
}
function VeriBadge(){return <span className="vbadge" style={{letterSpacing:'.4px'}}>VERIFIED</span>}

// ─── MapPicker ─────────────────────────────────────────────────────────────────
function MapPicker({lat,lng,onPinMove,height=260}){
  const ref=useRef(null);const mapRef=useRef(null)
  useEffect(()=>{
    if(!ref.current||mapRef.current)return
    const L=window.L; if(!L)return
    const m=L.map(ref.current).setView([lat||17.385,lng||78.4867],14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m)
    const mk=L.marker([lat||17.385,lng||78.4867],{draggable:true}).addTo(m)
    mk.on('dragend',e=>{const p=e.target.getLatLng();onPinMove(p.lat,p.lng)})
    m.on('click',e=>{mk.setLatLng(e.latlng);onPinMove(e.latlng.lat,e.latlng.lng)})
    mapRef.current=m
    return()=>{m.remove();mapRef.current=null}
  },[])
  return <div ref={ref} style={{height,borderRadius:'var(--r8)',zIndex:1}}/>
}

// ─── Banner Carousel ──────────────────────────────────────────────────────────
function BannerCarousel({onCtaClick}){
  const[idx,setIdx]=useState(0)
  const timerRef=useRef(null)
  const go=useCallback(n=>setIdx(i=>(i+n+BANNERS.length)%BANNERS.length),[])
  useEffect(()=>{timerRef.current=setInterval(()=>go(1),4200);return()=>clearInterval(timerRef.current)},[go])
  const b=BANNERS[idx]
  return(
    <div className="banner-wrap" style={{background:b.bg}}>
      <div className="banner-slide" style={{background:b.bg}}>
        {b.img&&<img src={b.img} alt="" className="banner-img"/>}
        <div className="banner-body">
          <span className="banner-badge" style={{color:b.accent,borderColor:b.accent+'55',background:b.accent+'18'}}>{b.badge}</span>
          <h1 className="banner-title">{b.title}</h1>
          <p className="banner-sub">{b.sub}</p>
          <RippleBtn className="banner-cta" onClick={()=>onCtaClick&&onCtaClick()}>Shop Now →</RippleBtn>
        </div>
        <div className="banner-progress" style={{background:b.accent}} key={idx}/>
      </div>
      <div className="banner-dots">
        {BANNERS.map((_,i)=><span key={i} className={`bdot ${i===idx?'on':''}`} style={{background:i===idx?'#fff':b.accent+'66'}} onClick={()=>setIdx(i)}/>)}
      </div>
      <button className="banner-nav" style={{left:14}} onClick={()=>go(-1)}>‹</button>
      <button className="banner-nav" style={{right:14}} onClick={()=>go(1)}>›</button>
    </div>
  )
}

// ─── Product Card ──────────────────────────────────────────────────────────────
function ProdCard({p,cart,onCartUpdate,onClick,wishlisted,onWishlist,delay=0}){
  const colors=Array.isArray(p.colors)?p.colors:[]
  const qty=cart.find(i=>(i._key||String(i.id))===String(p.id))?.qty||0
  const disc=p.mrp&&p.mrp>p.price?Math.round((1-p.price/p.mrp)*100):null

  const add=e=>{
    e.stopPropagation()
    if(p.hasSizes){onClick(p);return}
    // Check if cart has items from a DIFFERENT shop
    const cartShopId=cart.length>0?cart[0].shopId:null
    if(cartShopId && p.shopId && cartShopId!==p.shopId){
      showToast('Clear cart first — items from another shop','error')
      return
    }
    onCartUpdate(prev=>{
      const idx=prev.findIndex(i=>i.id===p.id)
      if(idx>=0){const u=[...prev];u[idx]={...u[idx],qty:u[idx].qty+1};return u}
      return[...prev,{...p,_key:String(p.id),qty:1}]
    })
    showToast('Added to cart','success')
  }
  const rem=e=>{
    e.stopPropagation()
    onCartUpdate(prev=>{
      const idx=prev.findIndex(i=>i.id===p.id)
      if(idx<0)return prev
      const u=[...prev];u[idx]={...u[idx],qty:u[idx].qty-1}
      if(u[idx].qty<=0)u.splice(idx,1)
      return u
    })
  }

  return(
    <div className="pc" style={{animationDelay:`${delay}s`}} onClick={()=>onClick(p)}>
      <div className="pc-img-wrap">
        {p.imageUrl
          ?<img src={p.imageUrl} alt={p.name} className="pc-img" onError={e=>e.target.style.display='none'}/>
          :<div className="pc-img" style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:44,background:'#f8fafc'}}><svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='#cbd5e1' strokeWidth='1.5' strokeLinecap='round'><path d='M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z'/><line x1='3' y1='6' x2='21' y2='6'/><path d='M16 10a4 4 0 01-8 0'/></svg></div>}
        {disc>5&&<span className="pc-badge" style={{background:'#ef4444'}}>{disc}% OFF</span>}
        {onWishlist&&(
          <button className={`pc-wish${wishlisted?' on':''}`} onClick={e=>{e.stopPropagation();onWishlist(p.id)}}>
            {wishlisted
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            }
          </button>
        )}
      </div>
      <div className="pc-body">
        <div className="pc-name">{p.name}</div>
        {p.shopName&&(
          <div className="pc-shop">{p.shopName}{p.shopVerified&&<span className="pc-v" style={{fontSize:9,fontWeight:800,background:'#eff6ff',color:'#1d4ed8',padding:'1px 5px',borderRadius:4}}>VERIFIED</span>}</div>
        )}
        <div className="pc-stars"><Stars r={p.avgRating||0} n={p.reviewCount||0}/></div>
        {colors.length>0&&(
          <div className="pc-colors">
            {colors.slice(0,5).map((c,i)=><div key={i} className="pc-cdot" title={c.name} style={{background:c.hex,outline:c.hex==='#ffffff'?'1px solid #e2e8f0':'none'}}/>)}
            {colors.length>5&&<span style={{fontSize:9,color:'var(--mu2)',fontWeight:700,alignSelf:'center'}}>+{colors.length-5}</span>}
          </div>
        )}
        <div className="pc-foot">
          <div>
            <span className="pc-price">₹{p.price}</span>
            {p.mrp&&p.mrp>p.price&&<span className="pc-mrp">₹{p.mrp}</span>}
            {disc>5&&<span className="pc-disc">{disc}%</span>}
          </div>
          {qty>0
            ?<div className="pc-qty">
               <button onClick={rem} style={{fontWeight:900,fontSize:16,lineHeight:1}}>−</button>
               <span>{qty}</span>
               <button onClick={add} style={{fontWeight:900,fontSize:16,lineHeight:1}}>+</button>
             </div>
             :<RippleBtn className="pc-addbtn" onClick={add} disabled={!p.isActive}
                style={{fontSize:11,fontWeight:800,letterSpacing:'.3px',padding:'0 8px',width:'auto',minWidth:30}}>
                {p.hasSizes?'SELECT':'ADD'}
              </RippleBtn>
          }
        </div>
      </div>
    </div>
  )
}

// ─── Shop Card ────────────────────────────────────────────────────────────────
function ShopCard({shop,onClick}){
  return(
    <div className="scard" onClick={()=>onClick(shop)}>
      {shop.imageUrl
        ?<img src={shop.imageUrl} alt={shop.name} className="scard-img" onError={e=>e.target.style.display='none'}/>
        :<div style={{height:148,background:'linear-gradient(135deg,var(--nv),var(--nv2))',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,.2)' strokeWidth='1.5' strokeLinecap='round'><path d='M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'/><rect x='9' y='14' width='6' height='7' rx='1'/></svg></div>}
      <div className="scard-body">
        <div className="scard-name">
          {shop.name}
          {shop.isVerified&&<VeriBadge/>}
        </div>
        <div className="scard-meta">
          <Stars r={shop.rating||0} n={shop.ratingCount||0}/>
          <span>·</span><span>⏱ {shop.deliveryTime}m</span>
          {shop.distanceKm&&<><span>·</span><span style={{fontWeight:700}}>{shop.distanceKm} km away</span></>}
        </div>
        <div style={{fontSize:11,color:'var(--mu)',marginTop:4}}>{shop.category}</div>
      </div>
    </div>
  )
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({onSuccess,onClose,initialTab='login'}){
  const[tab,setTab]=useState(initialTab)
  const[form,setForm]=useState({name:'',email:'',phone:'',password:''})
  const[loading,setLoading]=useState(false)
  const[err,setErr]=useState('')
  const[otpStep,setOtpStep]=useState('form')
  const[otpDigits,setOtpDigits]=useState(['','','','','',''])
  const[otpSending,setOtpSending]=useState(false)
  const[otpTimer,setOtpTimer]=useState(0)
  const[loc,setLoc]=useState(null)
  const[showPass,setShowPass]=useState(false)
  const timerRef=useRef(null)
  const otpRefs=[useRef(),useRef(),useRef(),useRef(),useRef(),useRef()]
  const s=k=>e=>setForm(f=>({...f,[k]:e.target.value}))

  const startTimer=()=>{
    setOtpTimer(60)
    timerRef.current=setInterval(()=>setOtpTimer(t=>{if(t<=1){clearInterval(timerRef.current);return 0}return t-1}),1000)
  }

  const otpValue=otpDigits.join('')

  const handleOtpDigit=(i,val)=>{
    const d=[...otpDigits]
    d[i]=val.replace(/\D/g,'').slice(-1)
    setOtpDigits(d)
    if(val&&i<5) otpRefs[i+1].current?.focus()
  }
  const handleOtpKey=(i,e)=>{
    if(e.key==='Backspace'&&!otpDigits[i]&&i>0){otpRefs[i-1].current?.focus()}
  }

  const sendOtp=async()=>{
    const phone=form.phone.replace(/\D/g,'')
    if(phone.length!==10){setErr('Enter valid 10-digit number');return}
    setOtpSending(true);setErr('')
    try{
      const r=await api.sendOtp(phone)
      setOtpStep('otp');startTimer()
      if(r.data.dev_otp){
        const digits=String(r.data.dev_otp).split('')
        setOtpDigits(digits)
      }
      setTimeout(()=>otpRefs[0].current?.focus(),100)
    }catch(e){setErr(e.response?.data?.detail||'OTP failed')}
    setOtpSending(false)
  }

  const getLoc=()=>navigator.geolocation?.getCurrentPosition(p=>setLoc({lat:p.coords.latitude,lng:p.coords.longitude}))

  const submit=async()=>{
    setErr('');setLoading(true)
    try{
      let r
      if(tab==='login') r=await api.login({email:form.email,password:form.password,...loc})
      else{
        if(!form.name||!form.email||!form.password){setErr('All fields are required');setLoading(false);return}
        r=await api.register({...form,role:'CUSTOMER',otp:otpValue,...loc})
      }
      setTokens(r.data.accessToken,r.data.refreshToken)
      onSuccess(r.data.user)
    }catch(e){setErr(e.response?.data?.detail||'Login failed. Check your details.')}
    setLoading(false)
  }

  const switchTab=(t)=>{setTab(t);setOtpStep('form');setOtpDigits(['','','','','','']);setErr('');setForm({name:'',email:'',phone:'',password:''})}

  const FEATURES=[
    {icon:<Ic.Shop  width={18} height={18} stroke="var(--or)"/>, text:'Shop from local fashion stores'},
    {icon:<Ic.Truck width={18} height={18} stroke="var(--or)"/>, text:'60-minute delivery to your door'},
    {icon:<Ic.Tag   width={18} height={18} stroke="var(--or)"/>, text:'Products in every colour & size'},
    {icon:<Ic.Return width={18} height={18} stroke="var(--or)"/>, text:'Easy 7-day returns on fashion'},
  ]

  useEffect(()=>setTab(initialTab),[initialTab])

  return(
    <div className="auth-page">
      {/* LEFT — brand panel */}
      <div className="auth-left">
        <div className="auth-dots"/>
        <div className="auth-story">
          <div className="auth-story-top">
            <div className="auth-logo-box"><svg width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='#fff' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z'/><line x1='3' y1='6' x2='21' y2='6'/><path d='M16 10a4 4 0 01-8 0'/></svg></div>
            <div>
              <div className="auth-kicker">Marketplace membership</div>
              <div style={{fontWeight:900,fontSize:32,color:'#fff',letterSpacing:'-1px',marginTop:8}}>Near<span style={{color:'var(--or)'}}>Now</span></div>
            </div>
          </div>
          <div className="auth-hero-title">{tab==='register'?'Create your shopping account with a premium onboarding flow.':'Sign in and continue your fashion orders in seconds.'}</div>
          <div className="auth-hero-copy">A cleaner, faster customer experience inspired by marketplace storefronts and food-delivery polish. Scroll, browse, sign up, track orders, and check out with a more premium feel.</div>
          <div className="auth-story-grid">
            <div className="auth-story-card"><strong>60 min</strong><span>Fast local delivery with better order visibility.</span></div>
            <div className="auth-story-card"><strong>Verified</strong><span>Trusted stores and cleaner product presentation.</span></div>
          </div>
          <div className="auth-story-list">
            {FEATURES.map(({icon,text})=>(
              <div key={text} className="auth-story-item">
                <span className="auth-story-ico">{icon}</span>
                <span style={{color:'rgba(255,255,255,.86)',fontSize:13,fontWeight:600,lineHeight:1.6}}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
            {['shirt','kurta','saree','jeans','dress','jacket'].map(s=>(
              <button key={s} onClick={()=>{setQuery(s);doSearch(s)}} style={{border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.08)',color:'#fff',padding:'9px 14px',borderRadius:999,cursor:'pointer',fontWeight:700,fontSize:12}}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="auth-right">
        <div className="auth-form-box">
          {/* Close btn */}
          {onClose&&(
            <button onClick={onClose} style={{position:'absolute',top:20,right:20,background:'#f1f5f9',border:'none',borderRadius:'50%',width:36,height:36,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--mu)',transition:'.2s'}}
              onMouseEnter={e=>e.target.style.background='#e2e8f0'} onMouseLeave={e=>e.target.style.background='#f1f5f9'}>✕</button>
          )}

          <div className="auth-card">
          <div className="auth-pane-head">
            <div className="auth-pane-eyebrow">{tab==='login'?'Customer sign in':'Dedicated sign-up page'}</div>
            <div className="auth-pane-title">
              {tab==='login'?'Welcome back':'Create your account'}
            </div>
            <div className="auth-pane-sub">
              {tab==='login'?'Continue your orders, wishlist, and checkout history.':'A richer full-screen sign-up flow with OTP verification and smoother onboarding.'}
            </div>
          </div>

          {/* Tab switcher */}
          <div className="auth-tab-row">
            <button className={`auth-tab ${tab==='login'?'on':'off'}`} onClick={()=>switchTab('login')}>Sign In</button>
            <button className={`auth-tab ${tab==='register'?'on':'off'}`} onClick={()=>switchTab('register')}>Sign Up</button>
          </div>

          {/* OTP verification step */}
          {tab==='register'&&otpStep==='otp'?(
            <div className="auth-scroll-panel" style={{animation:'slideRight .3s ease'}}>
              <div style={{textAlign:'center',padding:'20px',background:'linear-gradient(135deg,var(--orl),#fffbeb)',borderRadius:'var(--r12)',border:'2px solid var(--orm)',marginBottom:20}}>
                <div style={{width:56,height:56,borderRadius:14,background:'var(--orl)',border:'2px solid var(--orm)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 10px'}}><svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='var(--ord)' strokeWidth='2' strokeLinecap='round'><rect x='5' y='2' width='14' height='20' rx='2' ry='2'/><line x1='12' y1='18' x2='12.01' y2='18'/></svg></div>
                <div style={{fontWeight:800,fontSize:16,color:'var(--ord)'}}>OTP sent to {form.phone}</div>
                <div style={{fontSize:12,color:'var(--mu)',marginTop:4}}>Enter the 6-digit code below</div>
              </div>

              {/* 6 individual OTP digit boxes */}
              <div className="auth-otp-box">
                {otpDigits.map((d,i)=>(
                  <input key={i} ref={otpRefs[i]} className="auth-otp-input" value={d} maxLength={1}
                    onChange={e=>handleOtpDigit(i,e.target.value)}
                    onKeyDown={e=>handleOtpKey(i,e)}
                    onFocus={e=>e.target.select()}/>
                ))}
              </div>

              {err&&<div style={{color:'var(--rd)',fontSize:12,padding:'9px 13px',background:'var(--rdl)',borderRadius:'var(--r8)',marginBottom:12,textAlign:'center'}}>{err}</div>}

              <button className="auth-submit-btn" onClick={submit} disabled={loading||otpValue.length!==6} style={{marginTop:4}}>
                {loading?(
                  <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <span style={{width:18,height:18,border:'2.5px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 1s linear infinite',display:'inline-block'}}/>
                    Verifying…
                  </span>
                ):'Verify & Create Account'}
              </button>

              <div style={{display:'flex',justifyContent:'space-between',marginTop:14,fontSize:13}}>
                <button onClick={()=>{setOtpStep('form');setOtpDigits(['','','','','',''])}} style={{background:'none',border:'none',color:'var(--mu)',cursor:'pointer',fontWeight:600}}>← Change number</button>
                {otpTimer>0
                  ?<span style={{color:'var(--mu)'}}>Resend in <strong>{otpTimer}s</strong></span>
                  :<button onClick={sendOtp} style={{background:'none',border:'none',color:'var(--or)',cursor:'pointer',fontWeight:800}}>Resend OTP →</button>}
              </div>
            </div>
          ):(
            <div className="auth-scroll-panel" style={{display:'flex',flexDirection:'column',gap:4}}>
              {tab==='register'&&(
                <>
                  <div className="auth-floating-label">
                    <input placeholder=" " value={form.name} onChange={s('name')}/>
                    <label>Full Name *</label>
                  </div>
                  <div className="auth-floating-label">
                    <input placeholder=" " value={form.phone} onChange={s('phone')} inputMode="tel"/>
                    <label>Phone Number *</label>
                  </div>
                </>
              )}
              <div className="auth-floating-label">
                <input type="email" placeholder=" " value={form.email} onChange={s('email')}/>
                <label>Email Address *</label>
              </div>
              <div className="auth-floating-label" style={{position:'relative'}}>
                <input type={showPass?'text':'password'} placeholder=" " value={form.password} onChange={s('password')} onKeyDown={e=>e.key==='Enter'&&(tab==='login'?submit():sendOtp())}/>
                <label>Password *</label>
                <button onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--mu)'}}>
                  {showPass?'Hide':'Show'}
                </button>
              </div>

              {/* GPS location */}
              <div onClick={getLoc} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:'var(--r8)',border:`1.5px solid ${loc?'var(--gn)':'var(--br)'}`,background:loc?'var(--gnl)':'#f8fafc',cursor:'pointer',transition:'.2s',marginTop:4}}>
                <span style={{fontSize:20}}>{loc?'●':'○'}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:loc?'var(--gn)':'var(--tx)'}}>{loc?'Location set!':'Set your location (optional)'}</div>
                  <div style={{fontSize:11,color:'var(--mu)'}}>Helps find shops near you</div>
                </div>
                {!loc&&<span style={{marginLeft:'auto',fontSize:11,color:'var(--or)',fontWeight:700}}>Tap to set →</span>}
              </div>

              {err&&<div style={{color:'var(--rd)',fontSize:12,padding:'9px 13px',background:'var(--rdl)',borderRadius:'var(--r8)',marginTop:4}}>{err}</div>}

              <button className="auth-submit-btn" style={{marginTop:12}} onClick={tab==='login'?submit:sendOtp} disabled={loading||otpSending}>
                {loading||otpSending?(
                  <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <span style={{width:18,height:18,border:'2.5px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 1s linear infinite',display:'inline-block'}}/>
                    {otpSending?'Sending OTP…':'Signing in…'}
                  </span>
                ):tab==='login'?'Sign In →':'Send OTP →'}
              </button>

              {tab==='login'&&(
                <>
                  <div style={{display:'flex',alignItems:'center',gap:10,margin:'14px 0 10px'}}>
                    <div style={{flex:1,height:1,background:'var(--br)'}}/>
                    <span style={{fontSize:12,color:'var(--mu)',fontWeight:600}}>Demo Account</span>
                    <div style={{flex:1,height:1,background:'var(--br)'}}/>
                  </div>
                  <button onClick={()=>setForm(f=>({...f,email:'arjun@example.com',password:'password123'}))}
                    style={{width:'100%',padding:'10px',border:'1.5px dashed var(--br)',borderRadius:'var(--r8)',background:'#f8fafc',cursor:'pointer',fontSize:12,fontWeight:700,color:'var(--mu)',transition:'.2s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--or)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--br)'}>
                    arjun@example.com / password123
                  </button>
                </>
              )}

              {tab==='register'&&(
                <div style={{marginTop:10,fontSize:12,color:'var(--mu)',textAlign:'center'}}>
                  By registering you agree to our Terms of Service & Privacy Policy
                </div>
              )}

              <div className="auth-switch-note">
                {tab==='login'?'New here? ':'Already have an account? '}
                <button className="auth-text-btn" onClick={()=>switchTab(tab==='login'?'register':'login')}>
                  {tab==='login'?'Open Sign Up':'Back to Sign In'}
                </button>
              </div>

              {onClose&&(
                <button onClick={onClose} style={{width:'100%',padding:10,border:'1.5px solid var(--br)',borderRadius:'var(--r8)',background:'transparent',cursor:'pointer',fontSize:13,fontWeight:700,color:'var(--mu)',marginTop:8,transition:'.2s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--or)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--br)'}>
                  ← Continue browsing
                </button>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

// ─── 60-Minute Delivery Countdown ─────────────────────────────────────────────


function CheckoutModal({cart,user,onClose,onSuccess}){
  const[savedAddresses,setSavedAddresses]=useState([])
  useEffect(()=>{if(user)api.getAddresses().then(r=>setSavedAddresses(r.data||[])).catch(()=>{})},[user])
  const[addr,setAddr]=useState(user?.lat?`Near your saved location`:'' )
  const[dLat,setDLat]=useState(user?.lat||null)
  const[dLng,setDLng]=useState(user?.lng||null)
  const[payment,setPayment]=useState('cod')
  const[loading,setLoading]=useState(false)
  const[manualAddr,setManualAddr]=useState('')
  const[locMode,setLocMode]=useState(user?.lat?'saved':'manual')
  const[feeData,setFeeData]=useState(null)
  const[feeLd,setFeeLd]=useState(false)
  const[showMap,setShowMap]=useState(false)
  const[promo,setPromo]=useState('')
  const[step,setStep]=useState(1)
  const[promoData,setPromoData]=useState(null)
  const[promoErr,setPromoErr]=useState('')

  const sub=cart.reduce((s,i)=>s+i.price*i.qty,0)
  const fee=feeData?.deliveryFee??29
  const km=feeData?.km??null
  const baseFee=feeData?.baseDeliveryFee??20
  const distanceFee=feeData?.distanceFee??0
  const surgeFee=feeData?.surgeFee??0
  const gstAmount=feeData?.gstAmount??0
  const platformFee=feeData?.platformFee??PLATFORM_FEE
  const freeDeliveryDiscount=feeData?.freeDeliveryDiscount??0
  const promoDiscount=promoData?.discount||0
  const grand=Math.max(0,sub+fee+platformFee+gstAmount-promoDiscount)
  const paymentLabel=payment==='cod'?'Cash on Delivery':payment==='upi'?'UPI / Netbanking':'Card Payment'
  const finalAddr=(locMode==='saved'?addr:manualAddr)||''
  const priceRows=[
    {k:'Items total',v:`₹${sub.toFixed(2)}`},
    {k:'Base delivery',v:`₹${baseFee.toFixed(2)}`},
    {k:`Distance fee${km?` (${km} km)`:''}`,v:feeLd?'Calculating...':`₹${distanceFee.toFixed(2)}`},
    {k:'Surge fee',v:`₹${surgeFee.toFixed(2)}`},
    {k:'Platform fee',v:`₹${platformFee.toFixed(2)}`},
    {k:`GST (${Math.round((feeData?.gstRate||0.05)*100)}%)`,v:`₹${gstAmount.toFixed(2)}`},
    {k:'Free delivery savings',v:freeDeliveryDiscount?`-₹${freeDeliveryDiscount.toFixed(2)}`:'₹0.00',accent:!!freeDeliveryDiscount},
  ]

  useEffect(()=>{
    if(dLat&&dLng){
      setFeeLd(true)
      const sLat=cart[0]?.shopLat||17.385;const sLng=cart[0]?.shopLng||78.4867
      api.getDeliveryFee(sLat,sLng,dLat,dLng,sub,!!user?.isPremium).then(r=>setFeeData(r.data)).catch(()=>setFeeData(null)).finally(()=>setFeeLd(false))
    }
  },[dLat,dLng,sub,user?.isPremium])

  const place=async()=>{
    if(!finalAddr.trim()){showToast('Please enter a delivery address','error');return}
    setLoading(true)
    try{
      const r=await api.placeOrder({
        shopId:cart[0].shopId,
        items:cart.map(i=>({productId:i.id,qty:i.qty,size:i.selectedSize||undefined})),
        deliveryAddress:finalAddr,paymentMethod:payment,
        deliveryLat:dLat,deliveryLng:dLng,promoCode:promo||undefined
      })
      onSuccess(r.data)
    }catch(e){showToast(e.response?.data?.detail||'Order failed. Please try again.','error')}
    setLoading(false)
  }

  const STEPS=[{n:1,label:'Delivery'},{n:2,label:'Payment'},{n:3,label:'Confirm'}]

  return(
    <div style={{position:'fixed',inset:0,zIndex:600,background:'linear-gradient(135deg,rgba(15,23,42,.94),rgba(30,41,59,.88))',display:'flex',alignItems:'stretch',justifyContent:'center',padding:'14px',backdropFilter:'blur(12px)',animation:'fadeIn .2s ease'}}>
      <div style={{background:'#fff',borderRadius:28,width:'100%',maxWidth:1480,height:'calc(100vh - 28px)',overflow:'hidden',display:'flex',flexDirection:'column',animation:'scaleIn .3s cubic-bezier(.22,1,.36,1)',boxShadow:'0 32px 80px rgba(0,0,0,.25)',position:'relative'}}>

        {/* Header */}
        <div style={{background:'linear-gradient(120deg,#0f172a,#1d3557 55%,#243b53)',padding:'22px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{fontWeight:900,fontSize:22,color:'#fff',letterSpacing:'-.3px'}}>Secure Checkout</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:2}}>₹{grand} · {cart.length} item{cart.length!==1?'s':''}</div>
          </div>
          <button onClick={onClose} style={{width:42,height:42,borderRadius:'50%',background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.15)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'.2s'}}
            onMouseEnter={e=>e.target.style.background='rgba(255,255,255,.2)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,.1)'}>
            <Ic.X width={16} height={16}/>
          </button>
        </div>

        {/* Step indicators */}
        <div style={{display:'flex',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',flexShrink:0,padding:'0 20px'}}>
          {STEPS.map(({n,label},i)=>{
            const state=step===n?'active':step>n?'done':'pending'
            return(
              <div key={n} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'12px 8px',cursor:n<step?'pointer':'default',borderBottom:`3px solid ${state==='active'?'#f97316':state==='done'?'#16a34a':'transparent'}`,transition:'.2s'}} onClick={()=>n<step&&setStep(n)}>
                <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,transition:'.2s',background:state==='active'?'#f97316':state==='done'?'#16a34a':'#e2e8f0',color:state==='pending'?'#94a3b8':'#fff'}}>
                  {state==='done'?<Ic.Check width={12} height={12}/>:n}
                </div>
                <span style={{fontSize:11,fontWeight:700,color:state==='active'?'#f97316':state==='done'?'#16a34a':'#94a3b8'}}>{label}</span>
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div style={{flex:1,display:'grid',gridTemplateColumns:'minmax(0,1.15fr) minmax(360px,.85fr)',overflow:'hidden'}}>
          <div style={{overflowY:'auto',padding:'24px 28px 30px'}}>

          {/* ── STEP 1: DELIVERY ── */}
          {step===1&&(
            <div style={{animation:'fadeUp .3s ease'}}>
              <div style={{fontWeight:800,fontSize:13,letterSpacing:'.5px',textTransform:'uppercase',color:'#64748b',marginBottom:14}}>Delivery Address</div>

              {/* Saved location option */}
              {user?.lat&&(
                <div onClick={()=>{setLocMode('saved');setAddr(`Near your saved location (${user.lat?.toFixed(3)}°N, ${user.lng?.toFixed(3)}°E)`);setDLat(user.lat);setDLng(user.lng)}}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:14,border:`2px solid ${locMode==='saved'?'#f97316':'#e2e8f0'}`,background:locMode==='saved'?'#fff7ed':'#fff',cursor:'pointer',marginBottom:10,transition:'all .2s'}}>
                  <div style={{width:40,height:40,borderRadius:12,background:locMode==='saved'?'#f97316':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'.2s'}}>
                    <Ic.Map width={18} height={18} stroke={locMode==='saved'?'#fff':'#64748b'}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>Saved Location</div>
                    <div style={{fontSize:12,color:'#64748b',marginTop:1}}>{user.lat?.toFixed(4)}°N, {user.lng?.toFixed(4)}°E</div>
                  </div>
                  <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${locMode==='saved'?'#f97316':'#e2e8f0'}`,display:'flex',alignItems:'center',justifyContent:'center',background:locMode==='saved'?'#f97316':'transparent',flexShrink:0}}>
                    {locMode==='saved'&&<Ic.Check width={10} height={10} stroke="#fff"/>}
                  </div>
                </div>
              )}

              {/* Saved addresses */}
              {savedAddresses.length>0&&savedAddresses.map(a=>(
                <div key={a.id} onClick={()=>{setManualAddr(a.address);setLocMode('manual');if(a.lat){setDLat(a.lat);setDLng(a.lng)}}}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:14,border:`2px solid ${manualAddr===a.address&&locMode==='manual'?'#f97316':'#e2e8f0'}`,background:manualAddr===a.address&&locMode==='manual'?'#fff7ed':'#fff',cursor:'pointer',marginBottom:8,transition:'all .2s'}}>
                  <div style={{width:36,height:36,borderRadius:10,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontWeight:800,fontSize:12,color:'#475569'}}>
                    {a.label==='Home'?'🏠':a.label==='Work'?'💼':'📍'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13}}>{a.label}</div>
                    <div style={{fontSize:11,color:'#64748b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.address}</div>
                  </div>
                </div>
              ))}

              {/* Manual address */}
              <div onClick={()=>setLocMode('manual')} style={{padding:'14px 16px',borderRadius:14,border:`2px solid ${locMode==='manual'&&!savedAddresses.some(a=>a.address===manualAddr)?'#f97316':'#e2e8f0'}`,background:'#fff',cursor:'pointer',marginBottom:10,transition:'all .2s'}}>
                <div style={{fontWeight:700,fontSize:13,color:'#0f172a',marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
                  <Ic.Map width={15} height={15} stroke="#f97316"/> Enter New Address
                </div>
                <textarea
                  value={manualAddr}
                  onChange={e=>{setManualAddr(e.target.value);setLocMode('manual')}}
                  onClick={e=>{e.stopPropagation();setLocMode('manual')}}
                  rows={2}
                  placeholder="House no., Street, Area, Landmark…"
                  style={{width:'100%',border:'1.5px solid #e2e8f0',borderRadius:10,padding:'10px 12px',fontSize:13,fontFamily:'var(--fn)',color:'#0f172a',outline:'none',resize:'none',transition:'border .2s'}}
                  onFocus={e=>e.target.style.borderColor='#f97316'}
                  onBlur={e=>e.target.style.borderColor='#e2e8f0'}
                />
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button onClick={e=>{e.stopPropagation();setShowMap(true)}}
                    style={{flex:1,padding:'9px',borderRadius:10,border:'1.5px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:12,fontWeight:700,color:'#475569',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'.2s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#f97316';e.currentTarget.style.color='#f97316'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#475569'}}>
                    <Ic.Map width={14} height={14}/> Pin on Map
                  </button>
                  {manualAddr&&(
                    <button onClick={e=>{e.stopPropagation();api.addAddress({label:'Home',address:manualAddr,lat:dLat,lng:dLng}).then(r=>setSavedAddresses(p=>[...p,r.data]));showToast('Address saved!','success')}}
                      style={{flex:1,padding:'9px',borderRadius:10,border:'1.5px solid #16a34a',background:'#f0fdf4',cursor:'pointer',fontSize:12,fontWeight:700,color:'#16a34a',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'.2s'}}>
                      <Ic.Check width={14} height={14} stroke="#16a34a"/> Save Address
                    </button>
                  )}
                </div>
              </div>

              {/* Promo */}
              <div style={{marginBottom:20}}>
                <div style={{fontWeight:800,fontSize:13,letterSpacing:'.5px',textTransform:'uppercase',color:'#64748b',marginBottom:10}}>Promo Code</div>
                <div style={{display:'flex',gap:8}}>
                  <input value={promo} onChange={e=>{setPromo(e.target.value.toUpperCase());setPromoData(null);setPromoErr('')}}
                    placeholder="Enter code…"
                    style={{flex:1,padding:'11px 14px',border:'1.5px solid #e2e8f0',borderRadius:10,fontSize:14,fontFamily:'var(--fn)',outline:'none',letterSpacing:1,fontWeight:700,transition:'.2s'}}
                    onFocus={e=>e.target.style.borderColor='#f97316'} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
                  <button onClick={async()=>{if(!promo.trim())return;try{const r=await api.validatePromo(promo,sub);setPromoData(r.data);setPromoErr('')}catch(e){setPromoErr(e.response?.data?.detail||'Invalid code');setPromoData(null)}}}
                    style={{padding:'11px 18px',background:'linear-gradient(135deg,#f97316,#ea580c)',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontWeight:800,fontSize:13}}>Apply</button>
                </div>
                {promoData&&<div style={{marginTop:8,padding:'8px 12px',background:'#f0fdf4',border:'1px solid rgba(22,163,74,.2)',borderRadius:8,fontSize:12,fontWeight:700,color:'#16a34a',display:'flex',alignItems:'center',gap:6}}><Ic.Check width={12} height={12} stroke="#16a34a"/> {promoData.message}</div>}
                {promoErr&&<div style={{marginTop:8,fontSize:12,color:'#dc2626',padding:'6px 10px',background:'#fef2f2',borderRadius:8}}>{promoErr}</div>}
              </div>

              <button onClick={()=>{
                  const finalAddr=(locMode==='saved'?addr:manualAddr)||''
                  if(!finalAddr.trim()){showToast('Please enter a delivery address','error');return}
                  setStep(2)
                }}
                style={{width:'100%',padding:'15px',background:'linear-gradient(135deg,#f97316,#ea580c)',color:'#fff',border:'none',borderRadius:14,fontWeight:800,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 18px rgba(249,115,22,.3)',transition:'all .2s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(249,115,22,.4)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 18px rgba(249,115,22,.3)'}}>
                Continue to Payment <Ic.ChevR width={18} height={18}/>
              </button>
            </div>
          )}

          {/* ── STEP 2: PAYMENT ── */}
          {step===2&&(
            <div style={{animation:'fadeUp .3s ease'}}>
              <div style={{fontWeight:800,fontSize:13,letterSpacing:'.5px',textTransform:'uppercase',color:'#64748b',marginBottom:14}}>Payment Method</div>
              {[
                {v:'cod',label:'Cash on Delivery',sub:'Pay when your order arrives',icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,c:'#16a34a',bg:'#f0fdf4'},
                {v:'upi',label:'UPI / GPay / PhonePe',sub:'Pay instantly, zero fees',icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,c:'#7c3aed',bg:'#f5f3ff'},
                {v:'card',label:'Credit / Debit Card',sub:'Visa · Mastercard · Rupay',icon:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>,c:'#2563eb',bg:'#eff6ff'},
              ].map(({v,label,sub,icon,c,bg})=>(
                <div key={v} onClick={()=>setPayment(v)} style={{display:'flex',alignItems:'center',gap:14,padding:'16px',borderRadius:16,border:`2px solid ${payment===v?c:'#e2e8f0'}`,background:payment===v?bg:'#fff',cursor:'pointer',marginBottom:10,transition:'all .2s',boxShadow:payment===v?`0 0 0 4px ${c}18`:'none'}}>
                  <div style={{width:48,height:48,borderRadius:12,background:payment===v?c+'15':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',color:payment===v?c:'#94a3b8',flexShrink:0,transition:'.2s'}}>{icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800,fontSize:14,color:'#0f172a'}}>{label}</div>
                    <div style={{fontSize:12,color:'#64748b',marginTop:2}}>{sub}</div>
                  </div>
                  <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${payment===v?c:'#e2e8f0'}`,display:'flex',alignItems:'center',justifyContent:'center',background:payment===v?c:'transparent',flexShrink:0,transition:'all .2s'}}>
                    {payment===v&&<Ic.Check width={11} height={11} stroke="#fff"/>}
                  </div>
                </div>
              ))}

              {/* Security badge */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderRadius:12,border:'1px solid rgba(22,163,74,.15)',marginBottom:20}}>
                <Ic.Shield width={18} height={18} stroke="#16a34a"/>
                <span style={{fontSize:12,fontWeight:600,color:'#15803d'}}>256-bit SSL encrypted · Your payment is 100% secure</span>
              </div>

              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setStep(1)} style={{flex:'0 0 auto',padding:'14px 20px',borderRadius:14,border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',fontWeight:700,fontSize:14,color:'#475569',display:'flex',alignItems:'center',gap:6,transition:'.2s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#f97316'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}>
                  <Ic.ChevL width={16} height={16}/> Back
                </button>
                <button onClick={()=>setStep(3)} style={{flex:1,padding:'14px',background:'linear-gradient(135deg,#f97316,#ea580c)',color:'#fff',border:'none',borderRadius:14,fontWeight:800,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 18px rgba(249,115,22,.3)',transition:'all .2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(249,115,22,.4)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 18px rgba(249,115,22,.3)'}}>
                  Review Order <Ic.ChevR width={18} height={18}/>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: CONFIRM ── */}
          {step===3&&(
            <div style={{animation:'fadeUp .3s ease'}}>
              {/* Order items */}
              <div style={{marginBottom:18}}>
                <div style={{fontWeight:800,fontSize:13,letterSpacing:'.5px',textTransform:'uppercase',color:'#64748b',marginBottom:10}}>Order Summary</div>
                <div style={{background:'#f8fafc',borderRadius:14,overflow:'hidden',border:'1px solid #e2e8f0'}}>
                  {cart.map((item,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderBottom:i<cart.length-1?'1px solid #f1f5f9':'none'}}>
                      {item.imageUrl?<img src={item.imageUrl} alt={item.name} style={{width:44,height:44,borderRadius:10,objectFit:'cover',border:'1px solid #e2e8f0',flexShrink:0}}/>:<div style={{width:44,height:44,borderRadius:10,background:'#e2e8f0',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><Ic.Shop width={18} height={18} stroke="#94a3b8"/></div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#0f172a'}}>{item.name}</div>
                        {item.selectedSize&&<div style={{fontSize:11,color:'#64748b'}}>Size: {item.selectedSize}</div>}
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontWeight:800,fontSize:14,color:'#0f172a'}}>₹{item.price*item.qty}</div>
                        <div style={{fontSize:11,color:'#94a3b8'}}>×{item.qty}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price breakdown */}
              <div style={{background:'linear-gradient(135deg,#f8fafc,#f1f5f9)',borderRadius:16,padding:'16px',marginBottom:18,border:'1px solid #e2e8f0'}}>
                {[{k:'Subtotal',v:`₹${sub}`},{k:`Delivery${km?` (${km}km)`:''}`,v:feeLd?'Calculating…':`₹${fee}`},{k:'Platform Fee',v:`₹${PLATFORM_FEE}`}].map(({k,v})=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:14,borderBottom:'1px solid rgba(226,232,240,.5)'}}>
                    <span style={{color:'#64748b'}}>{k}</span>
                    <span style={{fontWeight:700}}>{v}</span>
                  </div>
                ))}
                {promoDiscount>0&&(
                  <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:14,borderBottom:'1px solid rgba(226,232,240,.5)'}}>
                    <span style={{color:'#16a34a',fontWeight:700}}>Promo Discount</span>
                    <span style={{fontWeight:700,color:'#16a34a'}}>-₹{promoDiscount}</span>
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',paddingTop:12,marginTop:4,fontWeight:900,fontSize:20,borderTop:'2px solid #e2e8f0'}}>
                  <span>Total</span>
                  <span style={{color:'#f97316'}}>₹{grand}</span>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginTop:-4,marginBottom:18}}>
                <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'12px 14px'}}>
                  <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.6px',color:'#94a3b8',marginBottom:4}}>Delivery logic</div>
                  <div style={{fontWeight:800,fontSize:13,color:'#0f172a'}}>₹{baseFee} + ₹{distanceFee}</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:4}}>Base fee + distance fee</div>
                </div>
                <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'12px 14px'}}>
                  <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.6px',color:'#94a3b8',marginBottom:4}}>Dynamic extras</div>
                  <div style={{fontWeight:800,fontSize:13,color:'#0f172a'}}>₹{surgeFee + gstAmount}</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:4}}>Surge + GST on delivery</div>
                </div>
                <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'12px 14px'}}>
                  <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.6px',color:'#94a3b8',marginBottom:4}}>Savings</div>
                  <div style={{fontWeight:800,fontSize:13,color:freeDeliveryDiscount?'#16a34a':'#0f172a'}}>{freeDeliveryDiscount?`-₹${freeDeliveryDiscount}`:'₹0'}</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:4}}>Free delivery for premium / high cart</div>
                </div>
              </div>

              {/* Delivery address and payment summary */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
                <div style={{padding:'12px 14px',background:'#f8fafc',borderRadius:12,border:'1px solid #e2e8f0'}}>
                  <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.6px',color:'#94a3b8',marginBottom:4}}>Deliver To</div>
                  <div style={{fontSize:12,fontWeight:700,color:'#0f172a',lineHeight:1.4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{(locMode==='saved'?addr:manualAddr)||'—'}</div>
                </div>
                <div style={{padding:'12px 14px',background:'#f8fafc',borderRadius:12,border:'1px solid #e2e8f0'}}>
                  <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.6px',color:'#94a3b8',marginBottom:4}}>Payment</div>
                  <div style={{fontSize:12,fontWeight:700,color:'#0f172a'}}>{payment==='cod'?'Cash on Delivery':payment==='upi'?'UPI':'Card'}</div>
                </div>
              </div>

              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setStep(2)} style={{flex:'0 0 auto',padding:'14px 20px',borderRadius:14,border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',fontWeight:700,fontSize:14,color:'#475569',display:'flex',alignItems:'center',gap:6,transition:'.2s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#f97316'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}>
                  <Ic.ChevL width={16} height={16}/> Back
                </button>
                <button onClick={place} disabled={loading} style={{flex:1,padding:'15px',background:'linear-gradient(135deg,#f97316,#ea580c)',color:'#fff',border:'none',borderRadius:14,fontWeight:900,fontSize:15,cursor:loading?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 6px 22px rgba(249,115,22,.35)',opacity:loading?.8:1,transition:'all .2s'}}
                  onMouseEnter={e=>{if(!loading){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 10px 32px rgba(249,115,22,.45)'}}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 6px 22px rgba(249,115,22,.35)'}}>
                  {loading?<><span style={{width:18,height:18,border:'2.5px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 1s linear infinite',display:'inline-block'}}/> Placing order…</>:<><Ic.Check width={18} height={18}/> Place Order · ₹{grand}</>}
                </button>
              </div>
            </div>
          )}
          </div>
          <div style={{borderLeft:'1px solid #e2e8f0',background:'linear-gradient(180deg,#f8fafc,#eef2ff)',padding:'26px 24px',overflowY:'auto'}}>
            <div style={{position:'sticky',top:0,display:'grid',gap:16}}>
              <div style={{padding:'20px',borderRadius:22,background:'linear-gradient(145deg,#13233b,#223552)',color:'#fff',boxShadow:'0 18px 40px rgba(15,23,42,.18)'}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:'.6px',textTransform:'uppercase',color:'#ffd27a',marginBottom:10}}>Payment Snapshot</div>
                <div style={{fontWeight:900,fontSize:32,letterSpacing:'-.8px',marginBottom:6}}>₹{grand.toFixed(2)}</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,.7)',lineHeight:1.6}}>All charges shown up front: delivery, platform, GST, surge, discounts, and final payable total.</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginTop:16}}>
                  <div style={{padding:'12px 10px',borderRadius:16,background:'rgba(255,255,255,.08)'}}>
                    <div style={{fontSize:10,color:'rgba(255,255,255,.52)',textTransform:'uppercase'}}>Items</div>
                    <div style={{fontWeight:800,fontSize:13,marginTop:4}}>{cart.length}</div>
                  </div>
                  <div style={{padding:'12px 10px',borderRadius:16,background:'rgba(255,255,255,.08)'}}>
                    <div style={{fontSize:10,color:'rgba(255,255,255,.52)',textTransform:'uppercase'}}>ETA</div>
                    <div style={{fontWeight:800,fontSize:13,marginTop:4}}>{cart[0]?.deliveryTime||'60'} min</div>
                  </div>
                  <div style={{padding:'12px 10px',borderRadius:16,background:'rgba(255,255,255,.08)'}}>
                    <div style={{fontSize:10,color:'rgba(255,255,255,.52)',textTransform:'uppercase'}}>Pay mode</div>
                    <div style={{fontWeight:800,fontSize:13,marginTop:4}}>{payment==='cod'?'COD':payment==='upi'?'UPI':'CARD'}</div>
                  </div>
                </div>
              </div>

              <div style={{padding:'18px',borderRadius:20,background:'#fff',border:'1px solid #e2e8f0',boxShadow:'0 10px 30px rgba(15,23,42,.06)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{fontWeight:900,fontSize:16,color:'#0f172a'}}>Charge Breakdown</div>
                  <span style={{padding:'6px 10px',borderRadius:999,background:freeDeliveryDiscount?'#ecfdf5':'#fff7ed',color:freeDeliveryDiscount?'#15803d':'#c2410c',fontSize:11,fontWeight:800}}>{freeDeliveryDiscount?'Free delivery active':'Standard delivery'}</span>
                </div>
                <div style={{display:'grid',gap:10}}>
                  {priceRows.map(row=>(
                    <div key={row.k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:13,paddingBottom:10,borderBottom:'1px solid #eef2f7'}}>
                      <span style={{color:'#64748b'}}>{row.k}</span>
                      <span style={{fontWeight:800,color:row.accent?'#16a34a':'#0f172a'}}>{row.v}</span>
                    </div>
                  ))}
                  {promoDiscount>0&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:13,paddingBottom:10,borderBottom:'1px solid #eef2f7'}}><span style={{color:'#16a34a'}}>Promo discount</span><span style={{fontWeight:800,color:'#16a34a'}}>-₹{promoDiscount.toFixed(2)}</span></div>}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:19,fontWeight:900,paddingTop:6}}>
                    <span>Total payable</span>
                    <span style={{color:'#f97316'}}>₹{grand.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{padding:'18px',borderRadius:20,background:'#fff',border:'1px solid #e2e8f0',boxShadow:'0 10px 30px rgba(15,23,42,.06)'}}>
                <div style={{fontWeight:900,fontSize:16,color:'#0f172a',marginBottom:12}}>Delivery and Return Status</div>
                <div style={{display:'grid',gap:10}}>
                  {[{title:'Vendor acceptance',value:step>1?'Pending / auto after order':'Waiting for order'},{title:'Rider assignment',value:step>2?'Will start after confirmation':'Pending'},{title:'Return handling',value:'Vendor fault: free return · Customer reason: return fee applies'},{title:'Delivery address',value:finalAddr||'Add address to continue'},{title:'Payment mode',value:paymentLabel}].map(card=>(
                    <div key={card.title} style={{padding:'12px 14px',borderRadius:16,background:'#f8fafc',border:'1px solid #e2e8f0'}}>
                      <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.55px',color:'#94a3b8',marginBottom:5}}>{card.title}</div>
                      <div style={{fontSize:13,fontWeight:700,color:'#0f172a',lineHeight:1.5}}>{card.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{padding:'18px',borderRadius:20,background:'#fff',border:'1px solid #e2e8f0',boxShadow:'0 10px 30px rgba(15,23,42,.06)'}}>
                <div style={{fontWeight:900,fontSize:16,color:'#0f172a',marginBottom:12}}>Items in this order</div>
                <div style={{display:'grid',gap:10}}>
                  {cart.map((item,i)=>(
                    <div key={`${item.id}-${i}`} style={{display:'flex',alignItems:'center',gap:12,padding:'12px',borderRadius:16,background:'#f8fafc',border:'1px solid #e2e8f0'}}>
                      {item.imageUrl?<img src={item.imageUrl} alt={item.name} style={{width:58,height:58,borderRadius:14,objectFit:'cover',border:'1px solid #e2e8f0'}}/>:<div style={{width:58,height:58,borderRadius:14,background:'#e2e8f0'}}/>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:800,fontSize:13,color:'#0f172a'}}>{item.name}</div>
                        <div style={{fontSize:11,color:'#64748b',marginTop:4}}>{item.selectedSize?`Size ${item.selectedSize} · `:''}Qty {item.qty}</div>
                      </div>
                      <div style={{fontWeight:900,fontSize:14,color:'#0f172a'}}>₹{(item.price*item.qty).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map Panel - slides over body */}
        {showMap&&(
          <div style={{position:'absolute',inset:0,background:'#fff',zIndex:20,display:'flex',flexDirection:'column',borderRadius:24,overflow:'hidden',animation:'scaleIn .25s ease'}}>
            <div style={{background:'linear-gradient(135deg,#0f172a,#1e293b)',padding:'16px 20px',color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <div style={{fontWeight:800,fontSize:16}}>Pin Your Location</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:1}}>Drag the map or tap to set delivery point</div>
              </div>
              <button onClick={()=>setShowMap(false)} style={{width:34,height:34,borderRadius:'50%',background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.15)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Ic.X width={15} height={15}/></button>
            </div>
            <div style={{flex:1,position:'relative'}}>
              <MapPicker lat={dLat||17.385} lng={dLng||78.4867} onPinMove={(la,ln)=>{setDLat(la);setDLng(ln)}} height={'100%'}/>
            </div>
            <div style={{padding:'16px',background:'#fff',display:'flex',gap:10,borderTop:'1px solid #e2e8f0'}}>
              <button onClick={()=>setShowMap(false)} style={{flex:1,padding:'12px',borderRadius:12,border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',fontWeight:700,fontSize:14,color:'#475569',transition:'.2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#f97316'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}>Cancel</button>
              <button onClick={()=>{setManualAddr(`Pinned location (${dLat?.toFixed(4)}°N, ${dLng?.toFixed(4)}°E)`);setLocMode('manual');setShowMap(false);showToast('Location pinned ✓','success')}}
                style={{flex:2,padding:'12px',background:'linear-gradient(135deg,#f97316,#ea580c)',color:'#fff',border:'none',borderRadius:12,cursor:'pointer',fontWeight:800,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <Ic.Check width={16} height={16}/> Confirm Location
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ─── Cart Drawer ──────────────────────────────────────────────────────────────
function CartDrawer({cart,onUpdate,onClose,user,onCheckout,minOrderShop}){
  const sub=cart.reduce((s,i)=>s+i.price*i.qty,0)
  const count=cart.reduce((s,i)=>s+i.qty,0)
  const fee=29
  const estimatedGst=Math.round(fee*0.05)
  const total=sub+fee+PLATFORM_FEE+estimatedGst

  const upd=(id,delta)=>onUpdate(prev=>{
    const idx=prev.findIndex(i=>i.id===id)
    if(idx<0)return prev
    const u=[...prev]
    u[idx]={...u[idx],qty:u[idx].qty+delta}
    if(u[idx].qty<=0)u.splice(idx,1)
    return u
  })

  return(
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:500,animation:'fadeIn .2s ease',backdropFilter:'blur(4px)'}}/>
      <div style={{position:'fixed',right:0,top:0,bottom:0,width:'min(420px,100vw)',background:'#fff',zIndex:501,display:'flex',flexDirection:'column',animation:'slideRight .3s cubic-bezier(.22,1,.36,1)',boxShadow:'-8px 0 48px rgba(0,0,0,.15)'}}>

        {/* Header */}
        <div style={{padding:'20px 22px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff'}}>
          <div>
            <div style={{fontWeight:900,fontSize:20,color:'#0f172a',letterSpacing:'-.4px',display:'flex',alignItems:'center',gap:8}}>
              <Ic.Cart width={22} height={22} stroke="#f97316"/> My Cart
            </div>
            <div style={{fontSize:13,color:'#64748b',marginTop:1}}>{count} item{count!==1?'s':''}</div>
          </div>
          <button onClick={onClose} style={{width:38,height:38,borderRadius:'50%',background:'#f1f5f9',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'.2s'}}
            onMouseEnter={e=>e.currentTarget.style.background='#e2e8f0'} onMouseLeave={e=>e.currentTarget.style.background='#f1f5f9'}>
            <Ic.X width={17} height={17} stroke="#475569"/>
          </button>
        </div>

        {/* Items */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 22px'}}>
          {cart.length===0?(
            <div style={{textAlign:'center',padding:'60px 20px',color:'#94a3b8'}}>
              <div style={{width:72,height:72,borderRadius:20,background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                <Ic.Cart width={32} height={32} stroke="#cbd5e1"/>
              </div>
              <div style={{fontWeight:800,fontSize:17,color:'#475569',marginBottom:6}}>Your cart is empty</div>
              <div style={{fontSize:13}}>Add items from the store to get started</div>
            </div>
          ):cart.map((item,i)=>(
            <div key={item.id} style={{display:'flex',gap:14,padding:'14px 0',borderBottom:i<cart.length-1?'1px solid #f8fafc':'none',animation:'fadeUp .3s ease',animationDelay:`${i*0.04}s`}}>
              {item.imageUrl?
                <img src={item.imageUrl} alt={item.name} style={{width:76,height:76,borderRadius:14,objectFit:'cover',border:'1px solid #f1f5f9',flexShrink:0}}/>:
                <div style={{width:76,height:76,borderRadius:14,background:'#f8fafc',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid #f1f5f9'}}><Ic.Shop width={28} height={28} stroke="#e2e8f0"/></div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,lineHeight:1.35,marginBottom:3,color:'#0f172a',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{item.name}</div>
                {item.selectedSize&&<div style={{fontSize:11,color:'#64748b',marginBottom:4}}>Size: {item.selectedSize}</div>}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:6}}>
                  <div style={{fontWeight:900,fontSize:16,color:'#f97316'}}>₹{item.price*item.qty}</div>
                  <div style={{display:'flex',alignItems:'center',gap:0,border:'1.5px solid #f97316',borderRadius:10,overflow:'hidden'}}>
                    <button onClick={()=>upd(item.id,-1)} style={{width:32,height:32,background:'#fff7ed',border:'none',cursor:'pointer',fontSize:17,fontWeight:800,color:'#f97316',display:'flex',alignItems:'center',justifyContent:'center',transition:'.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#fed7aa'} onMouseLeave={e=>e.currentTarget.style.background='#fff7ed'}>
                      <Ic.Minus width={14} height={14} stroke="#f97316"/>
                    </button>
                    <span style={{width:32,textAlign:'center',fontWeight:800,fontSize:14,color:'#f97316'}}>{item.qty}</span>
                    <button onClick={()=>upd(item.id,1)} style={{width:32,height:32,background:'#fff7ed',border:'none',cursor:'pointer',fontSize:17,fontWeight:800,color:'#f97316',display:'flex',alignItems:'center',justifyContent:'center',transition:'.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#fed7aa'} onMouseLeave={e=>e.currentTarget.style.background='#fff7ed'}>
                      <Ic.Plus width={14} height={14} stroke="#f97316"/>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {cart.length>0&&(
          <div style={{padding:'20px 22px',borderTop:'1px solid #f1f5f9',background:'#fafafa'}}>
            <div style={{marginBottom:14}}>
              {[{k:'Subtotal',v:`₹${sub}`},{k:'Delivery',v:`₹${fee}`},{k:'Platform fee',v:`₹${PLATFORM_FEE}`}].map(({k,v})=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:13}}>
                  <span style={{color:'#64748b'}}>{k}</span>
                  <span style={{fontWeight:700}}>{v}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',paddingTop:10,marginTop:6,borderTop:'1.5px dashed #e2e8f0',fontWeight:900,fontSize:19}}>
                <span>Total</span>
                <span style={{color:'#f97316'}}>₹{total}</span>
              </div>
            </div>
            <button onClick={()=>{onClose();onCheckout()}} style={{width:'100%',padding:'15px',background:'linear-gradient(135deg,#f97316,#ea580c)',color:'#fff',border:'none',borderRadius:14,fontWeight:900,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:'0 6px 22px rgba(249,115,22,.35)',transition:'all .2s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 10px 32px rgba(249,115,22,.45)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 6px 22px rgba(249,115,22,.35)'}}>
              <Ic.Check width={18} height={18}/> Proceed to Checkout
            </button>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:10,fontSize:11,color:'#94a3b8',fontWeight:600}}>
              <Ic.Shield width={12} height={12} stroke="#94a3b8"/> Secure checkout · Free returns on fashion
            </div>
          </div>
        )}
      </div>
    </>
  )
}


function ProductDetail({product:init,shop:shopProp,cart,onCartUpdate,onBack,user,wishlisted,onWishlist,onBuyNow,onProductClick,userLoc,radius}){
  const[product]=useState(init)
  const[shop,setShop]=useState(shopProp||null)
  const[reviews,setReviews]=useState([])
  const[tab,setTab]=useState('details')
  const[rating,setRating]=useState(0)
  const[hover,setHover]=useState(0)
  const[comment,setComment]=useState('')
  const[submitting,setSubmitting]=useState(false)
  const[eligibleOrders,setEligibleOrders]=useState([])
  const[relatedProducts,setRelatedProducts]=useState([])
  const[selSize,setSelSize]=useState(null)
  const colors=Array.isArray(product.colors)?product.colors:[]
  const extraImgs=Array.isArray(product.images)?product.images:[]
  const[selColorIdx,setSelColorIdx]=useState(colors.length>0?0:null)
  const[activeImg,setActiveImg]=useState(product.imageUrl||null)
  const allThumbs=[product.imageUrl,...extraImgs,...colors.filter(c=>c.imageUrl).map(c=>c.imageUrl)].filter((u,i,a)=>u&&a.indexOf(u)===i)

  useEffect(()=>{
    if(selColorIdx!==null&&colors[selColorIdx]?.imageUrl) setActiveImg(colors[selColorIdx].imageUrl)
    else setActiveImg(product.imageUrl||null)
  },[selColorIdx])

  useEffect(()=>{
    api.getProductReviews(product.id).then(r=>setReviews(r.data)).catch(()=>{})
    if(user) api.myOrders().then(r=>setEligibleOrders(r.data.filter(o=>o.status==='DELIVERED'&&!o.isReviewed&&o.shop?.id===product.shopId))).catch(()=>{})
    // Load shop if not passed as prop
    if(!shopProp&&product.shopId){
      api.getShops({}).then(r=>{
        const found=r.data.find(s=>s.id===product.shopId)
        if(found)setShop(found)
      }).catch(()=>{})
    }
    api.getProducts({lat:userLoc?.lat,lng:userLoc?.lng,radius}).then(r=>{
      const ranked=(r.data||[])
        .filter(p=>p.id!==product.id)
        .map(p=>({
          ...p,
          _nearScore:
            ((p.category||'').toLowerCase()===(product.category||'').toLowerCase()?6:0)+
            ((p.shopId!==product.shopId)?2:0)+
            fuzzyProductScore(p, product.name||product.category||'')
        }))
        .sort((a,b)=>b._nearScore-a._nearScore)
        .slice(0,8)
      setRelatedProducts(ranked)
    }).catch(()=>{})
  },[product.id])

  const selColor=selColorIdx!==null?colors[selColorIdx]:null
  const cartKey=`${product.id}${selColor?'__'+selColor.name:''}${selSize?'__'+selSize:''}`
  const qty=cart.find(i=>i._key===cartKey)?.qty||cart.find(i=>i.id===product.id)?.qty||0

  const add=()=>{
    if(product.hasSizes&&!selSize){showToast('Pick a size first','error');return}
    // Check different shop
    const cartShopId=cart.length>0?cart[0].shopId:null
    if(cartShopId && product.shopId && cartShopId!==product.shopId){
      showToast('Clear your cart first — different shop','error')
      return
    }
    onCartUpdate(prev=>{
      const idx=prev.findIndex(i=>i._key===cartKey)
      if(idx>=0){const u=[...prev];u[idx]={...u[idx],qty:u[idx].qty+1};return u}
      return[...prev,{...product,_key:cartKey,selectedSize:selSize,selectedColor:selColor?.name,selectedColorHex:selColor?.hex,imageUrl:activeImg||product.imageUrl,qty:1}]
    })
    showToast(`Added${selSize?` (${selSize})`:''}${selColor?` · ${selColor.name}`:''} ✓`,'success')
  }
  const rem=()=>{
    onCartUpdate(prev=>{
      const idx=prev.findIndex(i=>i._key===cartKey)
      if(idx<0)return prev
      const u=[...prev];u[idx]={...u[idx],qty:u[idx].qty-1}
      if(u[idx].qty<=0)u.splice(idx,1)
      return u
    })
  }

  const buyNow=()=>{
    if(product.hasSizes&&!selSize){showToast('Pick a size first','error');return}
    const immediateItem={...product,_key:cartKey,selectedSize:selSize,selectedColor:selColor?.name,selectedColorHex:selColor?.hex,imageUrl:activeImg||product.imageUrl,qty:1}
    onBuyNow&&onBuyNow(immediateItem)
  }

  const submitReview=async()=>{
    if(!rating){showToast('Select a rating','error');return}
    if(!eligibleOrders.length){showToast('No eligible order','error');return}
    setSubmitting(true)
    try{
      await api.addReview({productId:product.id,orderId:eligibleOrders[0].id,rating,comment})
      showToast('Review submitted ✓','success');setRating(0);setComment('')
      const r=await api.getProductReviews(product.id);setReviews(r.data)
    }catch(e){showToast(e.response?.data?.detail||'Failed','error')}
    setSubmitting(false)
  }

  const disc=product.mrp&&product.mrp>product.price?Math.round((1-product.price/product.mrp)*100):null

  return(
    <div className="pd-page">
      {/* Zoom lightbox */}
      {activeImg&&(
        <div id="zoom-overlay" className="hidden" onClick={()=>document.getElementById('zoom-overlay')?.classList.add('hidden')}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.92)',zIndex:900,display:'none',alignItems:'center',justifyContent:'center',padding:20,cursor:'zoom-out'}}>
          <img src={activeImg} alt={product.name} style={{maxWidth:'95vw',maxHeight:'90vh',objectFit:'contain',borderRadius:'var(--r12)'}}/>
          <button style={{position:'absolute',top:20,right:20,background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',borderRadius:8,padding:'7px 16px',cursor:'pointer',fontSize:14,fontWeight:700}}>✕ Close</button>
        </div>
      )}

      {/* Back nav */}
      <div style={{background:'rgba(255,255,255,.95)',backdropFilter:'blur(12px)',borderBottom:'1px solid var(--br)',padding:'10px 0',position:'sticky',top:62,zIndex:100}}>
        <div className="wrap">
          <button className="back-btn" style={{marginBottom:0}} onClick={onBack}>Back</button>
        </div>
      </div>

      <div className="wrap" style={{paddingTop:20,paddingBottom:100}}>
        <div className="pd-grid">
          {/* ── IMAGE COLUMN ── */}
          <div className="pd-imgs-col">
            {/* Main image */}
            <div style={{position:'relative',borderRadius:'var(--r16)',overflow:'hidden',border:'1px solid var(--br)',background:'#f8fafc',cursor:'zoom-in',boxShadow:'0 4px 24px rgba(0,0,0,.08)'}}
              onClick={()=>{const o=document.getElementById('zoom-overlay');if(o){o.style.display='flex';}}}>
              {activeImg
                ?<img src={activeImg} alt={product.name} className="pd-main-img" key={activeImg}
                    style={{transition:'transform .4s ease'}}
                    onMouseEnter={e=>e.target.style.transform='scale(1.04)'}
                    onMouseLeave={e=>e.target.style.transform='scale(1)'}/>
                :<div className="pd-main-img" style={{background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:72}}><svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='#cbd5e1' strokeWidth='1.5' strokeLinecap='round'><path d='M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z'/><line x1='3' y1='6' x2='21' y2='6'/><path d='M16 10a4 4 0 01-8 0'/></svg></div>}
              {/* Colour badge */}
              {selColor&&(
                <div style={{position:'absolute',bottom:12,left:12,display:'flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.6)',backdropFilter:'blur(8px)',borderRadius:100,padding:'5px 12px'}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:selColor.hex,border:'1.5px solid rgba(255,255,255,.5)'}}/>
                  <span style={{color:'#fff',fontSize:12,fontWeight:700}}>{selColor.name}</span>
                </div>
              )}
              {/* Zoom badge */}
              <div style={{position:'absolute',bottom:12,right:12,background:'rgba(0,0,0,.5)',color:'#fff',borderRadius:8,padding:'4px 10px',fontSize:11,fontWeight:700,backdropFilter:'blur(4px)'}}> Zoom</div>
              {/* Wish button */}
              {onWishlist&&(
                <button className={`pd-wish-btn${wishlisted?' on':''}`} onClick={e=>{e.stopPropagation();onWishlist(product.id)}}
                  style={{position:'absolute',top:12,right:12}}>
                  {wishlisted ? <svg width='16' height='16' viewBox='0 0 24 24' fill='#ef4444' stroke='#ef4444' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/></svg> : <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/></svg>}
                </button>
              )}
              {/* Discount badge */}
              {disc>0&&<span style={{position:'absolute',top:12,left:12,background:'#ef4444',color:'#fff',fontSize:11,fontWeight:800,padding:'3px 10px',borderRadius:100}}>{disc}% OFF</span>}
            </div>

            {/* Thumbnails */}
            {allThumbs.length>1&&(
              <div className="pd-thumbs" style={{marginTop:10}}>
                {allThumbs.map((img,i)=>(
                  <img key={i} src={img} alt="" className={`pd-thumb${activeImg===img?' on':''}`}
                    onClick={()=>setActiveImg(img)} onError={e=>e.target.style.display='none'}/>
                ))}
              </div>
            )}

            {/* Colour circles on desktop */}
            {colors.length>0&&(
              <div className="pd-section-box" style={{marginTop:12}}>
                <div className="pd-lbl" style={{marginBottom:10}}>Colour · <span style={{color:'var(--or)',textTransform:'none',fontWeight:800}}>{selColor?.name||'Select'}</span></div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {colors.map((col,i)=>{
                    const on=selColorIdx===i
                    return(
                      <div key={i} onClick={()=>setSelColorIdx(i)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer'}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:col.hex,
                          border:`3.5px solid ${on?'var(--or)':'transparent'}`,
                          boxShadow:on?`0 0 0 2px var(--or),0 0 0 4px #fff`:`0 0 0 1.5px rgba(0,0,0,.12)`,
                          transition:'all .2s',transform:on?'scale(1.18)':'scale(1)',
                          outline:col.hex==='#ffffff'?'1px solid var(--br)':'none'}}/>
                        <span style={{fontSize:9,fontWeight:on?800:600,color:on?'var(--or)':'var(--mu)',maxWidth:40,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'center'}}>{col.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── INFO COLUMN ── */}
          <div className="pd-info-col">
            {/* Brand + title */}
            <div className="pd-section-box">
              {/* Shop info */}
              {shop&&(
                <div className="pd-shop-card">
                  {shop.imageUrl
                    ?<img src={shop.imageUrl} alt={shop.name} style={{width:40,height:40,borderRadius:10,objectFit:'cover',border:'1px solid var(--br)',flexShrink:0}}/>
                    :<div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,var(--nv),var(--nv2))',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Ic.Shop width={20} height={20} stroke="rgba(255,255,255,.7)"/></div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:13,display:'flex',alignItems:'center',gap:6}}>{shop.name}{shop.isVerified&&<VeriBadge/>}</div>
                    <div style={{fontSize:11,color:'var(--mu)',marginTop:1}}><span style={{display:'inline-flex',alignItems:'center',gap:2}}><Ic.Star width={11} height={11}/>{shop.rating?.toFixed(1)||'New'}</span> · <span style={{display:'inline-flex',alignItems:'center',gap:2}}><Ic.Clock width={11} height={11}/>{shop.deliveryTime}min</span> · {shop.city||'Hyderabad'}</div>
                  </div>
                  <span style={{color:'var(--mu)',fontSize:14}}>›</span>
                </div>
              )}

              <div className="pd-name" style={{fontSize:26,fontWeight:900,lineHeight:1.25,marginBottom:10}}>{product.name}</div>

              {/* Rating row */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <Stars r={product.avgRating||0} n={product.reviewCount||0}/>
                {product.avgRating>0&&<span className="rpill"> {product.avgRating?.toFixed(1)}</span>}
                {reviews.length>0&&<span style={{fontSize:12,color:'var(--mu)'}}>({reviews.length} reviews)</span>}
              </div>

              {/* Price */}
              <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:14}}>
                <span style={{fontSize:32,fontWeight:900,letterSpacing:'-1px'}}>₹{product.price}</span>
                {product.mrp&&product.mrp>product.price&&<span style={{fontSize:16,color:'var(--mu)',textDecoration:'line-through'}}>₹{product.mrp}</span>}
                {disc>0&&<span style={{background:'#f0fdf4',color:'var(--gn)',fontSize:13,fontWeight:800,padding:'3px 10px',borderRadius:'var(--r4)'}}>{disc}% off</span>}
              </div>

              {/* Trust chips */}
              <div className="pd-trust-row">
                {[{icon:'✓',label:'Genuine product'},{icon:'→',label:'Fast delivery'},shop?.acceptsReturns&&{icon:'↩',label:`${shop.returnDays}-day returns`},{icon:'✓',label:'Secure checkout'}].filter(Boolean).map(({icon,label})=>(
                  <span key={label} className="pd-trust-chip" style={{fontWeight:800,fontSize:10,letterSpacing:'.3px',textTransform:'uppercase',color:'var(--tx)',borderColor:'var(--br)',background:'#f8fafc'}}>{label}</span>
                ))}
              </div>
            </div>

            {/* Colour selection (info column version) */}
            {colors.length>0&&(
              <div className="pd-section-box">
                <div className="pd-lbl">Colour: <span style={{color:selColor?'var(--tx)':'var(--or)',textTransform:'none',fontWeight:800}}>{selColor?.name||'Select a colour'}</span></div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
                  {colors.map((col,i)=>{
                    const on=selColorIdx===i
                    return(
                      <div key={i} className={`pd-cpill${on?' on':''}`} onClick={()=>setSelColorIdx(i)}>
                        <div className="pd-cdot" style={{background:col.hex,outline:col.hex==='#ffffff'?'1px solid var(--br)':'none'}}/>
                        {col.name}{on&&<span style={{fontSize:11,color:'var(--or)'}}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Size selection */}
            {product.hasSizes&&product.sizes?.length>0&&(
              <div className="pd-section-box">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div className="pd-lbl">Size {!selSize&&<span style={{color:'var(--or)',textTransform:'none',fontWeight:700}}>— select one</span>}</div>
                  <span style={{fontSize:11,color:'var(--or)',fontWeight:700,cursor:'pointer'}}>Size guide →</span>
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {product.sizes.map(s=>{
                    const oos=s.stock<=0;const on=selSize===s.size
                    return(
                      <div key={s.size} className={`pd-size${on?' on':''}${oos?' oos':''}`}
                        onClick={()=>!oos&&setSelSize(s.size)}>
                        <span style={{fontWeight:800}}>{s.size}</span>
                        <span style={{fontSize:9,color:oos?'var(--rd)':'var(--mu)',marginTop:2}}>{oos?'Out':s.stock+'left'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add to cart */}
            <div className="pd-section-box">
              {qty>0?(
                <div style={{display:'flex',alignItems:'center',gap:14,background:'var(--orl)',borderRadius:'var(--r12)',padding:'12px 16px',border:'1.5px solid var(--orm)'}}>
                  <button onClick={rem} style={{width:40,height:40,borderRadius:10,border:'2px solid var(--or)',background:'#fff',color:'var(--or)',fontSize:22,cursor:'pointer',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                  <span style={{fontWeight:900,fontSize:22,flex:1,textAlign:'center'}}>{qty}</span>
                  <button onClick={add} style={{width:40,height:40,borderRadius:10,border:'2px solid var(--or)',background:'#fff',color:'var(--or)',fontSize:22,cursor:'pointer',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                  <span style={{fontSize:14,color:'var(--mu)',fontWeight:600}}>₹{product.price*qty}</span>
                </div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10}}>
                  <button className="pd-add-btn" onClick={add} disabled={!product.isActive||(product.hasSizes&&!selSize)}
                    style={{flex:1,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    {!product.isActive?'Out of Stock':product.hasSizes&&!selSize?'Select Size First':'Add to Cart'}
                  </button>
                  <button onClick={buyNow} disabled={!product.isActive||(product.hasSizes&&!selSize)} style={{minHeight:52,border:'none',borderRadius:999,background:'linear-gradient(135deg,#131921,#314761)',color:'#fff',fontWeight:900,cursor:'pointer',padding:'0 22px',fontSize:15,boxShadow:'0 10px 24px rgba(19,25,33,.2)'}}>
                    Buy Now
                  </button>
                  {onWishlist&&(
                    <button className={`pd-wish-btn${wishlisted?' on':''}`} onClick={()=>onWishlist(product.id)} style={{width:52,height:52}}>
                      {wishlisted ? <svg width='16' height='16' viewBox='0 0 24 24' fill='#ef4444' stroke='#ef4444' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/></svg> : <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/></svg>}
                    </button>
                  )}
                </div>
              )}

              {/* Delivery info */}
              {shop&&(
                <div style={{display:'flex',gap:14,marginTop:14,paddingTop:14,borderTop:'1px solid var(--br2)'}}>
                  {[['Shop',shop.name],['ETA',`${shop.deliveryTime} min`],['Area',shop.address?.split(',')[0]||'Hyderabad']].map(([icon,text])=>(
                    <div key={icon} style={{flex:1,textAlign:'center'}}>
                      <div style={{fontSize:9,fontWeight:800,color:'var(--or)',letterSpacing:'.3px',marginBottom:3}}>{icon}</div>
                      <div style={{fontSize:10,color:'var(--mu)',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{text}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{marginTop:14,padding:'16px',borderRadius:16,background:'linear-gradient(135deg,#fff,#f8fafc)',border:'1px solid var(--br)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:10}}>
                  <div style={{fontWeight:900,fontSize:14,color:'var(--tx)'}}>Easy Return Policy</div>
                  {product.price>=300 && <span style={{padding:'6px 10px',borderRadius:999,background:'#ecfdf5',color:'#15803d',fontSize:11,fontWeight:800,border:'1px solid #bbf7d0'}}>Easy Return</span>}
                </div>
                <div style={{display:'grid',gap:8,fontSize:12,color:'var(--mu)',lineHeight:1.6}}>
                  <div>Free return for vendor faults like wrong product, damaged item, or wrong size delivered.</div>
                  <div>Unused, unwashed items with tags intact can be returned within {shop?.returnDays?`${shop.returnDays} day${shop.returnDays>1?'s':''}`:'24-48 hours'} of delivery.</div>
                  <div>Customer-choice refunds may deduct a return fee of `max(₹40, 1.5 x delivery fee)`.</div>
                  <div>Items below ₹300, washed products, removed tags, or late requests are not eligible.</div>
                  {user?.isPremium && <div style={{color:'var(--or)',fontWeight:700}}>Premium perk: Try & Return is available on eligible fashion orders.</div>}
                </div>
              </div>
            </div>

            {/* Share product */}
            <button onClick={()=>{
              const url=`${window.location.origin}?product=${product.id}`
              if(navigator.share)navigator.share({title:product.name,text:product.description||product.name,url})
              else{navigator.clipboard?.writeText(url);showToast('Product link copied ✓','success')}
            }} style={{width:'100%',padding:'10px',border:'1.5px solid var(--br)',borderRadius:'var(--r12)',background:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,color:'var(--mu)',transition:'.15s',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--or)';e.currentTarget.style.color='var(--or)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--br)';e.currentTarget.style.color='var(--mu)'}}>
               Share Product
            </button>

            {relatedProducts.length>0&&(
              <div className="pd-section-box" style={{marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{fontWeight:900,fontSize:15,color:'#0f172a'}}>Nearby Shop Products</div>
                  <span style={{fontSize:11,color:'var(--mu)',fontWeight:700}}>Similar styles from nearby sellers</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {relatedProducts.slice(0,4).map(p=>(
                    <div key={p.id} onClick={()=>onProductClick&&onProductClick(p)} style={{cursor:'pointer',border:'1px solid var(--br)',borderRadius:16,overflow:'hidden',background:'#fff',transition:'.18s'}}>
                      <div style={{aspectRatio:'1 / .92',background:'#f8fafc'}}>
                        {p.imageUrl&&<img src={p.imageUrl} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                      </div>
                      <div style={{padding:10}}>
                        <div style={{fontWeight:800,fontSize:12,color:'#0f172a',lineHeight:1.4}}>{p.name}</div>
                        <div style={{fontSize:11,color:'var(--mu)',marginTop:4}}>{p.shopName||shop?.name}</div>
                        <div style={{fontWeight:900,fontSize:14,color:'var(--or)',marginTop:6}}>₹{p.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs: Details / Reviews / Write Review */}
            <div className="pd-section-box" style={{padding:0,overflow:'hidden'}}>
              <div className="pd-tabs" style={{padding:'0 20px',background:'#f8fafc',borderBottom:'2px solid var(--br)'}}>
                {['details','reviews',user&&eligibleOrders.length>0&&'write'].filter(Boolean).map(t=>(
                  <button key={t} className={`pd-tab${tab===t?' on':''}`} onClick={()=>setTab(t)}>
                    {t==='details'?'Details':t==='reviews'?`Reviews (${reviews.length})`:'Write Review'}
                  </button>
                ))}
              </div>

              <div style={{padding:'18px 20px'}}>
                {tab==='details'&&(
                  <div style={{fontSize:14,lineHeight:1.8,color:'#374151'}}>
                    <p style={{marginBottom:14,color:'var(--mu)',lineHeight:1.7}}>{product.description||'Premium quality product.'}</p>
                    {[{k:'Category',v:product.category},{k:'Brand',v:product.brand||product.shopName||null},{k:'Material',v:product.material},{k:'Stock',v:`${product.stock} units`},{k:'Colors',v:colors.length>0?colors.map(col=>col.name).join(', '):null}]
                      .filter(({v})=>v).map(({k,v})=>(
                      <div key={k} style={{display:'flex',gap:12,padding:'8px 0',borderBottom:'1px solid var(--br2)',fontSize:13}}>
                        <span style={{color:'var(--mu)',minWidth:88,flexShrink:0,fontWeight:600}}>{k}</span>
                        <strong style={{fontWeight:700}}>{v}</strong>
                      </div>
                    ))}
                    {Array.isArray(product.tags)&&product.tags.length>0&&(
                      <div style={{marginTop:12,display:'flex',gap:5,flexWrap:'wrap'}}>
                        {product.tags.map(t=><span key={t} style={{padding:'3px 10px',borderRadius:100,background:'#f1f5f9',fontSize:11,fontWeight:700,color:'var(--mu)'}}>#{t}</span>)}
                      </div>
                    )}
                  </div>
                )}

                {tab==='reviews'&&(
                  <div>
                    {reviews.length>0&&(()=>{
                      const avg=reviews.reduce((s,r)=>s+r.rating,0)/reviews.length
                      const counts=[5,4,3,2,1].map(n=>({n,count:reviews.filter(r=>r.rating===n).length}))
                      return(
                        <div style={{background:'#f8fafc',borderRadius:'var(--r12)',padding:16,marginBottom:18,border:'1px solid var(--br)'}}>
                          <div style={{display:'flex',gap:20,alignItems:'center'}}>
                            <div style={{textAlign:'center',flexShrink:0}}>
                              <div style={{fontWeight:900,fontSize:48,lineHeight:1,color:'var(--or)'}}>{avg.toFixed(1)}</div>
                              <Stars r={avg} n={0}/>
                              <div style={{fontSize:11,color:'var(--mu)',marginTop:3}}>{reviews.length} reviews</div>
                            </div>
                            <div style={{flex:1}}>
                              {counts.map(({n,count})=>(
                                <div key={n} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                                  <span style={{fontSize:11,color:'var(--mu)',minWidth:12,textAlign:'right'}}>{n}</span>
                                  <span style={{fontSize:10,color:'#f59e0b'}}></span>
                                  <div style={{flex:1,height:7,background:'#e2e8f0',borderRadius:4,overflow:'hidden'}}>
                                    <div style={{height:'100%',background:'#f59e0b',borderRadius:4,width:`${reviews.length?count/reviews.length*100:0}%`,transition:'width .6s ease'}}/>
                                  </div>
                                  <span style={{fontSize:11,color:'var(--mu)',minWidth:16}}>{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                    {reviews.length===0
                      ?<div className="empty" style={{padding:'30px 0'}}><span className="empty-icon" style={{fontSize:36}}></span><div className="empty-title">No reviews yet</div></div>
                      :reviews.map(r=>(
                        <div key={r.id} className="rev-row">
                          <div className="rev-avatar" style={{background:`hsl(${(r.customerName?.charCodeAt(0)||65)*137%360},55%,65%)`}}>{r.customerName?.[0]?.toUpperCase()||'U'}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                              <span style={{fontWeight:700,fontSize:14}}>{r.customerName}</span>
                              <span style={{fontSize:11,color:'var(--mu)'}}>{new Date(r.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
                            </div>
                            <Stars r={r.rating} n={0}/>
                            {r.comment&&<div style={{fontSize:13,color:'#374151',lineHeight:1.6,background:'#f8fafc',borderRadius:8,padding:'8px 12px',marginTop:6}}>{r.comment}</div>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {tab==='write'&&(
                  <div>
                    <div style={{background:'#f8fafc',borderRadius:'var(--r12)',padding:16,marginBottom:13,border:'1px solid var(--br)'}}>
                      <div style={{fontWeight:800,fontSize:14,marginBottom:11}}>Rate this product</div>
                      <div style={{display:'flex',gap:5,justifyContent:'center',marginBottom:8}}>
                        {[1,2,3,4,5].map(n=>(
                          <span key={n} style={{fontSize:44,color:(hover||rating)>=n?'#f59e0b':'#e2e8f0',cursor:'pointer',transition:'all .15s',transform:(hover||rating)>=n?'scale(1.2)':'scale(1)',display:'inline-block'}}
                            onMouseEnter={()=>setHover(n)} onMouseLeave={()=>setHover(0)} onClick={()=>setRating(n)}></span>
                        ))}
                      </div>
                      {rating>0&&<div style={{textAlign:'center',fontWeight:800,fontSize:15,color:'var(--or)'}}>{['',' Poor',' Fair',' Good',' Great',' Excellent!'][rating]}</div>}
                    </div>
                    <div style={{marginBottom:11}}>
                      <label className="inp-lbl">Your Review (optional)</label>
                      <textarea className="inp" rows={4} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Quality? Fit? Delivery?" style={{resize:'none'}}/>
                    </div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:13}}>
                      {['True to size','Great quality','Fast delivery','As pictured','Comfortable','Good value'].map(tag=>(
                        <span key={tag} onClick={()=>setComment(prev=>prev?prev+', '+tag:tag)}
                          style={{padding:'4px 11px',borderRadius:100,border:'1.5px solid var(--br)',background:'#f8fafc',fontSize:11,cursor:'pointer',fontWeight:600,color:'var(--mu)',transition:'.15s'}}
                          onMouseEnter={e=>{e.target.style.borderColor='var(--or)';e.target.style.color='var(--or)'}}
                          onMouseLeave={e=>{e.target.style.borderColor='var(--br)';e.target.style.color='var(--mu)'}}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button className="btn btn-or" style={{position:"relative",overflow:"hidden",width:'100%',padding:14,justifyContent:'center',fontSize:15}} onClick={submitReview} disabled={submitting||!rating}>
                      {submitting?'Submitting…':'✓ Submit Review'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky buy bar */}
      <div className="pd-sticky-buy">
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:18}}>₹{product.price}</div>
          {disc>0&&<div style={{fontSize:11,color:'var(--gn)',fontWeight:700}}>{disc}% off</div>}
        </div>
        {qty>0?(
          <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--orl)',borderRadius:10,padding:'8px 14px',border:'1.5px solid var(--orm)'}}>
            <button onClick={rem} style={{width:30,height:30,borderRadius:8,border:'2px solid var(--or)',background:'#fff',color:'var(--or)',fontSize:18,cursor:'pointer',fontWeight:800}}>−</button>
            <span style={{fontWeight:900,fontSize:16,minWidth:20,textAlign:'center'}}>{qty}</span>
            <button onClick={add} style={{width:30,height:30,borderRadius:8,border:'2px solid var(--or)',background:'#fff',color:'var(--or)',fontSize:18,cursor:'pointer',fontWeight:800}}>+</button>
          </div>
        ):(
          <button onClick={add} disabled={!product.isActive||(product.hasSizes&&!selSize)}
            style={{padding:'11px 24px',background:'var(--or)',border:'none',borderRadius:12,color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'var(--fn)',boxShadow:'0 4px 16px rgba(249,115,22,.4)'}}>
            {product.hasSizes&&!selSize?'Pick Size':'Add to Cart'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Shop Detail ──────────────────────────────────────────────────────────────
function ShopDetail({shop:initShop,cart,onCartUpdate,onBack,user,onProductClick,wishlistIds,onWishlist}){
  const[shop]=useState(initShop)
  const[products,setProducts]=useState([])
  const[loading,setLoading]=useState(true)
  const[cat,setCat]=useState('All')

  useEffect(()=>{
    api.getProducts({shopId:initShop.id}).then(r=>setProducts(r.data)).catch(()=>{}).finally(()=>setLoading(false))
  },[initShop.id])

  const cats=['All',...new Set(products.map(p=>p.category).filter(Boolean))]
  const filtered=cat==='All'?products:products.filter(p=>p.category===cat)

  return(
    <div style={{paddingBottom:48}}>
      <div style={{position:'relative',height:230,overflow:'hidden'}}>
        {shop.imageUrl
          ?<img src={shop.imageUrl} alt={shop.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          :<div style={{height:'100%',background:'linear-gradient(135deg,var(--nv),var(--nv2))'}}/>}
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,.15))'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'18px'}}>
          <div style={{maxWidth:1400,margin:'0 auto'}}>
            <button className="back-btn" onClick={onBack} style={{color:'#fff',borderColor:'rgba(255,255,255,.3)',background:'rgba(0,0,0,.3)',marginBottom:9}}>← Back</button>
            <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:14}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:5}}>
                  <h1 style={{color:'#fff',fontSize:24,fontWeight:900}}>{shop.name}</h1>
                  {shop.isVerified&&<VeriBadge/>}
                  <span style={{padding:'3px 9px',borderRadius:100,background:shop.isOpen?'#22c55e':'#ef4444',color:'#fff',fontSize:11,fontWeight:700}}>● {shop.isOpen?'Open':'Closed'}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10,color:'rgba(255,255,255,.8)',fontSize:13}}>
                  <Stars r={shop.rating||0} n={shop.ratingCount||0}/>
                  <span>· ⏱ {shop.deliveryTime}m</span>
                  <span>· {shop.category}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="wrap" style={{paddingTop:18}}>
        {cats.length>2&&(
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:18}}>
            {cats.map(c=>(
              <span key={c} className={`fpill${cat===c?' on':''}`} onClick={()=>setCat(c)}>{c}</span>
            ))}
          </div>
        )}
        {loading
          ?<div className="pgrid">{[1,2,3,4,5,6].map(i=><SkeletonCard key={i}/>)}</div>
          :filtered.length===0
            ?<div className="empty"><div style={{width:56,height:56,borderRadius:14,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div className="empty-title">No products here</div></div>
            :<div className="pgrid">
               {filtered.map((p,i)=>(
                 <ProdCard key={p.id} p={{...p,shopName:shop.name}} cart={cart} onCartUpdate={onCartUpdate}
                   onClick={onProductClick} wishlisted={wishlistIds?.includes(p.id)} onWishlist={onWishlist} delay={i*0.03}/>
               ))}
             </div>}
      </div>
    </div>
  )
}

// ─── Orders Page ──────────────────────────────────────────────────────────────


function DeliveryCountdown({ placedAt, deadline, serverNow, deliveredTime, isDelayed }){
  const resolveEnd = () => deadline ? new Date(deadline).getTime() : new Date(placedAt).getTime() + 60*60*1000
  const serverOffset = useRef(serverNow ? (new Date(serverNow).getTime() - Date.now()) : 0)
  const endTime = useRef(resolveEnd())
  const [secs, setSecs] = useState(Math.max(0, Math.floor((endTime.current - (Date.now() + serverOffset.current)) / 1000)))
  useEffect(()=>{
    const t = setInterval(()=>{
      const left = Math.max(0, Math.floor((endTime.current - (Date.now() + serverOffset.current)) / 1000))
      setSecs(left)
    }, 1000)
    return ()=>clearInterval(t)
  },[])
  const mins = Math.floor(secs/60)
  const s = secs % 60
  const pct = secs/3600
  const C = 125.6
  const urgent = secs < 600
  if(deliveredTime) return(
    <div style={{padding:'12px 16px',background:isDelayed?'#fff7ed':'#f0fdf4',borderRadius:12,border:`1px solid ${isDelayed?'rgba(234,88,12,.18)':'rgba(34,197,94,.18)'}`,display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
      <Ic.Clock width={16} height={16} stroke={isDelayed?'#ea580c':'#16a34a'}/>
      <span style={{fontSize:13,fontWeight:800,color:isDelayed?'#c2410c':'#15803d'}}>{isDelayed?'Delivered late':'Delivered on time'}</span>
    </div>
  )
  if(secs<=0) return(
    <div style={{padding:'12px 16px',background:'#fef2f2',borderRadius:12,border:'1px solid rgba(220,38,38,.2)',display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
      <Ic.Clock width={16} height={16} stroke="#dc2626"/>
      <span style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>60-minute window has passed</span>
    </div>
  )
  return(
    <div style={{padding:'12px 16px',background:'linear-gradient(135deg,#0f172a,#1e293b)',borderRadius:14,border:`1px solid ${urgent?'rgba(239,68,68,.3)':'rgba(249,115,22,.25)'}`,display:'flex',alignItems:'center',gap:14,marginBottom:12,boxShadow:'0 4px 16px rgba(0,0,0,.15)'}}>
      {/* SVG ring */}
      <div style={{position:'relative',width:54,height:54,flexShrink:0}}>
        <svg width="54" height="54" viewBox="0 0 54 54" style={{transform:'rotate(-90deg)'}}>
          <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="4"/>
          <circle cx="27" cy="27" r="22" fill="none" stroke={urgent?'#ef4444':'#f97316'} strokeWidth="4"
            strokeLinecap="round" strokeDasharray={`${C*pct} ${C*(1-pct)}`}
            style={{transition:'stroke-dasharray .5s ease',filter:urgent?'drop-shadow(0 0 4px rgba(239,68,68,.6))':'none'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:'#fff',fontFamily:'monospace'}}>{mins}</div>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:24,fontWeight:900,color:urgent?'#ef4444':'#f97316',fontFamily:'monospace',lineHeight:1,letterSpacing:'-1px',animation:urgent?'pulse 1s ease infinite':'none'}}>
          {String(mins).padStart(2,'0')}:{String(s).padStart(2,'0')}
        </div>
        <div style={{fontSize:11,color:'rgba(255,255,255,.5)',marginTop:2,fontWeight:600}}>{urgent?'⚡ Delivery time running low!':'minutes until 60-min delivery'}</div>
      </div>
      <div style={{textAlign:'center',flexShrink:0}}>
        <div style={{padding:'4px 10px',borderRadius:8,background:urgent?'rgba(239,68,68,.15)':'rgba(249,115,22,.15)',border:`1px solid ${urgent?'rgba(239,68,68,.25)':'rgba(249,115,22,.25)'}`,fontSize:10,fontWeight:800,color:urgent?'#fca5a5':'#fed7aa',letterSpacing:'.3px'}}>
          {urgent?'URGENT':'60-MIN'}
        </div>
        <div style={{fontSize:9,color:'rgba(255,255,255,.3)',marginTop:3,fontWeight:600}}>GUARANTEE</div>
      </div>
    </div>
  )
}


function RateRiderSection({orderId, onRated}){
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const submit = async () => {
    if(!rating) return
    setSubmitting(true)
    try { await api.rateRider(orderId, rating); setDone(true); onRated&&onRated(); showToast('Thank you for your rating!', 'success') }
    catch(e) { showToast('Rating failed', 'error') }
    setSubmitting(false)
  }
  if(done) return <div style={{marginTop:12,padding:'12px 16px',background:'#f0fdf4',borderRadius:12,fontSize:13,fontWeight:700,color:'#16a34a',textAlign:'center'}}>⭐ Thank you for rating your rider!</div>
  return(
    <div style={{marginTop:12,padding:'16px',background:'#fffbeb',borderRadius:14,border:'1px solid rgba(245,158,11,.2)'}}>
      <div style={{fontWeight:800,fontSize:13,marginBottom:10,color:'#92400e',display:'flex',alignItems:'center',gap:6}}>
        <Ic.Star width={14} height={14}/> Rate your delivery rider
      </div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        {[1,2,3,4,5].map(s=>(
          <button key={s} onClick={()=>setRating(s)} style={{fontSize:26,background:'none',border:'none',cursor:'pointer',transition:'.15s',transform:s<=rating?'scale(1.15)':'scale(1)',filter:s<=rating?'none':'grayscale(1)'}}>⭐</button>
        ))}
      </div>
      <button onClick={submit} disabled={!rating||submitting} style={{padding:'9px 20px',background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'#fff',border:'none',borderRadius:10,fontWeight:800,fontSize:13,cursor:rating?'pointer':'not-allowed',opacity:rating?.8:1}}>
        {submitting?'Submitting…':'Submit Rating'}
      </button>
    </div>
  )
}


function OrdersPage({user,onTrack,onBuyAgain}){
  const[orders,setOrders]=useState([])
  const[loading,setLoading]=useState(true)
  const[trackId,setTrackId]=useState(null)
  const[trackData,setTrackData]=useState(null)
  const[otpMap,setOtpMap]=useState({})  // orderId -> otp string
  const[otpLoading,setOtpLoading]=useState(null)

  const getDeliveryOtp=async(orderId)=>{
    setOtpLoading(orderId)
    try{
      const r=await api.genDeliveryOtp(orderId)
      setOtpMap(m=>({...m,[orderId]:r.data.otp}))
      showToast('OTP generated! Share it with the rider ✓','success')
    }catch(e){showToast(e.response?.data?.detail||'Failed','error')}
    setOtpLoading(null)
  }

  useEffect(()=>{
    if(!user)return
    api.myOrders().then(r=>setOrders(r.data)).catch(()=>{}).finally(()=>setLoading(false))
    // Poll every 20s for live status updates on active orders
    const poll=setInterval(()=>{
      api.myOrders().then(r=>setOrders(r.data)).catch(()=>{})
    },20000)
    return()=>clearInterval(poll)
  },[user])

  const openTrack=async(id)=>{
    if(trackId===id){setTrackId(null);setTrackData(null);return}
    setTrackId(id);setTrackData(null)
    try{const r=await api.trackOrder(id);setTrackData(r.data)}catch(e){}
  }

  if(!user)return(
    <div className="wrap" style={{padding:'40px 16px'}}>
      <div className="empty"><div style={{width:56,height:56,borderRadius:14,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div><div className="empty-title">Sign in to see orders</div></div>
    </div>
  )

  return(
    <div className="orders-shell">
      <div className="wrap">
      <div className="orders-head-card">
        <div className="auth-pane-eyebrow" style={{color:'#ffe29b',marginBottom:10}}>Order center</div>
        <div style={{fontSize:32,fontWeight:900,marginBottom:6,letterSpacing:'-.8px'}}>Track every order in one place</div>
        <div style={{opacity:.82,fontSize:14,maxWidth:560,lineHeight:1.7}}>Live status, rider details, re-order actions, cancellations, and returns in a cleaner dashboard inspired by premium commerce and delivery apps.</div>
        <div style={{display:'flex',gap:12,marginTop:18,flexWrap:'wrap'}}>
          <span className="promo-chip" style={{background:'rgba(255,255,255,.08)',borderColor:'rgba(255,255,255,.12)',color:'#fff'}}>Live tracking</span>
          <span className="promo-chip" style={{background:'rgba(255,255,255,.08)',borderColor:'rgba(255,255,255,.12)',color:'#fff'}}>Fast re-order</span>
          <span className="promo-chip" style={{background:'rgba(255,255,255,.08)',borderColor:'rgba(255,255,255,.12)',color:'#fff'}}>Return support</span>
        </div>
      </div>
      </div>
      <div className="wrap" style={{paddingTop:20}}>
        {loading?<Spin/>:orders.length===0
          ?<div className="empty"><div style={{width:56,height:56,borderRadius:14,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg></div><div className="empty-title">No orders yet</div><div style={{fontSize:13}}>Start shopping to see orders here</div></div>
          :<div className="orders-list">{orders.map(o=>{
            const sm=STATUS_META[o.status]||{label:o.status,color:'#6b7280',bg:'#f1f5f9'}
            return(
              <div key={o.id} className="order-card">
                <div className="order-card-hd">
                  <div>
                    <span className="order-code">#{o.orderCode}</span>
                    <div style={{fontSize:11,color:'var(--mu)',marginTop:2}}>{new Date(o.placedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} · {new Date(o.placedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <span className="order-status" style={{background:sm.bg,color:sm.color}}>{sm.label}</span>
                    {o.status==='PENDING'&&(
                      <button className="btn btn-out btn-sm" style={{color:'var(--rd)',borderColor:'var(--rd)'}}
                        onClick={()=>{
                          const reason=window.prompt('Reason for cancelling?\n(e.g. Changed my mind, Wrong address)')
                          if(reason!==null){
                            api.cancelOrder(o.id, reason||'No reason given')
                              .then(()=>{showToast('Order cancelled','info');api.myOrders().then(r=>setOrders(r.data))})
                              .catch(e=>showToast(e.response?.data?.detail||'Cannot cancel now','error'))
                          }
                        }}>Cancel</button>
                    )}
                    <button className="btn btn-out btn-sm" onClick={()=>openTrack(o.id)}>
                      {trackId===o.id?'Hide Tracking':'Track Order'}
                    </button>
                  </div>
                </div>
                <div className="order-card-body">
                  {o.items?.slice(0,3).map((item,i)=>(
                    <div key={i} className="oi-row">
                      {item.imageUrl&&<img src={item.imageUrl} alt={item.name} className="oi-img" onError={e=>e.target.style.display='none'}/>}
                      <div>
                        <div style={{fontSize:13,fontWeight:700}}>{item.name}{item.size?` (${item.size})`:''}</div>
                        <div style={{fontSize:12,color:'var(--mu)'}}>×{item.qty} · ₹{item.price*item.qty}</div>
                      </div>
                    </div>
                  ))}
                  {o.items?.length>3&&<div style={{fontSize:12,color:'var(--mu)'}}>+{o.items.length-3} more</div>}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:14}}>
                    <div style={{padding:'12px 14px',borderRadius:14,background:'#f8fafc',border:'1px solid var(--br2)'}}>
                      <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.5px',color:'#94a3b8',marginBottom:4}}>Vendor</div>
                      <div style={{fontSize:12,fontWeight:800,color:'#0f172a'}}>{o.status==='PENDING'?'Waiting to accept':'Accepted / preparing'}</div>
                    </div>
                    <div style={{padding:'12px 14px',borderRadius:14,background:'#f8fafc',border:'1px solid var(--br2)'}}>
                      <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.5px',color:'#94a3b8',marginBottom:4}}>Rider</div>
                      <div style={{fontSize:12,fontWeight:800,color:'#0f172a'}}>{o.riderId?'Rider accepted':'Waiting for rider'}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:9,paddingTop:9,borderTop:'1px solid var(--br2)'}}>
                    <div>
                      <div style={{fontSize:13,color:'var(--mu)'}}>From: {o.shop?.name}</div>
                      <div style={{fontSize:11,color:'#64748b',marginTop:3}}>
                        {o.paymentMethod?.toUpperCase()==='COD' ? `Cash on Delivery · Pay ₹${o.codDueAmount||o.total}` : 'Prepaid payment'}
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      {o.status==='DELIVERED'&&(
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-out btn-sm" style={{color:'var(--or)',borderColor:'var(--or)',letterSpacing:'.1px'}}
                            onClick={()=>{
                              if(o.items?.length>0){
                                const reItems=o.items.map(i=>({...i,id:i.productId,_key:String(i.productId),shopId:o.shop?.id||0,qty:i.qty,imageUrl:i.imageUrl}))
                                onBuyAgain&&onBuyAgain(reItems,o.shop)
                                showToast('Items added to cart','success')
                              }
                            }}>Buy Again</button>
                        </div>
                      )}
                      <div style={{fontWeight:900,fontSize:16}}>₹{o.total}</div>
                    </div>
                  </div>

                  {trackId===o.id&&(
                    <div className="track-panel" style={{animation:'fadeUp .3s ease'}}>

                      {/* 60-min countdown */}
                      {o.status!=='CANCELLED'&&o.placedAt&&(
                        <DeliveryCountdown placedAt={o.placedAt} deadline={o.deliveryDeadline||o.countdown?.deadline} serverNow={o.countdown?.serverNow} deliveredTime={o.deliveredTime||o.countdown?.deliveredTime} isDelayed={o.isDelayed}/>
                      )}

                      {/* Live tracking header */}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,marginTop:2}}>
                        <div style={{fontWeight:800,fontSize:14,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',animation:'pulse 1.5s ease infinite'}}/>
                          Live Tracking
                        </div>
                        <span style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>Updates every 20s</span>
                      </div>

                      {/* Track steps */}
                      {trackData?(
                        <div className="track-step-list">
                          {trackData.steps?.map((step,i)=>{
                            const isDone=step.done
                            const isActive=trackData.status===step.key&&!step.done
                            return(
                              <div key={step.key} className="track-step-row" style={{display:'flex',alignItems:'flex-start',gap:14}}>
                                <div className="track-step-dot" style={{transition:'.3s',
                                  background:isDone?'#22c55e':isActive?'#f97316':'#f1f5f9',
                                  color:isDone||isActive?'#fff':'#94a3b8',
                                  boxShadow:isActive?'0 0 0 6px rgba(249,115,22,.15)':isDone?'0 0 0 4px rgba(34,197,94,.12)':'none'}}>
                                  {isDone?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:isActive?<div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>:i+1}
                                </div>
                                <div style={{flex:1}}>
                                  <div style={{fontWeight:isDone||isActive?800:600,fontSize:14,color:isActive?'#f97316':isDone?'#16a34a':'#94a3b8',marginBottom:2}}>{step.label}</div>
                                  {isDone&&<div style={{fontSize:11,color:'#22c55e',fontWeight:600}}>Completed</div>}
                                  {isActive&&<div style={{fontSize:11,color:'#f97316',fontWeight:700,animation:'pulse 1.5s ease infinite'}}>In progress…</div>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ):(
                        <div style={{display:'flex',alignItems:'center',gap:10,padding:'16px',color:'#94a3b8',background:'#f8fafc',borderRadius:12}}>
                          <span style={{width:18,height:18,border:'2.5px solid #e2e8f0',borderTopColor:'#f97316',borderRadius:'50%',animation:'spin 1s linear infinite',display:'inline-block',flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:600}}>Loading tracking data…</span>
                        </div>
                      )}

                      {/* Rider info */}
                      {trackData?.riderLocation&&(
                        <div className="track-hero" style={{marginTop:10}}>
                          <div className="track-stat-card" style={{background:'linear-gradient(135deg,#fff7ed,#fffbeb)',border:'1px solid rgba(249,115,22,.2)'}}>
                          <div style={{fontWeight:800,fontSize:13,color:'#ea580c',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                            <Ic.Truck width={14} height={14} stroke="#ea580c"/> Rider is on the way
                          </div>
                          <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>{trackData.riderLocation.name}</div>
                          <div style={{display:'flex',gap:10,marginTop:8}}>
                            <a href={`https://maps.google.com/?q=${trackData.riderLocation.lat},${trackData.riderLocation.lng}`} target="_blank" rel="noreferrer"
                              style={{flex:1,padding:'9px',borderRadius:10,background:'#fff',border:'1px solid rgba(249,115,22,.3)',color:'#ea580c',fontSize:12,fontWeight:700,textDecoration:'none',textAlign:'center',transition:'.2s'}}>
                              Track on Map
                            </a>
                            <a href={`tel:${trackData.riderLocation.phone}`}
                              style={{flex:1,padding:'9px',borderRadius:10,background:'#fff',border:'1px solid rgba(22,163,74,.3)',color:'#16a34a',fontSize:12,fontWeight:700,textDecoration:'none',textAlign:'center',transition:'.2s'}}>
                              Call Rider
                            </a>
                          </div>
                          </div>
                          <div className="track-stat-card">
                            <div className="track-mini-title">Delivery promise</div>
                            <div style={{fontWeight:900,fontSize:28,color:'var(--nv)'}}>{o.shop?.deliveryTime||60} min</div>
                            <div style={{fontSize:12,color:'var(--mu)',marginTop:6,lineHeight:1.6}}>Order updates refresh automatically while the rider is moving.</div>
                          </div>
                        </div>
                      )}

                      <div style={{marginTop:14,padding:'14px 16px',borderRadius:16,background:'#f8fafc',border:'1px solid var(--br2)'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:8}}>
                          <div style={{fontWeight:800,fontSize:13,color:'#0f172a'}}>Need help with this order?</div>
                          {o.returnRequest&&<span style={{fontSize:11,fontWeight:800,color:'#c2410c'}}>{o.returnRequest.pickupStatus||o.returnRequest.status}</span>}
                        </div>
                        {o.returnRequest?(
                          <div style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>
                            Return request submitted. Vendor decision: {o.returnRequest.status}. Pickup updates appear here only after vendor approval.
                          </div>
                        ):(
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                            <div style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>Return is available inside order details only. Unused item, tags intact, and within policy window.</div>
                            {o.status==='DELIVERED'&&o.shop?.acceptsReturns&&(
                              <button className="btn btn-out btn-sm" style={{fontSize:11,whiteSpace:'nowrap'}}
                                onClick={()=>{
                                  const choice=window.prompt('Select return reason code:\nWRONG_SIZE\nDAMAGED\nWRONG_PRODUCT\nCHANGED_MIND','WRONG_SIZE')
                                  const picked=RETURN_REASONS.find(r=>r.code===choice)
                                  if(!picked)return
                                  api.previewReturn({orderId:o.id,reason:picked.label,reasonCode:picked.code,requestType:picked.type,conditionAccepted:true})
                                    .then(({data})=>{
                                      const confirmText = `Policy: ${data.decision}\nReturn fee: ₹${data.returnFee}\nRefund: ₹${data.refundAmount}\n\nContinue?`
                                      if(!window.confirm(confirmText)) return
                                      return api.requestReturn({orderId:o.id,reason:picked.label,reasonCode:picked.code,requestType:picked.type,conditionAccepted:true})
                                    })
                                    .then((res)=>{ if(res){ showToast('Return requested','success'); api.myOrders().then(r=>setOrders(r.data)) }})
                                    .catch(e=>showToast(e.response?.data?.detail||'Failed','error'))
                                }}>Request Return</button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Delivery OTP */}
                      {(o.status==='OUT_FOR_DELIVERY'||o.status==='PICKED_UP')&&(
                        <div style={{marginTop:12,padding:'16px',background:'linear-gradient(135deg,#0f172a,#1e293b)',borderRadius:16,border:'1px solid rgba(249,115,22,.25)'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                            <div style={{fontWeight:800,fontSize:14,color:'#fff',display:'flex',alignItems:'center',gap:8}}>
                              <Ic.Lock width={15} height={15} stroke="#f97316"/> Delivery OTP
                            </div>
                            <span style={{background:'rgba(249,115,22,.2)',color:'#fed7aa',fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:100,border:'1px solid rgba(249,115,22,.3)'}}>Share with rider</span>
                          </div>
                          {otpMap[o.id]?(
                            <div>
                              <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:10}}>
                                {String(otpMap[o.id]).split('').map((d,di)=>(
                                  <div key={di} style={{width:40,height:48,borderRadius:10,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:900,color:'#f97316',fontFamily:'monospace',letterSpacing:'0'}}>{d}</div>
                                ))}
                              </div>
                              <div style={{textAlign:'center',fontSize:11,color:'rgba(255,255,255,.4)'}}>This OTP confirms your delivery</div>
                            </div>
                          ):(
                            <button onClick={()=>getDeliveryOtp(o.id)} disabled={otpLoading===o.id}
                              style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#f97316,#ea580c)',color:'#fff',border:'none',borderRadius:12,fontWeight:800,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                              {otpLoading===o.id?<><span style={{width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 1s linear infinite',display:'inline-block'}}/> Generating…</>:<><Ic.Lock width={14} height={14}/> Get Delivery OTP</>}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Rate rider */}
                      {o.status==='DELIVERED'&&!o.riderRating&&(
                        <RateRiderSection orderId={o.id} onRated={()=>api.myOrders().then(r=>setOrders(r.data))}/>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )
          })}</div>
        }
      </div>
    </div>
  )
}

// ─── Wishlist Page ────────────────────────────────────────────────────────────
function WishlistPage({user,cart,onCartUpdate,onProductClick,wishlistIds,onWishlist}){
  const[items,setItems]=useState([])
  const[loading,setLoading]=useState(true)

  useEffect(()=>{
    if(!user){setLoading(false);return}
    api.getWishlist().then(r=>setItems(r.data)).catch(()=>{}).finally(()=>setLoading(false))
  },[user,wishlistIds.length])

  if(!user)return(
    <div className="wrap" style={{padding:'40px 16px'}}>
      <div className="empty"><div style={{width:56,height:56,borderRadius:14,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div><div className="empty-title">Sign in to see wishlist</div></div>
    </div>
  )
  return(
    <div className="wrap" style={{paddingTop:24,paddingBottom:48}}>
      <div className="sec-hd"><div><div className="sec-title">My Wishlist</div><div className="sec-sub">{items.length} saved items</div></div></div>
      {loading?<div style={{display:'flex',gap:12}}>{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>
        :items.length===0
          ?<div className="empty"><div style={{width:60,height:60,borderRadius:'50%',background:'#fef2f2',border:'2px solid #fecaca',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}><svg width='28' height='28' viewBox='0 0 24 24' fill='#ef4444' stroke='#ef4444' strokeWidth='0'><path d='M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z'/></svg></div><div className="empty-title">Nothing saved yet</div><div style={{fontSize:13}}>Tap the heart on any product to save it</div></div>
          :<div className="pgrid">
             {items.filter(w=>w.product).map(w=>(
               <ProdCard key={w.id} p={{...w.product}} cart={cart} onCartUpdate={onCartUpdate}
                 onClick={onProductClick} wishlisted={true} onWishlist={onWishlist}/>
             ))}
           </div>}
    </div>
  )
}

// ─── Search Page ──────────────────────────────────────────────────────────────
function SearchPage({initialQuery,cart,onCartUpdate,onProductClick,user,wishlistIds,onWishlist,userLoc,radius}){
  const[query,setQuery]=useState(initialQuery||'')
  const[results,setResults]=useState([])
  const[similar,setSimilar]=useState([])
  const[loading,setLoading]=useState(false)
  const[sortBy,setSortBy]=useState('relevance')
  const[priceMax,setPriceMax]=useState('')
  const[minRating,setMinRating]=useState('')
  const[category,setCategory]=useState('')
  const[searched,setSearched]=useState(false)

  const doSearch=useCallback(async(q)=>{
    if(!q.trim())return
    setLoading(true);setSearched(true)
    try{
      const r=await api.search({q,sortBy,maxPrice:priceMax||undefined,minRating:minRating||undefined,category:category||undefined})
      const exact=r.data.results||[]
      setResults(exact)
      if(exact.length===0){
        const all=await api.getProducts({lat:userLoc?.lat,lng:userLoc?.lng,radius})
        const ranked=(all.data||[]).map(p=>({...p,_score:fuzzyProductScore(p,q)})).filter(p=>p._score>0).sort((a,b)=>b._score-a._score).slice(0,8)
        setSimilar(ranked)
      }else setSimilar([])
    }catch(e){setResults([]);setSimilar([])}
    setLoading(false)
  },[sortBy,priceMax,minRating,category,userLoc?.lat,userLoc?.lng,radius])

  useEffect(()=>{if(initialQuery)doSearch(initialQuery)},[])
  useEffect(()=>{if(searched&&query)doSearch(query)},[sortBy,priceMax,minRating,category])

  return(
    <div style={{paddingBottom:48}}>
      <div style={{background:'linear-gradient(180deg,#111827,#172231)',padding:'20px 0 18px'}}>
        <div className="wrap">
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',background:'linear-gradient(180deg,#fff,#fbfdff)',borderRadius:22,overflow:'hidden',boxShadow:'0 18px 42px rgba(0,0,0,.2)',border:'1px solid rgba(255,255,255,.08)'}}>
            <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch(query)}
              style={{flex:1,border:'none',padding:'12px 16px',fontSize:15,outline:'none',fontFamily:'var(--fn)'}} placeholder="Search products, brands, categories…"/>
            <button onClick={()=>doSearch(query)} style={{background:'var(--or)',border:'none',padding:'0 20px',cursor:'pointer',height:44,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div className="filterbar">
        <div className="filterbar-inner">
          {[
            {val:sortBy,setter:setSortBy,opts:[{v:'relevance',l:'Relevance'},{v:'price_asc',l:'Price ↑'},{v:'price_desc',l:'Price ↓'},{v:'rating',l:'Top Rated'}],ph:'Sort'},
            {val:category,setter:setCategory,opts:[{v:'',l:'All Categories'},...CATS.filter(c=>c.id!=='All').map(c=>({v:c.id,l:c.id}))],ph:'Category'},
            {val:priceMax,setter:setPriceMax,opts:[{v:'',l:'Max Price'},{v:'500',l:'Under ₹500'},{v:'1000',l:'Under ₹1,000'},{v:'2000',l:'Under ₹2,000'},{v:'5000',l:'Under ₹5,000'}],ph:'Price'},
            {val:minRating,setter:setMinRating,opts:[{v:'',l:'Any Rating'},{v:'4',l:'4+'},{v:'3',l:'3+'}],ph:'Rating'},
          ].map(({val,setter,opts,ph})=>(
            <select key={ph} value={val} onChange={e=>setter(e.target.value)} className="fselect">
              {opts.map(({v,l})=><option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          {searched&&<span className="res-count">{results.length} result{results.length!==1?'s':''}</span>}
        </div>
      </div>
      <div className="wrap" style={{paddingTop:20}}>
        {loading?<div className="pgrid">{[1,2,3,4,5,6].map(i=><SkeletonCard key={i}/>)}</div>
          :!searched
            ?<div>
               <div className="sec-title" style={{marginBottom:14}}>Popular Searches</div>
               <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                 {['Kurta','Saree','Jeans','Dress','T-Shirt','Footwear','Kids','Jacket'].map(s=>(
                   <span key={s} onClick={()=>{setQuery(s);doSearch(s)}} className="fpill" style={{cursor:'pointer',fontSize:12,fontWeight:700}}>{s}</span>
                 ))}
               </div>
             </div>
             :results.length===0
              ?<div>
                 <div className="empty"><div style={{width:56,height:56,borderRadius:14,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div className="empty-title">No exact result for "{query}"</div><div style={{fontSize:13,color:'var(--mu)',marginTop:6}}>Showing similar products from nearby shops.</div></div>
                 {similar.length>0&&<div className="pgrid">
                   {similar.map((p,i)=>(
                     <ProdCard key={p.id} p={p} cart={cart} onCartUpdate={onCartUpdate} onClick={onProductClick}
                       wishlisted={wishlistIds.includes(p.id)} onWishlist={onWishlist} delay={i*0.03}/>
                   ))}
                 </div>}
               </div>
              :<div className="pgrid">
                 {results.map((p,i)=>(
                   <ProdCard key={p.id} p={p} cart={cart} onCartUpdate={onCartUpdate} onClick={onProductClick}
                     wishlisted={wishlistIds.includes(p.id)} onWishlist={onWishlist} delay={i*0.03}/>
                 ))}
               </div>
        }
      </div>
    </div>
  )
}

// ─── Referral Page ────────────────────────────────────────────────────────────
function SearchPagePremium(props){
  const {initialQuery,cart,onCartUpdate,onProductClick,wishlistIds,onWishlist,userLoc,radius}=props
  const[query,setQuery]=useState(initialQuery||'')
  const[results,setResults]=useState([])
  const[similar,setSimilar]=useState([])
  const[loading,setLoading]=useState(false)
  const[sortBy,setSortBy]=useState('relevance')
  const[priceMax,setPriceMax]=useState('')
  const[minRating,setMinRating]=useState('')
  const[category,setCategory]=useState('')
  const[searched,setSearched]=useState(false)

  const doSearch=useCallback(async(q)=>{
    if(!q.trim()) return
    setLoading(true)
    setSearched(true)
    try{
      const r=await api.search({q,sortBy,maxPrice:priceMax||undefined,minRating:minRating||undefined,category:category||undefined})
      const exact=r.data.results||[]
      setResults(exact)
      if(exact.length===0){
        const all=await api.getProducts({lat:userLoc?.lat,lng:userLoc?.lng,radius})
        const ranked=(all.data||[])
          .map(p=>({...p,_score:fuzzyProductScore(p,q)}))
          .filter(p=>p._score>0)
          .sort((a,b)=>b._score-a._score)
          .slice(0,8)
        setSimilar(ranked)
      }else{
        setSimilar([])
      }
    }catch(e){
      setResults([])
      setSimilar([])
    }
    setLoading(false)
  },[sortBy,priceMax,minRating,category,userLoc?.lat,userLoc?.lng,radius])

  useEffect(()=>{if(initialQuery)doSearch(initialQuery)},[])
  useEffect(()=>{if(searched&&query)doSearch(query)},[sortBy,priceMax,minRating,category])

  return(
    <div className="search-shell">
      <div className="search-hero">
        <div className="wrap">
          <div className="search-hero-card">
            <div className="search-kicker">Premium discovery</div>
            <div className="search-title">Find exact products or the closest nearby style match.</div>
            <div className="search-copy">Search by product name, category, or brand. If an exact item is not available, NearNow now surfaces similar products from nearby shops so the customer still finds a strong match.</div>
            <div className="search-input-shell">
              <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch(query)}
                placeholder="Search shirts, sarees, jeans, dresses, local brands..." />
              <button onClick={()=>doSearch(query)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            </div>
            <div className="search-chip-row">
              {['shirt','kurta','saree','jeans','dress','jacket'].map(s=>(
                <button key={s} className="search-chip" onClick={()=>{setQuery(s);doSearch(s)}}>{s}</button>
              ))}
            </div>
            <div className="search-overview">
              <div className="search-overview-card">
                <strong>{results.length || similar.length || 24}+</strong>
                <span>products discovered nearby</span>
              </div>
              <div className="search-overview-card">
                <strong>Exact + similar</strong>
                <span>fallback search now returns close style alternatives</span>
              </div>
              <div className="search-overview-card">
                <strong>{userLoc ? 'Nearby shops on' : 'Location smart'}</strong>
                <span>{userLoc ? 'results tuned for your nearby stores' : 'turn on location for better local matches'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="filterbar">
        <div className="filterbar-inner">
          {[
            {val:sortBy,setter:setSortBy,opts:[{v:'relevance',l:'Relevance'},{v:'price_asc',l:'Price Low to High'},{v:'price_desc',l:'Price High to Low'},{v:'rating',l:'Top Rated'}],ph:'Sort'},
            {val:category,setter:setCategory,opts:[{v:'',l:'All Categories'},...CATS.filter(c=>c.id!=='All').map(c=>({v:c.id,l:c.id}))],ph:'Category'},
            {val:priceMax,setter:setPriceMax,opts:[{v:'',l:'Max Price'},{v:'500',l:'Under Rs 500'},{v:'1000',l:'Under Rs 1,000'},{v:'2000',l:'Under Rs 2,000'},{v:'5000',l:'Under Rs 5,000'}],ph:'Price'},
            {val:minRating,setter:setMinRating,opts:[{v:'',l:'Any Rating'},{v:'4',l:'4+'},{v:'3',l:'3+'}],ph:'Rating'},
          ].map(({val,setter,opts,ph})=>(
            <select key={ph} value={val} onChange={e=>setter(e.target.value)} className="fselect">
              {opts.map(({v,l})=><option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          {searched&&<span className="res-count">{results.length || similar.length} result{(results.length || similar.length)!==1?'s':''}</span>}
        </div>
      </div>
      <div className="wrap search-body">
        {loading ? <div className="pgrid">{[1,2,3,4,5,6].map(i=><SkeletonCard key={i}/>)}</div>
        : !searched ? <div className="search-panel">
            <div className="search-section-head">
              <strong>Popular searches</strong>
              <span>Trending categories customers search most</span>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {['Kurta','Saree','Jeans','Dress','T-Shirt','Footwear','Kids','Jacket'].map(s=>(
                <span key={s} onClick={()=>{setQuery(s);doSearch(s)}} className="fpill" style={{cursor:'pointer',fontSize:12,fontWeight:700}}>{s}</span>
              ))}
            </div>
          </div>
        : results.length===0 ? <div style={{display:'grid',gap:18}}>
            <div className="search-empty">
              <div className="search-empty-title">No exact result for "{query}"</div>
              <div className="search-empty-copy">NearNow could not find that exact product name, so the app is showing the closest nearby style alternatives using category, brand, and title similarity.</div>
            </div>
            {similar.length>0&&<div className="search-panel">
              <div className="search-section-head">
                <strong>Similar products from nearby shops</strong>
                <span>Ranked using name, category, and brand similarity</span>
              </div>
              <div className="pgrid">
                {similar.map((p,i)=>(
                  <ProdCard key={p.id} p={p} cart={cart} onCartUpdate={onCartUpdate} onClick={onProductClick}
                    wishlisted={wishlistIds.includes(p.id)} onWishlist={onWishlist} delay={i*0.03}/>
                ))}
              </div>
            </div>}
          </div>
        : <div className="search-panel">
            <div className="search-section-head">
              <strong>Search results</strong>
              <span>Matching products ready for quick delivery</span>
            </div>
            <div className="pgrid">
              {results.map((p,i)=>(
                <ProdCard key={p.id} p={p} cart={cart} onCartUpdate={onCartUpdate} onClick={onProductClick}
                  wishlisted={wishlistIds.includes(p.id)} onWishlist={onWishlist} delay={i*0.03}/>
              ))}
            </div>
          </div>}
      </div>
    </div>
  )
}

function ReferralPage({user}){
  const[data,setData]=useState(null)
  const[refInput,setRefInput]=useState('')
  const[applying,setApplying]=useState(false)
  const[loading,setLoading]=useState(true)

  useEffect(()=>{
    if(!user){setLoading(false);return}
    api.getMyReferral().then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false))
  },[user])

  const copy=()=>{navigator.clipboard?.writeText(data?.code||'');showToast('Code copied! Share it to earn ✓','success')}
  const apply=async()=>{
    if(!refInput.trim())return;setApplying(true)
    try{const r=await api.applyReferral(refInput.trim().toUpperCase());showToast(r.data.message,'success');api.getMyReferral().then(r=>setData(r.data))}
    catch(e){showToast(e.response?.data?.detail||'Invalid code','error')}
    setApplying(false)
  }

  if(!user)return(
    <div className="wrap" style={{padding:'40px 16px'}}>
      <div className="empty"><div style={{width:56,height:56,borderRadius:14,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div className="empty-title">Sign in to access Refer & Earn</div></div>
    </div>
  )
  if(loading)return<div className="wrap" style={{paddingTop:40}}><Spin/></div>
  return(
    <div className="wrap" style={{paddingTop:24,paddingBottom:48,maxWidth:680}}>
      <div className="ref-card">
        <div style={{position:'relative',zIndex:1}}>
          <div style={{fontWeight:900,fontSize:22,letterSpacing:"-.5px",marginBottom:7}}>Refer & Earn</div>
          <div style={{fontWeight:900,fontSize:22,marginBottom:5,letterSpacing:'-.5px'}}>Refer & Earn</div>
          <div style={{opacity:.8,fontSize:14,marginBottom:15,lineHeight:1.6}}>Share your code → Friend joins → You earn 50 pts · They earn 25 pts<br/>100 pts = ₹10 off</div>
          <div className="ref-code" onClick={copy}>{data?.code||'...'}</div>
          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-or" style={{position:"relative",overflow:"hidden",flex:1,justifyContent:'center'}} onClick={copy}>Copy Code</button>
            <button onClick={()=>navigator.share?.({title:'Join DOTT!',text:`Use my code ${data?.code}!`,url:data?.shareLink})}
              style={{flex:1,padding:'10px',background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',borderRadius:'var(--r8)',color:'#fff',fontFamily:'var(--fn)',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,fontSize:14}}>Share</button>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:11,marginBottom:18}}>
        {[{val:data?.points||0,lbl:'Points'},{val:data?.usedCount||0,lbl:'Friends'},{val:'₹'+Math.floor((data?.points||0)/10),lbl:'Value'}].map(({val,lbl})=>(
          <div key={lbl} style={{background:'#fff',borderRadius:'var(--r12)',border:'1px solid var(--br)',padding:15,textAlign:'center',boxShadow:'var(--sh0)'}}>
            <div style={{height:8}}/>
            <div style={{fontWeight:900,fontSize:22,color:'var(--or)'}}>{val}</div>
            <div style={{fontSize:11,color:'var(--mu)',fontWeight:700,marginTop:2}}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff',borderRadius:'var(--r16)',border:'1px solid var(--br)',padding:19,marginBottom:18}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:3}}>Have a friend's code?</div>
        <div style={{fontSize:13,color:'var(--mu)',marginBottom:12}}>Apply to earn 25 bonus points</div>
        <div style={{display:'flex',gap:9}}>
          <input className="inp" placeholder="Enter referral code…" value={refInput} onChange={e=>setRefInput(e.target.value.toUpperCase())} style={{flex:1}}/>
          <button className="btn btn-or" style={{position:"relative",overflow:"hidden"}} onClick={apply} disabled={applying}>{applying?'…':'Apply'}</button>
        </div>
      </div>

      <div style={{background:'linear-gradient(135deg,#064e3b,#047857)',borderRadius:'var(--r16)',padding:22,color:'#fff'}}>
        <div style={{fontWeight:900,fontSize:18,marginBottom:5}}> Become a Reseller</div>
        <div style={{opacity:.85,fontSize:14,marginBottom:14}}>Share products · Earn 10% per sale · Zero investment</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
          {[{title:'Share Products',desc:'Pick from our catalogue'},{title:'Earn 10%',desc:'Per sale via your link'}].map(({icon,title,desc})=>(
            <div key={title} style={{background:'rgba(255,255,255,.1)',borderRadius:'var(--r8)',padding:'11px 13px',border:'1px solid rgba(255,255,255,.15)'}}>
              <div style={{height:4}}/>
              <div style={{fontWeight:800,fontSize:13,marginBottom:1}}>{title}</div>
              <div style={{fontSize:11,opacity:.8}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Account Page ─────────────────────────────────────────────────────────────
function AccountPage({user,onSignOut,onOpenAuth,onNavigate}){
  const[points,setPoints]=useState(null)
  const[orders,setOrders]=useState([])
  useEffect(()=>{
    if(!user)return
    api.getPoints().then(r=>setPoints(r.data)).catch(()=>{})
    api.myOrders().then(r=>setOrders(r.data.slice(0,3))).catch(()=>{})
  },[user])

  if(!user)return(
    <div style={{minHeight:'80vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}>
      <div style={{width:72,height:72,borderRadius:20,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><svg width='34' height='34' viewBox='0 0 24 24' fill='none' stroke='#94a3b8' strokeWidth='1.5' strokeLinecap='round'><line x1='16.5' y1='9.4' x2='7.5' y2='4.21'/><path d='M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z'/><polyline points='3.27 6.96 12 12.01 20.73 6.96'/><line x1='12' y1='22.08' x2='12' y2='12'/></svg></div>
      <div style={{fontWeight:900,fontSize:24,marginBottom:8,letterSpacing:'-.5px'}}>Welcome to NearNow</div>
      <div style={{fontSize:15,color:'var(--mu)',marginBottom:28,lineHeight:1.6,maxWidth:300}}>Sign in to track orders, save your wishlist and earn rewards</div>
      <button className="btn btn-or" style={{position:"relative",overflow:"hidden",padding:'14px 36px',fontSize:16,justifyContent:'center',borderRadius:'var(--r100)',boxShadow:'0 6px 20px rgba(249,115,22,.3)'}} onClick={onOpenAuth}>
        Sign In / Register →
      </button>
    </div>
  )

  const STATUS_COLOR={PENDING:'#f59e0b',CONFIRMED:'#3b82f6',PACKING:'#8b5cf6',PICKED_UP:'#06b6d4',OUT_FOR_DELIVERY:'#f97316',DELIVERED:'#22c55e',CANCELLED:'#ef4444'}

  const menuItems=[
    {icon:null,label:'My Orders',sub:`${orders.length} recent orders`,page:'orders',color:'#f97316',bg:'#fff7ed',letter:'O'},
    {icon:null,label:'Wishlist',sub:'Your saved items',page:'wishlist',color:'#ef4444',bg:'#fef2f2',letter:'W'},
    {icon:null,label:'Refer & Earn',sub:'Earn points & rewards',page:'referral',color:'#7c3aed',bg:'#f5f3ff',letter:'R'},
    {icon:null,label:'Returns',sub:'Easy return process',page:'orders',color:'#0ea5e9',bg:'#f0f9ff',letter:'T'},
  ]

  return(
    <div className="acct-shell">
      {/* Hero header */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)',padding:'28px 20px 80px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(rgba(249,115,22,.15) 1px,transparent 1px)',backgroundSize:'24px 24px'}}/>
        <div style={{maxWidth:640,margin:'0 auto',position:'relative',zIndex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#f97316,#ea580c)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:28,color:'#fff',flexShrink:0,border:'3px solid rgba(255,255,255,.2)',boxShadow:'0 8px 24px rgba(0,0,0,.3)'}}>
              {user.name?.[0]?.toUpperCase()||'U'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:900,fontSize:20,color:'#fff',marginBottom:2}}>{user.name}</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,.6)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
              {user.phone&&<div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:3}}> {user.phone}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Points card — floats over hero */}
      <div className="acct-wrap" style={{marginTop:'-44px',position:'relative',zIndex:2}}>
        <div style={{background:'#fff',borderRadius:20,padding:'16px 20px',boxShadow:'0 8px 32px rgba(0,0,0,.12)',border:'1px solid rgba(249,115,22,.1)',display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <div style={{width:46,height:46,borderRadius:12,background:'linear-gradient(135deg,#f97316,#ea580c)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}></div>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:16}}>{points?`${points.points} Points`:'0 Points'}</div>
            <div style={{fontSize:12,color:'var(--mu)',marginTop:1}}>{points&&points.rupeeValue>0?`Worth ₹${points.rupeeValue} · Earn more by referring friends`:'Refer friends to earn points!'}</div>
          </div>
          <button onClick={()=>onNavigate&&onNavigate('referral')} style={{background:'var(--orl)',border:'1.5px solid var(--orm)',color:'var(--ord)',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'var(--fn)',flexShrink:0}}>
            Earn →
          </button>
        </div>

        <div className="acct-stat-grid">
          <div className="acct-stat-card">
            <strong>{orders.length}</strong>
            <span>recent orders in your account</span>
          </div>
          <div className="acct-stat-card">
            <strong>{points?.points||0}</strong>
            <span>reward points ready to redeem</span>
          </div>
          <div className="acct-stat-card">
            <strong>{orders.filter(o=>o.status==='DELIVERED').length}</strong>
            <span>successful deliveries completed</span>
          </div>
        </div>

        <div className="acct-media-grid">
          <div className="acct-style-card">
            <div style={{fontSize:11,fontWeight:800,color:'#ea580c',letterSpacing:'.6px',textTransform:'uppercase',marginBottom:10}}>Style profile</div>
            <h3>Your fashion account, rewards, and orders in one premium space.</h3>
            <p>Track deliveries, manage wishlist, find nearby stores, and jump back into your latest looks faster. The account page now behaves more like a polished commerce dashboard instead of a plain settings screen.</p>
            <div className="acct-style-actions">
              <button onClick={()=>onNavigate&&onNavigate('orders')} className="btn btn-or" style={{position:'relative',overflow:'hidden'}}>Open Orders</button>
              <button onClick={()=>onNavigate&&onNavigate('wishlist')} className="btn btn-out">View Wishlist</button>
            </div>
          </div>
          <div className="acct-visual-card">
            {(orders.flatMap(o=>o.items||[]).filter(i=>i.imageUrl).slice(0,4)).map((item,idx)=>(
              <div key={`${item.id||idx}-${idx}`} className="acct-visual-slot">
                <img src={item.imageUrl} alt={item.name||'product'} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              </div>
            ))}
            {orders.flatMap(o=>o.items||[]).filter(i=>i.imageUrl).length===0&&(
              <div className="acct-fallback">Your style collection and recent product images appear here.</div>
            )}
          </div>
        </div>

        {/* Recent Orders preview */}
        {orders.length>0&&(
          <div style={{background:'#fff',borderRadius:20,padding:'16px 20px',boxShadow:'0 2px 12px rgba(0,0,0,.06)',border:'1px solid var(--br)',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:15}}>Recent Orders</div>
              <button onClick={()=>onNavigate&&onNavigate('orders')} style={{background:'none',border:'none',color:'var(--or)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'var(--fn)'}}>View all →</button>
            </div>
            {orders.map(o=>{
              const color=STATUS_COLOR[o.status]||'#6b7280'
              return(
                <div key={o.id} onClick={()=>onNavigate&&onNavigate('orders')} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--br2)',cursor:'pointer',transition:'.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  {o.items?.[0]?.imageUrl
                    ?<img src={o.items[0].imageUrl} alt="" style={{width:46,height:46,borderRadius:10,objectFit:'cover',border:'1px solid var(--br)',flexShrink:0}}/>
                    :<div style={{width:46,height:46,borderRadius:10,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}><svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='#cbd5e1' strokeWidth='1.5' strokeLinecap='round'><path d='M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z'/><line x1='3' y1='6' x2='21' y2='6'/><path d='M16 10a4 4 0 01-8 0'/></svg></div>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.items?.[0]?.name||'Order'}{o.items?.length>1?` +${o.items.length-1} more`:''}</div>
                    <div style={{fontSize:11,color:'var(--mu)',marginTop:2}}>#{o.orderCode} · ₹{o.total}</div>
                  </div>
                  <span style={{background:color+'18',color,fontSize:11,fontWeight:800,padding:'3px 9px',borderRadius:100,flexShrink:0,border:`1px solid ${color}30`}}>{o.status?.replace(/_/g,' ')}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Menu grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          {menuItems.map(item=>(
            <div key={item.label} onClick={()=>onNavigate&&onNavigate(item.page)}
              style={{background:'#fff',borderRadius:16,border:'1px solid var(--br)',padding:'18px 16px',cursor:'pointer',transition:'all .2s',boxShadow:'0 2px 8px rgba(0,0,0,.04)'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.1)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.04)'}}>
              <div style={{width:44,height:44,borderRadius:10,background:item.color,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10,boxShadow:`0 4px 12px ${item.color}30`}}>
                <span style={{fontSize:14,fontWeight:900,color:'#fff',letterSpacing:'.5px'}}>{item.letter}</span>
              </div>
              <div style={{fontWeight:800,fontSize:14,marginBottom:3}}>{item.label}</div>
              <div style={{fontSize:11,color:'var(--mu)'}}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* App info */}
        <div style={{background:'#fff',borderRadius:16,padding:'14px 18px',border:'1px solid var(--br)',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}></span>
            <div>
              <div style={{fontWeight:700,fontSize:13}}>NearNow</div>
              <div style={{fontSize:11,color:'var(--mu)'}}>Fashion delivered fast · v8.0</div>
            </div>
          </div>
          <span style={{background:'#f0fdf4',color:'var(--gn)',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:100,border:'1px solid #bbf7d0'}}>●  Online</span>
        </div>

        <button style={{width:'100%',padding:'13px',background:'transparent',border:'1.5px solid #fecaca',borderRadius:14,cursor:'pointer',color:'var(--rd)',fontSize:14,fontWeight:800,fontFamily:'var(--fn)',transition:'.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
          onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}
          onClick={onSignOut}>
           Sign Out
        </button>
      </div>
    </div>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────
function HomePage({user,userLoc,radius,cart,onCartUpdate,onShopOpen,onProductClick,wishlistIds,onWishlist,onSearchPage,recentlyViewed=[]}){
  const[shops,setShops]=useState([])
  const[products,setProducts]=useState([])
  const[loading,setLoading]=useState(true)
  const[cat,setCat]=useState('All')

  useEffect(()=>{
    const load=async()=>{
      setLoading(true)
      try{
        const[sr,pr]=await Promise.all([
          api.getShops({lat:userLoc?.lat,lng:userLoc?.lng,radius}),
          api.getProducts({lat:userLoc?.lat,lng:userLoc?.lng,radius})
        ])
        const shopsData=sr.data
        const prods=pr.data.map(p=>({...p,shopName:shopsData.find(s=>s.id===p.shopId)?.name}))
        setShops(shopsData);setProducts(prods)
      }catch(e){}
      setLoading(false)
    }
    load()
  },[userLoc,radius])

  const filtered=cat==='All'?products:products.filter(p=>p.category===cat)
  const newArrivals=products.filter(p=>!p.avgRating||p.avgRating===0).slice(0,10)
  const topRated=[...products].sort((a,b)=>(b.avgRating||0)-(a.avgRating||0)).filter(p=>p.avgRating>0).slice(0,10)

  return(
    <div>
      <BannerCarousel onCtaClick={onSearchPage}/>

      {/* Promo bar */}
      <div className="promo-bar">
        <div className="promo-inner">
          {[{txt:'Free Delivery',sub:'Orders above ₹500'},{txt:'7-Day Returns',sub:'Fashion items'},{txt:'60-Min Delivery',sub:'Local stores'},{txt:'Verified Sellers',sub:'100% authentic'},{txt:'Earn Points',sub:'Refer friends'}].map(({txt,sub})=>(
            <div key={txt} className="promo-item" style={{borderRight:'1px solid rgba(255,255,255,.12)',padding:'0 28px',flexShrink:0}}>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                <span style={{fontSize:12,fontWeight:800,color:'#fff',letterSpacing:'.2px'}}>{txt}</span>
                <span style={{fontSize:10,color:'rgba(255,255,255,.5)',fontWeight:500}}>{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category bar */}
      <div className="catbar">
        <div className="catbar-inner">
          {CATS.map(c=>(
            <div key={c.id} className={`cat-btn${cat===c.id?' on':''}`} onClick={()=>setCat(c.id)}>
              <span>{c.id}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="wrap">
        <div className="home-hero">
          <div className="hero-panel">
            <div className="hero-kicker">Curated marketplace</div>
            <div className="hero-title">Shop fashion the way customers expect online.</div>
            <div className="hero-copy">
              Clean product discovery, nearby trusted stores, and faster checkout built to feel closer to a modern marketplace than a local catalogue.
            </div>
            <div className="hero-points">
              <div className="hero-point">
                <strong>{products.length || 0}+</strong>
                <span>Products ready to browse</span>
              </div>
              <div className="hero-point">
                <strong>{shops.length || 0}</strong>
                <span>Verified local shops nearby</span>
              </div>
              <div className="hero-point">
                <strong>60 min</strong>
                <span>Fast delivery promise</span>
              </div>
            </div>
          </div>
          <div className="hero-side">
            <div className="hero-mini">
              <h3>Better storefront polish</h3>
              <p>Smaller cards, tighter spacing, stronger contrast, and clearer calls to action for a more professional customer experience.</p>
            </div>
            <div className="hero-mini light">
              <h3>Ready to explore</h3>
              <p>{cat==='All'?'Browse all categories or jump straight into the best sellers.':`Now showing ${cat} products with a cleaner catalogue layout.`}</p>
            </div>
          </div>
        </div>

        {/* Nearby Shops */}
        {(loading||shops.length>0)&&(
          <div className="sec-wrap">
            <div className="sec-hd">
              <div><div className="sec-title">Shops Near You</div><div className="sec-sub">{shops.length} stores available</div></div>
            </div>
            <div className="hscroll">
              <div className="hs-inner">
                {loading?[1,2,3,4].map(i=><div key={i} className="skel" style={{width:260,height:200,borderRadius:'var(--r16)'}}/>)
                  :shops.slice(0,6).map(s=><ShopCard key={s.id} shop={s} onClick={onShopOpen}/>)}
              </div>
            </div>
          </div>
        )}

        {/* Deal boxes */}
        {!loading&&shops.length>=2&&(
          <div className="sec-wrap">
            <div className="sec-hd"><div className="sec-title">Today's Deals</div></div>
            <div className="deal-grid">
              {[{title:'New Arrivals',s:0},{title:'Top Rated',s:1},{title:'Ethnic Wear',s:shops.findIndex(s=>s.category?.toLowerCase().includes('fashion'))},{title:'Footwear',s:shops.length-1}].filter(d=>shops[d.s]).map((d,di)=>(
                <div key={di} className="deal-card" onClick={()=>onShopOpen(shops[d.s])}>
                  <div className="deal-title">{d.title}</div>
                  <div className="deal-imgs">
                    {products.filter(p=>p.shopId===shops[d.s].id&&p.imageUrl).slice(0,4).map((p,pi)=>(
                      <img key={pi} src={p.imageUrl} alt={p.name} onError={e=>e.target.style.display='none'}/>
                    ))}
                  </div>
                  <div className="deal-cta">Shop Now →</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Arrivals */}
        {(loading||newArrivals.length>0)&&(
          <div className="sec-wrap">
            <div className="sec-hd"><div><div className="sec-title">New Arrivals</div><div className="sec-sub">Fresh styles just added</div></div></div>
            <div className="hscroll">
              <div className="hs-inner">
                {loading?[1,2,3,4,5].map(i=><SkeletonCard key={i}/>)
                  :newArrivals.map((p,i)=>(
                    <ProdCard key={p.id} p={p} cart={cart} onCartUpdate={onCartUpdate} onClick={onProductClick}
                      wishlisted={wishlistIds.includes(p.id)} onWishlist={onWishlist} delay={i*0.05}/>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {recentlyViewed&&recentlyViewed.length>0&&(
          <div className="sec-wrap">
            <div className="sec-hd"><div><div className="sec-title">Recently Viewed</div><div className="sec-sub">Your browsing history</div></div></div>
            <div className="hscroll">
              <div className="hs-inner">
                {recentlyViewed.map((p,i)=>(
                  <ProdCard key={p.id} p={p} cart={cart} onCartUpdate={onCartUpdate} onClick={onProductClick}
                    wishlisted={wishlistIds.includes(p.id)} onWishlist={onWishlist} delay={i*0.03}/>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Top Rated */}
        {topRated.length>0&&(
          <div className="sec-wrap">
            <div className="sec-hd"><div><div className="sec-title">Top Rated</div><div className="sec-sub">Loved by customers</div></div></div>
            <div className="hscroll">
              <div className="hs-inner">
                {topRated.map((p,i)=>(
                  <ProdCard key={p.id} p={p} cart={cart} onCartUpdate={onCartUpdate} onClick={onProductClick}
                    wishlisted={wishlistIds.includes(p.id)} onWishlist={onWishlist} delay={i*0.05}/>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All products */}
        <div className="sec-wrap">
          <div className="sec-hd">
            <div><div className="sec-title">{cat==='All'?'All Products':cat}</div><div className="sec-sub">{filtered.length} items</div></div>
          </div>
          {loading
            ?<div className="pgrid">{[1,2,3,4,5,6,7,8].map(i=><SkeletonCard key={i}/>)}</div>
            :filtered.length===0
              ?<div className="empty"><div style={{width:60,height:60,borderRadius:16,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}><svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='#94a3b8' strokeWidth='1.5' strokeLinecap='round'><path d='M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z'/><line x1='3' y1='6' x2='21' y2='6'/><path d='M16 10a4 4 0 01-8 0'/></svg></div><div className="empty-title">No products yet</div><div style={{fontSize:13}}>Vendors are setting up — check back soon!</div></div>
              :<div className="pgrid">
                 {filtered.map((p,i)=>(
                   <ProdCard key={p.id} p={p} cart={cart} onCartUpdate={onCartUpdate} onClick={onProductClick}
                     wishlisted={wishlistIds.includes(p.id)} onWishlist={onWishlist} delay={i*0.03}/>
                 ))}
               </div>}
        </div>
      </div>
    </div>
  )
}

// ─── Leaflet loader ───────────────────────────────────────────────────────────
function useLeaflet(){
  useEffect(()=>{
    if(window.L)return
    const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l)
    const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';document.head.appendChild(s)
  },[])
}

// ─── MAP LOCATION MODAL ────────────────────────────────────────────────────────
function MapLocationModal({currentLat,currentLng,radius,onSave,onClose}){
  const[lat,setLat]=useState(currentLat||17.385)
  const[lng,setLng]=useState(currentLng||78.4867)
  const[rad,setRad]=useState(radius||15)
  return(
    <div className="auth-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="auth-card" style={{maxWidth:500}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontWeight:900,fontSize:18}}>Set Location</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'var(--mu)'}}>✕</button>
        </div>
        <MapPicker lat={lat} lng={lng} onPinMove={(la,lo)=>{setLat(la);setLng(lo)}} height={280}/>
        <div style={{marginTop:16,marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <label style={{fontSize:13,fontWeight:700,color:'var(--tx)'}}>Delivery Radius</label>
            <span style={{fontWeight:800,fontSize:15,color:'var(--or)'}}>{rad} km</span>
          </div>
          <input type="range" min={1} max={50} step={1} value={rad} onChange={e=>setRad(Number(e.target.value))}
            style={{width:'100%',accentColor:'var(--or)',height:4,cursor:'pointer'}}/>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--mu)',marginTop:4}}>
            <span>1 km</span><span>50 km</span>
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-out" style={{flex:1,justifyContent:'center'}} onClick={onClose}>Cancel</button>
          <button className="btn btn-or" style={{position:"relative",overflow:"hidden",flex:2,justifyContent:'center'}} onClick={()=>onSave({lat,lng},rad)}>Save Location</button>
        </div>
      </div>
    </div>
  )
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App(){
  const[user,setUser]=useState(null)
  const[loading,setLoading]=useState(true)
  // page: home | search | shop | product | orders | wishlist | referral | account
  const[page,setPage]=useState('home')
  const[pageData,setPageData]=useState({})
  const[recentlyViewed,setRecentlyViewed]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('dott_rv')||'[]')}catch{return[]}
  })
  const[cart,setCart]=useState(()=>{try{return JSON.parse(localStorage.getItem('dott_cart')||'[]')}catch{return[]}})
  const[showCart,setShowCart]=useState(false)
  const[showCheckout,setShowCheckout]=useState(false)
  const[showAuth,setShowAuth]=useState(false)
  const[authTab,setAuthTab]=useState('login')
  const[orderSuccess,setOrderSuccess]=useState(null)
  const[wishlistIds,setWishlistIds]=useState([])
  const[userLoc,setUserLoc]=useState(null)
  const[searchQuery,setSearchQuery]=useState('')
  const[suggestions,setSuggestions]=useState([])
  const[showSugg,setShowSugg]=useState(false)
  const[showLocMap,setShowLocMap]=useState(false)
  const[radius,setRadius]=useState(15)

  useLeaflet()

  // Persist cart
  useEffect(()=>{try{localStorage.setItem('dott_cart',JSON.stringify(cart))}catch(e){console.warn('Cart save:',e)}},[cart])

  // Boot auth
  useEffect(()=>{
    if(!hasToken()){setLoading(false);return}
    api.me().then(r=>{setUser(r.data);if(r.data.lat)setUserLoc({lat:r.data.lat,lng:r.data.lng})})
      .catch(()=>clearTokens()).finally(()=>setLoading(false))
  },[])

  // Load wishlist IDs
  useEffect(()=>{
    if(!user){setWishlistIds([]);return}
    api.getWishlistIds().then(r=>setWishlistIds(r.data.ids)).catch(()=>{})
  },[user])

  // GPS
  useEffect(()=>{
    if(!userLoc) navigator.geolocation?.getCurrentPosition(p=>{
      const loc={lat:p.coords.latitude,lng:p.coords.longitude}
      setUserLoc(loc)
      if(user) api.updateLocation(loc).catch(()=>{})
    })
  },[])

  // Search suggestions
  useEffect(()=>{
    if(!searchQuery||searchQuery.length<2){setSuggestions([]);return}
    const t=setTimeout(async()=>{
      try{const r=await api.search({q:searchQuery});setSuggestions([...new Set(r.data.results.slice(0,5).map(p=>p.name))])}catch(e){}
    },300)
    return()=>clearTimeout(t)
  },[searchQuery])

  const toggleWishlist=async(productId)=>{
    if(!user){setAuthTab('login');setShowAuth(true);return}
    try{
      const r=await api.toggleWishlist(productId)
      if(r.data.action==='added'){setWishlistIds(ids=>[...ids,productId]);showToast('Saved to wishlist','success')}
      else{setWishlistIds(ids=>ids.filter(id=>id!==productId));showToast('Removed from wishlist','info')}
    }catch(e){}
  }

  const openProduct=useCallback((p)=>{
    setPageData({product:p});setPage('product')
    setRecentlyViewed(prev=>{
      const safe={id:p.id,name:p.name,price:p.price,imageUrl:p.imageUrl,shopId:p.shopId,shopName:p.shopName,avgRating:p.avgRating,reviewCount:p.reviewCount,hasSizes:p.hasSizes,isActive:p.isActive,colors:p.colors,category:p.category}
      const updated=[safe,...prev.filter(x=>x.id!==p.id)].slice(0,10)
      try{localStorage.setItem('dott_rv',JSON.stringify(updated))}catch(e){console.warn('RV save:',e)}
      return updated
    })
  },[])
  const openShop=useCallback((s)=>{setPageData({shop:s});setPage('shop')},[])
  const goHome=()=>{setPage('home');setPageData({})}
  const signOut=async()=>{try{await api.logout()}catch(e){};clearTokens();setUser(null);setWishlistIds([]);setPage('home');showToast('Signed out','info')}

  const doSearch=useCallback((q)=>{setSearchQuery(q);setShowSugg(false);setPageData({query:q});setPage('search')},[])

  const cartCount=cart.reduce((s,i)=>s+i.qty,0)

  const NAV_ITEMS=[
    {id:'home',  icon:<Ic.Home   width={22} height={22}/>, label:'Home'},
    {id:'search',icon:<Ic.Search width={22} height={22}/>, label:'Search'},
    {id:'orders',icon:<Ic.Box    width={22} height={22}/>, label:'Orders'},
    {id:'wishlist',icon:<Ic.Heart width={22} height={22}/>, label:'Wishlist'},
    {id:'account',icon:<Ic.User  width={22} height={22}/>, label:'Account'},
  ]

  if(loading)return(
    <>
      <style>{CSS}</style>
      <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--nv)',flexDirection:'column',gap:14}}>
        <div style={{width:64,height:64,borderRadius:16,background:'var(--or)',display:'flex',alignItems:'center',justifyContent:'center',animation:'float 2s ease infinite',boxShadow:'0 8px 32px rgba(249,115,22,.4)'}}><Ic.Shop width={32} height={32} stroke="#fff"/></div>
        <div style={{fontFamily:'var(--fn)',fontWeight:900,fontSize:28,color:'#fff',letterSpacing:'-1px'}}>DOTT<span style={{color:'var(--or)'}}>.</span></div>
        <div style={{color:'rgba(255,255,255,.45)',fontSize:13,marginTop:4}}>Fashion at your doorstep…</div>
      </div>
    </>
  )

  return(
    <>
      <style>{CSS}</style>

      {/* TOP NAV */}
      <nav className="topnav">
        <div className="topnav-inner">
          <div className="nav-logo" onClick={goHome}>Near<span>Now</span></div>

          {/* Search */}
          <div className="search-box" style={{position:'relative'}}>
            <select className="search-cat">
              <option>All</option>
              {CATS.filter(c=>c.id!=='All').map(c=><option key={c.id}>{c.id}</option>)}
            </select>
            <input className="search-inp" value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setShowSugg(true)}}
              onKeyDown={e=>e.key==='Enter'&&doSearch(searchQuery)} onFocus={()=>setShowSugg(true)}
              placeholder="Search DOTT — fashion, brands, categories…"/>
            <button className="search-btn" onClick={()=>doSearch(searchQuery)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            {showSugg&&suggestions.length>0&&(
              <div className="search-sugg">
                {suggestions.map(s=>(
                  <div key={s} className="ss-row" onClick={()=>doSearch(s)}>
                    <span style={{fontSize:11,fontWeight:700,color:'var(--mu)',textTransform:'uppercase',letterSpacing:'.3px'}}>SEARCH</span>{s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nav actions */}
          <div className="nav-acts">
            <button className="nav-act" onClick={()=>setShowLocMap(true)} title="Set location & radius">
              <span className="nav-act-icon" style={{fontSize:16}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
              </span>
              <span className="nav-act-lbl">{userLoc?`${userLoc.lat?.toFixed(1)}°`:'Location'}</span>
            </button>
            {user?(
              <button className="nav-act" onClick={()=>setPage('account')}>
                <span className="nav-act-icon" style={{width:28,height:28,background:'var(--or)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,color:'#fff'}}>
                  {user.name[0]?.toUpperCase()}
                </span>
                <span className="nav-act-lbl">{user.name.split(' ')[0]}</span>
              </button>
            ):(
              <button className="nav-act" onClick={()=>{setAuthTab('login');setShowAuth(true)}}>
                <span className="nav-act-icon" style={{fontSize:16}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <span className="nav-act-lbl">Sign In</span>
              </button>
            )}
            <button className="nav-act" onClick={()=>user?setPage('wishlist'):(setAuthTab('login'),setShowAuth(true))}>
              <span className="nav-act-icon" style={{fontSize:16,position:'relative'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlistIds.length>0?'#f97316':'none'} stroke={wishlistIds.length>0?'#f97316':'currentColor'} strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                {wishlistIds.length>0&&<span className="nav-badge">{wishlistIds.length}</span>}
              </span>
              <span className="nav-act-lbl">Wishlist</span>
            </button>
            <button className="nav-act" onClick={()=>setShowCart(true)}>
              <span className="nav-act-icon" style={{fontSize:16,position:'relative'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.66a2 2 0 001.99-1.61L23 6H6"/></svg>
                {cartCount>0&&<span className="nav-badge">{cartCount}</span>}
              </span>
              <span className="nav-act-lbl">Cart</span>
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{minHeight:'100vh'}} onClick={()=>setShowSugg(false)}>
        {page==='home'&&(
          <HomePage user={user} userLoc={userLoc} radius={radius} cart={cart} onCartUpdate={setCart}
            onShopOpen={openShop} onProductClick={openProduct} wishlistIds={wishlistIds} onWishlist={toggleWishlist}
            onSearchPage={()=>{setPage('search');setPageData({})}} recentlyViewed={recentlyViewed}/>
        )}
        {page==='search'&&(
          <SearchPagePremium initialQuery={pageData.query} cart={cart} onCartUpdate={setCart} onProductClick={openProduct}
            user={user} wishlistIds={wishlistIds} onWishlist={toggleWishlist} userLoc={userLoc} radius={radius}/>
        )}
        {page==='shop'&&pageData.shop&&(
          <ShopDetail shop={pageData.shop} cart={cart} onCartUpdate={setCart} onBack={goHome}
            user={user} onProductClick={openProduct} wishlistIds={wishlistIds} onWishlist={toggleWishlist}/>
        )}
        {page==='product'&&pageData.product&&(
          <ProductDetail product={pageData.product} shop={null} cart={cart} onCartUpdate={setCart}
            onBack={()=>{setPage(pageData.from||'home');pageData.from=undefined}}
            user={user} wishlisted={wishlistIds.includes(pageData.product.id)} onWishlist={toggleWishlist}
            onProductClick={openProduct} userLoc={userLoc} radius={radius}
            onBuyNow={item=>{
              if(!user){setAuthTab('login');setShowAuth(true);return}
              setCart([item])
              setShowCheckout(true)
            }}/>
        )}
        {page==='orders'&&<OrdersPage user={user} onBuyAgain={(items,shop)=>{setCart(items);setPage('home');showToast('Items added to cart — go to checkout when ready','success')}}/>}
        {page==='wishlist'&&<WishlistPage user={user} cart={cart} onCartUpdate={setCart} onProductClick={openProduct} wishlistIds={wishlistIds} onWishlist={toggleWishlist}/>}
        {page==='referral'&&<ReferralPage user={user}/>}
        {page==='account'&&<AccountPage user={user} onSignOut={signOut} onOpenAuth={()=>{setAuthTab('login');setShowAuth(true)}} onNavigate={setPage}/>}
      </main>

      {/* Bottom nav (mobile) */}
      <nav style={{display:'none',position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:'1px solid var(--br)',zIndex:300,padding:'6px 0'}} id="bottom-nav">
        <div style={{display:'flex',justifyContent:'space-around'}}>
          {NAV_ITEMS.map(n=>(
            <button key={n.id} onClick={()=>{if((n.id==='orders'||n.id==='wishlist')&&!user){setAuthTab('login');setShowAuth(true);return}setPage(n.id)}}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'5px 14px',cursor:'pointer',color:page===n.id?'var(--or)':'var(--mu)',transition:'.15s',border:'none',background:'transparent'}}>
              <span style={{fontSize:22,position:'relative'}}>{n.icon}{n.id==='wishlist'&&wishlistIds.length>0&&<span className="nav-badge">{wishlistIds.length}</span>}</span>
              <span style={{fontSize:10,fontWeight:700}}>{n.label}</span>
            </button>
          ))}
          <button onClick={()=>setShowCart(true)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'5px 14px',cursor:'pointer',color:'var(--mu)',border:'none',background:'transparent'}}>
            <span style={{fontSize:22,position:'relative'}}>CART{cartCount>0&&<span className="nav-badge">{cartCount}</span>}</span>
            <span style={{fontSize:10,fontWeight:700}}>Cart</span>
          </button>
        </div>
      </nav>

      {/* Overlays */}
      {showCart&&<CartDrawer cart={cart} onUpdate={setCart} onClose={()=>setShowCart(false)} user={user}
        minOrderShop={0}
        onCheckout={()=>{setShowCart(false);user?setShowCheckout(true):(setAuthTab('login'),setShowAuth(true))}}/>}

      {showCheckout&&<CheckoutModal cart={cart} user={user} onClose={()=>setShowCheckout(false)}
        onSuccess={data=>{setCart([]);setShowCheckout(false);setOrderSuccess(data||true);setPage('orders')}}/>}

      {showAuth&&<AuthModal initialTab={authTab} onSuccess={u=>{setUser(u);setShowAuth(false);showToast(`Welcome, ${u.name}!`,'success')}} onClose={()=>setShowAuth(false)}/>}

      {/* Order success */}
      {orderSuccess&&(
        <div style={{position:'fixed',inset:0,zIndex:800,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:16,animation:'fadeIn .2s ease'}}>
          <div style={{background:'#fff',borderRadius:24,padding:32,maxWidth:420,width:'100%',textAlign:'center',animation:'scaleIn .35s cubic-bezier(.22,1,.36,1)',boxShadow:'0 32px 80px rgba(0,0,0,.25)',position:'relative',overflow:'hidden'}}>
            {/* Confetti */}
            {[...Array(14)].map((_,i)=>(
              <div key={i} style={{position:'fixed',width:i%2===0?8:5,height:i%2===0?8:14,borderRadius:i%3===0?'50%':'2px',background:['#f97316','#22c55e','#2563eb','#f59e0b','#7c3aed','#ec4899','#06b6d4'][i%7],left:`${6+i*6.5}%`,top:'-20px',animation:`confetti ${2.5+i*0.15}s ease ${i*0.08}s forwards`,pointerEvents:'none',zIndex:9999}}/>
            ))}
            <div style={{width:80,height:80,borderRadius:'50%',background:'linear-gradient(135deg,#22c55e,#16a34a)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 12px 32px rgba(34,197,94,.35)',animation:'checkBounce .6s cubic-bezier(.22,1,.36,1)'}}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{fontWeight:900,fontSize:26,marginBottom:6,letterSpacing:'-.5px',color:'#0f172a'}}>Order Confirmed!</div>
            <div style={{color:'#64748b',fontSize:14,marginBottom:18,lineHeight:1.6}}>Your order is placed. Delivery guaranteed within 60 minutes.</div>
            <div style={{marginBottom:18}}><DeliveryCountdown placedAt={new Date().toISOString()} /></div>
            {orderSuccess?.total&&(
              <div style={{background:'#f8fafc',borderRadius:'var(--r12)',padding:'13px 16px',marginBottom:18,border:'1px solid var(--br)',textAlign:'left'}}>
                {[{k:'Items',v:`₹${orderSuccess.subtotal}`},{k:'Base delivery',v:`₹${orderSuccess.baseDeliveryFee||20}`},{k:'Distance fee',v:`₹${orderSuccess.distanceFee||0}`},{k:'Surge fee',v:`₹${orderSuccess.surgeFee||0}`},{k:'Delivery total',v:`₹${orderSuccess.deliveryFee}${orderSuccess.deliveryKm?` (${orderSuccess.deliveryKm}km)`:''}`},{k:'Platform fee',v:`₹${orderSuccess.platformFee||PLATFORM_FEE}`},{k:'GST',v:`₹${orderSuccess.gstAmount||0}`}].map(({k,v})=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:13,color:'var(--mu)'}}><span>{k}</span><span style={{fontWeight:700}}>{v}</span></div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:900,fontSize:17,marginTop:8,paddingTop:8,borderTop:'1px solid var(--br)'}}><span>Total</span><span style={{color:'var(--or)'}}>₹{orderSuccess.total}</span></div>
                {orderSuccess.orderCode&&<div style={{marginTop:5,fontSize:11,color:'var(--mu)',textAlign:'center'}}>Order #{orderSuccess.orderCode}</div>}
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-out" style={{flex:1,justifyContent:'center'}} onClick={()=>setOrderSuccess(null)}>Continue Shopping</button>
              <button className="btn btn-or" style={{position:"relative",overflow:"hidden",flex:1,justifyContent:'center'}} onClick={()=>{setOrderSuccess(null);setPage('orders')}}>Track Order</button>
            </div>
          </div>
        </div>
      )}

      {showLocMap&&(
        <MapLocationModal
          currentLat={userLoc?.lat||17.385}
          currentLng={userLoc?.lng||78.4867}
          radius={radius}
          onSave={(coords,rad)=>{
            setUserLoc(coords);setRadius(rad);setShowLocMap(false)
            if(user) api.updateLocation(coords).catch(()=>{})
            showToast(`◎ Location updated · ${rad}km radius`,'success')
          }}
          onClose={()=>setShowLocMap(false)}
        />
      )}

      <Toasts/>
    </>
  )
}
