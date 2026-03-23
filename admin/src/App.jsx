import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8080/api'
const ax = axios.create({ baseURL: BASE })
ax.interceptors.request.use(cfg => {
  const t = localStorage.getItem('dott_admin_access')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
ax.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401) {
    const rt = localStorage.getItem('dott_admin_refresh')
    if (rt) {
      try {
        const r = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rt })
        localStorage.setItem('dott_admin_access', r.data.accessToken)
        localStorage.setItem('dott_admin_refresh', r.data.refreshToken)
        err.config.headers.Authorization = `Bearer ${r.data.accessToken}`
        return ax(err.config)
      } catch {
        localStorage.removeItem('dott_admin_access')
        localStorage.removeItem('dott_admin_refresh')
      }
    }
  }
  return Promise.reject(err)
})

const api = {
  login:          d      => ax.post('/auth/login', d),
  me:             ()     => ax.get('/auth/me'),
  logout:         ()     => ax.post('/auth/logout'),
  stats:          ()     => ax.get('/admin/stats'),
  revenue:        ()     => ax.get('/admin/revenue'),
  users:          ()     => ax.get('/admin/users'),
  blockUser:      (id,v) => ax.patch(`/admin/users/${id}/block`, { isBlocked: v }),
  shops:          ()     => ax.get('/admin/shops'),
  suspendShop:    (id,v) => ax.patch(`/admin/shops/${id}/suspend`, { isSuspended: v }),
  verifyShop:     (id,badge) => ax.post(`/admin/shops/${id}/verify`, { badgeType: badge }),
  verifyRequests: ()     => ax.get('/admin/verify-requests'),
  orders:         p      => ax.get('/admin/orders', { params: p }),
  returns:        ()     => ax.get('/admin/returns'),
  // Promo codes
  listPromos:     ()     => ax.get('/admin/promo'),
  createPromo:    d      => ax.post('/admin/promo', d),
  togglePromo:    id     => ax.patch(`/admin/promo/${id}/toggle`),
  // Commission
  getCommission:  ()     => ax.get('/admin/commission'),
  setCommission:  d      => ax.put('/admin/commission', d),
  // CSV export (window.open triggers download)
  exportOrders:   ()     => { window.open(`${BASE}/admin/export/orders?token=${localStorage.getItem('dott_admin_access')}`, '_blank') },
  exportUsers:    ()     => { window.open(`${BASE}/admin/export/users?token=${localStorage.getItem('dott_admin_access')}`, '_blank') },
}

/* ─── CSS ─────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --primary:#6c47ff;--primary-d:#5535e0;--primary-l:rgba(108,71,255,.1);
  --green:#16a34a;--green-l:#dcfce7;--green-t:#15803d;
  --red:#ef4444;--red-l:#fee2e2;--red-t:#b91c1c;
  --amber:#f59e0b;--amber-l:#fef9c3;--amber-t:#92400e;
  --blue:#3b82f6;--blue-l:#dbeafe;--blue-t:#1d4ed8;
  --orange:#f97316;--orange-l:#fff7ed;--orange-t:#c2410c;
  --purple:#8b5cf6;--purple-l:#ede9fe;--purple-t:#6d28d9;
  --bg:#f4f2ff;--surface:#fff;--border:#e8e4ff;--border2:#f0eeff;
  --text:#1e1b3a;--muted:#6b7280;
  --font:'Plus Jakarta Sans',sans-serif;--body:'Inter',sans-serif;
  --sh-sm:0 1px 4px rgba(108,71,255,.08);
  --sh:0 4px 20px rgba(108,71,255,.12);
  --sh-lg:0 12px 40px rgba(108,71,255,.18);
  --r:14px;--r-sm:10px;--r-lg:20px;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--body)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:#c4b8ff;border-radius:4px}

/* ── ANIMATIONS ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideIn{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
@keyframes scaleIn{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes bgMove{0%{background-position:0 0}100%{background-position:60px 60px}}
@keyframes barGrow{from{width:0}to{width:var(--w)}}
@keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes ripple{0%{transform:scale(0);opacity:.5}100%{transform:scale(3);opacity:0}}

.fade-up{animation:fadeUp .38s cubic-bezier(.22,1,.36,1) both}
.fade-in{animation:fadeIn .28s ease both}
.slide-in{animation:slideIn .32s cubic-bezier(.22,1,.36,1) both}
.scale-in{animation:scaleIn .3s cubic-bezier(.22,1,.36,1) both}
.skeleton{background:linear-gradient(90deg,#ede9ff 25%,#ddd8ff 50%,#ede9ff 75%);background-size:600px 100%;animation:shimmer 1.6s infinite;border-radius:8px}

/* ── LAYOUT ── */
.layout{display:flex;min-height:100vh}

/* ── SIDEBAR ── */
.sidebar{
  width:256px;background:linear-gradient(180deg,#1e1b3a 0%,#2d2a5e 100%);
  display:flex;flex-direction:column;position:fixed;top:0;bottom:0;left:0;z-index:100;
  overflow-y:auto;overflow-x:hidden;
}
.sidebar::-webkit-scrollbar{width:0}
.sb-logo{padding:24px 20px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.sb-logo .brand{font-family:var(--font);font-weight:900;font-size:24px;color:#fff;letter-spacing:-.5px}
.sb-logo .brand span{color:#a78bfa}
.sb-logo .tag{font-size:10px;color:rgba(255,255,255,.3);font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:3px}
.sb-section{padding:16px 12px 0}
.sb-section-label{font-size:9px;font-weight:800;color:rgba(255,255,255,.22);text-transform:uppercase;letter-spacing:1.4px;padding:10px 8px 5px}
.sb-item{
  display:flex;align-items:center;gap:11px;padding:11px 12px;
  border-radius:12px;cursor:pointer;color:rgba(255,255,255,.55);
  font-family:var(--font);font-size:13px;font-weight:600;
  transition:.2s;position:relative;margin-bottom:2px;
}
.sb-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.9)}
.sb-item.active{background:rgba(108,71,255,.3);color:#c4b8ff}
.sb-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:65%;background:#a78bfa;border-radius:0 3px 3px 0}
.sb-item svg{width:18px;height:18px;flex-shrink:0;opacity:.8}
.sb-item.active svg{opacity:1}
.sb-badge{margin-left:auto;font-size:10px;font-weight:900;padding:2px 7px;border-radius:100px;min-width:18px;text-align:center}
.sb-bottom{padding:14px 12px 20px;border-top:1px solid rgba(255,255,255,.07);margin-top:auto}
.sb-admin-card{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05);margin-bottom:10px}
.sb-avatar{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6c47ff,#a78bfa);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#fff;flex-shrink:0}

/* ── MAIN ── */
.main{margin-left:256px;flex:1;display:flex;flex-direction:column;min-height:100vh}

/* ── TOPBAR ── */
.topbar{
  background:var(--surface);border-bottom:1.5px solid var(--border2);
  padding:0 28px;height:64px;display:flex;align-items:center;justify-content:space-between;
  position:sticky;top:0;z-index:50;box-shadow:var(--sh-sm);
}
.topbar-left{display:flex;align-items:center;gap:12px}
.topbar-title{font-family:var(--font);font-size:20px;font-weight:800;color:var(--text)}
.topbar-right{display:flex;align-items:center;gap:12px}
.live-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite}

/* ── PAGE ── */
.page{padding:28px;animation:fadeIn .3s ease}
.page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:26px;gap:12px}
.page-title{font-family:var(--font);font-size:24px;font-weight:900;color:var(--text)}
.page-sub{color:var(--muted);font-size:13px;margin-top:4px}

/* ── STAT CARDS ── */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
.stat-card{
  background:var(--surface);border-radius:var(--r);border:1.5px solid var(--border2);
  padding:22px;position:relative;overflow:hidden;transition:.25s;cursor:default;
}
.stat-card:hover{transform:translateY(-4px);box-shadow:var(--sh);border-color:var(--border)}
.stat-card::after{content:'';position:absolute;top:-20px;right:-20px;width:90px;height:90px;border-radius:50%;opacity:.07}
.stat-icon{font-size:28px;margin-bottom:12px;display:block}
.stat-val{font-family:var(--font);font-size:30px;font-weight:900;line-height:1;margin-bottom:5px;animation:countUp .5s ease both}
.stat-label{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
.stat-sub{font-size:12px;color:var(--muted);margin-top:6px;display:flex;align-items:center;gap:4px}
.stat-trend{font-size:11px;font-weight:800;padding:2px 7px;border-radius:100px}
.trend-up{background:#dcfce7;color:#15803d}
.trend-down{background:#fee2e2;color:#b91c1c}

/* ── CARDS ── */
.card{background:var(--surface);border-radius:var(--r);border:1.5px solid var(--border2);padding:20px;box-shadow:var(--sh-sm);transition:.22s}
.card:hover{box-shadow:var(--sh)}
.card-title{font-family:var(--font);font-weight:800;font-size:15px;margin-bottom:16px;color:var(--text);display:flex;align-items:center;gap:8px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px}

/* ── TABLE ── */
.table-wrap{background:var(--surface);border-radius:var(--r);border:1.5px solid var(--border2);overflow:hidden;box-shadow:var(--sh-sm)}
.table-toolbar{padding:16px 20px;border-bottom:1.5px solid var(--border2);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.table-head{display:grid;padding:12px 20px;background:var(--bg);border-bottom:1.5px solid var(--border2)}
.th{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.7px}
.table-row{display:grid;padding:14px 20px;border-bottom:1px solid var(--border2);align-items:center;transition:.15s}
.table-row:last-child{border-bottom:none}
.table-row:hover{background:var(--bg)}

/* ── FORMS / INPUTS ── */
.input{width:100%;padding:10px 14px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-family:var(--body);font-size:14px;outline:none;transition:.2s}
.input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(108,71,255,.1)}
.input::placeholder{color:#bbb}
.search-input{padding:9px 14px 9px 38px;border-radius:100px;font-size:13px;min-width:220px}
.search-wrap{position:relative}
.search-wrap svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--muted)}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 18px;border-radius:10px;border:none;cursor:pointer;font-family:var(--font);font-weight:700;font-size:13px;transition:.22s;position:relative;overflow:hidden;white-space:nowrap}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-primary{background:linear-gradient(135deg,#6c47ff,#8b5cf6);color:#fff;box-shadow:0 4px 14px rgba(108,71,255,.3)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(108,71,255,.4)}
.btn-success{background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff}
.btn-success:hover{transform:translateY(-1px)}
.btn-danger{background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff}
.btn-danger:hover{transform:translateY(-1px)}
.btn-ghost{background:var(--surface);color:var(--text);border:1.5px solid var(--border)}
.btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
.btn-sm{padding:6px 12px;font-size:12px;border-radius:8px}
.btn-icon{width:34px;height:34px;padding:0;border-radius:9px}

/* ── BADGES ── */
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:800;font-family:var(--font);white-space:nowrap}
.badge-success{background:var(--green-l);color:var(--green-t)}
.badge-danger{background:var(--red-l);color:var(--red-t)}
.badge-warning{background:var(--amber-l);color:var(--amber-t)}
.badge-info{background:var(--blue-l);color:var(--blue-t)}
.badge-purple{background:var(--purple-l);color:var(--purple-t)}.badge-muted{background:#f1f5f9;color:#64748b}
.badge-orange{background:var(--orange-l);color:var(--orange-t)}
.badge-gray{background:#f3f4f6;color:#374151}

/* ── TOGGLE ── */
.toggle{width:42px;height:23px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:.25s;flex-shrink:0}
.toggle::after{content:'';position:absolute;width:17px;height:17px;border-radius:50%;background:#fff;top:3px;transition:.25s;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.toggle.on{background:var(--green)}.toggle.on::after{left:22px}
.toggle.off{background:#d1d5db}.toggle.off::after{left:3px}

/* ── CHART BAR ── */
.bar-chart{display:flex;align-items:flex-end;gap:8px;height:120px;padding:0 4px}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.bar-fill{width:100%;background:linear-gradient(180deg,#8b5cf6,#6c47ff);border-radius:6px 6px 0 0;transition:height .6s cubic-bezier(.22,1,.36,1);min-height:4px;position:relative;cursor:pointer}
.bar-fill:hover{background:linear-gradient(180deg,#a78bfa,#7c3aed);transform:scaleY(1.03);transform-origin:bottom}
.bar-fill::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#1e1b3a;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap;opacity:0;transition:.15s;pointer-events:none}
.bar-fill:hover::after{opacity:1}
.bar-label{font-size:10px;color:var(--muted);font-weight:700;text-align:center}
.bar-val{font-size:10px;font-weight:800;color:var(--primary)}

/* ── AUTH ── */
.auth-page{min-height:100vh;display:flex;background:#1e1b3a;position:relative;overflow:hidden}
.auth-bg-dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(108,71,255,.25) 1px,transparent 1px);background-size:28px 28px;animation:bgMove 10s linear infinite;pointer-events:none}
.auth-glow{position:absolute;border-radius:50%;pointer-events:none}
.auth-form-wrap{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:100%;padding:24px}

/* ── MODAL ── */
.modal-overlay{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease;backdrop-filter:blur(4px)}
.modal{background:var(--surface);border-radius:var(--r-lg);padding:28px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;animation:scaleIn .25s cubic-bezier(.22,1,.36,1);box-shadow:0 24px 64px rgba(0,0,0,.2)}

/* ── MISC ── */
.divider{height:1px;background:var(--border2);margin:16px 0}
.empty{text-align:center;padding:60px 20px;color:var(--muted)}
.empty-icon{font-size:48px;margin-bottom:14px;display:block;animation:float 3s ease-in-out infinite}
.toast-wrap{position:fixed;top:20px;right:24px;z-index:999;display:flex;flex-direction:column;gap:8px}
.toast{padding:12px 20px;border-radius:12px;font-size:13px;font-weight:700;animation:slideIn .3s ease;box-shadow:var(--sh-lg);max-width:320px;border-left:4px solid transparent;font-family:var(--font)}
.toast.success{background:#f0fdf4;color:#15803d;border-color:#16a34a}
.toast.error{background:#fef2f2;color:#b91c1c;border-color:#ef4444}
.toast.info{background:#eff6ff;color:#1d4ed8;border-color:#3b82f6}
.tag{display:inline-flex;align-items:center;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700}

/* ── ACTIVITY FEED ── */
.activity-item{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border2)}
.activity-item:last-child{border-bottom:none}
.activity-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:4px}
.activity-text{font-size:13px;color:var(--text);line-height:1.5}
.activity-time{font-size:11px;color:var(--muted);margin-top:2px}

/* ── STATUS MAP ── */
.status-pill{padding:4px 12px;border-radius:100px;font-size:11px;font-weight:800;font-family:var(--font)}

/* ── RESPONSIVE ── */
@media(max-width:1100px){.stats-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.sidebar{width:70px}.sb-item span,.sb-section-label,.sb-logo .brand,.sb-logo .tag,.sb-admin-card div{display:none}.main{margin-left:70px}.stats-grid{grid-template-columns:1fr 1fr}.two-col{grid-template-columns:1fr}}
`

/* ── STATUS COLORS ── */
const SC = { PENDING:'#f59e0b', CONFIRMED:'#3b82f6', PACKING:'#8b5cf6', PICKED_UP:'#06b6d4', OUT_FOR_DELIVERY:'#f97316', DELIVERED:'#22c55e', CANCELLED:'#ef4444' }
const SL = { PENDING:'Pending', CONFIRMED:'Confirmed', PACKING:'Packing', PICKED_UP:'Picked Up', OUT_FOR_DELIVERY:'Out for Delivery', DELIVERED:'Delivered', CANCELLED:'Cancelled' }
const RL = { REQUESTED:'Requested', APPROVED:'Approved', REJECTED:'Rejected', PICKED_UP:'Collected', REFUNDED:'Refunded' }
const RC = { REQUESTED:'#f59e0b', APPROVED:'#22c55e', REJECTED:'#ef4444', PICKED_UP:'#0ea5e9', REFUNDED:'#8b5cf6' }

/* ── ICONS ── */
const I = {
  Dashboard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  Users:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Shops:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Orders:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  Revenue:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  Riders:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-3l-3 8M6 17.5L9 10l4-2h3l2 3.5"/></svg>,
  Returns:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  Search:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Logout:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  Close:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Refresh:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  Shield:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Eye:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Block:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  Check:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Bell:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Analytics: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  Settings:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Nav:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>,
}

/* ── TOAST ── */
let _setToasts, _tid = 0
function toast(msg, type = 'info') {
  if (_setToasts) { const id = ++_tid; _setToasts(t => [...t, { id, msg, type }]); setTimeout(() => _setToasts(t => t.filter(x => x.id !== id)), 3000) }
}
function Toasts() {
  const [ts, setTs] = useState([]); _setToasts = setTs
  return <div className="toast-wrap">{ts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}</div>
}

/* ════════════════════════════════════════════════════════════
   AUTH PAGE
════════════════════════════════════════════════════════════ */
function AuthPage({ onSuccess }) {
  const [email, setEmail] = useState('admin@dott.in')
  const [pass, setPass] = useState('password123')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr(''); setLoading(true)
    try {
      const r = await api.login({ email, password: pass })
      if (r.data.user.role !== 'ADMIN') { setErr('Access denied — Admin only'); setLoading(false); return }
      localStorage.setItem('dott_admin_access', r.data.accessToken)
      localStorage.setItem('dott_admin_refresh', r.data.refreshToken)
      onSuccess(r.data.user)
    } catch (e) { setErr(e.response?.data?.detail || 'Invalid credentials') }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-dots" />
      <div className="auth-glow" style={{ top: '-20%', left: '-10%', width: '60%', height: '70%', background: 'radial-gradient(circle,rgba(108,71,255,.15),transparent 70%)' }} />
      <div className="auth-glow" style={{ bottom: '-20%', right: '-10%', width: '50%', height: '60%', background: 'radial-gradient(circle,rgba(167,139,250,.1),transparent 70%)' }} />

      <div className="auth-form-wrap">
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 56, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>🛡️</div>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 32, color: '#fff', letterSpacing: '-.5px' }}>
              DOTT <span style={{ color: '#a78bfa' }}>Admin</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 14, marginTop: 6 }}>Platform Control Center</div>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
            {['📊 Live Analytics', '👥 User Management', '🏪 Shop Control', '🚴 Rider Tracking', '📦 Order Monitor'].map(f => (
              <span key={f} style={{ background: 'rgba(108,71,255,.15)', border: '1px solid rgba(108,71,255,.25)', color: 'rgba(255,255,255,.7)', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 100 }}>{f}</span>
            ))}
          </div>

          {/* Form card */}
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: 28, backdropFilter: 'blur(12px)', animation: 'scaleIn .4s cubic-bezier(.22,1,.36,1)' }}>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 20 }}>Sign in to Dashboard</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.7px', display: 'block', marginBottom: 6 }}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'var(--body)' }}
                  onFocus={e => e.target.style.borderColor = '#a78bfa'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.12)'} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.7px', display: 'block', marginBottom: 6 }}>Password</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'var(--body)' }}
                  onFocus={e => e.target.style.borderColor = '#a78bfa'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.12)'} />
              </div>

              {err && <div style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>{err}</div>}

              <button className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 4 }} onClick={submit} disabled={loading}>
                {loading
                  ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Signing in...</>
                  : <><I.Shield /> Enter Admin Panel</>}
              </button>

              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 12 }}>
                Demo: admin@dott.in / password123
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   DASHBOARD — LIVE MEMBERS & PLATFORM STATS
════════════════════════════════════════════════════════════ */
function Dashboard() {
  const [stats, setStats] = useState(null)
  const [revenue, setRevenue] = useState(null)
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    try {
      const [s, r, o, u] = await Promise.all([api.stats(), api.revenue(), api.orders(), api.users()])
      setStats(s.data); setRevenue(r.data)
      setOrders(o.data); setUsers(u.data)
      setLastUpdated(new Date())
    } catch (e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])

  const riders    = users.filter(u => u.role === 'RIDER')
  const vendors   = users.filter(u => u.role === 'OWNER')
  const customers = users.filter(u => u.role === 'CUSTOMER')
  const online    = riders.filter(u => u.isOnline)
  const maxRev    = revenue?.daily ? Math.max(...revenue.daily.map(d => d.revenue), 1) : 1

  const Num = ({ val, color = 'var(--primary)' }) => (
    <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 36, color, lineHeight: 1, letterSpacing: '-1.5px' }}>
      {loading ? <div className="skeleton" style={{ height: 36, width: 72, borderRadius: 6 }} /> : val}
    </div>
  )

  const MiniBar = ({ pct, color }) => (
    <div style={{ height: 4, background: 'var(--border2)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
      <div style={{ height: '100%', background: color, borderRadius: 2, width: `${pct}%`, transition: 'width 1s ease' }} />
    </div>
  )

  const total = users.length || 1

  return (
    <div className="page">

      {/* ── LIVE HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg,#1e1b3a,#312e81)', borderRadius: 18, padding: '22px 26px', marginBottom: 24, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px)', backgroundSize: '22px 22px' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 20, letterSpacing: '-.5px' }}>Live Platform Dashboard</div>
            <div style={{ opacity: .6, fontSize: 12, marginTop: 4 }}>
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Loading...'} · Auto-refreshes every 15s
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 100, padding: '5px 13px', fontSize: 12, fontWeight: 800, color: '#4ade80' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} /> LIVE
            </div>
            <button onClick={load} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)' }}>↻ Refresh</button>
          </div>
        </div>
      </div>

      {/* ── TOTAL MEMBERS — BIG HERO NUMBER ── */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid var(--border)', padding: '24px 28px', marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>Total Members on Platform</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 56, color: 'var(--primary)', lineHeight: 1, letterSpacing: '-2px' }}>
              {loading ? '—' : (stats?.users || users.length).toLocaleString('en-IN')}
            </div>
            {stats?.newToday > 0 && (
              <div style={{ background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 100, border: '1px solid #bbf7d0' }}>
                +{stats.newToday} today
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            {stats?.newThisWeek || 0} new members this week · {stats?.blockedUsers || 0} blocked
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, minWidth: 320 }}>
          {[
            { label: 'Customers', count: stats?.customers ?? customers.length, color: '#6c47ff', pct: (stats?.customers ?? customers.length) / total * 100 },
            { label: 'Vendors',   count: stats?.vendors   ?? vendors.length,   color: '#f97316', pct: (stats?.vendors   ?? vendors.length)   / total * 100 },
            { label: 'Riders',    count: stats?.riders    ?? riders.length,    color: '#22c55e', pct: (stats?.riders    ?? riders.length)    / total * 100 },
          ].map(({ label, count, color, pct }) => (
            <div key={label} style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 28, color, lineHeight: 1, marginBottom: 4 }}>{loading ? '—' : count}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
              <div style={{ height: 3, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: color, borderRadius: 2, width: `${Math.min(pct, 100)}%`, transition: 'width 1s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4 KEY STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Active Orders',  value: stats?.activeOrders  ?? 0, sub: `${stats?.pendingOrders ?? 0} pending`,  color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Today Orders',   value: stats?.todayOrders   ?? 0, sub: `Total: ${stats?.orders ?? 0}`,          color: '#8b5cf6', bg: '#f5f3ff' },
          { label: 'Today Revenue',  value: `₹${(stats?.todayRevenue ?? 0).toLocaleString('en-IN')}`, sub: `All time: ₹${(stats?.revenue ?? 0).toLocaleString('en-IN')}`, color: '#059669', bg: '#f0fdf4' },
          { label: 'Riders Online',  value: stats?.onlineRiders  ?? online.length, sub: `${stats?.riders ?? riders.length} total riders`, color: '#f97316', bg: '#fff7ed' },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${color}20`, padding: '18px 20px', boxShadow: 'var(--shadow-sm)', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 28, color, lineHeight: 1, marginBottom: 4 }}>{loading ? '—' : value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* ── REVENUE CHART ── */}
        <div className="card fade-up" style={{ animationDelay: '.1s' }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Revenue — Last 7 Days</div>
          {revenue?.daily ? (
            <>
              <div className="bar-chart">
                {revenue.daily.map((d, i) => (
                  <div key={i} className="bar-col">
                    <div className="bar-val">₹{d.revenue > 999 ? (d.revenue / 1000).toFixed(1) + 'k' : d.revenue}</div>
                    <div className="bar-fill" style={{ height: `${Math.max((d.revenue / maxRev) * 100, 4)}%` }} />
                    <div className="bar-label">{d.day}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border2)' }}>
                {[{ k: 'This Week', v: `₹${revenue.week?.revenue || 0}` }, { k: 'This Month', v: `₹${revenue.month?.revenue || 0}` }, { k: 'All Time', v: `₹${revenue.allTime?.revenue || 0}` }].map(({ k, v }) => (
                  <div key={k} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 15, color: 'var(--primary)' }}>{v}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.3px' }}>{k}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="skeleton" style={{ height: 160 }} />}
        </div>

        {/* ── RECENT ORDERS ── */}
        <div className="card fade-up" style={{ animationDelay: '.15s' }}>
          <div className="card-title" style={{ marginBottom: 14 }}>Recent Orders</div>
          {orders.slice(0, 6).length === 0
            ? <div className="empty" style={{ padding: '28px 0' }}><div style={{ fontSize: 13 }}>No orders yet</div></div>
            : orders.slice(0, 6).map((o, i) => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 5 ? '1px solid var(--border2)' : 'none' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: SC[o.status] || '#6b7280', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    #{o.orderCode} — {o.customer?.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{o.shop?.name} · ₹{o.total}</div>
                </div>
                <span style={{ background: `${SC[o.status] || '#6b7280'}15`, color: SC[o.status] || '#6b7280', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 100, flexShrink: 0, letterSpacing: '.3px' }}>{SL[o.status]}</span>
              </div>
            ))}
        </div>
      </div>

      {/* ── MEMBER BREAKDOWN TABLE ── */}
      <div className="card fade-up" style={{ animationDelay: '.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Member Breakdown</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Last 15 registrations</div>
        </div>

        {/* Role summary bars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { role: 'Customers', count: stats?.customers ?? customers.length, color: '#6c47ff', icon: 'C', blocked: users.filter(u => u.role === 'CUSTOMER' && u.isBlocked).length },
            { role: 'Vendors',   count: stats?.vendors   ?? vendors.length,   color: '#f97316', icon: 'V', blocked: users.filter(u => u.role === 'OWNER' && u.isBlocked).length },
            { role: 'Riders',    count: stats?.riders    ?? riders.length,    color: '#22c55e', icon: 'R', blocked: users.filter(u => u.role === 'RIDER' && u.isBlocked).length, online: stats?.onlineRiders ?? online.length },
          ].map(({ role, count, color, icon, blocked, online }) => (
            <div key={role} style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px', border: `1px solid ${color}20` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>{icon}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{role}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {blocked > 0 ? `${blocked} blocked` : 'All active'}
                    {online !== undefined && ` · ${online} online`}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 32, color, lineHeight: 1 }}>{loading ? '—' : count}</div>
              <div style={{ height: 4, background: 'var(--border2)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: color, borderRadius: 2, width: `${Math.min((count / (total || 1)) * 100, 100)}%`, transition: 'width 1.2s ease' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5, fontWeight: 600 }}>
                {total > 0 ? Math.round(count / total * 100) : 0}% of all members
              </div>
            </div>
          ))}
        </div>

        {/* Recent registrations list */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>Recent Registrations</div>
        {users.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8).map((u, i) => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < 7 ? '1px solid var(--border2)' : 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: u.role === 'CUSTOMER' ? '#6c47ff' : u.role === 'OWNER' ? '#f97316' : '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#fff', flexShrink: 0 }}>
              {u.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{u.email} · {u.phone}</div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ background: u.role === 'CUSTOMER' ? '#ede9fe' : u.role === 'OWNER' ? '#fff7ed' : '#f0fdf4', color: u.role === 'CUSTOMER' ? '#6c47ff' : u.role === 'OWNER' ? '#f97316' : '#22c55e', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 100, letterSpacing: '.4px', marginBottom: 3 }}>
                {u.role === 'CUSTOMER' ? 'CUSTOMER' : u.role === 'OWNER' ? 'VENDOR' : 'RIDER'}
              </div>
              {u.isBlocked && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 800 }}>BLOCKED</div>}
              {u.createdAt && <div style={{ fontSize: 9, color: 'var(--muted)' }}>{new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}


/* ════════════════════════════════════════════════════════════
   USERS PAGE
════════════════════════════════════════════════════════════ */
function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [actioning, setActioning] = useState(null)

  const load = async () => { setLoading(true); try { const r = await api.users(); setUsers(r.data) } catch (e) {}; setLoading(false) }
  useEffect(() => { load() }, [])

  const toggleBlock = async (u) => {
    setActioning(u.id)
    try {
      await api.blockUser(u.id, !u.isBlocked)
      toast(u.isBlocked ? `${u.name} unblocked` : `${u.name} blocked`, u.isBlocked ? 'success' : 'error')
      load()
    } catch (e) { toast('Action failed', 'error') }
    setActioning(null)
  }

  const ROLES = ['ALL', 'CUSTOMER', 'OWNER', 'RIDER', 'ADMIN']
  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search)
    return matchRole && matchSearch
  })

  const ROLE_COLORS = { CUSTOMER: 'badge-info', OWNER: 'badge-orange', RIDER: 'badge-success', ADMIN: 'badge-purple' }

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Users</div><div className="page-sub">{users.length} total registered users</div></div>
        <button className="btn btn-ghost btn-sm" onClick={load}><I.Refresh /> Refresh</button>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ROLES.map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className="btn btn-sm"
                style={{ background: roleFilter === r ? 'var(--primary-l)' : 'var(--surface)', color: roleFilter === r ? 'var(--primary)' : 'var(--muted)', border: `1.5px solid ${roleFilter === r ? 'var(--primary)' : 'var(--border)'}` }}>
                {r} {r !== 'ALL' && <span style={{ fontWeight: 900 }}>({users.filter(u => u.role === r).length})</span>}
              </button>
            ))}
          </div>
          <div className="search-wrap">
            <I.Search />
            <input className="input search-input" placeholder="Search name, email, phone…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-head" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 100px' }}>
          <span className="th">Name</span><span className="th">Email</span><span className="th">Role</span>
          <span className="th">Status</span><span className="th">Online</span><span className="th">Action</span>
        </div>

        {loading ? [...Array(5)].map((_, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 100px' }}>
            {[...Array(6)].map((_, j) => <div key={j} className="skeleton" style={{ height: 16 }} />)}
          </div>
        )) : filtered.length === 0 ? (
          <div className="empty"><span className="empty-icon">👥</span><div>No users found</div></div>
        ) : filtered.map((u, i) => (
          <div key={u.id} className="table-row fade-up" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 100px', animationDelay: `${i * 0.03}s` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{u.phone || 'No phone'}</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            <span className={`badge ${ROLE_COLORS[u.role] || 'badge-gray'}`}>{u.role}</span>
            <span className={`badge ${u.isBlocked ? 'badge-danger' : 'badge-success'}`}>{u.isBlocked ? 'Blocked' : 'Active'}</span>
            <span style={{ fontSize: 12, color: u.isOnline ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>{u.isOnline ? '● Online' : '○ Offline'}</span>
            <button className={`btn btn-sm ${u.isBlocked ? 'btn-success' : 'btn-danger'}`}
              disabled={actioning === u.id || u.role === 'ADMIN'}
              onClick={() => toggleBlock(u)}>
              {actioning === u.id ? '...' : u.isBlocked ? 'Unblock' : 'Block'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   SHOPS PAGE
════════════════════════════════════════════════════════════ */
function ShopsPage() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actioning, setActioning] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = async () => { setLoading(true); try { const r = await api.shops(); setShops(r.data) } catch (e) {}; setLoading(false) }
  useEffect(() => { load() }, [])

  const toggleSuspend = async (s) => {
    setActioning(s.id)
    try {
      await api.suspendShop(s.id, !s.isSuspended)
      toast(s.isSuspended ? `${s.name} restored` : `${s.name} suspended`, s.isSuspended ? 'success' : 'error')
      load()
    } catch (e) { toast('Failed', 'error') }
    setActioning(null)
  }

  const filtered = shops.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Shops</div><div className="page-sub">{shops.length} registered shops</div></div>
        <button className="btn btn-ghost btn-sm" onClick={load}><I.Refresh /> Refresh</button>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-success">{shops.filter(s => s.isOpen && !s.isSuspended).length} Open</span>
            <span className="badge badge-danger">{shops.filter(s => s.isSuspended).length} Suspended</span>
            <span className="badge badge-warning">{shops.filter(s => !s.isOpen && !s.isSuspended).length} Closed</span>
          </div>
          <div className="search-wrap">
            <I.Search />
            <input className="input search-input" placeholder="Search shops…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px 110px' }}>
          <span className="th">Shop</span><span className="th">Category</span><span className="th">Rating</span>
          <span className="th">Orders</span><span className="th">Status</span><span className="th">Open</span><span className="th">Action</span>
        </div>

        {loading ? [...Array(5)].map((_, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px 110px' }}>
            {[...Array(7)].map((_, j) => <div key={j} className="skeleton" style={{ height: 16 }} />)}
          </div>
        )) : filtered.map((s, i) => (
          <div key={s.id} className="table-row fade-up" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px 110px', animationDelay: `${i * 0.03}s` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {s.imageUrl
                ? <img src={s.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏪</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{s.ownerName}</div>
              </div>
            </div>
            <span className="tag" style={{ background: 'var(--orange-l)', color: 'var(--orange-t)', fontSize: 11 }}>{s.category}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>⭐ {s.rating?.toFixed(1) || 'New'} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({s.ratingCount})</span></span>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.totalOrders}</span>
            <span className={`badge ${s.isSuspended ? 'badge-danger' : 'badge-success'}`}>{s.isSuspended ? 'Suspended' : 'Active'}</span>
            <span style={{ fontSize: 12, color: s.isOpen ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>{s.isOpen ? '● Open' : '○ Closed'}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-icon" title="View details" onClick={() => setSelected(s)}><I.Eye /></button>
              <button className={`btn btn-sm ${s.isSuspended ? 'btn-success' : 'btn-danger'}`}
                disabled={actioning === s.id} onClick={() => toggleSuspend(s)}>
                {actioning === s.id ? '...' : s.isSuspended ? 'Restore' : 'Suspend'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Shop detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 18 }}>🏪 {selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><I.Close /></button>
            </div>
            {selected.imageUrl && <img src={selected.imageUrl} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[{k:'Owner',v:selected.ownerName}, {k:'Category',v:selected.category}, {k:'City',v:selected.city}, {k:'Phone',v:selected.phone || '—'}, {k:'Rating',v:`⭐ ${selected.rating?.toFixed(1) || 'New'} (${selected.ratingCount} reviews)`}, {k:'Total Orders',v:selected.totalOrders}, {k:'Delivery Time',v:`${selected.deliveryTime} min`}, {k:'Min Order',v:`₹${selected.minOrder}`}, {k:'Returns',v:selected.acceptsReturns ? `✅ ${selected.returnDays} days` : '❌ No returns'}].map(({k, v}) => (
                <div key={k} style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px' }}>{k}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 3 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              📍 {selected.address}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSelected(null)}>Close</button>
              <button className={`btn ${selected.isSuspended ? 'btn-success' : 'btn-danger'}`} style={{ flex: 1 }}
                disabled={actioning === selected.id}
                onClick={() => { toggleSuspend(selected); setSelected(null) }}>
                {selected.isSuspended ? '✓ Restore Shop' : '⚠ Suspend Shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   ORDERS PAGE
════════════════════════════════════════════════════════════ */
function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [timingFilter, setTimingFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (timingFilter === 'ON_TIME') params.timing = 'on_time'
      if (timingFilter === 'LATE') params.timing = 'late'
      const r = await api.orders(params)
      setOrders(r.data)
    } catch (e) {}
    setLoading(false)
  }
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [timingFilter])

  const STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'PACKING', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']
  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter
    const matchTiming = timingFilter === 'ALL' || (timingFilter === 'ON_TIME' ? !o.isDelayed : !!o.isDelayed)
    const matchSearch = !search || o.orderCode?.includes(search) || o.customer?.name?.toLowerCase().includes(search.toLowerCase()) || o.shop?.name?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchTiming && matchSearch
  })

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">All Orders</div><div className="page-sub">{orders.length} total · Live updates every 15s</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green)', fontWeight: 700 }}><div className="live-dot" /> Live</div>
          <button className="btn btn-ghost btn-sm" onClick={load}><I.Refresh /></button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar" style={{ flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className="btn btn-sm"
                style={{ background: statusFilter === s ? `${SC[s] || 'var(--primary)'}18` : 'var(--surface)', color: statusFilter === s ? (SC[s] || 'var(--primary)') : 'var(--muted)', border: `1.5px solid ${statusFilter === s ? (SC[s] || 'var(--primary)') : 'var(--border)'}` }}>
                {s === 'ALL' ? 'All' : SL[s]} {s !== 'ALL' && <span style={{ fontWeight: 900 }}>({orders.filter(o => o.status === s).length})</span>}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['ALL','ON_TIME','LATE'].map(s => (
              <button key={s} onClick={() => setTimingFilter(s)} className="btn btn-sm"
                style={{ background: timingFilter === s ? `${s === 'LATE' ? '#ef4444' : s === 'ON_TIME' ? '#22c55e' : 'var(--primary)'}18` : 'var(--surface)', color: timingFilter === s ? (s === 'LATE' ? '#ef4444' : s === 'ON_TIME' ? '#22c55e' : 'var(--primary)') : 'var(--muted)', border: `1.5px solid ${timingFilter === s ? (s === 'LATE' ? '#ef4444' : s === 'ON_TIME' ? '#22c55e' : 'var(--primary)') : 'var(--border)'}` }}>
                {s === 'ALL' ? 'All timing' : s === 'ON_TIME' ? 'On time' : 'Late'}
              </button>
            ))}
          </div>
          <div className="search-wrap" style={{ maxWidth: 300 }}>
            <I.Search />
            <input className="input search-input" placeholder="Search order code, customer, shop…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-head" style={{ gridTemplateColumns: '130px 2fr 2fr 1fr 1fr 1fr' }}>
          <span className="th">Order Code</span><span className="th">Customer</span><span className="th">Shop</span>
          <span className="th">Total</span><span className="th">Status</span><span className="th">Time</span>
        </div>

        {loading ? [...Array(6)].map((_, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: '130px 2fr 2fr 1fr 1fr 1fr' }}>
            {[...Array(6)].map((_, j) => <div key={j} className="skeleton" style={{ height: 16 }} />)}
          </div>
        )) : filtered.length === 0 ? (
          <div className="empty"><span className="empty-icon">📦</span><div>No orders found</div></div>
        ) : filtered.map((o, i) => (
          <div key={o.id} className="table-row fade-up" style={{ gridTemplateColumns: '130px 2fr 2fr 1fr 1fr 1fr', animationDelay: `${i * 0.02}s`, cursor: 'pointer' }} onClick={() => setSelected(o)}>
            <span style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 13, color: 'var(--primary)' }}>#{o.orderCode}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.customer?.phone}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.shop?.name}</div>
            <span style={{ fontFamily: 'var(--font)', fontWeight: 800, color: 'var(--primary)' }}>₹{o.total}</span>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <span className="status-pill" style={{ background: `${SC[o.status]}18`, color: SC[o.status] }}>{SL[o.status]}</span>
              {o.status === 'DELIVERED' && <span className="status-pill" style={{ background: o.isDelayed ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)', color: o.isDelayed ? '#ef4444' : '#22c55e' }}>{o.isDelayed ? 'Late' : 'On time'}</span>}
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{o.placedAt ? new Date(o.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
          </div>
        ))}
      </div>

      {/* Order detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 18 }}>Order #{selected.orderCode}</div>
                <span className="status-pill" style={{ background: `${SC[selected.status]}18`, color: SC[selected.status], marginTop: 6, display: 'inline-block' }}>{SL[selected.status]}</span>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><I.Close /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[{k:'Customer',v:selected.customer?.name}, {k:'Phone',v:selected.customer?.phone}, {k:'Shop',v:selected.shop?.name}, {k:'Payment',v:selected.paymentMethod?.toUpperCase()}, {k:'Subtotal',v:`₹${selected.subtotal}`}, {k:'Delivery Fee',v:`₹${selected.deliveryFee}`}, {k:'Total',v:`₹${selected.total}`}, {k:'Rider',v:selected.rider?.name || 'Not assigned'}].map(({k, v}) => (
                <div key={k} style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 3 }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Items</div>
              {selected.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{item.name}{item.size ? ` (${item.size})` : ''} ×{item.qty}</span>
                  <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{item.price * item.qty}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>📍 {selected.deliveryAddress}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   RIDERS PAGE
════════════════════════════════════════════════════════════ */
function RidersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)

  const load = async () => { setLoading(true); try { const r = await api.users(); setUsers(r.data.filter(u => u.role === 'RIDER')) } catch (e) {}; setLoading(false) }
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [])

  const toggleBlock = async (u) => {
    setActioning(u.id)
    try { await api.blockUser(u.id, !u.isBlocked); toast(u.isBlocked ? `${u.name} unblocked` : `${u.name} blocked`, u.isBlocked ? 'success' : 'error'); load() }
    catch (e) { toast('Failed', 'error') }
    setActioning(null)
  }

  const online = users.filter(u => u.isOnline)
  const offline = users.filter(u => !u.isOnline)

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Riders</div><div className="page-sub">{users.length} total · {online.length} online now</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green)', fontWeight: 700 }}><div className="live-dot" /> Live</div>
          <button className="btn btn-ghost btn-sm" onClick={load}><I.Refresh /></button>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Online Now', val: online.length, color: '#22c55e', icon: '🟢' },
          { label: 'Offline', val: offline.length, color: 'var(--muted)', icon: '⚫' },
          { label: 'Blocked', val: users.filter(u => u.isBlocked).length, color: '#ef4444', icon: '🚫' },
        ].map((s, i) => (
          <div key={s.label} className="card fade-up" style={{ animationDelay: `${i * 0.07}s`, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 28, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Online riders */}
      {online.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 15, marginBottom: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="live-dot" /> Online Riders ({online.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {online.map((u, i) => (
              <div key={u.id} className="card fade-up" style={{ animationDelay: `${i * 0.05}s`, borderLeft: '3px solid var(--green)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#fff', flexShrink: 0 }}>{u.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{u.phone || u.email}</div>
                    {u.lat && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>📍 {u.lat?.toFixed(3)}, {u.lng?.toFixed(3)}</div>}
                  </div>
                  <span className="badge badge-success">● Online</span>
                </div>
                {!u.isBlocked && (
                  <button className="btn btn-danger btn-sm" style={{ width: '100%', marginTop: 10 }} disabled={actioning === u.id} onClick={() => toggleBlock(u)}>
                    Block Rider
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All riders table */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <div style={{ fontWeight: 700, fontSize: 14 }}>All Riders</div>
        </div>
        <div className="table-head" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 100px' }}>
          <span className="th">Rider</span><span className="th">Contact</span><span className="th">Status</span>
          <span className="th">Online</span><span className="th">Location</span><span className="th">Action</span>
        </div>
        {loading ? [...Array(4)].map((_, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 100px' }}>
            {[...Array(6)].map((_, j) => <div key={j} className="skeleton" style={{ height: 16 }} />)}
          </div>
        )) : users.map((u, i) => (
          <div key={u.id} className="table-row fade-up" style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 100px', animationDelay: `${i * 0.04}s` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: u.isOnline ? 'linear-gradient(135deg,#16a34a,#22c55e)' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: u.isOnline ? '#fff' : '#9ca3af', flexShrink: 0 }}>{u.name[0]}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
            </div>
            <div><div style={{ fontSize: 13 }}>{u.email}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.phone}</div></div>
            <span className={`badge ${u.isBlocked ? 'badge-danger' : 'badge-success'}`}>{u.isBlocked ? 'Blocked' : 'Active'}</span>
            <span style={{ fontSize: 12, color: u.isOnline ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>{u.isOnline ? '● Online' : '○ Offline'}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{u.lat ? `${u.lat?.toFixed(2)}…` : 'Unknown'}</span>
            <button className={`btn btn-sm ${u.isBlocked ? 'btn-success' : 'btn-danger'}`}
              disabled={actioning === u.id} onClick={() => toggleBlock(u)}>
              {actioning === u.id ? '...' : u.isBlocked ? 'Unblock' : 'Block'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   REVENUE PAGE
════════════════════════════════════════════════════════════ */
function RevenuePage() {
  const [revenue, setRevenue] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.revenue().then(r => setRevenue(r.data)).catch(() => {}).finally(() => setLoading(false)) }, [])

  const maxRev = revenue?.daily ? Math.max(...revenue.daily.map(d => d.revenue), 1) : 1

  const PERIODS = [
    { label: 'Today', key: 'today', icon: '☀️', color: '#6c47ff' },
    { label: 'This Week', key: 'week', icon: '📅', color: '#3b82f6' },
    { label: 'This Month', key: 'month', icon: '🗓', color: '#f97316' },
    { label: 'All Time', key: 'allTime', icon: '🏆', color: '#22c55e' },
  ]

  return (
    <div className="page">
      <div className="page-header"><div className="page-title">Revenue Analytics</div></div>

      {/* Period cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {PERIODS.map((p, i) => (
          <div key={p.key} className="stat-card fade-up" style={{ animationDelay: `${i * 0.08}s`, borderTop: `3px solid ${p.color}` }}>
            <span className="stat-icon">{p.icon}</span>
            {loading
              ? <div className="skeleton" style={{ height: 30, width: 80, marginBottom: 8 }} />
              : <div className="stat-val" style={{ color: p.color }}>₹{revenue?.[p.key]?.revenue?.toLocaleString('en-IN') || 0}</div>}
            <div className="stat-label">{p.label}</div>
            <div className="stat-sub">
              <span style={{ fontWeight: 800 }}>{revenue?.[p.key]?.orders || 0}</span> orders
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card fade-up" style={{ animationDelay: '.32s', marginBottom: 20 }}>
        <div className="card-title">📊 Daily Revenue — Last 7 Days</div>
        {revenue?.daily ? (
          <>
            <div className="bar-chart" style={{ height: 180 }}>
              {revenue.daily.map((d, i) => (
                <div key={i} className="bar-col">
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
                    {d.revenue > 999 ? `₹${(d.revenue / 1000).toFixed(1)}k` : `₹${d.revenue}`}
                  </div>
                  <div className="bar-fill" data-tip={`${d.date}: ₹${d.revenue} · ${d.orders} orders`}
                    style={{ height: `${Math.max((d.revenue / maxRev) * 100, 3)}%` }} />
                  <div className="bar-label">{d.day}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600 }}>{d.orders} orders</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border2)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[{k:'Best day this week',v:`₹${Math.max(...(revenue.daily?.map(d => d.revenue) || [0]))}`}, {k:'Avg daily orders',v:`${Math.round((revenue.week?.orders || 0) / 7)}`}, {k:'Avg order value',v:`₹${revenue.allTime?.orders ? Math.round((revenue.allTime?.revenue || 0) / revenue.allTime.orders) : 0}`}].map(({k, v}) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 18, color: 'var(--primary)', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </>
        ) : <div className="skeleton" style={{ height: 200 }} />}
      </div>

      {/* Platform take summary */}
      <div className="two-col">
        <div className="card fade-up" style={{ animationDelay: '.4s' }}>
          <div className="card-title">💰 Platform Summary</div>
          {[
            {k:'Gross Revenue (All Time)',v:`₹${revenue?.allTime?.revenue?.toLocaleString('en-IN') || 0}`},
            {k:'Rider Commissions (8%)',v:`₹${Math.round((revenue?.allTime?.revenue || 0) * 0.08).toLocaleString('en-IN')}`},
            {k:'Net Platform Revenue',v:`₹${Math.round((revenue?.allTime?.revenue || 0) * 0.92).toLocaleString('en-IN')}`},
            {k:'Total Delivered Orders',v:`${revenue?.allTime?.orders || 0} orders`},
          ].map(({k, v}) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border2)', fontSize: 14 }}>
              <span style={{ color: 'var(--muted)' }}>{k}</span>
              <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="card fade-up" style={{ animationDelay: '.46s' }}>
          <div className="card-title">📈 Performance</div>
          {[
            {label:'Orders this week', current:revenue?.week?.orders||0, total:revenue?.allTime?.orders||0},
            {label:'Revenue this week', current:revenue?.week?.revenue||0, total:revenue?.allTime?.revenue||1},
          ].map(({label, current, total}) => (
            <div key={label} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontWeight: 800 }}>{typeof current === 'number' && current > 999 ? `₹${(current / 1000).toFixed(1)}k` : current}</span>
              </div>
              <div style={{ height: 8, background: 'var(--border2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#6c47ff,#a78bfa)', borderRadius: 4, width: `${Math.min((current / (total || 1)) * 100, 100)}%`, transition: 'width .8s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   RETURNS PAGE
════════════════════════════════════════════════════════════ */
function ReturnsPage() {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  const load = async () => { setLoading(true); try { const r = await api.returns(); setReturns(r.data) } catch (e) {}; setLoading(false) }
  useEffect(() => { load() }, [])

  const STATUSES = ['ALL', 'REQUESTED', 'APPROVED', 'REJECTED', 'PICKED_UP', 'REFUNDED']
  const filtered = filter === 'ALL' ? returns : returns.filter(r => r.status === filter)

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Returns</div><div className="page-sub">{returns.length} total return requests</div></div>
        <button className="btn btn-ghost btn-sm" onClick={load}><I.Refresh /></button>
      </div>

      {/* Status summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUSES.filter(s => s !== 'ALL').map(s => (
          <div key={s} style={{ padding: '10px 18px', background: 'var(--surface)', borderRadius: 12, border: `1.5px solid ${filter === s ? RC[s] : 'var(--border2)'}`, cursor: 'pointer', transition: '.2s', textAlign: 'center' }} onClick={() => setFilter(filter === s ? 'ALL' : s)}>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 20, color: RC[s] }}>{returns.filter(r => r.status === s).length}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{RL[s]}</div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <div className="table-head" style={{ gridTemplateColumns: '80px 2fr 2fr 2fr 1fr 1fr' }}>
          <span className="th">ID</span><span className="th">Customer</span><span className="th">Shop</span>
          <span className="th">Reason</span><span className="th">Status</span><span className="th">Date</span>
        </div>
        {loading ? [...Array(4)].map((_, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: '80px 2fr 2fr 2fr 1fr 1fr' }}>
            {[...Array(6)].map((_, j) => <div key={j} className="skeleton" style={{ height: 16 }} />)}
          </div>
        )) : filtered.length === 0 ? (
          <div className="empty"><span className="empty-icon">🔄</span><div>No returns found</div></div>
        ) : filtered.map((r, i) => (
          <div key={r.id} className="table-row fade-up" style={{ gridTemplateColumns: '80px 2fr 2fr 2fr 1fr 1fr', animationDelay: `${i * 0.03}s` }}>
            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>#{r.id}</span>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.customerName}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.shopName}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</div>
            <span className="badge" style={{ background: `${RC[r.status]}18`, color: RC[r.status] }}>{RL[r.status]}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   APP ROOT
════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════
   VERIFY SHOPS PAGE
════════════════════════════════════════════════════════════ */
function VerifyPage() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)

  const load = () => {
    setLoading(true)
    api.verifyRequests().then(r => setShops(r.data)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const verify = async (shop, badge) => {
    setActioning(shop.id)
    try {
      await api.verifyShop(shop.id, badge)
      toast(`${shop.name} — ${badge} badge granted ✓`, 'success')
      load()
    } catch(e) { toast('Failed', 'error') }
    setActioning(null)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Vendor Verification</div>
          <div className="page-sub">Review and grant verified badges to shops</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><I.Refresh /> Refresh</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {loading ? [...Array(4)].map((_, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: '60%' }} />
          </div>
        )) : shops.map(s => (
          <div key={s.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{s.name}</span>
                {s.isVerified && (
                  <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100 }}>✓ Verified</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {s.category} · {s.owner} · {s.totalOrders} orders · ⭐ {s.rating?.toFixed(1) || 'New'} ({s.ratingCount} reviews)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {!s.isVerified ? (
                <>
                  <button className="btn btn-sm" style={{ background: '#dbeafe', color: '#1d4ed8', border: 'none' }}
                    disabled={actioning === s.id}
                    onClick={() => verify(s, 'verified')}>
                    {actioning === s.id ? '…' : '✓ Verify'}
                  </button>
                  <button className="btn btn-sm" style={{ background: '#fef9c3', color: '#92400e', border: 'none' }}
                    disabled={actioning === s.id}
                    onClick={() => verify(s, 'top_seller')}>
                    🏆 Top Seller
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Badge granted</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   PROMO CODES PAGE
════════════════════════════════════════════════════════════ */
function PromoPage() {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ code: '', discountType: 'percent', discountValue: 10, minOrder: 0, maxUses: 100 })
  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState(null)

  const load = () => {
    setLoading(true)
    api.listPromos().then(r => setPromos(r.data)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const createPromo = async () => {
    if (!form.code.trim()) { toast('Enter a promo code', 'error'); return }
    setCreating(true)
    try {
      await api.createPromo(form)
      toast(`Promo code ${form.code} created ✓`, 'success')
      setShowCreate(false)
      setForm({ code: '', discountType: 'percent', discountValue: 10, minOrder: 0, maxUses: 100 })
      load()
    } catch(e) { toast(e.response?.data?.detail || 'Create failed', 'error') }
    setCreating(false)
  }

  const toggle = async (p) => {
    setToggling(p.id)
    try {
      await api.togglePromo(p.id)
      toast(p.isActive ? 'Promo deactivated' : 'Promo activated', p.isActive ? 'info' : 'success')
      load()
    } catch(e) { toast('Failed', 'error') }
    setToggling(null)
  }

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Promo Codes</div>
          <div className="page-sub">{promos.length} codes · {promos.filter(p => p.isActive).length} active</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? '✕ Cancel' : '+ Create Code'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load}><I.Refresh /></button>
        </div>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: '20px', marginBottom: 20, border: '2px solid var(--primary-l)', animation: 'fadeUp .25s ease' }}>
          <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, marginBottom: 16, color: 'var(--primary)' }}>✨ Create New Promo Code</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="label">Code *</label>
              <input className="input" placeholder="SUMMER20" value={form.code} onChange={sf('code')}
                style={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: 2 }} />
            </div>
            <div>
              <label className="label">Discount Type</label>
              <select className="input" value={form.discountType} onChange={sf('discountType')}>
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="label">Discount Value</label>
              <input className="input" type="number" min="1" value={form.discountValue} onChange={sf('discountValue')}
                placeholder={form.discountType === 'percent' ? 'e.g. 15 for 15%' : 'e.g. 50 for ₹50'} />
            </div>
            <div>
              <label className="label">Min. Order (₹)</label>
              <input className="input" type="number" min="0" value={form.minOrder} onChange={sf('minOrder')} />
            </div>
            <div>
              <label className="label">Max Uses</label>
              <input className="input" type="number" min="1" value={form.maxUses} onChange={sf('maxUses')} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={createPromo} disabled={creating}>
            {creating ? 'Creating…' : '✓ Create Promo Code'}
          </button>
        </div>
      )}

      <div className="table-wrap">
        <div className="table-head" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px' }}>
          <span className="th">Code</span>
          <span className="th">Discount</span>
          <span className="th">Min Order</span>
          <span className="th">Used / Max</span>
          <span className="th">Expires</span>
          <span className="th">Status</span>
          <span className="th">Action</span>
        </div>
        {loading ? [...Array(3)].map((_, i) => (
          <div key={i} className="table-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px' }}>
            {[...Array(7)].map((_, j) => <div key={j} className="skeleton" style={{ height: 16 }} />)}
          </div>
        )) : promos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No promo codes yet. Create your first one above.</div>
        ) : promos.map(p => (
          <div key={p.id} className="table-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px' }}>
            <span style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 14, letterSpacing: 1, color: 'var(--primary)' }}>{p.code}</span>
            <span style={{ fontWeight: 700, color: p.discountType === 'percent' ? '#16a34a' : '#f97316' }}>
              {p.discountType === 'percent' ? `${p.discountValue}% off` : `₹${p.discountValue} off`}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>₹{p.minOrder}</span>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>{p.usedCount}</span>
              <span style={{ color: 'var(--muted)' }}> / {p.maxUses}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'No expiry'}
            </span>
            <span className={`badge ${p.isActive ? 'badge-success' : 'badge-muted'}`}>{p.isActive ? 'Active' : 'Inactive'}</span>
            <button className={`btn btn-sm ${p.isActive ? 'btn-ghost' : 'btn-success'}`}
              disabled={toggling === p.id}
              onClick={() => toggle(p)}>
              {toggling === p.id ? '…' : p.isActive ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   COMMISSION / SETTINGS PAGE
════════════════════════════════════════════════════════════ */
function CommissionPage() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    api.getCommission().then(r => {
      setData(r.data)
      setForm(r.data)
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await api.setCommission({
        platform_fee_flat: parseFloat(form.platform_fee_flat),
        reseller_pct: parseFloat(form.reseller_pct),
        rider_base: parseFloat(form.rider_base),
      })
      setData(r.data)
      toast('Settings saved ✓', 'success')
    } catch(e) { toast('Save failed', 'error') }
    setSaving(false)
  }

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Platform Settings</div>
          <div className="page-sub">Commission rates, fees & data export</div>
        </div>
      </div>

      {/* Commission settings */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, marginBottom: 18 }}>💰 Commission & Fee Settings</div>
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              {key:'platform_fee_flat', label:'Platform Fee (₹ per order)', unit:'₹', desc:'Flat fee charged on every customer order'},
              {key:'reseller_pct',      label:'Reseller Commission (%)',     unit:'%', desc:'Commission paid to resellers per sale'},
              {key:'rider_base',        label:'Rider Base Pay (₹)',          unit:'₹', desc:'Minimum pay per delivery regardless of distance'},
            ].map(({key, label, unit, desc}) => (
              <div key={key} style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>{unit}</span>
                  <input type="number" min="0" value={form[key] ?? ''} onChange={sf(key)}
                    style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 18, fontWeight: 800, fontFamily: 'var(--font)', outline: 'none', width: '100%' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{desc}</div>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary" onClick={save} disabled={saving || !data}>
          {saving ? 'Saving…' : '✓ Save Settings'}
        </button>
      </div>

      {/* CSV Export */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, marginBottom: 6 }}>📥 Export Data</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>Download CSV files for reporting and accounting</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Export Orders CSV', desc: 'All orders with status, revenue, payment method', action: api.exportOrders, color: '#dbeafe', textColor: '#1d4ed8' },
            { label: 'Export Users CSV', desc: 'All registered customers, vendors and riders', action: api.exportUsers, color: '#dcfce7', textColor: '#15803d' },
          ].map(({ label, desc, action, color, textColor }) => (
            <div key={label} style={{ background: color, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', border: `1px solid ${textColor}20`, transition: '.2s' }}
              onClick={() => { action(); toast('Download starting…', 'success') }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 14, color: textColor, marginBottom: 4 }}>📥 {label}</div>
              <div style={{ fontSize: 12, color: textColor, opacity: .75 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, marginBottom: 14 }}>🔧 System Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
          {[
            {k:'Backend',v:'FastAPI + SQLite'},
            {k:'Auth',v:'JWT (access + refresh)'},
            {k:'OTP',v:'Dev mode (console)'},
            {k:'Storage',v:'Local /uploads/'},
            {k:'AI',v:'Claude claude-sonnet-4-20250514'},
            {k:'Maps',v:'OpenStreetMap + Leaflet'},
            {k:'Payments',v:'COD + UPI (mock)'},
            {k:'Version',v:'DOTT v8.0'},
          ].map(({k, v}) => (
            <div key={k} style={{ padding: '9px 12px', background: 'var(--bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{k}</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [pendingOrders, setPendingOrders] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('dott_admin_access')
    if (!token) { setLoading(false); return }
    api.me().then(r => { if (r.data.role === 'ADMIN') setUser(r.data) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    const poll = () => api.orders().then(r => setPendingOrders(r.data.filter(o => o.status === 'PENDING').length)).catch(() => {})
    poll(); const t = setInterval(poll, 15000); return () => clearInterval(t)
  }, [user])

  const signOut = async () => {
    try { await api.logout() } catch (e) {}
    localStorage.removeItem('dott_admin_access'); localStorage.removeItem('dott_admin_refresh')
    setUser(null)
  }

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1b3a', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(108,71,255,.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: 'rgba(255,255,255,.5)', fontFamily: 'var(--font)', fontWeight: 700 }}>Loading DOTT Admin...</div>
      </div>
    </>
  )

  if (!user) return <><style>{CSS}</style><AuthPage onSuccess={u => setUser(u)} /></>

  const NAV = [
    { id: 'dashboard',  label: 'Dashboard',  Icon: I.Dashboard },
    { id: 'orders',     label: 'Orders',     Icon: I.Orders,  badge: pendingOrders },
    { id: 'users',      label: 'Users',      Icon: I.Users },
    { id: 'shops',      label: 'Shops',      Icon: I.Shops },
    { id: 'verify',     label: 'Verify',     Icon: I.Shield },
    { id: 'riders',     label: 'Riders',     Icon: I.Riders },
    { id: 'revenue',    label: 'Revenue',    Icon: I.Revenue },
    { id: 'returns',    label: 'Returns',    Icon: I.Returns },
    { id: 'promo',      label: 'Promo Codes',Icon: I.Analytics },
    { id: 'commission', label: 'Settings',   Icon: I.Settings },
  ]

  const pageTitle = NAV.find(n => n.id === page)?.label || 'Dashboard'

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="brand">DOTT <span>Admin</span></div>
            <div className="tag">Control Center</div>
          </div>

          <div className="sb-section">
            <div className="sb-section-label">Main</div>
            {NAV.map(({ id, label, Icon, badge }) => (
              <div key={id} className={`sb-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
                <Icon />
                <span>{label}</span>
                {badge > 0 && <span className="sb-badge" style={{ background: '#ef4444', color: '#fff' }}>{badge}</span>}
              </div>
            ))}
          </div>

          <div className="sb-bottom">
            <div className="sb-admin-card">
              <div className="sb-avatar">{user.name[0]}</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>Administrator</div>
              </div>
            </div>
            <div className="sb-item" onClick={signOut} style={{ color: '#f87171' }}>
              <I.Logout />
              <span>Sign Out</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <div className="topbar-title">{pageTitle}</div>
              {pendingOrders > 0 && (
                <span className="badge badge-warning" style={{ cursor: 'pointer' }} onClick={() => setPage('orders')}>
                  🔔 {pendingOrders} pending order{pendingOrders > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="topbar-right">
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Welcome, <strong style={{ color: 'var(--text)' }}>{user.name}</strong></div>
              <span className="badge badge-purple"><I.Shield /> Admin</span>
            </div>
          </div>

          {page === 'dashboard'  && <Dashboard />}
          {page === 'orders'     && <OrdersPage />}
          {page === 'users'      && <UsersPage />}
          {page === 'shops'      && <ShopsPage />}
          {page === 'verify'     && <VerifyPage />}
          {page === 'riders'     && <RidersPage />}
          {page === 'revenue'    && <RevenuePage />}
          {page === 'returns'    && <ReturnsPage />}
          {page === 'promo'      && <PromoPage />}
          {page === 'commission' && <CommissionPage />}
        </main>
      </div>

      <Toasts />
    </>
  )
}
