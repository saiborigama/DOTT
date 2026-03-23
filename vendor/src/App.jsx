import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8080/api'
const ax = axios.create({ baseURL: BASE })
ax.interceptors.request.use(cfg => {
  const t = localStorage.getItem('dott_vendor_access')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
ax.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401) {
    const rt = localStorage.getItem('dott_vendor_refresh')
    if (rt) {
      try {
        const r = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rt })
        localStorage.setItem('dott_vendor_access', r.data.accessToken)
        localStorage.setItem('dott_vendor_refresh', r.data.refreshToken)
        err.config.headers.Authorization = `Bearer ${r.data.accessToken}`
        return ax(err.config)
      } catch {
        localStorage.removeItem('dott_vendor_access')
        localStorage.removeItem('dott_vendor_refresh')
      }
    }
  }
  return Promise.reject(err)
})

/* ── AI analyze via Claude Anthropic API ── */
async function analyzeProductWithAI(imageDataUrl) {
  const base64 = imageDataUrl.split(',')[1]
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg'
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '',            // API key injected by platform
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            },
            {
              type: 'text',
              text: `You are an expert e-commerce product analyst. Look at this product image carefully and extract all visible information. Respond ONLY with a valid JSON object, no markdown, no explanation. Use this exact structure:
{
  "name": "specific product name",
  "category": "one of: Fashion, Grocery, Electronics, Footwear, Kids, Accessories, Kurtas, Kurtis, Sarees, Jeans, T-Shirts, Dresses, Jackets, Shirts, Trousers, Activewear, Sweatshirts, Skirts, Snacks, Dairy, Fruits, Vegetables, Bakery, Beverages",
  "brand": "brand name or empty string",
  "color": "primary color(s) visible",
  "material": "fabric or material if detectable",
  "productType": "shirt/kurta/saree/jeans/dress/snack/fruit etc",
  "mrp": "price if visible on tag, else empty string",
  "suggestedPrice": "estimated selling price in INR as number string",
  "description": "2-3 sentence product description for e-commerce listing",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "sizes": "if clothing suggest size range: XS,S,M,L,XL,XXL else empty",
  "isVeg": true,
  "confidence": "high/medium/low"
}`
            }
          ]
        }]
      })
    })
    const data = await res.json()
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch(e) {
    console.warn('AI analyze error (this is normal without API key):', e?.message || e)
    return null
  }
}

const api = {
  sendOtp:    phone => ax.post('/otp/send', { phone }),
  verifyOtp:  (phone,otp) => ax.post('/otp/verify', { phone, otp }),
  uploadImage: file => { const fd=new FormData(); fd.append('file',file); return ax.post('/upload/image',fd,{headers:{'Content-Type':'multipart/form-data'}}) },
  processProductImageAI: file => { const fd=new FormData(); fd.append('file',file); return ax.post('/upload/product-image-transform',fd,{headers:{'Content-Type':'multipart/form-data'}}) },
  login: d => ax.post('/auth/login', d),
  register: d => ax.post('/auth/register', d),
  me: () => ax.get('/auth/me'),
  updatePayment: d => ax.put('/auth/payment-details', d),
  logout: () => ax.post('/auth/logout'),
  myShop: () => ax.get('/shops/my'),
  createShop: d => ax.post('/shops', d),
  updateShop: (id, d) => ax.put(`/shops/${id}`, d),
  myProducts: () => ax.get('/products/my'),
  addProduct: d => ax.post('/products', d),
  updateProduct: (id, d) => ax.put(`/products/${id}`, d),
  shopOrders: (p) => ax.get('/orders/shop/all', { params: p }),
  acceptOrder: id => ax.post(`/orders/${id}/accept`),
  rejectOrder: id => ax.post(`/orders/${id}/reject`),
  updateStatus: (id, s) => ax.put(`/orders/${id}/status`, { status: s }),
  shopReturns: () => ax.get('/returns/shop'),
  updateReturn: (id, d) => ax.put(`/returns/${id}`, d),
  analytics: () => ax.get('/analytics'),
  lowStock: () => ax.get('/vendor/low-stock'),
  cloneProduct: id => ax.post(`/products/${id}/clone`),
  vendorEarnings: () => ax.get('/vendor/earnings'),
  replyReview: (id, reply) => ax.post(`/reviews/${id}/reply`, { reply }),
}

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`, { headers: { 'Accept-Language': 'en' } })
    const d = await r.json()
    if (d?.address) {
      const a = d.address
      return {
        full: [a.house_number ? (a.house_number + (a.road ? ', ' + a.road : '')) : a.road || '', a.neighbourhood || a.suburb || '', a.city_district || '', a.city || a.town || a.village || '', a.state || '', a.postcode || ''].filter(Boolean).join(', '),
        city: a.city || a.town || a.village || 'Hyderabad',
        pincode: a.postcode || '',
        area: a.neighbourhood || a.suburb || ''
      }
    }
  } catch (e) {}
  return { full: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: 'Hyderabad', pincode: '', area: '' }
}

function LeafletMap({ lat, lng, onPinMove, height = 200 }) {
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const markerRef = useRef(null)
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const l = document.createElement('link')
      l.id = 'leaflet-css'; l.rel = 'stylesheet'
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(l)
    }
    const init = () => {
      if (!mapRef.current || leafletMapRef.current) return
      const L = window.L
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 16)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
      const icon = L.divIcon({ html: `<div style="width:26px;height:26px;background:#6c47ff;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`, iconSize: [26, 26], iconAnchor: [13, 26], className: '' })
      const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map)
      markerRef.current = marker; leafletMapRef.current = map
      marker.on('dragend', e => { const { lat: la, lng: lo } = e.target.getLatLng(); onPinMove && onPinMove(la, lo) })
      map.on('click', e => { const { lat: la, lng: lo } = e.latlng; marker.setLatLng([la, lo]); onPinMove && onPinMove(la, lo) })
    }
    if (window.L) { init() } else {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = init
      document.head.appendChild(s)
    }
    return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null } }
  }, [])
  useEffect(() => {
    if (markerRef.current && leafletMapRef.current) {
      markerRef.current.setLatLng([lat, lng])
      leafletMapRef.current.setView([lat, lng], 16, { animate: true })
    }
  }, [lat, lng])
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid var(--border)', position: 'relative', marginTop: 8 }}>
      <div ref={mapRef} style={{ width: '100%', height }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 999, background: 'rgba(255,255,255,.92)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#374151' }}>
        Drag pin or tap to reposition
      </div>
    </div>
  )
}

/* ── GLOBAL CSS ── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --primary:#6c47ff;--primary-dark:#5535e0;--primary-light:rgba(108,71,255,.08);
  --green:#16a34a;--red:#ef4444;--orange:#f97316;--blue:#0ea5e9;--amber:#f59e0b;
  --bg:#f8f7ff;--surface:#fff;--border:#e8e4ff;--border2:#f0eeff;
  --text:#1e1b3a;--muted:#6b7280;--font:'Plus Jakarta Sans',sans-serif;--body:'Inter',sans-serif;
  --shadow-sm:0 1px 4px rgba(108,71,255,.08);
  --shadow:0 4px 20px rgba(108,71,255,.12);
  --shadow-lg:0 12px 40px rgba(108,71,255,.18);
  --radius:14px;--radius-sm:10px;--radius-lg:20px;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--body);overflow-x:hidden}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:#c4b8ff}

@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes bgScroll{0%{background-position:0 0}100%{background-position:60px 60px}}
@keyframes ripple{0%{transform:scale(0);opacity:.6}100%{transform:scale(2.5);opacity:0}}
@keyframes scaleIn{from{transform:scale(0.94);opacity:0}to{transform:scale(1);opacity:1}}

.fade-up{animation:fadeUp .38s cubic-bezier(.22,1,.36,1) both}
.fade-in{animation:fadeIn .28s ease both}
.slide-in{animation:slideIn .32s cubic-bezier(.22,1,.36,1) both}
.scale-in{animation:scaleIn .3s cubic-bezier(.22,1,.36,1) both}
.skeleton{background:linear-gradient(90deg,#ede9ff 25%,#ddd8ff 50%,#ede9ff 75%);background-size:600px 100%;animation:shimmer 1.6s infinite;border-radius:8px}

/* ── AUTH PAGE ── */
.auth-page{min-height:100vh;display:flex;background:#fff}
.auth-visual{width:48%;background:#1e1b3a;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:48px}
.auth-visual::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 20% 20%,rgba(108,71,255,.4) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(108,71,255,.3) 0%,transparent 50%);pointer-events:none}
.auth-visual-dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(108,71,255,.3) 1px,transparent 1px);background-size:28px 28px;animation:bgScroll 8s linear infinite;pointer-events:none}
.auth-form-side{width:52%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 56px;background:#fff;overflow-y:auto}
.auth-form-wrap{width:100%;max-width:420px}
@media(max-width:768px){
  .auth-visual{display:none}
  .auth-form-side{width:100%;padding:32px 24px;background:linear-gradient(170deg,#1e1b3a 0%,#2d2a5e 40%,#fff 40%)}
  .auth-form-wrap{background:#fff;border-radius:20px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.2)}
}

/* ── SIDEBAR LAYOUT ── */
.layout{display:flex;min-height:100vh}
.sidebar{width:240px;background:#1e1b3a;display:flex;flex-direction:column;position:fixed;top:0;bottom:0;left:0;z-index:100;overflow-y:auto}
.sidebar-logo{padding:22px 20px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
.sidebar-logo .brand{font-family:var(--font);font-weight:900;font-size:24px;color:#fff;letter-spacing:-.5px}
.sidebar-logo .brand span{color:#a78bfa}
.sidebar-logo .version{font-size:10px;color:rgba(255,255,255,.3);margin-top:2px;font-weight:600;letter-spacing:.8px;text-transform:uppercase}
.sidebar-nav{flex:1;padding:16px 12px}
.nav-section-title{font-size:9px;font-weight:800;color:rgba(255,255,255,.25);text-transform:uppercase;letter-spacing:1.2px;padding:12px 8px 6px;margin-top:8px}
.nav-item{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;cursor:pointer;color:rgba(255,255,255,.6);font-size:13px;font-weight:600;transition:.2s;position:relative;margin-bottom:2px;font-family:var(--font)}
.nav-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.9)}
.nav-item.active{background:rgba(108,71,255,.25);color:#c4b8ff}
.nav-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:60%;background:#a78bfa;border-radius:0 3px 3px 0}
.nav-item svg{width:18px;height:18px;flex-shrink:0}
.nav-badge{margin-left:auto;background:#ef4444;color:#fff;font-size:10px;font-weight:900;padding:2px 6px;border-radius:100px;min-width:18px;text-align:center}
.sidebar-bottom{padding:16px 12px 20px;border-top:1px solid rgba(255,255,255,.08)}
.sidebar-shop{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05);margin-bottom:10px}
.sidebar-shop .shop-avatar{width:36px;height:36px;border-radius:10px;background:rgba(108,71,255,.3);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.sidebar-shop .shop-name{font-size:13px;font-weight:700;color:#e5e7eb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sidebar-shop .shop-status{font-size:10px;font-weight:600;margin-top:1px}
.main-content{margin-left:240px;flex:1;min-height:100vh;display:flex;flex-direction:column}

/* ── TOP BAR ── */
.topbar{background:var(--surface);border-bottom:1px solid var(--border2);padding:0 28px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;box-shadow:var(--shadow-sm)}
.topbar-title{font-family:var(--font);font-size:20px;font-weight:800;color:var(--text)}
.topbar-actions{display:flex;align-items:center;gap:12px}

/* ── PAGE ── */
.page{padding:28px;max-width:1100px}
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.page-title{font-family:var(--font);font-size:24px;font-weight:900;color:var(--text)}
.page-sub{color:var(--muted);font-size:14px;margin-top:3px}

/* ── CARDS ── */
.card{background:var(--surface);border-radius:var(--radius);border:1.5px solid var(--border2);padding:20px;box-shadow:var(--shadow-sm);transition:.25s}
.card:hover{box-shadow:var(--shadow);border-color:var(--border)}
.card-title{font-family:var(--font);font-weight:800;font-size:15px;margin-bottom:14px;color:var(--text)}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
.stat-card{background:var(--surface);border-radius:var(--radius);border:1.5px solid var(--border2);padding:20px 22px;transition:.25s;position:relative;overflow:hidden}
.stat-card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
.stat-card::before{content:'';position:absolute;top:0;right:0;width:80px;height:80px;border-radius:0 0 0 80px;opacity:.06}
.stat-val{font-family:var(--font);font-size:28px;font-weight:900;margin-bottom:4px}
.stat-label{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
.stat-sub{font-size:12px;color:var(--muted);margin-top:5px}

/* ── TABLE ── */
.table-wrap{background:var(--surface);border-radius:var(--radius);border:1.5px solid var(--border2);overflow:hidden}
.table-head{display:flex;padding:14px 20px;background:var(--bg);border-bottom:1.5px solid var(--border2);gap:16px}
.table-head span{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.7px}
.table-row{display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border2);gap:16px;transition:.15s}
.table-row:last-child{border-bottom:none}
.table-row:hover{background:var(--bg)}

/* ── FORMS ── */
.input{width:100%;padding:11px 14px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:var(--body);font-size:14px;outline:none;transition:.2s}
.input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(108,71,255,.1)}
.input::placeholder{color:#aaa}
.label{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px;display:block}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}

/* ── BUTTONS ── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 18px;border-radius:10px;border:none;cursor:pointer;font-family:var(--font);font-weight:700;font-size:13px;transition:.22s;position:relative;overflow:hidden;white-space:nowrap}
.btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,0);transition:.2s}
.btn:hover::after{background:rgba(255,255,255,.12)}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important}
.btn-primary{background:linear-gradient(135deg,#6c47ff,#8b5cf6);color:#fff;box-shadow:0 4px 14px rgba(108,71,255,.3)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(108,71,255,.4)}
.btn-success{background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.3)}
.btn-success:hover{transform:translateY(-1px)}
.btn-danger{background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;box-shadow:0 4px 14px rgba(239,68,68,.3)}
.btn-danger:hover{transform:translateY(-1px)}
.btn-ghost{background:var(--surface);color:var(--text);border:1.5px solid var(--border);box-shadow:var(--shadow-sm)}
.btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
.btn-orange{background:linear-gradient(135deg,#ea580c,#f97316);color:#fff;box-shadow:0 4px 14px rgba(249,115,22,.3)}

/* ── BADGES ── */
.badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:800;font-family:var(--font)}
.badge-success{background:#dcfce7;color:#15803d}
.badge-warning{background:#fef9c3;color:#854d0e}
.badge-danger{background:#fee2e2;color:#b91c1c}
.badge-info{background:#e0f2fe;color:#0369a1}
.badge-purple{background:#ede9fe;color:#6d28d9}
.badge-gray{background:#f3f4f6;color:#374151}

/* ── TOGGLE ── */
.toggle{width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:.25s;flex-shrink:0}
.toggle::after{content:'';position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;transition:.25s;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.toggle.on{background:var(--green)}.toggle.on::after{left:23px}
.toggle.off{background:#d1d5db}.toggle.off::after{left:3px}

/* ── MODAL/OVERLAY ── */
.overlay{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease;backdrop-filter:blur(4px)}
.modal{background:var(--surface);border-radius:20px;padding:28px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;animation:scaleIn .25s cubic-bezier(.22,1,.36,1);box-shadow:0 24px 64px rgba(0,0,0,.2)}

/* ── PRODUCT CARD ── */
.prod-card{background:var(--surface);border:1.5px solid var(--border2);border-radius:var(--radius);overflow:hidden;transition:.25s;position:relative}
.prod-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg);border-color:var(--primary)}
.prod-card .pc-img{width:100%;height:170px;object-fit:cover;display:block;background:var(--bg)}
.prod-card .pc-body{padding:14px}
.prod-card .pc-name{font-weight:800;font-size:15px;margin-bottom:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-family:var(--font)}
.prod-card .pc-meta{font-size:12px;color:var(--muted);margin-bottom:8px}
.prod-card .pc-price{font-family:var(--font);font-weight:900;font-size:20px;color:var(--primary)}
.prod-card .pc-actions{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--border2);background:var(--bg)}
.prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}

/* ── ORDER CARD ── */
.order-card{background:var(--surface);border:1.5px solid var(--border2);border-radius:var(--radius);overflow:hidden;margin-bottom:12px;transition:.2s}
.order-card:hover{box-shadow:var(--shadow);border-color:var(--border)}
.order-card.pending{border-left:4px solid var(--amber)}
.order-card.accepted{border-left:4px solid var(--blue)}
.order-head{padding:14px 18px;background:var(--bg);border-bottom:1px solid var(--border2);display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.order-body{padding:16px 18px}
.order-items{font-size:13px;color:var(--muted);margin-bottom:12px;line-height:1.6}

/* ── MISC ── */
.tabs{display:flex;gap:4px;background:var(--bg);border-radius:12px;padding:4px;margin-bottom:20px;flex-wrap:wrap}
.tab-btn{padding:9px 16px;border:none;border-radius:9px;cursor:pointer;font-family:var(--font);font-weight:700;font-size:13px;transition:.2s;background:transparent;color:var(--muted);white-space:nowrap}
.tab-btn.active{background:var(--surface);color:var(--primary);box-shadow:var(--shadow-sm)}
.tab-btn:hover:not(.active){background:rgba(108,71,255,.05);color:var(--primary)}
.divider{height:1px;background:var(--border2);margin:16px 0}
.empty{text-align:center;padding:60px 20px;color:var(--muted)}
.empty-icon{font-size:48px;margin-bottom:14px;display:block;animation:float 3s ease-in-out infinite}
.toast{position:fixed;top:20px;right:24px;z-index:999;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:700;animation:slideIn .3s ease;box-shadow:var(--shadow-lg);max-width:320px;font-family:var(--font);border-left:4px solid transparent}
.toast.success{background:#f0fdf4;color:#15803d;border-color:#16a34a}
.toast.error{background:#fef2f2;color:#b91c1c;border-color:#ef4444}
.toast.info{background:#eff6ff;color:#1d4ed8;border-color:#3b82f6}
.status-filter{display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.status-filter::-webkit-scrollbar{display:none}
.filter-pill{padding:7px 14px;border-radius:100px;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;font-size:12px;font-weight:700;transition:.2s;white-space:nowrap;font-family:var(--font)}
.filter-pill.active{background:var(--primary-light);border-color:var(--primary);color:var(--primary)}
.filter-pill:hover:not(.active){border-color:var(--primary);color:var(--primary)}
.camera-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;padding:20px;border:2px dashed var(--primary);border-radius:var(--radius);background:var(--primary-light);cursor:pointer;transition:.2s;font-family:var(--font);color:var(--primary);font-weight:700;font-size:14px}
.camera-btn:hover{background:rgba(108,71,255,.14);border-style:solid;transform:scale(.99)}
.img-process-overlay{position:absolute;inset:0;background:rgba(0,0,0,.7);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:var(--radius);color:#fff;font-family:var(--font);font-weight:700;font-size:13px}
.img-compare{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.img-compare img{width:100%;height:140px;object-fit:contain;border-radius:10px;background:#f9fafb;border:1.5px solid var(--border)}

/* ── AI AUTOFILL ── */
.ai-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;background:linear-gradient(135deg,#6c47ff,#a78bfa);color:#fff;font-size:11px;font-weight:800;font-family:var(--font)}
.ai-field{position:relative}
.ai-field .ai-dot{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:var(--primary);opacity:.7}
.ai-glow{border-color:var(--primary)!important;box-shadow:0 0 0 3px rgba(108,71,255,.12)!important}
.multi-img-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.img-slot{border:2px dashed var(--border);border-radius:12px;overflow:hidden;aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:.2s;position:relative;background:var(--bg)}
.img-slot:hover{border-color:var(--primary);background:var(--primary-light)}
.img-slot.filled{border-style:solid;border-color:var(--border)}
.img-slot img{width:100%;height:100%;object-fit:cover}
.img-slot .slot-label{font-size:11px;font-weight:700;color:var(--muted);margin-top:6px}
.img-slot .slot-icon{font-size:22px}
.img-slot .remove-btn{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(239,68,68,.9);border:none;color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;opacity:0;transition:.15s}
.img-slot:hover .remove-btn{opacity:1}
.analyze-overlay{position:absolute;inset:0;background:rgba(108,71,255,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border-radius:10px;color:#fff;font-family:var(--font);font-size:12px;font-weight:700}
.tag-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:100px;background:var(--primary-light);color:var(--primary);font-size:11px;font-weight:700;border:1px solid rgba(108,71,255,.2);cursor:pointer;transition:.15s}
.tag-chip:hover{background:var(--primary);color:#fff}
.tag-chip .x{font-size:12px;opacity:.6}
.shop-banner-slot{width:100%;height:120px;border:2px dashed var(--border);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:.2s;background:var(--bg);overflow:hidden;position:relative}
.shop-banner-slot:hover{border-color:var(--primary);background:var(--primary-light)}
.shop-banner-slot img{width:100%;height:100%;object-fit:cover}
`

const NEXT_STATUS = { CONFIRMED: 'PACKING' }  // Vendor only: start prep after rider accepts
const STATUS_COLOR = { PENDING: '#f59e0b', CONFIRMED: '#3b82f6', PACKING: '#8b5cf6', PICKED_UP: '#06b6d4', OUT_FOR_DELIVERY: '#f97316', DELIVERED: '#22c55e', CANCELLED: '#ef4444' }
const STATUS_LABEL = { PENDING: 'Pending', CONFIRMED: 'Confirmed', PACKING: 'Packing', PICKED_UP: 'Picked Up', OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }

/* ── ICONS ── */

// ─── Delivery Countdown (vendor view) ─────────────────────────────────────────
function DeliveryCountdown({ placedAt }) {
  const endTime = useRef(new Date(placedAt).getTime() + 60 * 60 * 1000)
  const [secsLeft, setSecsLeft] = useState(Math.max(0, Math.floor((endTime.current - Date.now()) / 1000)))
  useEffect(() => {
    const t = setInterval(() => setSecsLeft(Math.max(0, Math.floor((endTime.current - Date.now()) / 1000))), 1000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.floor(secsLeft / 60)
  const secs = secsLeft % 60
  const urgent = secsLeft < 600
  if (secsLeft <= 0) return <span style={{fontSize:11,fontWeight:800,color:'#dc2626',background:'rgba(220,38,38,.08)',padding:'2px 8px',borderRadius:100}}>Time expired</span>
  return (
    <span style={{fontSize:11,fontWeight:800,color:urgent?'#dc2626':'#059669',background:urgent?'rgba(220,38,38,.08)':'rgba(5,150,105,.08)',padding:'3px 9px',borderRadius:100,border:`1px solid ${urgent?'rgba(220,38,38,.2)':'rgba(5,150,105,.2)'}`}}>
      {urgent ? '⚡ ' : '⏱ '}{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')} left
    </span>
  )
}


function DeliveryCountdownSync({ placedAt, deadline, serverNow }) {
  const endTime = useRef(deadline ? new Date(deadline).getTime() : new Date(placedAt).getTime() + 60 * 60 * 1000)
  const serverOffset = useRef(serverNow ? (new Date(serverNow).getTime() - Date.now()) : 0)
  const [secsLeft, setSecsLeft] = useState(Math.max(0, Math.floor((endTime.current - (Date.now() + serverOffset.current)) / 1000)))
  useEffect(() => {
    const t = setInterval(() => setSecsLeft(Math.max(0, Math.floor((endTime.current - (Date.now() + serverOffset.current)) / 1000))), 1000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.floor(secsLeft / 60)
  const secs = secsLeft % 60
  const urgent = secsLeft < 1200
  const danger = secsLeft < 600
  if (secsLeft <= 0) return <span style={{fontSize:11,fontWeight:800,color:'#dc2626',background:'rgba(220,38,38,.08)',padding:'2px 8px',borderRadius:100}}>Time expired</span>
  return (
    <span style={{fontSize:11,fontWeight:800,color:danger?'#dc2626':urgent?'#d97706':'#059669',background:danger?'rgba(220,38,38,.08)':urgent?'rgba(245,158,11,.1)':'rgba(5,150,105,.08)',padding:'3px 9px',borderRadius:100,border:`1px solid ${danger?'rgba(220,38,38,.2)':urgent?'rgba(245,158,11,.22)':'rgba(5,150,105,.2)'}`}}>
      {danger ? 'ALERT ' : urgent ? 'FAST ' : 'TIME '}{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')} left
    </span>
  )
}

const Icons = {
  Dashboard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Orders: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  Products: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  Analytics: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  Settings: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M20 12h-2M6 12H4M17.66 17.66l-1.41-1.41M7.75 17.66l1.41-1.41M12 20v-2M12 6V4"/></svg>,
  Returns: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  Logout: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  Camera: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Close: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Plus: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Loc: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Upload: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
  Star: () => <svg viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
}

/* ── SMART IMAGE PROCESSOR (canvas-based) ── */
async function processProductImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 800
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')

      // White background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)

      // Scale + center the product
      const scale = Math.min((size * 0.82) / img.width, (size * 0.82) / img.height)
      const w = img.width * scale
      const h = img.height * scale
      const x = (size - w) / 2
      const y = (size - h) / 2

      // Soft shadow
      ctx.shadowColor = 'rgba(0,0,0,0.12)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 8
      ctx.drawImage(img, x, y, w, h)
      ctx.shadowBlur = 0

      // Brightness/contrast enhancement using pixel manipulation
      const imageData = ctx.getImageData(0, 0, size, size)
      const data = imageData.data
      const brightness = 12
      const contrast = 1.12
      for (let i = 0; i < data.length; i += 4) {
        // Skip near-white pixels (background)
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) continue
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness))
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness))
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness))
      }
      ctx.putImageData(imageData, 0, 0)

      // Sharpening via convolution (unsharp mask)
      const sharpData = ctx.getImageData(0, 0, size, size)
      const sd = sharpData.data
      const orig = new Uint8ClampedArray(sd)
      const amt = 0.4
      for (let y2 = 1; y2 < size - 1; y2++) {
        for (let x2 = 1; x2 < size - 1; x2++) {
          const idx = (y2 * size + x2) * 4
          if (orig[idx] > 240 && orig[idx+1] > 240 && orig[idx+2] > 240) continue
          for (let c = 0; c < 3; c++) {
            const n = orig[idx - size * 4 + c]
            const s = orig[idx + size * 4 + c]
            const l = orig[idx - 4 + c]
            const r = orig[idx + 4 + c]
            const blur = (n + s + l + r + orig[idx + c] * 2) / 6
            sd[idx + c] = Math.min(255, Math.max(0, orig[idx + c] + amt * (orig[idx + c] - blur)))
          }
        }
      }
      ctx.putImageData(sharpData, 0, 0)

      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        const processedUrl = URL.createObjectURL(blob)
        resolve({ blob, url: processedUrl, dataUrl: canvas.toDataURL('image/jpeg', 0.92) })
      }, 'image/jpeg', 0.92)
    }
    img.onerror = reject
    img.src = url
  })
}

function detectProductPresentation(ai = {}) {
  const text = [
    ai.productType,
    ai.category,
    ai.name,
    ai.description,
    ...(Array.isArray(ai.tags) ? ai.tags : []),
  ].filter(Boolean).join(' ').toLowerCase()

  if (/(shirt|t-shirt|tshirt|tee|kurta|hoodie|sweatshirt|jacket|blazer|top)/.test(text)) {
    return {
      key: 'upper',
      title: 'Male model render',
      detail: 'Upper-wear detected. Styled on a realistic male torso for a clean catalogue look.',
      badge: 'MODEL FIT',
    }
  }
  if (/(saree|sari|dress|gown|kurti|lehenga|dupatta)/.test(text)) {
    return {
      key: 'drape',
      title: 'Female drape render',
      detail: 'Drape-based apparel detected. Styled on a female model with flowing folds and studio lighting.',
      badge: 'DRAPED',
    }
  }
  if (/(pant|pants|trouser|trousers|jean|jeans|jogger|legging|palazzo|bottom|shorts)/.test(text)) {
    return {
      key: 'lower',
      title: 'Lower-body render',
      detail: 'Bottom-wear detected. Fitted on a lower-body model with shadow-balanced studio framing.',
      badge: 'LOWER FIT',
    }
  }
  return {
    key: 'fallback',
    title: 'Studio enhancement',
    detail: 'Product type was unclear. Using a premium e-commerce background, lighting, and shadow treatment.',
    badge: 'STUDIO',
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function makeBlobResult(canvas, meta = {}) {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      resolve({ blob, url, dataUrl: canvas.toDataURL('image/jpeg', 0.92), ...meta })
    }, 'image/jpeg', 0.92)
  })
}

function drawStudioBackdrop(ctx, size) {
  const bg = ctx.createLinearGradient(0, 0, 0, size)
  bg.addColorStop(0, '#f8fafc')
  bg.addColorStop(0.58, '#ffffff')
  bg.addColorStop(1, '#eef2f7')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const glow = ctx.createRadialGradient(size * 0.5, size * 0.24, 30, size * 0.5, size * 0.24, size * 0.55)
  glow.addColorStop(0, 'rgba(255,255,255,0.96)')
  glow.addColorStop(0.5, 'rgba(255,255,255,0.66)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = 'rgba(148,163,184,0.08)'
  ctx.beginPath()
  ctx.ellipse(size * 0.5, size * 0.84, size * 0.23, size * 0.04, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawModelSilhouette(ctx, size, presentation) {
  const skin = ctx.createLinearGradient(size * 0.5, size * 0.1, size * 0.5, size * 0.9)
  skin.addColorStop(0, '#f3d2bc')
  skin.addColorStop(1, '#d5a585')

  const suit = ctx.createLinearGradient(size * 0.3, size * 0.16, size * 0.7, size * 0.9)
  suit.addColorStop(0, '#dfe7ef')
  suit.addColorStop(1, '#aebdcc')

  ctx.save()
  ctx.globalAlpha = presentation.key === 'fallback' ? 0.18 : 0.34

  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(size * 0.5, size * 0.16, size * 0.07, size * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = suit
  if (presentation.key === 'upper') {
    ctx.beginPath()
    ctx.moveTo(size * 0.34, size * 0.29)
    ctx.quadraticCurveTo(size * 0.31, size * 0.48, size * 0.36, size * 0.76)
    ctx.lineTo(size * 0.64, size * 0.76)
    ctx.quadraticCurveTo(size * 0.69, size * 0.48, size * 0.66, size * 0.29)
    ctx.quadraticCurveTo(size * 0.58, size * 0.2, size * 0.5, size * 0.23)
    ctx.quadraticCurveTo(size * 0.42, size * 0.2, size * 0.34, size * 0.29)
    ctx.fill()
  } else if (presentation.key === 'drape') {
    ctx.beginPath()
    ctx.moveTo(size * 0.38, size * 0.25)
    ctx.quadraticCurveTo(size * 0.29, size * 0.45, size * 0.33, size * 0.82)
    ctx.lineTo(size * 0.67, size * 0.82)
    ctx.quadraticCurveTo(size * 0.71, size * 0.43, size * 0.62, size * 0.25)
    ctx.quadraticCurveTo(size * 0.56, size * 0.18, size * 0.5, size * 0.2)
    ctx.quadraticCurveTo(size * 0.44, size * 0.18, size * 0.38, size * 0.25)
    ctx.fill()
  } else if (presentation.key === 'lower') {
    ctx.beginPath()
    ctx.moveTo(size * 0.41, size * 0.28)
    ctx.lineTo(size * 0.59, size * 0.28)
    ctx.lineTo(size * 0.66, size * 0.44)
    ctx.lineTo(size * 0.59, size * 0.84)
    ctx.lineTo(size * 0.52, size * 0.84)
    ctx.lineTo(size * 0.5, size * 0.57)
    ctx.lineTo(size * 0.48, size * 0.84)
    ctx.lineTo(size * 0.41, size * 0.84)
    ctx.lineTo(size * 0.34, size * 0.44)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawStripMappedProduct(ctx, img, box, presentation) {
  const strips = presentation.key === 'drape' ? 38 : 28
  const sway = presentation.key === 'drape' ? box.w * 0.06 : presentation.key === 'upper' ? box.w * 0.03 : box.w * 0.02
  const pinch = presentation.key === 'upper' ? 0.18 : presentation.key === 'lower' ? 0.12 : 0.08

  for (let i = 0; i < strips; i++) {
    const t = i / strips
    const sx = t * img.width
    const sw = img.width / strips + 1
    const wave = Math.sin(t * Math.PI * (presentation.key === 'drape' ? 1.8 : 1)) * sway
    const contour = Math.sin((t - 0.5) * Math.PI) * pinch * box.w
    const dx = box.x + t * box.w + wave - contour * 0.12
    const dw = box.w / strips + contour * 0.02
    ctx.drawImage(img, sx, 0, sw, img.height, dx, box.y, dw, box.h)
  }

  ctx.save()
  ctx.globalAlpha = 0.12
  const shade = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y)
  shade.addColorStop(0, 'rgba(0,0,0,0.28)')
  shade.addColorStop(0.24, 'rgba(255,255,255,0)')
  shade.addColorStop(0.76, 'rgba(255,255,255,0)')
  shade.addColorStop(1, 'rgba(0,0,0,0.24)')
  ctx.fillStyle = shade
  ctx.fillRect(box.x, box.y, box.w, box.h)
  ctx.restore()
}

async function createMarketplaceProductImage(baseDataUrl, ai = {}) {
  const presentation = detectProductPresentation(ai)
  const img = await loadImage(baseDataUrl)
  const size = 1200
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  drawStudioBackdrop(ctx, size)
  drawModelSilhouette(ctx, size, presentation)

  const target =
    presentation.key === 'upper'
      ? { x: size * 0.295, y: size * 0.23, w: size * 0.41, h: size * 0.52 }
      : presentation.key === 'drape'
        ? { x: size * 0.265, y: size * 0.19, w: size * 0.47, h: size * 0.62 }
        : presentation.key === 'lower'
          ? { x: size * 0.325, y: size * 0.28, w: size * 0.35, h: size * 0.55 }
          : { x: size * 0.18, y: size * 0.14, w: size * 0.64, h: size * 0.64 }

  const scale = Math.min(target.w / img.width, target.h / img.height)
  const drawW = img.width * scale
  const drawH = img.height * scale
  const drawBox = {
    x: target.x + (target.w - drawW) / 2,
    y: target.y + (target.h - drawH) / 2,
    w: drawW,
    h: drawH,
  }

  ctx.save()
  ctx.fillStyle = 'rgba(15,23,42,0.14)'
  ctx.beginPath()
  ctx.ellipse(size * 0.5, presentation.key === 'lower' ? size * 0.86 : size * 0.81, drawBox.w * 0.34, drawBox.h * 0.06, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (presentation.key === 'fallback') {
    ctx.save()
    ctx.shadowColor = 'rgba(15,23,42,0.18)'
    ctx.shadowBlur = 36
    ctx.shadowOffsetY = 14
    ctx.drawImage(img, drawBox.x, drawBox.y, drawBox.w, drawBox.h)
    ctx.restore()
  } else {
    drawStripMappedProduct(ctx, img, drawBox, presentation)
  }

  ctx.save()
  ctx.globalAlpha = 0.1
  const edgeGlow = ctx.createLinearGradient(0, drawBox.y, 0, drawBox.y + drawBox.h)
  edgeGlow.addColorStop(0, 'rgba(255,255,255,0.8)')
  edgeGlow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = edgeGlow
  ctx.fillRect(drawBox.x, drawBox.y, drawBox.w, drawBox.h * 0.42)
  ctx.restore()

  return makeBlobResult(canvas, { presentation })
}

/* ══════════════════════════════════════════════════════════
   SMART PRODUCT CAMERA  — AI Auto-Fill + Multi-Image Upload
══════════════════════════════════════════════════════════ */
function CameraCapture({ onCapture, onAnalyze, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)

  const [mode, setMode] = useState('camera')  // 'camera'|'preview'|'upload'
  const [capturedUrl, setCapturedUrl] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [baseProcessedData, setBaseProcessedData] = useState(null)
  const [processedData, setProcessedData] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [aiResult, setAiResult] = useState(null)

  useEffect(() => { startCamera(); return () => stopCamera() }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 1280, height: 720 } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (e) { setError('Camera not available.'); setMode('upload') }
  }

  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      setCapturedUrl(url); setMode('preview'); stopCamera()
      processAndAnalyze(blob)
    }, 'image/jpeg', 0.95)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const url = URL.createObjectURL(file)
    setCapturedUrl(url); setMode('preview'); stopCamera()
    processAndAnalyze(file)
    e.target.value = ''
  }

  const processAndAnalyze = async (blob) => {
    setProcessing(true); setAnalyzing(false); setAiResult(null); setProcessedData(null); setBaseProcessedData(null)
    try {
      const file = blob instanceof File ? blob : new File([blob], 'cap.jpg', { type: 'image/jpeg' })
      const localPreview = await processProductImage(file)
      setBaseProcessedData(localPreview)
      setAnalyzing(true)
      const { data } = await api.processProductImageAI(file)
      setAiResult(data.analysis || null)
      setProcessedData({
        url: data.transformedUrl,
        dataUrl: data.transformedUrl,
        serverUrl: data.transformedUrl,
        originalUrl: data.originalUrl,
        presentation: data.analysis ? {
          badge: data.analysis.badge,
          title: data.analysis.title,
          detail: data.analysis.detail,
        } : null,
      })
    } catch (e) {
      setError('Processing failed.')
    }
    setProcessing(false); setAnalyzing(false)
  }

  const confirmImage = async () => {
    if (!processedData && !capturedUrl) { onClose(); return }
    setUploading(true)
    try {
      onCapture(processedData?.serverUrl || processedData?.dataUrl || capturedUrl)
      if (aiResult && onAnalyze) onAnalyze(aiResult)
    } catch(e) {
      onCapture(processedData?.serverUrl || processedData?.dataUrl || capturedUrl)
      if (aiResult && onAnalyze) onAnalyze(aiResult)
    }
    setUploading(false); onClose()
  }

  const confirmWithoutAI = async () => {
    setUploading(true)
    try { onCapture(processedData?.serverUrl || processedData?.dataUrl || capturedUrl) }
    catch(e) { onCapture(processedData?.serverUrl || processedData?.dataUrl || capturedUrl) }
    setUploading(false); onClose()
  }

  const isWorking = processing || analyzing || uploading

  return (
    <div className="overlay" style={{ zIndex: 500 }}>
      <div className="modal" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,var(--primary),#a78bfa)', padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Camera /> Smart Product Camera
            <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 100, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '.5px' }}>AI POWERED</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', padding: '6px 8px', display: 'flex' }}><Icons.Close /></button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Camera mode */}
          {mode === 'camera' && !error && (
            <div>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                  <Icons.Upload /> Gallery
                </button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={capturePhoto}>
                  <Icons.Camera /> Capture
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                Camera — AI enhances image + auto-fills all product details
              </div>
            </div>
          )}

          {/* Upload mode fallback */}
          {(mode === 'upload' || error) && (
            <div>
              {error && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', color: '#9a3412', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <div className="camera-btn" onClick={() => fileRef.current?.click()}>
                <Icons.Upload />
                <div>Upload Product Photo</div>
                <div style={{ fontSize: 12, opacity: .7 }}>AI will analyze & auto-fill all fields</div>
              </div>
            </div>
          )}

          {/* Preview + AI results */}
          {mode === 'preview' && (
            <div>
              {/* Before / After comparison */}
              <div className="img-compare" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textAlign: 'center', textTransform: 'uppercase' }}>Original</div>
                  <img src={capturedUrl} alt="Original" />
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', marginBottom: 5, textAlign: 'center', textTransform: 'uppercase' }}>E-commerce Ready</div>
                  {processing ? (
                    <div style={{ height: 140, background: 'var(--bg)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px solid var(--border)' }}>
                      <div style={{ width: 24, height: 24, border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>Rendering studio image...</div>
                    </div>
                  ) : processedData ? (
                    <img src={processedData.url} alt="Enhanced" />
                  ) : baseProcessedData ? (
                    <img src={baseProcessedData.url} alt="Enhanced" />
                  ) : <img src={capturedUrl} alt="Original" />}

                  {/* Analyzing overlay */}
                  {analyzing && (
                    <div className="analyze-overlay">
                      <div style={{fontWeight:900,fontSize:13,color:'#6c47ff',letterSpacing:'.3px'}}>AI</div>
                      <div>AI analyzing product...</div>
                      <div style={{ fontSize: 10, opacity: .7 }}>Reading name · category · price · details</div>
                    </div>
                  )}
                </div>
              </div>

              {!processing && processedData?.presentation && (
                <div style={{ background: '#eff6ff', border: '1px solid rgba(59,130,246,.18)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="ai-badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{processedData.presentation.badge}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{processedData.presentation.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                    {processedData.presentation.detail}
                  </div>
                </div>
              )}

              {/* AI Results */}
              {!processing && !analyzing && aiResult && (
                <div style={{ background: 'var(--primary-light)', border: '1.5px solid rgba(108,71,255,.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span className="ai-badge">AI Detected</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Confidence: {aiResult.confidence || 'medium'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      {k:'Product',  v:aiResult.name},
                      {k:'Category', v:aiResult.category},
                      {k:'Brand',    v:aiResult.brand},
                      {k:'Color',    v:aiResult.color},
                      {k:'Material', v:aiResult.material},
                      {k:'MRP',      v:aiResult.mrp ? '₹'+aiResult.mrp : null},
                      {k:'Price',    v:aiResult.suggestedPrice ? '₹'+aiResult.suggestedPrice : null},
                      {k:'Type',     v:aiResult.productType},
                    ].filter(({v}) => v).map(({k,v}) => (
                      <div key={k} style={{ background: '#fff', borderRadius: 8, padding: '7px 10px', border: '1px solid rgba(108,71,255,.12)' }}>
                        <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{k}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {aiResult.tags?.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {aiResult.tags.map(t => <span key={t} className="tag-chip">#{t}</span>)}
                    </div>
                  )}
                </div>
              )}

              {!processing && !analyzing && !aiResult && (
                <div style={{ background: '#fff7ed', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                  AI analysis unavailable — image enhanced. You can still use it.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setMode('camera'); setCapturedUrl(null); setProcessedData(null); setBaseProcessedData(null); setAiResult(null); setError(''); startCamera() }} disabled={isWorking}>
                  ↺ Retake
                </button>
                {aiResult ? (
                  <button className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg,var(--primary),#a78bfa)' }} onClick={confirmImage} disabled={isWorking}>
                    {uploading ? 'Uploading...' : analyzing ? 'Analyzing...' : 'Use Image + Auto-Fill'}
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={confirmWithoutAI} disabled={isWorking}>
                    {uploading ? 'Uploading...' : 'Use This Image'}
                  </button>
                )}
              </div>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  )
}


/* ── TOAST ── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [])
  return <div className={`toast ${type}`}>{msg}</div>
}

/* ══════════════════════════════════════════════════════════
   AUTH PAGE — full page with animated background
══════════════════════════════════════════════════════════ */
function AuthPage({ onSuccess }) {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loc, setLoc] = useState(null)
  // OTP state
  const [otpStep, setOtpStep] = useState('form')   // 'form' | 'otp'
  const [otpValue, setOtpValue] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpTimer, setOtpTimer] = useState(0)
  const timerRef = useRef(null)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const startTimer = () => {
    setOtpTimer(60)
    timerRef.current = setInterval(() => setOtpTimer(t => { if(t<=1){clearInterval(timerRef.current);return 0} return t-1 }), 1000)
  }

  const sendOtp = async () => {
    if (!form.phone || form.phone.replace(/\D/g,'').length !== 10) { setError('Enter a valid 10-digit phone number'); return }
    setOtpSending(true); setError('')
    try {
      const r = await api.sendOtp(form.phone.replace(/\D/g,''))
      setOtpStep('otp'); startTimer()
      if (r.data.dev_otp) setOtpValue(r.data.dev_otp)  // auto-fill in dev
    } catch(e) { setError(e.response?.data?.detail || 'Failed to send OTP') }
    setOtpSending(false)
  }

  const getLoc = () => navigator.geolocation?.getCurrentPosition(p => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }))

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      let r
      if (tab === 'login') {
        r = await api.login({ email: form.email, password: form.password, ...loc })
      } else {
        if (!form.name || !form.email || !form.password) { setError('Fill all required fields'); setLoading(false); return }
        r = await api.register({ ...form, role: 'OWNER', otp: otpValue, ...loc })
      }
      localStorage.setItem('dott_vendor_access', r.data.accessToken)
      localStorage.setItem('dott_vendor_refresh', r.data.refreshToken)
      onSuccess(r.data.user)
    } catch (e) { setError(e.response?.data?.detail || 'Something went wrong. Please try again.') }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-visual-dots" />
      <div style={{ position: 'relative', zIndex: 1, width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ marginBottom: 16, animation: 'float 3s ease-in-out infinite',fontSize:20,fontWeight:900,color:'rgba(255,255,255,.3)' }}>DOTT</div>
          <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 36, letterSpacing: '-1px', marginBottom: 10 }}>
            DOTT <span style={{ color: '#a78bfa' }}>Vendor</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 16, lineHeight: 1.6, maxWidth: 300 }}>
            Your complete storefront management system.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
            {[
              {title:'Smart Camera',desc:'AI-enhanced product images',Icon:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>},
              {title:'Live Orders',desc:'Real-time order management',Icon:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>},
              {title:'Analytics',desc:'Track revenue & growth',Icon:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>},
              {title:'Instant Alerts',desc:'Real-time order notifications',Icon:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>},
            ].map(({title,desc,Icon})=>(
              <div key={title} style={{ display:'flex',alignItems:'center',gap:12,background:'rgba(255,255,255,.07)',borderRadius:12,padding:'12px 16px',textAlign:'left',border:'1px solid rgba(255,255,255,.08)' }}>
                <span style={{width:32,height:32,borderRadius:8,background:'rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'#a78bfa'}}><Icon/></span>
                <div><div style={{fontWeight:700,fontSize:14,color:'#f3f4f6'}}>{title}</div><div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:1}}>{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 20px',overflowY:'auto' }}>
        <div style={{ width:'100%',maxWidth:420,background:'#fff',borderRadius:24,padding:36,boxShadow:'0 24px 80px rgba(0,0,0,.4)',animation:'scaleIn .25s cubic-bezier(.22,1,.36,1)' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily:'var(--font)',fontWeight:900,fontSize:26,color:'var(--text)',letterSpacing:'-.5px' }}>
              {tab==='login'?'Welcome back':'Create Your Store'}
            </div>
            <div style={{ color:'var(--muted)',fontSize:14,marginTop:4 }}>{tab==='login'?'Sign in to your vendor dashboard':'Set up your store in minutes'}</div>
          </div>

          <div style={{ display:'flex',background:'#f3f0ff',borderRadius:12,padding:4,gap:4,marginBottom:24 }}>
            {['login','register'].map(t => (
              <button key={t} onClick={()=>{setTab(t);setOtpStep('form');setOtpValue('');setError('')}} style={{ flex:1,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',background:tab===t?'#fff':'transparent',color:tab===t?'var(--primary)':'var(--muted)',fontFamily:'var(--font)',fontWeight:700,fontSize:13,transition:'.2s',boxShadow:tab===t?'var(--shadow-sm)':'none' }}>
                {t==='login'?'Sign In':'Register'}
              </button>
            ))}
          </div>

          {/* OTP Step for registration */}
          {tab==='register' && otpStep==='otp' ? (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{textAlign:'center',padding:'16px',background:'var(--primary-light)',borderRadius:14,border:'1.5px solid var(--primary)'}}>
                <div style={{width:52,height:52,borderRadius:12,background:'rgba(108,71,255,.15)',border:'2px solid rgba(108,71,255,.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px'}}><svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#6c47ff' strokeWidth='2' strokeLinecap='round'><rect x='5' y='2' width='14' height='20' rx='2' ry='2'/><line x1='12' y1='18' x2='12.01' y2='18'/></svg></div>
                <div style={{fontWeight:700,fontSize:15,color:'var(--primary)'}}>OTP Sent!</div>
                <div style={{fontSize:13,color:'var(--muted)',marginTop:4}}>Enter the 6-digit OTP sent to {form.phone}</div>
              </div>
              <div>
                <label className="label">Enter OTP</label>
                <input className="input" placeholder="6-digit OTP" value={otpValue} onChange={e=>setOtpValue(e.target.value)} maxLength={6} style={{textAlign:'center',fontSize:24,letterSpacing:8,fontWeight:700}}/>
              </div>
              {error && <div style={{color:'#dc2626',fontSize:13,padding:'10px 14px',background:'#fef2f2',borderRadius:10,fontWeight:600,border:'1px solid #fecaca'}}>{error}</div>}
              <button className="btn btn-primary" style={{width:'100%',padding:'13px',fontSize:15}} onClick={submit} disabled={loading||otpValue.length!==6}>
                {loading?'Verifying...':'Verify & Create Account'}
              </button>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <button onClick={()=>{setOtpStep('form');setOtpValue('')}} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:13}}>← Change number</button>
                {otpTimer>0
                  ?<span style={{fontSize:13,color:'var(--muted)'}}>Resend in {otpTimer}s</span>
                  :<button onClick={sendOtp} style={{background:'none',border:'none',color:'var(--primary)',cursor:'pointer',fontSize:13,fontWeight:700}}>Resend OTP</button>}
              </div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {tab==='register' && <>
                <div><label className="label">Full Name *</label><input className="input" placeholder="Your full name" value={form.name} onChange={set('name')}/></div>
                <div><label className="label">Phone Number *</label><input className="input" placeholder="10-digit mobile number" value={form.phone} onChange={set('phone')}/></div>
              </>}
              <div><label className="label">Email Address *</label><input className="input" type="email" placeholder="vendor@email.com" value={form.email} onChange={set('email')}/></div>
              <div><label className="label">Password *</label><input className="input" type="password" placeholder="Enter your password" value={form.password} onChange={set('password')} onKeyDown={e=>e.key==='Enter'&&(tab==='login'?submit():sendOtp())}/></div>
              <div onClick={getLoc} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:12,border:`1.5px solid ${loc?'var(--green)':'var(--border)'}`,background:loc?'#f0fdf4':'var(--bg)',cursor:'pointer',transition:'.2s'}}>
                <span style={{fontSize:22}}>{loc?'●':'○'}</span>
                <div><div style={{fontWeight:700,fontSize:13}}>{loc?'Location captured':'Set shop location'}</div><div style={{color:'var(--muted)',fontSize:12}}>{loc?`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`:'Used for delivery radius'}</div></div>
              </div>
              {error && <div style={{color:'#dc2626',fontSize:13,padding:'10px 14px',background:'#fef2f2',borderRadius:10,fontWeight:600,border:'1px solid #fecaca'}}>{error}</div>}
              {tab==='login'
                ? <button className="btn btn-primary" style={{width:'100%',padding:'13px',fontSize:15}} onClick={submit} disabled={loading}>{loading?'Signing in...':'→ Sign In'}</button>
                : <button className="btn btn-primary" style={{width:'100%',padding:'13px',fontSize:15}} onClick={sendOtp} disabled={otpSending}>{otpSending?'Sending OTP...':'→ Send OTP & Continue'}</button>}
              {tab==='login' && (
                <div style={{marginTop:4}}>
                  <div style={{textAlign:'center',color:'var(--muted)',fontSize:12,marginBottom:10,textTransform:'uppercase',letterSpacing:'.8px',fontWeight:700}}>Demo Account</div>
                  <button onClick={()=>setForm(f=>({...f,email:'rahul@dott.in',password:'password123'}))} style={{width:'100%',padding:'11px',borderRadius:10,border:'1.5px solid var(--border)',background:'var(--bg)',color:'var(--muted)',cursor:'pointer',fontSize:13,fontFamily:'var(--font)',fontWeight:700,transition:'.2s'}} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                    rahul@dott.in / password123
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Dashboard({ shop }) {
  const [analytics, setAnalytics] = useState(null)
  const [orders, setOrders] = useState([])

  useEffect(() => {
    api.analytics().then(r => setAnalytics(r.data)).catch(() => {})
    api.shopOrders({ status: 'PENDING' }).then(r => setOrders(r.data)).catch(() => {})
  }, [])

  const stats = [
    { label: "Today's Revenue", val: `₹${analytics?.today?.revenue || 0}`, sub: `${analytics?.today?.orders || 0} orders`, color: '#6c47ff', letter: 'T' },
    { label: "This Month", val: `₹${analytics?.month?.revenue || 0}`, sub: `${analytics?.month?.orders || 0} orders`, color: '#0ea5e9', letter: 'M' },
    { label: "All Time", val: `₹${analytics?.allTime?.revenue || 0}`, sub: `${analytics?.allTime?.orders || 0} orders`, color: '#22c55e', letter: 'A' },
    { label: "Pending Returns", val: analytics?.pendingReturns ?? '—', sub: 'needs action', color: '#f97316', letter: 'R' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{shop?.name} · {shop?.category}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className={`badge ${shop?.isOpen ? 'badge-success' : 'badge-danger'}`}>{shop?.isOpen ? '● Open' : '● Closed'}</span>
          {shop?.isSuspended && <span className="badge badge-danger">Suspended</span>}
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s, i) => (
          <div key={s.label} className="stat-card fade-up" style={{ animationDelay: `${i * 0.07}s` }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="card fade-up" style={{ animationDelay: '.28s', borderColor: '#fde68a' }}>
          <div className="card-title" style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
             {orders.length} Pending Order{orders.length > 1 ? 's' : ''} — Action Required
          </div>
          {orders.slice(0, 2).map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border2)', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>#{o.orderCode} — {o.customer?.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{o.items?.length} items · ₹{o.total} · {o.paymentMethod?.toUpperCase()}</div>
              </div>
              <span className="badge badge-warning">Pending</span>
            </div>
          ))}
        </div>
      )}

      <div className="card fade-up" style={{ animationDelay: '.3s', marginTop: 16 }}>
        <div className="card-title">Quick Tips</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            {icon:'CAM', title:'Smart Camera', desc:'Use camera button to capture + AI enhance product images automatically'},
            {icon:'ORD', title:'Orders', desc:'Accept orders fast — riders get notified instantly on acceptance'},
            {icon:'ANA', title:'Analytics', desc:'Track revenue trends in the Analytics section'},
            {icon:'SET', title:'Settings', desc:'Enable WhatsApp mode to get order alerts on your phone'},
          ].map(({icon, title, desc}) => (
            <div key={title} style={{ display: 'flex', gap: 10, padding: '12px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 6, padding: '3px 6px', flexShrink: 0, alignSelf: 'flex-start', letterSpacing: '.3px' }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   ORDERS PAGE
══════════════════════════════════════════════════════════ */
function OrdersPage({ showToast }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL_ACTIVE')
  const [actioning, setActioning] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const load = useCallback(async () => {
    try { const r = await api.shopOrders(); setOrders(r.data) } catch (e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t) }, [load])

  const accept = async (id) => {
    setActioning(id)
    try { await api.acceptOrder(id); showToast('Order accepted — finding rider', 'success'); load() }
    catch (e) { showToast(e.response?.data?.detail || 'Failed', 'error') }
    setActioning(null)
  }
  const reject = async (id) => {
    setActioning(id)
    try { await api.rejectOrder(id); showToast('Order rejected', 'info'); load() }
    catch (e) { showToast('Failed', 'error') }
    setActioning(null)
  }
  const startPrep = async (o) => {
    if (!o.riderId) { showToast('⏳ Wait for rider to accept first', 'error'); return }
    setActioning(o.id)
    try { await api.updateStatus(o.id, 'PACKING'); showToast('Preparation started', 'success'); load() }
    catch (e) { showToast(e.response?.data?.detail || 'Failed', 'error') }
    setActioning(null)
  }

  const FLOW_STEPS = [
    { key: 'PENDING',          label: 'Order Placed',         icon: '',    who: 'customer' },
    { key: 'CONFIRMED',        label: 'Accepted by Vendor',   icon: '',    who: 'vendor'   },
    { key: 'RIDER_FINDING',    label: 'Finding Rider',        icon: '',    who: 'system',  virtual: true },
    { key: 'PACKING',          label: 'Preparing',            icon: '',    who: 'vendor'   },
    { key: 'PICKED_UP',        label: 'Rider Picked Up',      icon: '',    who: 'rider'    },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery',     icon: '',    who: 'rider'    },
    { key: 'DELIVERED',        label: 'Delivered',            icon: '',    who: 'rider'    },
  ]

  const FILTER_TABS = [
    { id: 'ALL_ACTIVE', label: 'Active', filter: o => !['DELIVERED','CANCELLED'].includes(o.status) },
    { id: 'PENDING',    label: 'New',    filter: o => o.status === 'PENDING' },
    { id: 'CONFIRMED',  label: 'Accepted',filter: o => o.status === 'CONFIRMED' },
    { id: 'PACKING',    label: 'Preparing',filter: o => o.status === 'PACKING' },
    { id: 'DELIVERED',  label: 'Done',   filter: o => o.status === 'DELIVERED' },
    { id: 'CANCELLED',  label: 'Cancelled', filter: o => o.status === 'CANCELLED' },
  ]

  const activeTab = FILTER_TABS.find(t => t.id === filter) || FILTER_TABS[0]
  const filtered  = orders.filter(activeTab.filter)
  const pendingCount = orders.filter(o => o.status === 'PENDING').length

  const getOrderStep = (status) => {
    if (status === 'CONFIRMED') return 1
    if (status === 'PACKING')   return 3
    if (status === 'PICKED_UP') return 4
    if (status === 'OUT_FOR_DELIVERY') return 5
    if (status === 'DELIVERED') return 6
    return 0
  }

  return (
    <div className="page fade-up">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1e1b3a,#312e81)', borderRadius: 18, padding: '22px 24px', marginBottom: 22, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px,transparent 1px)', backgroundSize: '22px 22px' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 22, letterSpacing: '-.5px' }}>Orders</div>
            <div style={{ opacity: .65, fontSize: 13, marginTop: 3 }}>{orders.filter(o=>!['DELIVERED','CANCELLED'].includes(o.status)).length} active · auto-refreshes every 8s</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {pendingCount > 0 && (
              <div style={{ background: '#ef4444', color: '#fff', fontWeight: 900, fontSize: 13, padding: '6px 14px', borderRadius: 100, animation: 'pulse 2s infinite', display: 'flex', alignItems: 'center', gap: 6 }}>
                 {pendingCount} new
              </div>
            )}
            <button onClick={load} style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)' }}>↻</button>
          </div>
        </div>
      </div>

      {/* Workflow explanation */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid var(--border)', padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 13, marginBottom: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
           Order Flow
        </div>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center', overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { label: 'New Order', color: '#f59e0b', who: 'Customer', abbr: 'NEW' },
            { label: 'You Accept', color: '#6c47ff', who: 'Vendor ↑', abbr: 'ACC' },
            { label: 'Rider Finds', color: '#0ea5e9', who: 'System', abbr: 'SYS' },
            { label: 'You Prepare', color: '#8b5cf6', who: 'Vendor ↑', abbr: 'PREP' },
            { label: 'Picked Up', color: '#06b6d4', who: 'Rider', abbr: 'PICK' },
            { label: 'Delivering', color: '#f97316', who: 'Rider', abbr: 'DEL' },
            { label: 'Delivered', color: '#22c55e', who: 'Rider', abbr: 'DONE' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 62 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: step.color + '15', border: `2px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{step.abbr}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.3 }}>{step.label}</div>
                <div style={{ fontSize: 8, color: step.who.includes('↑') ? step.color : 'var(--muted)', fontWeight: step.who.includes('↑') ? 800 : 600, background: step.who.includes('↑') ? step.color + '12' : 'transparent', padding: '1px 5px', borderRadius: 100 }}>{step.who.replace(' ↑', '')}</div>
              </div>
              {i < 6 && <div style={{ width: 16, height: 1.5, background: 'linear-gradient(90deg,#e5e7eb,#d1d5db)', flexShrink: 0, margin: '0 1px', marginTop: -18 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(tab => {
          const cnt = orders.filter(tab.filter).length
          return (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              style={{ padding: '7px 14px', borderRadius: 100, border: `1.5px solid ${filter === tab.id ? 'var(--primary)' : 'var(--border)'}`,
                background: filter === tab.id ? 'var(--primary)' : '#fff',
                color: filter === tab.id ? '#fff' : 'var(--muted)',
                fontFamily: 'var(--font)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: '.15s',
                display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.label}
              {cnt > 0 && <span style={{ background: filter === tab.id ? 'rgba(255,255,255,.25)' : '#f3f4f6', color: filter === tab.id ? '#fff' : 'var(--muted)', borderRadius: 100, padding: '1px 7px', fontSize: 10, fontWeight: 900 }}>{cnt}</span>}
            </button>
          )
        })}
      </div>

      {/* Orders list */}
      {loading && filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <span className="empty-icon"></span>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>No {activeTab.label.toLowerCase()} orders</div>
          <div style={{ fontSize: 13 }}>New orders will appear automatically</div>
        </div>
      ) : (
        filtered.map((o, i) => {
          const isExpanded = expandedId === o.id
          const stepIdx    = getOrderStep(o.status)
          const riderAccepted = !!o.riderId
          const isNew = o.status === 'PENDING'
          const isConfirmed = o.status === 'CONFIRMED'
          const isPacking = o.status === 'PACKING'
          const borderColor = isNew ? '#f59e0b' : STATUS_COLOR[o.status]

          return (
            <div key={o.id} className="fade-up" style={{ marginBottom: 14, animationDelay: `${i * 0.05}s` }}>
              <div style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${borderColor}30`, boxShadow: isNew ? `0 4px 20px ${borderColor}20` : 'var(--shadow-sm)', overflow: 'hidden', transition: '.2s' }}>

                {/* Order header */}
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border2)', cursor: 'pointer', background: isNew ? `linear-gradient(135deg,${borderColor}08,transparent)` : '#fff' }}
                  onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 15 }}>#{o.orderCode}</span>
                        <span style={{ background: `${STATUS_COLOR[o.status]}15`, color: STATUS_COLOR[o.status], fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 100, border: `1px solid ${STATUS_COLOR[o.status]}30` }}>
                          {STATUS_LABEL[o.status]}
                        </span>
                        {isNew && <span style={{ background: '#fef9c3', color: '#92400e', fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 100, border: '1px solid #fde68a', animation: 'pulse 2s infinite' }}> New!</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {o.customer?.name} · {o.customer?.phone}
                        <span style={{ margin: '0 5px' }}>·</span>
                        {new Date(o.placedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 18, color: 'var(--primary)' }}>₹{o.total}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{o.paymentMethod}</div>
                      {!['PENDING','CANCELLED','DELIVERED'].includes(o.status) && <div style={{marginTop:6}}><DeliveryCountdownSync placedAt={o.placedAt} deadline={o.deliveryDeadline||o.countdown?.deadline} serverNow={o.countdown?.serverNow} /></div>}
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  {!isNew && o.status !== 'CANCELLED' && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1,2,3,4,5,6].map(s => (
                          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= stepIdx ? STATUS_COLOR[o.status] : '#e5e7eb', transition: '.3s' }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div style={{ padding: '16px 18px' }}>
                    {/* Items */}
                    <div style={{ marginBottom: 14 }}>
                      {o.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: idx < o.items.length - 1 ? '1px solid var(--border2)' : 'none' }}>
                          {item.imageUrl && <img src={item.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}{item.size ? ` (${item.size})` : ''}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>×{item.qty} · ₹{item.price * item.qty}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Delivery address */}
                    <div style={{ display: 'flex', gap: 8, padding: '9px 12px', background: '#f8f7ff', borderRadius: 10, marginBottom: 14, fontSize: 12 }}>
                      <span>◎</span>
                      <span style={{ color: 'var(--muted)' }}>{o.deliveryAddress}</span>
                    </div>

                    {/* Rider info */}
                    {o.rider && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0fdf4', borderRadius: 12, marginBottom: 14, border: '1px solid #bbf7d0' }}>
                        <span style={{ fontSize: 22 }}>RIDER</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#15803d' }}>Rider Assigned</div>
                          <div style={{ fontSize: 12, color: '#4b7c5a' }}>{o.rider.name} · {o.rider.phone}</div>
                        </div>
                        <a href={`tel:${o.rider.phone}`} style={{ background: '#15803d', color: '#fff', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}> Call</a>
                      </div>
                    )}

                    {/* ── VENDOR ACTION PANEL ── */}

                    {/* PENDING: Accept or Reject */}
                    {isNew && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => reject(o.id)} disabled={actioning === o.id}
                          style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontFamily: 'var(--font)', fontWeight: 800, fontSize: 14, cursor: 'pointer', transition: '.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                          {actioning === o.id ? '…' : '✕ Reject'}
                        </button>
                        <button onClick={() => accept(o.id)} disabled={actioning === o.id}
                          style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontFamily: 'var(--font)', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(22,163,74,.3)', transition: '.15s' }}>
                          {actioning === o.id ? '…' : '✓ Accept Order'}
                        </button>
                      </div>
                    )}

                    {/* CONFIRMED: waiting for rider */}
                    {isConfirmed && !riderAccepted && (
                      <div style={{ padding: '16px', borderRadius: 14, background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1.5px solid #fde68a', textAlign: 'center' }}>
                        <div style={{ width:48, height:48, borderRadius:12, background:'linear-gradient(135deg,#6c47ff,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', animation:'float 2s ease infinite' }}><svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#fff' strokeWidth='2' strokeLinecap='round'><path d='M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z'/></svg></div>
                        <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 15, color: '#92400e', marginBottom: 4 }}>Waiting for Rider…</div>
                        <div style={{ fontSize: 12, color: '#a16207', lineHeight: 1.5 }}>A rider must accept this delivery before you can start preparing.<br/>This usually takes 1–3 minutes.</div>
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontSize: 11, color: '#a16207', fontWeight: 700 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} /> Searching for available riders nearby
                        </div>
                      </div>
                    )}

                    {/* CONFIRMED + rider accepted: can start prep */}
                    {isConfirmed && riderAccepted && (
                      <div>
                        <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #86efac', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>✓</span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 13, color: '#15803d' }}>Rider {o.rider?.name} has accepted!</div>
                            <div style={{ fontSize: 12, color: '#4b7c5a' }}>You can now start preparing the order</div>
                          </div>
                        </div>
                        <button onClick={() => startPrep(o)} disabled={actioning === o.id}
                          style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))', color: '#fff', fontFamily: 'var(--font)', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: 'var(--shadow)', transition: '.2s' }}>
                          {actioning === o.id ? '…' : '★ Start Preparing'}
                        </button>
                      </div>
                    )}

                    {/* PACKING: vendor preparing, rider will pick up */}
                    {isPacking && (
                      <div style={{ padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1.5px solid #c4b5fd', textAlign: 'center' }}>
                        <div style={{ fontSize: 30, marginBottom: 6 }}>★</div>
                        <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 15, color: '#5b21b6', marginBottom: 3 }}>Pack the order</div>
                        <div style={{ fontSize: 12, color: '#7c3aed' }}>Rider {o.rider?.name} will pick up when ready.<br/>Pack carefully and mark it clearly.</div>
                      </div>
                    )}

                    {/* PICKED_UP and beyond: rider handles everything */}
                    {['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status) && (
                      <div style={{ padding: '13px 15px', borderRadius: 12, background: '#fff7ed', border: '1.5px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>RIDER</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#9a3412' }}>Rider is handling delivery</div>
                          <div style={{ fontSize: 12, color: '#c2410c' }}>{o.status === 'PICKED_UP' ? 'Order picked up — on the way to customer' : 'Out for delivery — almost there!'}</div>
                        </div>
                      </div>
                    )}

                    {o.status === 'DELIVERED' && (
                      <div style={{ padding: '13px 15px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #86efac', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>✓</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#15803d' }}>Order Delivered!</div>
                          <div style={{ fontSize: 12, color: '#4b7c5a' }}>₹{o.subtotal} will be credited after platform fee deduction</div>
                        </div>
                      </div>
                    )}

                    {o.status === 'CANCELLED' && (
                      <div style={{ padding: '11px 14px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                        ✕ Order was cancelled
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsed preview of action needed */}
                {!isExpanded && (
                  <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, background: '#f8f7ff', cursor: 'pointer' }}
                    onClick={() => setExpandedId(o.id)}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>
                      {o.items?.slice(0,2).map(i => `${i.name}${i.size ? ` (${i.size})` : ''}`).join('  ·  ')}
                      {o.items?.length > 2 && `  +${o.items.length - 2} more`}
                    </div>
                    {isNew && <span style={{ background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 100 }}>Tap to respond</span>}
                    {isConfirmed && !o.riderId && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 100 }}>⏳ Awaiting rider</span>}
                    {isConfirmed && o.riderId && <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 100 }}>▶ Start prep</span>}
                    <span style={{ color: 'var(--muted)', fontSize: 14 }}>›</span>
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}


/* ══════════════════════════════════════════════════════════
   PRODUCT FORM MODAL with Camera
══════════════════════════════════════════════════════════ */
function FormSection({id, label, isOpen, onToggle, children}) {
  return (
    <div style={{border:'1.5px solid var(--border2)',borderRadius:14,overflow:'hidden',marginBottom:12}}>
      <div onClick={onToggle}
        style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',cursor:'pointer',background:isOpen?'var(--primary-light)':'var(--bg)',transition:'.15s'}}>
        <span style={{fontWeight:800,fontSize:14,color:isOpen?'var(--primary)':'var(--text)'}}>{label}</span>
        <span style={{color:'var(--muted)',fontSize:16}}>{isOpen?'▲':'▼'}</span>
      </div>
      {isOpen && <div style={{padding:'14px 16px'}}>{children}</div>}
    </div>
  )
}

function ProductFormModal({ initial, onClose, onSave, saving }) {
  const PRESET_COLORS = [
    {name:'Black',   hex:'#1a1a1a'},{name:'White',  hex:'#ffffff'},{name:'Navy',    hex:'#1e3a8a'},
    {name:'Red',     hex:'#dc2626'},{name:'Pink',   hex:'#ec4899'},{name:'Green',   hex:'#16a34a'},
    {name:'Blue',    hex:'#2563eb'},{name:'Yellow', hex:'#eab308'},{name:'Orange',  hex:'#f97316'},
    {name:'Purple',  hex:'#9333ea'},{name:'Brown',  hex:'#92400e'},{name:'Grey',    hex:'#6b7280'},
    {name:'Beige',   hex:'#d4b896'},{name:'Maroon', hex:'#7f1d1d'},{name:'Teal',    hex:'#0d9488'},
  ]

  const blank = {
    name:'', description:'', price:'', category:'', imageUrl:'',
    images:[], colors:[], brand:'', material:'', tags:[],
    stock:10, hasSizes:false, sizes:[]
  }
  const toForm = (d) => ({
    ...blank, ...d,
    sizes: Array.isArray(d?.sizes) ? d.sizes : [],
    colors: Array.isArray(d?.colors) ? d.colors : [],
    images: Array.isArray(d?.images) ? d.images : [],
    tags: Array.isArray(d?.tags) ? d.tags : [],
  })
  const [form, setForm] = useState(initial ? toForm(initial) : blank)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraTarget, setCameraTarget] = useState('main')   // 'main' | colorIdx
  const [aiApplied, setAiApplied] = useState(false)
  const [aiFields, setAiFields] = useState({})
  const [tagInput, setTagInput] = useState('')
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#000000')
  const [activeColorIdx, setActiveColorIdx] = useState(null)
  const [expandedSection, setExpandedSection] = useState('images')  // 'images'|'colors'|'sizes'|'details'

  const imgRefs = { back: useRef(null), side: useRef(null), tag: useRef(null) }
  const colorImgRef = useRef(null)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const isEdit = !!initial?.id

  // ── AI apply ──
  const applyAiResult = (ai) => {
    if (!ai) return
    const updates = {}; const filled = {}
    if (ai.name && !form.name)         { updates.name = ai.name; filled.name = true }
    if (ai.category && !form.category) { updates.category = ai.category; filled.category = true }
    if (ai.brand)                      { updates.brand = ai.brand; filled.brand = true }
    if (ai.color)                      { updates.color = ai.color }
    if (ai.material)                   { updates.material = ai.material; filled.material = true }
    if (ai.description && !form.description) { updates.description = ai.description; filled.description = true }
    if (ai.suggestedPrice && !form.price)    { updates.price = ai.suggestedPrice; filled.price = true }
    if (ai.tags?.length)               { updates.tags = ai.tags; filled.tags = true }
    if (ai.sizes && !form.hasSizes && ai.sizes.includes(',')) {
      updates.hasSizes = true
      updates.sizes = ai.sizes.split(',').map(s=>s.trim()).filter(Boolean).map(sz=>({size:sz,stock:5}))
      filled.sizes = true
    }
    // Auto-add detected color as first color variant
    if (ai.color && form.colors.length === 0) {
      const hex = PRESET_COLORS.find(c => c.name.toLowerCase()===ai.color.toLowerCase())?.hex || '#888888'
      updates.colors = [{ name: ai.color, hex, imageUrl: form.imageUrl, images: [] }]
      filled.colorAdded = true
    }
    setForm(f => ({ ...f, ...updates }))
    setAiFields(filled); setAiApplied(true)
  }

  // ── Image handlers ──
  const handleCapture = (url) => {
    if (cameraTarget === 'main') {
      setForm(f => ({ ...f, imageUrl: url }))
    } else if (typeof cameraTarget === 'number') {
      setForm(f => {
        const colors = [...f.colors]
        colors[cameraTarget] = { ...colors[cameraTarget], imageUrl: url }
        return { ...f, colors }
      })
    }
  }

  const uploadSlotImage = async (slot, file) => {
    try {
      const r = await api.uploadImage(file)
      const url = r.data.url
      if (slot === 'front') { setForm(f => ({ ...f, imageUrl: url })) }
      else { setForm(f => ({ ...f, images: [...(f.images||[]), url] })) }
    } catch(e) {}
  }

  const uploadColorImage = async (colorIdx, file) => {
    try {
      const r = await api.uploadImage(file)
      setForm(f => {
        const colors = [...f.colors]
        colors[colorIdx] = { ...colors[colorIdx], imageUrl: r.data.url }
        return { ...f, colors }
      })
    } catch(e) {}
  }

  const removeExtraImage = (url) => setForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))

  // ── Color variants ──
  const addColor = () => {
    if (!newColorName.trim()) return
    const c = { name: newColorName.trim(), hex: newColorHex, imageUrl: '', images: [] }
    setForm(f => ({ ...f, colors: [...f.colors, c] }))
    setNewColorName(''); setNewColorHex('#000000')
    setActiveColorIdx(form.colors.length)
  }

  const addPresetColor = (preset) => {
    if (form.colors.find(c => c.name === preset.name)) return
    setForm(f => ({ ...f, colors: [...f.colors, { ...preset, imageUrl: '', images: [] }] }))
  }

  const removeColor = (idx) => {
    setForm(f => ({ ...f, colors: f.colors.filter((_,i) => i !== idx) }))
    if (activeColorIdx === idx) setActiveColorIdx(null)
  }

  // ── Tags ──
  const addTag = (t) => {
    const tag = t.trim().toLowerCase().replace(/[^a-z0-9]/g,'')
    if (!tag || (form.tags||[]).includes(tag)) return
    setForm(f => ({ ...f, tags: [...(f.tags||[]), tag] })); setTagInput('')
  }
  const removeTag = (t) => setForm(f => ({ ...f, tags: (f.tags||[]).filter(x=>x!==t) }))

  // Section uses props instead of closure - prevents cursor jump on re-render

  return (
    <>
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:660,maxHeight:'93vh',overflowY:'auto'}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontFamily:'var(--font)',fontWeight:900,fontSize:18,color:'var(--text)'}}>
              {isEdit ? '️ Edit Product' : '+ Add Product'}
            </div>
            {aiApplied && <span className="ai-badge">AI AI Filled</span>}
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)'}}><Icons.Close/></button>
        </div>

        {aiApplied && (
          <div style={{background:'linear-gradient(135deg,var(--primary-light),rgba(167,139,250,.1))',border:'1.5px solid rgba(108,71,255,.2)',borderRadius:12,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>AI</span>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:'var(--primary)'}}>AI filled your product details!</div><div style={{fontSize:12,color:'var(--muted)'}}>Review all fields. Purple-highlighted = AI-detected.</div></div>
            <button onClick={()=>setAiApplied(false)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:16}}>×</button>
          </div>
        )}

        {/* ── SECTION 1: IMAGES ── */}
        <FormSection id="images" label="PHOTO Product Images" isOpen={expandedSection==="images"} onToggle={()=>setExpandedSection(s=>s==="images"?null:"images")}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            {/* Main image */}
            <div>
              <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Main Photo (AI Analyze)</div>
              <div style={{position:'relative',width:'100%',aspectRatio:'1',borderRadius:12,overflow:'hidden',border:`2px solid ${form.imageUrl?'var(--primary)':'var(--border)'}`,background:'#f9fafb',cursor:'pointer'}}
                onClick={()=>{setCameraTarget('main');setShowCamera(true)}}>
                {form.imageUrl
                  ? <img src={form.imageUrl} alt="main" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6}}>
                      <span style={{fontSize:28}}>PHOTO</span>
                      <span style={{fontSize:11,color:'var(--primary)',fontWeight:700}}>Tap to capture</span>
                      <span style={{fontSize:10,color:'var(--muted)'}}>AI auto-fills all fields</span>
                    </div>}
                {form.imageUrl && <div style={{position:'absolute',bottom:6,right:6,background:'var(--primary)',color:'#fff',borderRadius:100,padding:'3px 8px',fontSize:10,fontWeight:700}}>️ Change</div>}
              </div>
            </div>
            {/* Extra angles */}
            <div>
              <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:6,textTransform:'uppercase'}}>Extra Angles</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {(form.images||[]).slice(0,3).map((url,i)=>(
                  <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:8,overflow:'hidden',border:'1.5px solid var(--border)'}}>
                    <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    <button onClick={()=>removeExtraImage(url)} style={{position:'absolute',top:2,right:2,background:'rgba(239,68,68,.9)',border:'none',color:'#fff',borderRadius:'50%',width:18,height:18,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                  </div>
                ))}
                <label style={{aspectRatio:'1',borderRadius:8,border:'2px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:'var(--bg)',transition:'.15s',fontSize:20,color:'var(--muted)'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  +
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadSlotImage('extra',f);e.target.value=''}}/>
                </label>
              </div>
            </div>
          </div>
          <input className="input" placeholder="Or paste main image URL…" value={form.imageUrl||''} onChange={set('imageUrl')} style={{fontSize:12}}/>
        </FormSection>

        {/* ── SECTION 2: COLOR VARIANTS ── */}
        <FormSection id="colors" label={` Color Variants ${form.colors.length>0?`(${form.colors.length})`:'— Optional'}`} isOpen={expandedSection==="colors"} onToggle={()=>setExpandedSection(s=>s==="colors"?null:"colors")}>
          {/* Preset color swatches */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:'var(--muted)',fontWeight:700,marginBottom:8}}>Quick-add preset colors</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {PRESET_COLORS.map(pc=>{
                const already = form.colors.find(c=>c.name===pc.name)
                return(
                  <div key={pc.name} onClick={()=>!already&&addPresetColor(pc)} title={pc.name}
                    style={{width:28,height:28,borderRadius:'50%',background:pc.hex,cursor:already?'default':'pointer',
                      border:`2.5px solid ${already?'var(--primary)':'rgba(0,0,0,.12)'}`,
                      boxShadow:already?'0 0 0 2px var(--primary-light)':'none',
                      transform:already?'scale(1.1)':'scale(1)',transition:'.15s',flexShrink:0,
                      opacity:already?.5:1,position:'relative'}}>
                    {already&&<span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'#fff',fontWeight:900,textShadow:'0 1px 3px rgba(0,0,0,.5)'}}>✓</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Custom color row */}
          <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'center'}}>
            <input type="color" value={newColorHex} onChange={e=>setNewColorHex(e.target.value)} style={{width:40,height:38,borderRadius:8,border:'1.5px solid var(--border)',cursor:'pointer',padding:2}}/>
            <input className="input" placeholder="Color name (e.g. Midnight Blue)" value={newColorName} onChange={e=>setNewColorName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addColor()} style={{flex:1}}/>
            <button className="btn btn-primary btn-sm" onClick={addColor} style={{flexShrink:0}}>+ Add</button>
          </div>

          {/* Added color variants */}
          {form.colors.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {form.colors.map((c,idx)=>(
                <div key={idx} style={{border:`2px solid ${activeColorIdx===idx?'var(--primary)':'var(--border2)'}`,borderRadius:12,padding:'10px 12px',background:activeColorIdx===idx?'var(--primary-light)':'var(--surface)',transition:'.15s',cursor:'pointer'}}
                  onClick={()=>setActiveColorIdx(activeColorIdx===idx?null:idx)}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:c.hex,border:'2px solid rgba(0,0,0,.12)',flexShrink:0,boxShadow:`inset 0 1px 3px rgba(0,0,0,.2)`}}/>
                    <span style={{fontWeight:700,fontSize:13,flex:1}}>{c.name}</span>
                    {c.imageUrl && <img src={c.imageUrl} alt="" style={{width:32,height:32,borderRadius:6,objectFit:'cover',border:'1px solid var(--border)'}}/>}
                    <button onClick={e=>{e.stopPropagation();removeColor(idx)}} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:16,padding:'0 4px'}}>×</button>
                  </div>
                  {activeColorIdx===idx&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid rgba(108,71,255,.15)'}}>
                      <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:8}}>Photo for this color</div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        {c.imageUrl
                          ?<img src={c.imageUrl} alt="" style={{width:60,height:60,borderRadius:10,objectFit:'cover',border:'1.5px solid var(--border)',flexShrink:0}}/>
                          :<div style={{width:60,height:60,borderRadius:10,border:'2px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}></div>}
                        <div style={{display:'flex',flexDirection:'column',gap:6,flex:1}}>
                          <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setCameraTarget(idx);setShowCamera(true)}}>PHOTO Camera</button>
                          <label className="btn btn-ghost btn-sm" style={{cursor:'pointer',justifyContent:'center'}}>
                             Upload
                            <input ref={colorImgRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadColorImage(idx,f);e.target.value=''}}/>
                          </label>
                        </div>
                        {c.imageUrl&&<button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setForm(f=>{const cols=[...f.colors];cols[idx]={...cols[idx],imageUrl:f.imageUrl};return{...f,colors:cols}})}}>Use main photo</button>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {form.colors.length===0&&<div style={{textAlign:'center',padding:'20px 0',color:'var(--muted)',fontSize:13}}>Add colors if this product comes in multiple variants. Customers can switch between them on the product page.</div>}
        </FormSection>

        {/* ── SECTION 3: PRODUCT DETAILS ── */}
        <FormSection id="details" label=" Product Details" isOpen={expandedSection==="details"} onToggle={()=>setExpandedSection(s=>s==="details"?null:"details")}>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="grid-2">
              <div>
                <label className="label">Name * {aiFields.name&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <input className={`input ${aiFields.name?'ai-glow':''}`} placeholder="Product name" value={form.name} onChange={set('name')}/>
              </div>
              <div>
                <label className="label">Price (₹) * {aiFields.price&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <input className={`input ${aiFields.price?'ai-glow':''}`} type="number" min="0" placeholder="Selling price" value={form.price} onChange={set('price')}/>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label className="label">Category {aiFields.category&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <input className={`input ${aiFields.category?'ai-glow':''}`} placeholder="Fashion, Footwear…" value={form.category||''} onChange={set('category')}/>
              </div>
              <div>
                <label className="label">Brand {aiFields.brand&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <input className={`input ${aiFields.brand?'ai-glow':''}`} placeholder="Brand name" value={form.brand||''} onChange={set('brand')}/>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label className="label">Material {aiFields.material&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <input className={`input ${aiFields.material?'ai-glow':''}`} placeholder="Cotton, Polyester…" value={form.material||''} onChange={set('material')}/>
              </div>
              <div>
                <label className="label">Stock</label>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>setForm(f=>({...f,stock:Math.max(0,(f.stock||0)-1)}))} style={{padding:'11px 14px',borderRadius:10,border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontWeight:900}}>−</button>
                  <input className="input" type="number" min="0" value={form.stock} onChange={set('stock')} style={{textAlign:'center'}}/>
                  <button onClick={()=>setForm(f=>({...f,stock:(f.stock||0)+1}))} style={{padding:'11px 14px',borderRadius:10,border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontWeight:900}}>+</button>
                </div>
              </div>
            </div>
            <div>
              <label className="label">Description {aiFields.description&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
              <textarea className={`input ${aiFields.description?'ai-glow':''}`} rows={3} value={form.description||''} onChange={set('description')} style={{resize:'none'}} placeholder="Product description for customers"/>
            </div>
            {/* Tags */}
            <div>
              <label className="label">Tags {aiFields.tags&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
                {(form.tags||[]).map(t=>(
                  <span key={t} className="tag-chip">#{t} <span className="x" onClick={()=>removeTag(t)}>×</span></span>
                ))}
              </div>
              <div style={{display:'flex',gap:8}}>
                <input className="input" placeholder="Add tag…" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag(tagInput)}}} style={{flex:1}}/>
                <button className="btn btn-ghost" style={{padding:'10px 14px'}} onClick={()=>addTag(tagInput)}>+ Add</button>
              </div>
            </div>
          </div>
        </FormSection>

        {/* ── SECTION 4: SIZES ── */}
        <FormSection id="sizes" label={` Size Variants ${form.hasSizes?`(${form.sizes.length} sizes)`:'— Optional'}`} isOpen={expandedSection==="sizes"} onToggle={()=>setExpandedSection(s=>s==="sizes"?null:"sizes")}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:form.hasSizes?14:0}}>
            <div style={{color:'var(--muted)',fontSize:13}}>Enable for clothing with multiple sizes {aiFields.sizes&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</div>
            <button className={`toggle ${form.hasSizes?'on':'off'}`} onClick={()=>setForm(f=>({...f,hasSizes:!f.hasSizes,sizes:f.hasSizes?[]:[{size:'S',stock:5},{size:'M',stock:5},{size:'L',stock:5},{size:'XL',stock:3}]}))}/>
          </div>
          {form.hasSizes&&(()=>{
            const sizes=form.sizes||[]
            const addSize=(sz)=>{if(sizes.find(s=>s.size===sz))return;setForm(f=>({...f,sizes:[...f.sizes,{size:sz,stock:5}]}))}
            const removeSize=(sz)=>setForm(f=>({...f,sizes:f.sizes.filter(s=>s.size!==sz)}))
            const updateStock=(sz,val)=>setForm(f=>({...f,sizes:f.sizes.map(s=>s.size===sz?{...s,stock:Math.max(0,parseInt(val)||0)}:s)}))
            return(
              <div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
                  {['XS','S','M','L','XL','XXL','2XL'].map(sz=>(
                    <button key={sz} onClick={()=>addSize(sz)} style={{padding:'5px 12px',borderRadius:8,border:`1.5px solid ${sizes.find(s=>s.size===sz)?'var(--primary)':'var(--border)'}`,background:sizes.find(s=>s.size===sz)?'var(--primary-light)':'var(--surface)',color:sizes.find(s=>s.size===sz)?'var(--primary)':'var(--muted)',fontSize:12,fontWeight:700,cursor:'pointer'}}>{sz}</button>
                  ))}
                </div>
                {sizes.map(s=>(
                  <div key={s.size} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--surface)',borderRadius:10,border:'1px solid var(--border)',marginBottom:6}}>
                    <span style={{fontWeight:900,fontSize:15,minWidth:36,color:'var(--primary)'}}>{s.size}</span>
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:6}}>
                      <button onClick={()=>updateStock(s.size,s.stock-1)} style={{width:26,height:26,borderRadius:6,border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontWeight:800}}>−</button>
                      <input type="number" min="0" value={s.stock} onChange={e=>updateStock(s.size,e.target.value)} style={{width:56,padding:'4px',borderRadius:8,border:'1.5px solid var(--border)',textAlign:'center',fontWeight:800,fontSize:14,outline:'none'}}/>
                      <button onClick={()=>updateStock(s.size,s.stock+1)} style={{width:26,height:26,borderRadius:6,border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontWeight:800}}>+</button>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:s.stock>0?'var(--green)':'var(--red)'}}>{s.stock>0?`${s.stock} in stock`:'Sold out'}</span>
                    <button onClick={()=>removeSize(s.size)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:18}}>×</button>
                  </div>
                ))}
              </div>
            )
          })()}
        </FormSection>

        <div style={{display:'flex',gap:10,marginTop:4}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={saving||!form.name||!form.price} onClick={()=>onSave(form)}>
            {saving?'Saving…':isEdit?'Save Changes':'Add Product'}
          </button>
        </div>
      </div>
    </div>

    {showCamera&&(
      <CameraCapture
        onCapture={handleCapture}
        onAnalyze={cameraTarget==='main'?applyAiResult:null}
        onClose={()=>setShowCamera(false)}
      />
    )}
    </>
  )
}
/* ══════════════════════════════════════════════════════════
   PRODUCTS PAGE
══════════════════════════════════════════════════════════ */
function ProductsPage({ showToast }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => { setLoading(true); try { const r = await api.myProducts(); setProducts(r.data) } catch (e) {}; setLoading(false) }
  useEffect(() => { load() }, [])

  const saveProduct = async (form) => {
    setSaving(true)
    const body = {
      ...form,
      price: parseFloat(form.price),
      stock: parseInt(form.stock) || 0,
      sizes: JSON.stringify(form.sizes || []),
      images: JSON.stringify(form.images || []),
      colors: JSON.stringify(form.colors || []),
      tags: JSON.stringify(form.tags || []),
      brand: form.brand || null,
      material: form.material || null,
    }
    try {
      if (form.id) { await api.updateProduct(form.id, body); showToast('Product updated ✓', 'success') }
      else { await api.addProduct(body); showToast('Product added ✓', 'success') }
      setModal(null); load()
    } catch (e) { showToast(e.response?.data?.detail || 'Save failed', 'error') }
    setSaving(false)
  }

  const toggle = async (p) => {
    try { await api.updateProduct(p.id, { isActive: !p.isActive }); showToast(p.isActive ? 'Product hidden' : 'Product visible', 'info'); load() }
    catch (e) { showToast('Failed', 'error') }
  }

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Products</div>
          <div className="page-sub">{products.length} products · Click camera to capture photos</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Icons.Plus /> Add Product
        </button>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
        <input className="input" placeholder=" Search products…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
      </div>

      {loading ? (
        <div className="prod-grid">{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 240 }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">BOX</span>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>No products yet</div>
          <button className="btn btn-primary" onClick={() => setModal({})}>Add your first product</button>
        </div>
      ) : (
        <div className="prod-grid">
          {filtered.map((p, i) => (
            <div key={p.id} className="prod-card fade-up" style={{ animationDelay: `${i * 0.05}s`, opacity: p.isActive ? 1 : .55 }}>
              <div style={{ position: 'relative' }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="pc-img" />
                ) : (
                  <div className="pc-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}></div>
                )}
                {!p.isActive && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>HIDDEN</div>}
                {p.hasSizes && <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100 }}>SIZES</div>}
              </div>
              <div className="pc-body">
                <div className="pc-name">{p.name}</div>
                <div className="pc-meta">{p.category || 'Uncategorized'} · {p.hasSizes ? `${p.stock} total units` : `${p.stock} in stock`}</div>
                <div className="pc-price">₹{p.price}</div>
                {p.avgRating > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                  <Icons.Star /> {p.avgRating.toFixed(1)} ({p.reviewCount} reviews)
                </div>}
              </div>
              <div className="pc-actions">
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: '8px' }} onClick={() => toggle(p)}>
                  {p.isActive ? '✕ Hide' : '✓ Show'}
                </button>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: 12, padding: '8px' }} onClick={() => setModal(p)}>
                  <Icons.Edit /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && <ProductFormModal initial={modal.id ? modal : null} onClose={() => setModal(null)} onSave={saveProduct} saving={saving} />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   RETURNS PAGE
══════════════════════════════════════════════════════════ */
function ReturnsPage({ shop, showToast }) {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('REQUESTED')
  const [actioning, setActioning] = useState(null)

  const load = async () => { setLoading(true); try { const r = await api.shopReturns(); setReturns(r.data) } catch (e) {}; setLoading(false) }
  useEffect(() => { load() }, [])

  const update = async (id, status) => {
    setActioning(id)
    try { await api.updateReturn(id, { status }); showToast('Return updated ✓', 'success'); load() } catch (e) { showToast('Failed', 'error') }
    setActioning(null)
  }

  const RETURN_STATUS = ['REQUESTED', 'APPROVED', 'REJECTED', 'PICKED_UP', 'REFUNDED']
  const RETURN_COLORS = { REQUESTED: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444', PICKED_UP: '#0ea5e9', REFUNDED: '#8b5cf6' }
  const filtered = returns.filter(r => r.status === filter)

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Returns</div>
      </div>
      {!shop?.acceptsReturns && (
        <div style={{ background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: 14, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#854d0e', fontWeight: 600 }}>
          !️ Return policy not enabled for your shop. Enable it in Shop Settings.
        </div>
      )}
      <div className="status-filter">
        {RETURN_STATUS.map(s => (
          <button key={s} className={`filter-pill ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s.charAt(0) + s.slice(1).toLowerCase()} ({returns.filter(r => r.status === s).length})
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty"><span className="empty-icon"></span><div>No {filter.toLowerCase()} returns</div></div>
      ) : (
        filtered.map((r, i) => (
          <div key={r.id} className="card fade-up" style={{ animationDelay: `${i * 0.06}s`, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Return #{r.id} — Order #{r.orderCode}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{r.customerName} · {r.customerPhone}</div>
              </div>
              <span className="badge" style={{ background: `${RETURN_COLORS[r.status]}18`, color: RETURN_COLORS[r.status] }}>{r.status}</span>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, fontSize: 13 }}>
              <strong>Reason:</strong> {r.reason}
              {r.vendorNote && <div style={{ marginTop: 6, color: 'var(--muted)' }}><strong>Your note:</strong> {r.vendorNote}</div>}
            </div>
            {r.status === 'REQUESTED' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => update(r.id, 'REJECTED')} disabled={actioning === r.id}>Reject</button>
                <button className="btn btn-success" style={{ flex: 2 }} onClick={() => update(r.id, 'APPROVED')} disabled={actioning === r.id}>✓ Approve Return</button>
              </div>
            )}
            {r.status === 'APPROVED' && (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => update(r.id, 'REFUNDED')} disabled={actioning === r.id}>Mark as Refunded</button>
            )}
          </div>
        ))
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   ANALYTICS PAGE
══════════════════════════════════════════════════════════ */
function AnalyticsPage() {
  const [data, setData] = useState(null)
  useEffect(() => { api.analytics().then(r => setData(r.data)).catch(() => {}) }, [])

  const periods = [
    { label: 'Today', key: 'today', icon: '️' },
    { label: 'This Week', key: 'week', icon: '' },
    { label: 'This Month', key: 'month', icon: '' },
    { label: 'All Time', key: 'allTime', letter: 'A' },
  ]

  return (
    <div className="page">
      <div className="page-header"><div className="page-title">Analytics</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {periods.map((p, i) => (
          <div key={p.key} className="card fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 24 }}>{p.icon}</span>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{p.label}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 700 }}>Revenue</div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 26, color: 'var(--primary)' }}>₹{data?.[p.key]?.revenue || 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 700 }}>Orders</div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 26, color: 'var(--text)' }}>{data?.[p.key]?.orders || 0}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="card fade-up" style={{ animationDelay: '.3s' }}>
        <div className="card-title">Performance Insights</div>
        {[['Avg order value (all time)', `₹${data?.allTime?.orders ? Math.round((data?.allTime?.revenue || 0) / data.allTime.orders) : 0}`], ['This week vs last week', data?.week?.revenue > 0 ? 'Active' : 'No data yet'], ['Return rate', `${data?.pendingReturns || 0} pending`]].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border2)', fontSize: 14 }}>
            <span style={{ color: 'var(--muted)' }}>{k}</span>
            <span style={{ fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   SHOP SETTINGS
══════════════════════════════════════════════════════════ */

/* ── PAYMENT DETAILS FORM (shared by Vendor + Rider) ── */
function PaymentDetailsForm({ user, onSave }) {
  const [mode, setMode] = useState(user.paymentMethod || 'upi')
  const [upi, setUpi] = useState(user.upiId || '')
  const [bank, setBank] = useState(user.bankAccount || '')
  const [ifsc, setIfsc] = useState(user.bankIfsc || '')
  const [bname, setBname] = useState(user.bankName || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await onSave({ paymentMethod: mode, upiId: upi, bankAccount: bank, bankIfsc: ifsc, bankName: bname })
    setSaving(false)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:8}}>
        {[{v:'upi',l:' UPI / PhonePe'},{v:'bank',l:' Bank Account'}].map(({v,l})=>(
          <div key={v} onClick={()=>setMode(v)} style={{flex:1,padding:'12px',borderRadius:10,border:`2px solid ${mode===v?'var(--primary)':'var(--border)'}`,background:mode===v?'var(--primary-light)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:13,fontWeight:700,color:mode===v?'var(--primary)':'var(--muted)',transition:'.2s'}}>
            {l}
          </div>
        ))}
      </div>
      {mode==='upi' ? (
        <div>
          <label className="label">UPI ID / PhonePe Number</label>
          <input className="input" placeholder="9876543210@upi or name@phonepe" value={upi} onChange={e=>setUpi(e.target.value)}/>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:5}}>Payments will be sent to this UPI ID after each delivery</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><label className="label">Account Holder Name</label><input className="input" placeholder="Full name as on bank" value={bname} onChange={e=>setBname(e.target.value)}/></div>
          <div><label className="label">Account Number</label><input className="input" placeholder="Bank account number" value={bank} onChange={e=>setBank(e.target.value)}/></div>
          <div><label className="label">IFSC Code</label><input className="input" placeholder="e.g. SBIN0001234" value={ifsc} onChange={e=>setIfsc(e.target.value)}/></div>
        </div>
      )}
      <button className="btn btn-primary" onClick={save} disabled={saving} style={{alignSelf:'flex-start',padding:'10px 24px'}}>
        {saving?'Saving…':'✓ Save Payment Details'}
      </button>
    </div>
  )
}

function ShopSettings({ shop, setShop, showToast, user }) {
  const [form, setForm] = useState({ name: shop.name || '', description: shop.description || '', address: shop.address || '', city: shop.city || '', phone: shop.phone || '', deliveryTime: shop.deliveryTime || 25, minOrder: shop.minOrder || 0, imageUrl: shop.imageUrl || '', bannerUrl: '', storefrontUrl: '', acceptsReturns: shop.acceptsReturns || false, returnDays: shop.returnDays || 7, returnPolicyNote: shop.returnPolicyNote || '', whatsappMode: shop.whatsappMode || false, whatsappPhone: shop.whatsappPhone || '' })
  const [saving, setSaving] = useState(false)
  const [mapCoords, setMapCoords] = useState({ lat: shop.lat || 17.385, lng: shop.lng || 78.4867 })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const getLoc = () => navigator.geolocation?.getCurrentPosition(async p => {
    const coords = { lat: p.coords.latitude, lng: p.coords.longitude }
    setMapCoords(coords)
    const geo = await reverseGeocode(coords.lat, coords.lng)
    if (!form.address) setForm(f => ({ ...f, address: geo.full, city: geo.city }))
  })

  const save = async () => {
    setSaving(true)
    try {
      const r = await api.updateShop(shop.id, { ...form, lat: mapCoords.lat, lng: mapCoords.lng })
      setShop(r.data); showToast('Shop settings saved ✓', 'success')
    } catch (e) { showToast('Save failed', 'error') }
    setSaving(false)
  }

  const toggleOpen = async () => {
    try { const r = await api.updateShop(shop.id, { isOpen: !shop.isOpen }); setShop(r.data); showToast(shop.isOpen ? 'Shop closed' : 'Shop opened ✓', 'info') }
    catch (e) { showToast('Failed', 'error') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Shop Settings</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={`btn ${shop.isOpen ? 'btn-danger' : 'btn-success'}`} onClick={toggleOpen}>
            {shop.isOpen ? '● Close Shop' : '● Open Shop'}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : '✓ Save Changes'}
          </button>
        </div>
      </div>

      {/* Payment Details card */}
      <div className="card fade-up" style={{marginBottom:20}}>
        <div className="card-title"> Payment Details</div>
        <PaymentDetailsForm user={user || {}} onSave={async(d)=>{try{await api.updatePayment(d);showToast('Payment details saved ✓','success')}catch(e){showToast('Save failed','error')}}}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card fade-up">
          <div className="card-title">Basic Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label className="label">Shop Name</label><input className="input" value={form.name} onChange={set('name')} /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={set('description')} style={{ resize: 'none' }} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
            <div>
                <label className="label">Shop Images</label>
                {/* Shop logo */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:6}}>LOGO / MAIN PHOTO</div>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <div style={{width:64,height:64,borderRadius:12,overflow:'hidden',flexShrink:0,border:'1.5px solid var(--border)',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
                      {form.imageUrl?<img src={form.imageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'}/>:''}
                    </div>
                    <label style={{flex:1,display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:10,border:'2px dashed var(--primary)',background:'var(--primary-light)',cursor:'pointer',color:'var(--primary)',fontWeight:700,fontSize:12}}>
                      <span></span> Upload Logo
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
                        const file=e.target.files?.[0]; if(!file)return;
                        try{const r=await api.uploadImage(file);setForm(f=>({...f,imageUrl:r.data.url}));}catch(err){}
                        e.target.value=''
                      }}/>
                    </label>
                  </div>
                </div>
                {/* Banner */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:6}}>BANNER IMAGE</div>
                  <label className="shop-banner-slot">
                    {form.bannerUrl
                      ?<img src={form.bannerUrl} alt="banner"/>
                      :<div style={{textAlign:'center'}}><div style={{width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",opacity:.3}}><svg viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div><div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>Upload banner (wide photo)</div></div>}
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
                      const file=e.target.files?.[0]; if(!file)return;
                      try{const r=await api.uploadImage(file);setForm(f=>({...f,bannerUrl:r.data.url}));}catch(err){}
                      e.target.value=''
                    }}/>
                  </label>
                </div>
                {/* Storefront */}
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:6}}>STOREFRONT PHOTO</div>
                  <label className="shop-banner-slot">
                    {form.storefrontUrl
                      ?<img src={form.storefrontUrl} alt="storefront"/>
                      :<div style={{textAlign:'center'}}><div style={{width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",opacity:.3}}><svg viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div><div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>Upload storefront photo</div></div>}
                    <input type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{
                      const file=e.target.files?.[0]; if(!file)return;
                      try{const r=await api.uploadImage(file);setForm(f=>({...f,storefrontUrl:r.data.url}));}catch(err){}
                      e.target.value=''
                    }}/>
                  </label>
                </div>
                <input className="input" placeholder="Or paste logo URL" value={form.imageUrl||''} onChange={set('imageUrl')} style={{fontSize:12,marginTop:8}}/>
              </div>
            <div className="grid-2">
              <div><label className="label">Delivery Time (min)</label><input className="input" type="number" value={form.deliveryTime} onChange={set('deliveryTime')} /></div>
              <div><label className="label">Min Order (₹)</label><input className="input" type="number" value={form.minOrder} onChange={set('minOrder')} /></div>
            </div>
          </div>
        </div>

        <div className="card fade-up" style={{ animationDelay: '.06s' }}>
          <div className="card-title">Location</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label className="label">Address</label><textarea className="input" rows={2} value={form.address} onChange={set('address')} style={{ resize: 'none' }} /></div>
            <div><label className="label">City</label><input className="input" value={form.city} onChange={set('city')} /></div>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={getLoc}><Icons.Loc /> Use Current Location</button>
            <LeafletMap lat={mapCoords.lat} lng={mapCoords.lng} onPinMove={(lat, lng) => setMapCoords({ lat, lng })} height={180} />
          </div>
        </div>

        <div className="card fade-up" style={{ animationDelay: '.12s' }}>
          <div className="card-title">Return Policy</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border2)' }}>
              <div><div style={{ fontWeight: 700 }}>Accept Returns</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Allow customers to request returns</div></div>
              <button className={`toggle ${form.acceptsReturns ? 'on' : 'off'}`} onClick={() => setForm(f => ({ ...f, acceptsReturns: !f.acceptsReturns }))} />
            </div>
            {form.acceptsReturns && <>
              <div><label className="label">Return Window (days)</label><input className="input" type="number" value={form.returnDays} onChange={set('returnDays')} /></div>
              <div><label className="label">Policy Note</label><textarea className="input" rows={2} value={form.returnPolicyNote} onChange={set('returnPolicyNote')} style={{ resize: 'none' }} /></div>
            </>}
          </div>
        </div>

        <div className="card fade-up" style={{ animationDelay: '.18s' }}>
          <div className="card-title">WhatsApp Mode</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border2)' }}>
              <div><div style={{ fontWeight: 700 }}>WhatsApp Orders</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Get order alerts on WhatsApp</div></div>
              <button className={`toggle ${form.whatsappMode ? 'on' : 'off'}`} onClick={() => setForm(f => ({ ...f, whatsappMode: !f.whatsappMode }))} />
            </div>
            {form.whatsappMode && <div><label className="label">WhatsApp Number</label><input className="input" placeholder="10-digit number" value={form.whatsappPhone} onChange={set('whatsappPhone')} /></div>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   SHOP SETUP WIZARD
══════════════════════════════════════════════════════════ */
function ShopSetup({ onCreated, showToast }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', description: '', category: 'Fashion', address: '', city: 'Hyderabad', phone: '', lat: 17.385, lng: 78.4867, imageUrl: '', deliveryTime: 25, minOrder: 0 })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const CATEGORIES = ['Fashion', 'Kurtas', 'Kurtis', 'Sarees', 'Jeans', 'T-Shirts', 'Dresses', 'Jackets', 'Footwear', 'Kids', 'Accessories', 'Ethnic Wear', 'Western Wear', 'Activewear', 'Nightwear']

  const getLoc = async () => {
    navigator.geolocation?.getCurrentPosition(async p => {
      const geo = await reverseGeocode(p.coords.latitude, p.coords.longitude)
      setForm(f => ({ ...f, lat: p.coords.latitude, lng: p.coords.longitude, address: geo.full, city: geo.city }))
    })
  }

  const submit = async () => {
    setSaving(true)
    try {
      const r = await api.createShop(form)
      showToast('Shop created! ✓', 'success')
      onCreated(r.data)
    } catch (e) { showToast(e.response?.data?.detail || 'Failed', 'error') }
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 540 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'rgba(108,71,255,.08)', border:'2px solid rgba(108,71,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}><svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='#6c47ff' strokeWidth='1.5' strokeLinecap='round'><rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/></svg></div>
          <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 26, color: 'var(--text)' }}>Set up your store</div>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>Step {step} of 2 — {step === 1 ? 'Basic Info' : 'Location'}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[1, 2].map(s => <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= s ? 'var(--primary)' : 'var(--border)', transition: '.3s' }} />)}
        </div>

        <div className="card scale-in">
          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="label">Shop Name *</label><input className="input" placeholder="e.g. Fashion Hub, Fresh Mart" value={form.name} onChange={set('name')} /></div>
              <div><label className="label">Category *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {CATEGORIES.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))} style={{ padding: '8px 14px', borderRadius: 10, border: `2px solid ${form.category === c ? 'var(--primary)' : 'var(--border)'}`, background: form.category === c ? 'var(--primary-light)' : 'var(--surface)', color: form.category === c ? 'var(--primary)' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: '.15s' }}>{c}</button>)}
                </div>
              </div>
              <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={set('description')} style={{ resize: 'none' }} placeholder="Tell customers about your store" /></div>
              <div className="grid-2">
                <div><label className="label">Phone</label><input className="input" placeholder="Shop number" value={form.phone} onChange={set('phone')} /></div>
                <div><label className="label">Delivery Time (min)</label><input className="input" type="number" value={form.deliveryTime} onChange={set('deliveryTime')} /></div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '13px' }} disabled={!form.name} onClick={() => setStep(2)}>Next: Set Location →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="label">Address *</label><textarea className="input" rows={2} value={form.address} onChange={set('address')} style={{ resize: 'none' }} /></div>
              <div><label className="label">City</label><input className="input" value={form.city} onChange={set('city')} /></div>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={getLoc}><Icons.Loc /> Use My Current Location</button>
              <LeafletMap lat={form.lat} lng={form.lng} onPinMove={async (lat, lng) => { setForm(f => ({ ...f, lat, lng })); const g = await reverseGeocode(lat, lng); setForm(f => ({ ...f, address: g.full, city: g.city })) }} height={200} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving || !form.address} onClick={submit}>
                  {saving ? 'Creating…' : '→ Launch Store'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   APP ROOT
══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   EARNINGS PAGE
═══════════════════════════════════════════════════════════ */
function EarningsPage({ showToast }) {
  const [data, setData] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.vendorEarnings(), api.lowStock()])
      .then(([e, ls]) => { setData(e.data); setLowStock(ls.data.items) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><div className="spinner"/></div>

  return (
    <div className="page fade-up">
      <div className="page-header">
        <div>
          <div className="page-title">Earnings & Payouts</div>
          <div className="page-sub">Your revenue breakdown and stock alerts</div>
        </div>
      </div>

      {/* Earnings summary cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            ['Total Revenue', `₹${data.totalRevenue.toLocaleString('en-IN')}`, '#22c55e', ''],
            ['Net Earnings', `₹${data.netEarnings.toLocaleString('en-IN')}`, '#6c47ff', ''],
            ['This Month', `₹${data.thisMonth?.revenue?.toLocaleString('en-IN')||0}`, '#f59e0b', ''],
            ['Orders Delivered', data.totalOrders, '#0ea5e9', 'BOX'],
            ['Platform Fees', `₹${data.platformFees}`, '#ef4444', '️'],
            ['Pending Payout', `₹${data.pendingPayout}`, '#8b5cf6', '…'],
          ].map(({label, val, color, icon}) => (
            <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'rgba(108,71,255,.5)',flexShrink:0}}/>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{label}</span>
              </div>
              <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 22, color }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #fecaca', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>!️</span>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, color: '#ef4444' }}>
              Low Stock Alert — {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} running out
            </div>
          </div>
          {lowStock.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < lowStock.length - 1 ? '1px solid var(--border2)' : 'none' }}>
              {item.imageUrl && <img src={item.imageUrl} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                {item.size && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Size: {item.size}</div>}
              </div>
              <div style={{ background: item.stock <= 0 ? '#fee2e2' : '#fff7ed', color: item.stock <= 0 ? '#ef4444' : '#f97316', fontWeight: 800, padding: '4px 12px', borderRadius: 100, fontSize: 12 }}>
                {item.stock <= 0 ? 'Out of Stock' : `${item.stock} left`}
              </div>
            </div>
          ))}
        </div>
      )}
      {lowStock.length === 0 && (
        <div style={{ background: '#f0fdf4', borderRadius: 14, border: '1px solid #bbf7d0', padding: 20, textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
          ✓ All products have sufficient stock (above 3 units)
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [toast, setToast] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    const token = localStorage.getItem('dott_vendor_access')
    if (!token) { setLoading(false); return }
    Promise.all([api.me(), api.myShop()])
      .then(([u, s]) => { setUser(u.data); setShop(s.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!shop) return
    const poll = () => api.shopOrders({ status: 'PENDING' }).then(r => setPendingCount(r.data.length)).catch(() => {})
    poll(); const t = setInterval(poll, 15000); return () => clearInterval(t)
  }, [shop])

  const signOut = async () => {
    try { await api.logout() } catch (e) {}
    localStorage.removeItem('dott_vendor_access'); localStorage.removeItem('dott_vendor_refresh')
    setUser(null); setShop(null)
  }

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 44, height: 44, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: 'var(--muted)', fontFamily: 'var(--font)', fontWeight: 700 }}>Loading DOTT Vendor...</div>
      </div>
    </>
  )

  if (!user) return <><style>{CSS}</style><AuthPage onSuccess={u => { setUser(u); api.myShop().then(r => setShop(r.data)).catch(() => {}) }} /></>
  if (!shop) return <><style>{CSS}</style><ShopSetup onCreated={s => setShop(s)} showToast={showToast} /></>

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', Icon: Icons.Dashboard },
    { id: 'orders', label: 'Orders', Icon: Icons.Orders, count: pendingCount },
    { id: 'products', label: 'Products', Icon: Icons.Products },
    { id: 'returns', label: 'Returns', Icon: Icons.Returns },
    { id: 'analytics', label: 'Analytics', Icon: Icons.Analytics },
    { id: 'earnings', label: 'Earnings', Icon: Icons.Analytics },
    { id: 'settings', label: 'Settings', Icon: Icons.Settings },
  ]

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="brand">DOTT <span>Vendor</span></div>
            <div className="version">v5.0 · Enhanced</div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section-title">Main</div>
            {NAV.map(({ id, label, Icon, count }) => (
              <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
                <Icon />
                <span>{label}</span>
                {count > 0 && <span className="nav-badge">{count}</span>}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-shop">
              <div className="shop-avatar">{shop.imageUrl ? <img src={shop.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} /> : ''}</div>
              <div style={{ overflow: 'hidden' }}>
                <div className="shop-name">{shop.name}</div>
                <div className={`shop-status ${shop.isOpen ? 'status-open' : 'status-closed'}`} style={{ color: shop.isOpen ? '#4ade80' : '#f87171' }}>{shop.isOpen ? '● Open' : '● Closed'}</div>
              </div>
            </div>
            <div className="nav-item" onClick={signOut} style={{ color: '#f87171' }}>
              <Icons.Logout />
              <span>Sign Out</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main-content">
          <div className="topbar">
            <div className="topbar-title">{NAV.find(n => n.id === page)?.label}</div>
            <div className="topbar-actions">
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Welcome, <strong>{user.name}</strong></div>
              {pendingCount > 0 && <span className="badge badge-warning">{pendingCount} pending</span>}
            </div>
          </div>

          {page === 'dashboard' && <Dashboard shop={shop} />}
          {page === 'orders' && <OrdersPage showToast={showToast} />}
          {page === 'products' && <ProductsPage showToast={showToast} />}
          {page === 'returns' && <ReturnsPage shop={shop} showToast={showToast} />}
          {page === 'analytics' && <AnalyticsPage />}
          {page === 'earnings' && <EarningsPage showToast={showToast} />}
          {page === 'settings' && <ShopSettings shop={shop} setShop={setShop} showToast={showToast} user={user} />}
        </main>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
