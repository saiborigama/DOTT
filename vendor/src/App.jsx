import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
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

const DEMO_VENDOR_MODE = false
const DEMO_VENDOR_MODE_KEY = 'dott_vendor_demo_mode'
const DEMO_VENDOR_DB_KEY = 'dott_vendor_demo_db'

const DEMO_IMAGES = {
  shop: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
  banner: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
  storefront: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
  kurta: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=80',
  saree: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80',
  dress: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80',
  jacket: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
}

const demoResponse = (data) => Promise.resolve({ data })
const isVendorDemoMode = () => (DEMO_VENDOR_MODE && localStorage.getItem(DEMO_VENDOR_MODE_KEY) === '1')

function createDemoVendorDb() {
  const user = {
    id: 'demo-user-1',
    name: 'Rahul Vendor',
    email: 'rahul@dott.in',
    phone: '9876543210',
    paymentMethod: 'upi',
    upiId: 'rahul@upi',
    bankAccount: '',
    bankIfsc: '',
    bankName: '',
  }
  const shop = {
    id: 'demo-shop-1',
    name: 'NearNow Fashion Hub',
    category: 'Fashion',
    description: 'Trendy ethnic and western styles ready for same-day delivery.',
    address: 'Road No 12, Banjara Hills, Hyderabad',
    city: 'Hyderabad',
    phone: '9876543210',
    lat: 17.4124,
    lng: 78.4347,
    imageUrl: DEMO_IMAGES.shop,
    bannerUrl: DEMO_IMAGES.banner,
    storefrontUrl: DEMO_IMAGES.storefront,
    deliveryTime: 28,
    minOrder: 199,
    isOpen: true,
    isSuspended: false,
    acceptsReturns: true,
    returnDays: 7,
    returnPolicyNote: 'Easy 7-day return on unused fashion items.',
    whatsappMode: true,
    whatsappPhone: '9876543210',
  }
  const products = [
    { id: 'prod-1', name: 'Cloud Mist Anarkali Kurta', category: 'Kurtas', price: 999, stock: 8, hasSizes: true, sizes: ['S','M','L','XL'], images: [DEMO_IMAGES.kurta], imageUrl: DEMO_IMAGES.kurta, colors: ['White','Blue'], tags: ['anarkali','ethnic'], brand: 'NearNow Studio', material: 'Cotton Blend', isActive: true, avgRating: 4.7, reviewCount: 96 },
    { id: 'prod-2', name: 'Ivory Festive Kurti Set', category: 'Kurtis', price: 1199, stock: 5, hasSizes: true, sizes: ['S','M','L'], images: [DEMO_IMAGES.saree], imageUrl: DEMO_IMAGES.saree, colors: ['Ivory'], tags: ['festive','set'], brand: 'NearNow Studio', material: 'Rayon', isActive: true, avgRating: 4.5, reviewCount: 61 },
    { id: 'prod-3', name: 'Pearl Day Midi Dress', category: 'Dresses', price: 1299, stock: 2, hasSizes: true, sizes: ['S','M','L'], images: [DEMO_IMAGES.dress], imageUrl: DEMO_IMAGES.dress, colors: ['White'], tags: ['midi','dress'], brand: 'NearNow Studio', material: 'Georgette', isActive: true, avgRating: 4.6, reviewCount: 88 },
    { id: 'prod-4', name: 'City Blue Denim Jacket', category: 'Jackets', price: 1499, stock: 0, hasSizes: true, sizes: ['M','L','XL'], images: [DEMO_IMAGES.jacket], imageUrl: DEMO_IMAGES.jacket, colors: ['Blue'], tags: ['denim','jacket'], brand: 'NearNow Studio', material: 'Denim', isActive: false, avgRating: 4.4, reviewCount: 34 },
  ]
  const now = Date.now()
  const orders = [
    { id: 'ord-1', orderCode: 'NN1024', customer: { name: 'Sai Kumar', phone: '6303142328' }, items: [{ name: 'Cloud Mist Anarkali Kurta', qty: 1 }], status: 'PENDING', placedAt: new Date(now - 1000 * 60 * 8).toISOString(), total: 999, paymentMethod: 'cod', riderId: null, shop, deliveryAddress: 'Janakpuri 1-28, Hyderabad', notes: 'Call before dispatch', pickupOtp: '4821' },
    { id: 'ord-2', orderCode: 'NN1025', customer: { name: 'Bhavana', phone: '9012345678' }, items: [{ name: 'Pearl Day Midi Dress', qty: 1 }], status: 'CONFIRMED', placedAt: new Date(now - 1000 * 60 * 18).toISOString(), total: 1299, paymentMethod: 'online', riderId: 'rider-2', shop, deliveryAddress: 'Jubilee Hills Checkpost, Hyderabad', notes: '', pickupOtp: '9244' },
    { id: 'ord-3', orderCode: 'NN1026', customer: { name: 'Nikhil', phone: '9988776655' }, items: [{ name: 'Ivory Festive Kurti Set', qty: 1 }], status: 'PACKING', placedAt: new Date(now - 1000 * 60 * 26).toISOString(), total: 1199, paymentMethod: 'online', riderId: 'rider-3', shop, deliveryAddress: 'Madhapur Main Road, Hyderabad', notes: 'Gift wrap please', pickupOtp: '5512' },
    { id: 'ord-4', orderCode: 'NN1027', customer: { name: 'Asha', phone: '9123456780' }, items: [{ name: 'City Blue Denim Jacket', qty: 1 }], status: 'DELIVERED', placedAt: new Date(now - 1000 * 60 * 90).toISOString(), total: 1499, paymentMethod: 'online', riderId: 'rider-1', shop, deliveryAddress: 'Gachibowli, Hyderabad', notes: '', pickupOtp: '3001' },
  ]
  const returns = [
    { id: 'ret-1', orderCode: 'NN1008', customerName: 'Priya', customerPhone: '9090909090', customerAddress: 'Madhapur, Hyderabad', refundAmount: 999, reason: 'Size issue', status: 'REQUESTED', vendorNote: '' },
    { id: 'ret-2', orderCode: 'NN1002', customerName: 'Anil', customerPhone: '9888777666', customerAddress: 'Banjara Hills, Hyderabad', refundAmount: 1199, reason: 'Price issue / changed mind', status: 'APPROVED', vendorNote: 'Pickup already scheduled' },
    { id: 'ret-3', orderCode: 'NN0998', customerName: 'Kiran', customerPhone: '9000011111', customerAddress: 'Jubilee Hills, Hyderabad', refundAmount: 1299, reason: 'Price issue', status: 'REFUNDED', vendorNote: 'Refund completed to original payment method' },
  ]
  return { user, shop, products, orders, returns }
}

function getDemoVendorDb() {
  try {
    const raw = localStorage.getItem(DEMO_VENDOR_DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  const seeded = createDemoVendorDb()
  localStorage.setItem(DEMO_VENDOR_DB_KEY, JSON.stringify(seeded))
  return seeded
}

function saveDemoVendorDb(db) {
  localStorage.setItem(DEMO_VENDOR_DB_KEY, JSON.stringify(db))
}

function getDemoAnalytics(db) {
  const delivered = db.orders.filter(o => o.status === 'DELIVERED')
  const active = db.orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status))
  const totalRevenue = delivered.reduce((sum, o) => sum + Number(o.total || 0), 0)
  return {
    today: { revenue: 2498, orders: 2 },
    week: { revenue: 6840, orders: 6 },
    month: { revenue: 18240, orders: 16 },
    allTime: { revenue: totalRevenue || 28450, orders: delivered.length || 21 },
    pendingReturns: db.returns.filter(r => r.status === 'REQUESTED').length,
    activeOrders: active.length,
  }
}

function getDemoEarnings(db) {
  const analytics = getDemoAnalytics(db)
  return {
    totalRevenue: analytics.allTime.revenue,
    netEarnings: analytics.allTime.revenue,
    thisMonth: { revenue: analytics.month.revenue, orders: analytics.month.orders },
    totalOrders: analytics.allTime.orders,
    platformFees: 0,
    pendingPayout: analytics.month.revenue,
  }
}

const api = {
  sendOtp: phone => isVendorDemoMode() ? demoResponse({ sent: true, phone }) : ax.post('/otp/send', { phone }),
  verifyOtp: (phone, otp) => isVendorDemoMode() ? demoResponse({ verified: true, phone, otp }) : ax.post('/otp/verify', { phone, otp }),
  uploadImage: file => {
    if (isVendorDemoMode()) return demoResponse({ url: DEMO_IMAGES.shop })
    const fd = new FormData(); fd.append('file', file)
    return ax.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  processProductImageAI: file => {
    if (isVendorDemoMode()) return demoResponse({ transformedUrl: DEMO_IMAGES.dress, originalUrl: DEMO_IMAGES.dress, analysis: null })
    const fd = new FormData(); fd.append('file', file)
    return ax.post('/upload/product-image-transform', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  login: d => ax.post('/auth/login', d),
  register: d => ax.post('/auth/register', d),
  me: () => isVendorDemoMode() ? demoResponse(getDemoVendorDb().user) : ax.get('/auth/me'),
  updatePayment: d => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      db.user = { ...db.user, ...d }
      saveDemoVendorDb(db)
      return demoResponse(db.user)
    }
    return ax.put('/auth/payment-details', d)
  },
  logout: () => isVendorDemoMode() ? demoResponse({ ok: true }) : ax.post('/auth/logout'),
  myShop: () => isVendorDemoMode() ? demoResponse(getDemoVendorDb().shop) : ax.get('/shops/my'),
  createShop: d => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      db.shop = { ...db.shop, ...d, id: db.shop?.id || 'demo-shop-1' }
      saveDemoVendorDb(db)
      return demoResponse(db.shop)
    }
    return ax.post('/shops', d)
  },
  updateShop: (id, d) => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      db.shop = { ...db.shop, ...d }
      saveDemoVendorDb(db)
      return demoResponse(db.shop)
    }
    return ax.put(`/shops/${id}`, d)
  },
  myProducts: () => isVendorDemoMode() ? demoResponse(getDemoVendorDb().products) : ax.get('/products/my'),
  addProduct: d => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      const images = typeof d.images === 'string' ? JSON.parse(d.images || '[]') : (d.images || [])
      const sizes = typeof d.sizes === 'string' ? JSON.parse(d.sizes || '[]') : (d.sizes || [])
      const colors = typeof d.colors === 'string' ? JSON.parse(d.colors || '[]') : (d.colors || [])
      const tags = typeof d.tags === 'string' ? JSON.parse(d.tags || '[]') : (d.tags || [])
      const next = { ...d, id: `prod-${Date.now()}`, images, sizes, colors, tags, imageUrl: d.imageUrl || images[0] || DEMO_IMAGES.shop, reviewCount: 0, avgRating: 0, isActive: true }
      db.products.unshift(next)
      saveDemoVendorDb(db)
      return demoResponse(next)
    }
    return ax.post('/products', d)
  },
  updateProduct: (id, d) => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      db.products = db.products.map(p => {
        if (p.id !== id) return p
        const images = typeof d.images === 'string' ? JSON.parse(d.images || '[]') : (d.images ?? p.images)
        const sizes = typeof d.sizes === 'string' ? JSON.parse(d.sizes || '[]') : (d.sizes ?? p.sizes)
        const colors = typeof d.colors === 'string' ? JSON.parse(d.colors || '[]') : (d.colors ?? p.colors)
        const tags = typeof d.tags === 'string' ? JSON.parse(d.tags || '[]') : (d.tags ?? p.tags)
        return { ...p, ...d, images, sizes, colors, tags, imageUrl: d.imageUrl || images?.[0] || p.imageUrl }
      })
      saveDemoVendorDb(db)
      return demoResponse(db.products.find(p => p.id === id))
    }
    return ax.put(`/products/${id}`, d)
  },
  shopOrders: (p) => {
    if (isVendorDemoMode()) {
      let orders = [...getDemoVendorDb().orders]
      if (p?.status) orders = orders.filter(o => o.status === p.status)
      return demoResponse(orders)
    }
    return ax.get('/orders/shop/all', { params: p })
  },
  acceptOrder: id => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      db.orders = db.orders.map(o => o.id === id ? { ...o, status: 'CONFIRMED', riderId: o.riderId || 'rider-2' } : o)
      saveDemoVendorDb(db)
      return demoResponse({ ok: true })
    }
    return ax.post(`/orders/${id}/accept`)
  },
  rejectOrder: id => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      db.orders = db.orders.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o)
      saveDemoVendorDb(db)
      return demoResponse({ ok: true })
    }
    return ax.post(`/orders/${id}/reject`)
  },
  updateStatus: (id, s) => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      db.orders = db.orders.map(o => o.id === id ? { ...o, status: s, riderId: o.riderId || 'rider-2' } : o)
      saveDemoVendorDb(db)
      return demoResponse({ ok: true })
    }
    return ax.put(`/orders/${id}/status`, { status: s })
  },
  generatePickupOtp: id => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      const otp = `${Math.floor(1000 + Math.random() * 9000)}`
      db.orders = db.orders.map(o => o.id === id ? { ...o, pickupOtp: otp } : o)
      saveDemoVendorDb(db)
      return demoResponse({ otp })
    }
    return ax.post(`/orders/${id}/pickup-otp/generate`)
  },
  getPickupOtp: id => {
    if (isVendorDemoMode()) {
      const order = getDemoVendorDb().orders.find(o => o.id === id)
      return demoResponse({ otp: order?.pickupOtp || '4821' })
    }
    return ax.get(`/orders/${id}/pickup-otp`)
  },
  shopReturns: () => isVendorDemoMode() ? demoResponse(getDemoVendorDb().returns) : ax.get('/returns/shop'),
  updateReturn: (id, d) => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      db.returns = db.returns.map(r => r.id === id ? { ...r, ...d } : r)
      saveDemoVendorDb(db)
      return demoResponse(db.returns.find(r => r.id === id))
    }
    return ax.put(`/returns/${id}`, d)
  },
  analytics: () => isVendorDemoMode() ? demoResponse(getDemoAnalytics(getDemoVendorDb())) : ax.get('/analytics'),
  lowStock: () => {
    if (isVendorDemoMode()) {
      const items = getDemoVendorDb().products.filter(p => Number(p.stock) <= 3)
      return demoResponse({ items })
    }
    return ax.get('/vendor/low-stock')
  },
  cloneProduct: id => {
    if (isVendorDemoMode()) {
      const db = getDemoVendorDb()
      const base = db.products.find(p => p.id === id)
      const copy = { ...base, id: `prod-${Date.now()}`, name: `${base.name} Copy` }
      db.products.unshift(copy)
      saveDemoVendorDb(db)
      return demoResponse(copy)
    }
    return ax.post(`/products/${id}/clone`)
  },
  vendorEarnings: () => isVendorDemoMode() ? demoResponse(getDemoEarnings(getDemoVendorDb())) : ax.get('/vendor/earnings'),
  replyReview: (id, reply) => isVendorDemoMode() ? demoResponse({ ok: true }) : ax.post(`/reviews/${id}/reply`, { reply }),
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

function vendorGeoNeedsSecureContext() {
  if (typeof window === 'undefined') return false
  const host = window.location?.hostname || ''
  return !window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1'
}
function vendorGeoErrorMessage(error) {
  if (vendorGeoNeedsSecureContext()) return 'Current GPS needs HTTPS on mobile. Open app with secure link or use map pin.'
  switch (error?.code) {
    case 1: return 'Location permission denied. Please allow GPS access.'
    case 2: return 'Location unavailable. Move to open sky and retry.'
    case 3: return 'Location request timed out. Please retry.'
    default: return 'Unable to detect current location.'
  }
}
async function getCurrentGpsLocation() {
  if (!navigator?.geolocation) throw new Error('GPS is not supported on this device.')
  if (vendorGeoNeedsSecureContext()) throw new Error(vendorGeoErrorMessage())
  const first = await new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ ok: true, pos: p }),
        e => resolve({ ok: false, error: e }),
        { enableHighAccuracy: true, timeout: 14000, maximumAge: 0 }
      )
    } catch (error) {
      resolve({ ok: false, error })
    }
  })
  if (first?.ok) {
    return { lat: first.pos.coords.latitude, lng: first.pos.coords.longitude, accuracy: Number(first.pos.coords.accuracy || 0) }
  }
  const second = await new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ ok: true, pos: p }),
        e => resolve({ ok: false, error: e }),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 }
      )
    } catch (error) {
      resolve({ ok: false, error })
    }
  })
  if (second?.ok) {
    return { lat: second.pos.coords.latitude, lng: second.pos.coords.longitude, accuracy: Number(second.pos.coords.accuracy || 0) }
  }
  throw new Error(vendorGeoErrorMessage(second?.error || first?.error))
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
  --primary:#4aa8ff;--primary-dark:#2387e8;--primary-light:rgba(74,168,255,.12);
  --green:#4aa8ff;--red:#ef4444;--orange:#4aa8ff;--blue:#4aa8ff;--amber:#8ecbff;
  --bg:#eef7ff;--surface:#fff;--border:#cfe6fb;--border2:#e8f4ff;
  --text:#12324d;--muted:#5f7d96;--font:'Plus Jakarta Sans',sans-serif;--body:'Inter',sans-serif;
  --shadow-sm:0 1px 4px rgba(42,116,189,.08);
  --shadow:0 8px 28px rgba(42,116,189,.12);
  --shadow-lg:0 18px 48px rgba(42,116,189,.18);
  --radius:14px;--radius-sm:10px;--radius-lg:20px;
}
html{scroll-behavior:smooth}
body{background:linear-gradient(180deg,#f7fbff 0%,#eef7ff 48%,#f9fcff 100%);color:var(--text);font-family:var(--body);overflow-x:hidden}
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
.auth-page{min-height:100vh;display:flex;background:#fff;position:relative;overflow:hidden}
.auth-visual{width:48%;background:linear-gradient(180deg,#89c9ff 0%,#4aa8ff 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:48px}
.auth-visual::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle at 20% 20%,rgba(255,255,255,.45) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(17,95,161,.22) 0%,transparent 50%);pointer-events:none}
.auth-visual-dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.3) 1px,transparent 1px);background-size:28px 28px;animation:bgScroll 8s linear infinite;pointer-events:none}
.auth-form-side{width:52%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 56px;background:#fff;overflow-y:auto}
.auth-form-wrap{width:100%;max-width:420px}
.auth-card{width:100%;max-width:420px;background:#fff;border-radius:24px;padding:36px;box-shadow:0 24px 80px rgba(0,0,0,.14);animation:scaleIn .25s cubic-bezier(.22,1,.36,1)}
.auth-tabs{display:flex;background:#eaf4ff;border-radius:12px;padding:4px;gap:4px;margin-bottom:24px}
.auth-location-card{display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;transition:.2s}
@media(max-width:768px){
  .auth-visual{display:none}
  .auth-form-side{width:100%;padding:24px 16px;background:linear-gradient(180deg,#eef7ff 0%,#ffffff 100%)}
  .auth-form-wrap{max-width:100%}
  .auth-card{max-width:none;padding:26px 22px;border-radius:20px;box-shadow:0 18px 44px rgba(74,168,255,.14)}
}

/* ── SIDEBAR LAYOUT ── */
.layout{display:flex;min-height:100vh}
.sidebar{width:240px;background:linear-gradient(180deg,#8fd0ff 0%,#4aa8ff 100%);display:flex;flex-direction:column;position:fixed;top:0;bottom:0;left:0;z-index:100;overflow-y:auto;border-right:1px solid rgba(255,255,255,.55)}
.sidebar-logo{padding:22px 20px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
.sidebar-logo .brand{font-family:var(--font);font-weight:900;font-size:24px;color:#fff;letter-spacing:-.5px}
.sidebar-logo .brand span{color:#a78bfa}
.sidebar-logo .version{font-size:10px;color:rgba(255,255,255,.3);margin-top:2px;font-weight:600;letter-spacing:.8px;text-transform:uppercase}
.sidebar-nav{flex:1;padding:16px 12px}
.nav-section-title{font-size:9px;font-weight:800;color:rgba(255,255,255,.25);text-transform:uppercase;letter-spacing:1.2px;padding:12px 8px 6px;margin-top:8px}
.nav-item{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;cursor:pointer;color:rgba(255,255,255,.6);font-size:13px;font-weight:600;transition:.2s;position:relative;margin-bottom:2px;font-family:var(--font)}
.nav-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.9)}
.nav-item.active{background:rgba(255,255,255,.22);color:#fff}
.nav-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:60%;background:#fff;border-radius:0 3px 3px 0}
.nav-item svg{width:18px;height:18px;flex-shrink:0}
.nav-badge{margin-left:auto;background:#ef4444;color:#fff;font-size:10px;font-weight:900;padding:2px 6px;border-radius:100px;min-width:18px;text-align:center}
.sidebar-bottom{padding:16px 12px 20px;border-top:1px solid rgba(255,255,255,.08)}
.sidebar-shop{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05);margin-bottom:10px}
.sidebar-shop .shop-avatar{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
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
.page-header-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

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
.btn svg{width:16px;height:16px;flex-shrink:0}
.btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,0);transition:.2s}
.btn:hover::after{background:rgba(255,255,255,.12)}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important}
.btn-primary{background:linear-gradient(135deg,#69bbff,#4aa8ff);color:#fff;box-shadow:0 4px 14px rgba(74,168,255,.3)}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(74,168,255,.4)}
.btn-success{background:linear-gradient(135deg,#69bbff,#4aa8ff);color:#fff;box-shadow:0 4px 14px rgba(74,168,255,.3)}
.btn-success:hover{transform:translateY(-1px)}
.btn-danger{background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;box-shadow:0 4px 14px rgba(239,68,68,.3)}
.btn-danger:hover{transform:translateY(-1px)}
.btn-ghost{background:var(--surface);color:var(--text);border:1.5px solid var(--border);box-shadow:var(--shadow-sm)}
.btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
.btn-orange{background:linear-gradient(135deg,#69bbff,#4aa8ff);color:#fff;box-shadow:0 4px 14px rgba(74,168,255,.3)}

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
.modal{background:var(--surface);border-radius:20px;padding:22px;width:100%;max-width:560px;max-height:86vh;overflow-y:auto;animation:scaleIn .25s cubic-bezier(.22,1,.36,1);box-shadow:0 24px 64px rgba(0,0,0,.2)}

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
.prod-grid.compact{gap:10px}
.prod-card.compact .pc-img{height:128px}
.prod-card.compact .pc-body{padding:10px}
.prod-card.compact .pc-name{font-size:13px;margin-bottom:2px;-webkit-line-clamp:1}
.prod-card.compact .pc-meta{font-size:11px;margin-bottom:5px}
.prod-card.compact .pc-price{font-size:17px}
.prod-card.compact .pc-actions{padding:8px 10px;gap:6px}
.prod-card.compact .pc-actions .btn{font-size:11px;padding:7px 8px}
.view-toggle{display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:999px;background:#f4faff;border:1px solid var(--border)}
.view-toggle-btn{border:none;background:transparent;color:var(--muted);padding:7px 11px;border-radius:999px;cursor:pointer;font-size:11px;font-weight:800;font-family:var(--font);white-space:nowrap}
.view-toggle-btn.active{background:linear-gradient(180deg,#dff1ff,#c9e7ff);color:var(--primary-dark)}

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
.img-compare img{width:100%;height:110px;object-fit:contain;border-radius:10px;background:#f9fafb;border:1.5px solid var(--border)}

/* ── AI AUTOFILL ── */
.ai-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;background:linear-gradient(135deg,#69bbff,#4aa8ff);color:#fff;font-size:11px;font-weight:800;font-family:var(--font)}
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
.settings-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;border-radius:16px;background:linear-gradient(135deg,#0f4c81 0%,#1d6fb8 54%,#4aa8ff 100%);border:1px solid rgba(74,168,255,.48);box-shadow:0 14px 30px rgba(29,111,184,.25);margin-bottom:16px}
.settings-kicker{display:inline-flex;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.17);color:rgba(255,255,255,.96);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.settings-hero-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.settings-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);gap:16px;align-items:start}
.settings-col{display:flex;flex-direction:column;gap:16px}
.settings-health-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.settings-health-item{padding:12px;border-radius:12px;background:linear-gradient(180deg,#f8fcff,#eef7ff);border:1px solid var(--border2)}
.settings-health-label{font-size:11px;color:var(--muted);font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.settings-health-value{font-family:var(--font);font-size:22px;font-weight:900;color:var(--primary-dark);line-height:1.1;margin-top:6px}
.settings-health-sub{font-size:12px;color:var(--muted);margin-top:5px;line-height:1.4}
.settings-signout-btn{width:100%;background:rgba(239,68,68,.08);color:#ef4444;border:1.5px solid rgba(239,68,68,.18)}
.settings-signout-btn:hover{background:rgba(239,68,68,.14)}
.hub-switch-card{padding:12px 12px 4px;margin-bottom:10px;background:linear-gradient(180deg,#ffffff,#f8fbff);border:1.5px solid var(--border2)}
.hub-switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.hub-switch-title{font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
.hub-counts{display:flex;gap:8px;flex-wrap:wrap}
.hub-count-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:var(--primary-light);color:var(--primary-dark);font-size:11px;font-weight:800}
@media(max-width:980px){
  .layout{display:block}
  .auth-page{display:block}
  .auth-visual,.auth-form-side{width:100%}
  .auth-visual{min-height:220px;padding:28px 20px}
  .auth-form-side{padding:20px 14px 32px;background:linear-gradient(180deg,#eef7ff 0%,#ffffff 100%)}
  .auth-card{max-width:none;padding:24px 18px;border-radius:20px}
  .auth-tabs{margin-bottom:18px}
  .auth-location-card{padding:12px 14px}
  .sidebar{position:fixed;left:0;right:0;top:auto;bottom:0;width:100%;height:auto;max-height:none;border-right:none;border-top:1px solid rgba(74,168,255,.18);background:rgba(255,255,255,.97);backdrop-filter:blur(18px);overflow:hidden}
  .sidebar-logo{display:none}
  .sidebar-nav{display:flex;align-items:stretch;gap:8px;padding:10px 12px;overflow-x:auto}
  .nav-section-title{display:none}
  .nav-item{flex:0 0 auto;min-width:74px;justify-content:center;flex-direction:column;gap:5px;padding:9px 12px;border-radius:16px;background:#f4faff;color:var(--muted);border:1px solid var(--border);font-size:10px;text-align:center}
  .nav-item.active{background:linear-gradient(180deg,#dff1ff,#c9e7ff);color:var(--primary-dark)}
  .nav-item.active::before{display:none}
  .nav-item svg{width:20px;height:20px}
  .sidebar-bottom{display:none}
  .sidebar-shop{display:none}
  .main-content{margin-left:0;padding-bottom:94px}
  .topbar{display:none}
  .topbar-actions{width:100%;justify-content:space-between;flex-wrap:wrap}
  .topbar-actions .topbar-welcome{display:none}
  .page{padding:18px 14px 10px;max-width:none}
  .page-header{align-items:flex-start;flex-direction:column;gap:10px}
  .page-header-actions{width:100%}
  .page-header-actions .btn{flex:1 1 180px}
  .stat-grid,.grid-2,.grid-3,.img-compare{grid-template-columns:1fr}
  .settings-grid,.settings-health-grid{grid-template-columns:1fr}
  .settings-hero{flex-direction:column;padding:16px}
  .settings-hero-actions{width:100%;justify-content:stretch}
  .settings-hero-actions .btn{flex:1 1 180px}
  .hub-switch-row{align-items:flex-start}
  .prod-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .prod-grid.compact{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .table-head,.table-row{flex-wrap:wrap;padding:14px}
  .table-wrap{overflow-x:auto}
  .order-head,.page-header,.topbar{align-items:flex-start}
  .modal{padding:22px 18px}
  .prod-card .pc-actions{flex-direction:column}
  .prod-card .pc-actions .btn{width:100%}
  .table-head span,.table-row > *{flex:1 1 140px;min-width:0}
}
@media(max-width:560px){
  .auth-visual{display:none}
  .prod-grid{grid-template-columns:1fr}
  .prod-grid.compact{grid-template-columns:1fr}
  .sidebar-nav{padding:10px 10px 6px}
  .sidebar-bottom{display:none}
  .topbar,.page,.modal{padding-left:12px;padding-right:12px}
  .btn{width:100%}
  .topbar-actions{gap:8px}
  .topbar-actions > *{width:100%}
  .page-title{font-size:22px}
  .table-head{display:none}
  .table-row{padding:12px;gap:10px;border-radius:14px;background:var(--surface);margin-bottom:10px;border:1px solid var(--border2)}
  .table-row:last-child{margin-bottom:0}
  .auth-form-side{padding:14px 12px 24px}
  .auth-card{padding:22px 16px;border-radius:18px}
  .auth-location-card,.auth-tabs{gap:8px}
}
`

const NEXT_STATUS = { CONFIRMED: 'PACKING' }  // Vendor only: start prep after rider accepts
const STATUS_COLOR = { PENDING: '#f59e0b', CONFIRMED: '#3b82f6', PACKING: '#8b5cf6', PICKED_UP: '#06b6d4', OUT_FOR_DELIVERY: '#f97316', DELIVERED: '#22c55e', CANCELLED: '#ef4444' }
const STATUS_LABEL = { PENDING: 'Pending', CONFIRMED: 'Confirmed', PACKING: 'Packing', PICKED_UP: 'Picked Up', OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }
const PRODUCT_FORM_DRAFT_PREFIX = 'dott_vendor_product_form_draft_v1'
const PRODUCT_CARD_MODE_KEY = 'dott_vendor_products_card_mode'

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

function cleanUploadTokens(filename = '') {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function toTitleWords(value = '') {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function pickLocalCategory(tokens = []) {
  const joined = tokens.join(' ')
  if (/lehenga/.test(joined)) return { category:'Lehenga', productType:'Lehenga', gender:'Women', fabric:'Silk Blend', pattern:'Embroidered', fit:'Regular', occasion:'Festival', sleeveType:'Half Sleeve', length:'Long', price:'2499' }
  if (/(kurti|kurta)/.test(joined)) return { category:'Kurti', productType:'Kurti', gender:'Women', fabric:'Cotton Blend', pattern:'Printed', fit:'Regular', occasion:'Casual', sleeveType:'Three Quarter Sleeve', length:'Long', price:'999' }
  if (/(saree|sari)/.test(joined)) return { category:'Saree', productType:'Saree', gender:'Women', fabric:'Silk Blend', pattern:'Woven', fit:'Regular', occasion:'Festival', sleeveType:'Not Applicable', length:'Long', price:'1799' }
  if (/(shirt|tshirt|t-shirt|tee)/.test(joined)) return { category:'Shirt', productType:'Shirt', gender:'Men', fabric:'Cotton', pattern:'Plain', fit:'Slim', occasion:'Casual', sleeveType:'Full Sleeve', length:'Regular', price:'899' }
  if (/(jeans|jean|pant|pants|trouser|trousers)/.test(joined)) return { category:'Jeans', productType:'Jeans', gender:'Men', fabric:'Denim', pattern:'Solid', fit:'Regular', occasion:'Casual', sleeveType:'Not Applicable', length:'Full Length', price:'1299' }
  if (/(dress|gown)/.test(joined)) return { category:'Dress', productType:'Dress', gender:'Women', fabric:'Polyester Blend', pattern:'Printed', fit:'Regular', occasion:'Party', sleeveType:'Sleeveless', length:'Midi', price:'1499' }
  return { category:'Fashion', productType:'Fashion', gender:'Unisex', fabric:'Cotton Blend', pattern:'Solid', fit:'Regular', occasion:'Casual', sleeveType:'Regular', length:'Regular', price:'999' }
}

async function detectDominantColorFromSource(src) {
  try {
    const img = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = 48
    canvas.height = 48
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, 48, 48)
    const { data } = ctx.getImageData(0, 0, 48, 48)
    let r = 0, g = 0, b = 0, count = 0
    for (let i = 0; i < data.length; i += 4) {
      const pr = data[i], pg = data[i+1], pb = data[i+2]
      if (pr > 240 && pg > 240 && pb > 240) continue
      if (pr < 20 && pg < 20 && pb < 20) continue
      r += pr; g += pg; b += pb; count += 1
    }
    if (!count) return 'Blue'
    const avg = [r / count, g / count, b / count]
    const palette = [
      ['Black', [35,35,35]], ['White', [245,245,245]], ['Grey', [125,125,125]], ['Cream', [236,228,202]],
      ['Beige', [209,188,157]], ['Gold', [205,170,95]], ['Navy', [38,56,110]], ['Blue', [58,110,196]],
      ['Teal', [30,131,139]], ['Green', [62,132,66]], ['Olive', [107,121,52]], ['Yellow', [220,185,50]],
      ['Orange', [217,120,47]], ['Red', [180,55,63]], ['Pink', [214,112,155]], ['Purple', [104,72,134]],
      ['Maroon', [104,43,60]], ['Brown', [116,83,52]],
    ]
    let best = 'Blue'
    let bestScore = Number.POSITIVE_INFINITY
    palette.forEach(([name, [pr, pg, pb]]) => {
      const score = Math.pow(avg[0]-pr,2) + Math.pow(avg[1]-pg,2) + Math.pow(avg[2]-pb,2)
      if (score < bestScore) {
        best = name
        bestScore = score
      }
    })
    return best
  } catch {
    return 'Blue'
  }
}

async function buildLocalAutofill(file, previewUrl) {
  const tokens = cleanUploadTokens(file?.name || '')
  const preset = pickLocalCategory(tokens)
  const color = await detectDominantColorFromSource(previewUrl)
  const descriptor = [color, preset.pattern !== 'Solid' ? preset.pattern : '', preset.category].filter(Boolean).join(' ')
  const title = `${descriptor} for ${preset.gender}`.trim()
  return {
    name: `${color} ${preset.category}`.trim(),
    title,
    category: preset.category,
    productType: preset.productType,
    brand: 'DOTT Fashion',
    color,
    material: preset.fabric,
    fabric: preset.fabric,
    pattern: preset.pattern,
    gender: preset.gender,
    fit: preset.fit,
    occasion: preset.occasion,
    sleeveType: preset.sleeveType,
    length: preset.length,
    mrp: '',
    suggestedPrice: preset.price,
    price: preset.price,
    description: `${title} with a clean catalogue-ready look, ${preset.fabric.toLowerCase()} feel, and a ${preset.fit.toLowerCase()} fit for ${preset.occasion.toLowerCase()} wear.`,
    tags: [preset.category, preset.productType, color, preset.fabric, preset.occasion, 'fashion', 'catalogue'].map(toTitleWords),
    sizes: /Shirt|Kurti|Dress|Lehenga/.test(preset.productType) ? 'S, M, L, XL' : '',
    confidence: 'basic',
    analysisSource: 'local-fallback',
  }
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
  const [lastUploadName, setLastUploadName] = useState('')

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
    setLastUploadName(file.name || 'product image')
    setCapturedUrl(url); setMode('preview'); stopCamera()
    processAndAnalyze(file)
    e.target.value = ''
  }

  const processAndAnalyze = async (blob) => {
    setProcessing(true); setAnalyzing(false); setAiResult(null); setProcessedData(null); setBaseProcessedData(null); setError('')
    try {
      const file = blob instanceof File ? blob : new File([blob], 'cap.jpg', { type: 'image/jpeg' })
      if (!lastUploadName) setLastUploadName(file.name || 'product image')
      const localPreview = await processProductImage(file)
      setBaseProcessedData(localPreview)
      setAnalyzing(true)
      const { data } = await api.processProductImageAI(file)
      setAiResult(data.autofill || data.analysis || null)
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
      try {
        const file = blob instanceof File ? blob : new File([blob], 'cap.jpg', { type: 'image/jpeg' })
        const preview = baseProcessedData || await processProductImage(file)
        if (!baseProcessedData) setBaseProcessedData(preview)
        const fallbackAi = await buildLocalAutofill(file, preview.url || capturedUrl)
        setAiResult(fallbackAi)
        setProcessedData({
          url: preview.url || capturedUrl,
          dataUrl: preview.dataUrl || capturedUrl,
          serverUrl: '',
          originalUrl: capturedUrl,
          presentation: detectProductPresentation(fallbackAi),
        })
        setError('Quick AI draft ready')
      } catch {
        setError('Quick draft unavailable')
      }
    }
    setProcessing(false); setAnalyzing(false)
  }

  const resetCapture = () => {
    setMode('camera')
    setCapturedUrl(null)
    setProcessedData(null)
    setBaseProcessedData(null)
    setAiResult(null)
    setError('')
    setLastUploadName('')
    startCamera()
  }

  const confirmImage = async () => {
    if (!processedData && !capturedUrl) { onClose(); return }
    setUploading(true)
    const payload = {
      imageUrl: processedData?.serverUrl || processedData?.dataUrl || capturedUrl,
      processedImageUrl: processedData?.serverUrl || processedData?.dataUrl || capturedUrl,
      originalImageUrl: processedData?.originalUrl || capturedUrl,
      aiMeta: aiResult || null,
      presentation: processedData?.presentation || null,
    }
    try {
      onCapture(payload)
      if (aiResult && onAnalyze) onAnalyze(aiResult)
    } catch(e) {
      onCapture(payload)
      if (aiResult && onAnalyze) onAnalyze(aiResult)
    }
    setUploading(false); onClose()
  }

  const confirmWithoutAI = async () => {
    setUploading(true)
    const payload = {
      imageUrl: processedData?.serverUrl || processedData?.dataUrl || capturedUrl,
      processedImageUrl: processedData?.serverUrl || processedData?.dataUrl || capturedUrl,
      originalImageUrl: processedData?.originalUrl || capturedUrl,
      aiMeta: null,
      presentation: processedData?.presentation || null,
    }
    try { onCapture(payload) }
    catch(e) { onCapture(payload) }
    setUploading(false); onClose()
  }

  const isWorking = processing || analyzing || uploading

  return (
    <div className="overlay" style={{ zIndex: 500 }}>
      <div className="modal" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,var(--primary),#a78bfa)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontFamily: 'var(--font)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Camera /> Smart Product Camera
            <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 100, padding: '2px 6px', fontSize: 9, fontWeight: 700, letterSpacing: '.4px' }}>AI POWERED</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', padding: '5px 7px', display: 'flex' }}><Icons.Close /></button>
        </div>

          <div style={{ padding: 14 }}>
          {/* Camera mode */}
          {mode === 'camera' && !error && (
            <div>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1, padding: '10px 12px' }} onClick={() => fileRef.current?.click()}>
                  <Icons.Upload /> Gallery
                </button>
                <button className="btn btn-primary" style={{ flex: 2, padding: '10px 12px' }} onClick={capturePhoto}>
                  <Icons.Camera /> Capture
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                Camera — AI enhances image + auto-fills all product details
              </div>
            </div>
          )}

          {/* Upload mode fallback */}
          {(mode === 'upload' || (error && !capturedUrl)) && (
            <div>
              {error && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 14px', color: '#9a3412', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <div style={{border:'1.5px dashed #93c5fd',borderRadius:16,padding:'14px 14px',background:'linear-gradient(180deg,#f8fbff,#eef6ff)'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                  <div style={{width:46,height:46,borderRadius:14,background:'rgba(59,130,246,.12)',display:'grid',placeItems:'center',color:'#3b82f6'}}>
                    <Icons.Upload />
                  </div>
                  <div>
                    <div style={{fontSize:15,fontWeight:900,color:'var(--text)'}}>Add Product Image</div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>Upload one clean product photo to generate a faster listing draft.</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button className="btn btn-primary" style={{flex:1,padding:'10px 12px'}} onClick={() => fileRef.current?.click()}>
                    <Icons.Upload /> Upload Photo
                  </button>
                  <button className="btn btn-ghost" style={{flex:1,padding:'10px 12px'}} onClick={() => { setMode('camera'); setError(''); startCamera() }}>
                    <Icons.Camera /> Open Camera
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview + AI results */}
          {mode === 'preview' && (
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:900,color:'var(--text)'}}>Product Preview</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>
                    {lastUploadName || 'Captured image'}
                    {aiResult ? ' ready for auto-fill.' : ' ready to use.'}
                    {error === 'Quick AI draft ready' ? ' A quick product draft was generated locally.' : ''}
                    {!aiResult && error ? ' You can continue and add details manually.' : ''}
                  </div>
                </div>
                <span style={{padding:'6px 9px',borderRadius:999,background:aiResult?'rgba(59,130,246,.12)':'rgba(148,163,184,.12)',color:aiResult?'#2563eb':'#64748b',fontSize:10,fontWeight:800}}>
                  {processing ? 'Processing' : aiResult ? 'AI Ready' : 'Ready'}
                </span>
              </div>

              <div className="img-compare" style={{ marginBottom: 14, gridTemplateColumns: baseProcessedData || processedData ? '1fr 1fr' : '1fr' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textAlign: 'center', textTransform: 'uppercase' }}>Original</div>
                  <img src={capturedUrl} alt="Original" />
                </div>
                {(baseProcessedData || processedData) && (
                <div style={{ position: 'relative' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', marginBottom: 5, textAlign: 'center', textTransform: 'uppercase' }}>{processedData ? 'E-commerce Ready' : 'Clean Preview'}</div>
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
                )}
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
                <div style={{ background: 'var(--primary-light)', border: '1.5px solid rgba(108,71,255,.2)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
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
                <div style={{ background: '#f8fafc', border:'1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{fontSize:13,fontWeight:800,color:'#0f172a'}}>Continue with this image</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop:4 }}>
                    The photo is ready. You can add product details manually and save normally.
                  </div>
                </div>
              )}

              <div style={{position:'sticky',bottom:-2,background:'linear-gradient(180deg,rgba(255,255,255,0),#fff 28%)',paddingTop:14,marginTop:6}}>
                <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginBottom:8,textAlign:'center'}}>
                  {aiResult ? 'Use auto-fill to open the product form with AI-filled fields.' : 'Use this image to open the product form.'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={resetCapture} disabled={isWorking}>
                  ↺ Retake
                </button>
                {aiResult ? (
                  <button className="btn btn-primary" style={{ flex: 2, background: 'linear-gradient(135deg,var(--primary),#a78bfa)' }} onClick={confirmImage} disabled={isWorking}>
                    {uploading ? 'Opening Form...' : analyzing ? 'Analyzing...' : 'Use Auto-Fill'}
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={confirmWithoutAI} disabled={isWorking}>
                    {uploading ? 'Opening Form...' : 'Use This Image'}
                  </button>
                )}
                </div>
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
  const enterDemoStore = () => {
    localStorage.setItem(DEMO_VENDOR_MODE_KEY, '1')
    const db = getDemoVendorDb()
    onSuccess(db.user, db.shop)
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

  const getLoc = async () => {
    setError('')
    try {
      const gps = await getCurrentGpsLocation()
      setLoc({ lat: gps.lat, lng: gps.lng })
    } catch (err) {
      setError(err?.message || 'Unable to detect current location')
    }
  }

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
      <div className="auth-visual" style={{ position: 'relative', zIndex: 1 }}>
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

      <div className="auth-form-side">
        <div className="auth-form-wrap">
        <div className="auth-card">
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily:'var(--font)',fontWeight:900,fontSize:26,color:'var(--text)',letterSpacing:'-.5px' }}>
              {tab==='login'?'Welcome back':'Create Your Store'}
            </div>
            <div style={{ color:'var(--muted)',fontSize:14,marginTop:4 }}>{tab==='login'?'Sign in to your vendor dashboard':'Set up your store in minutes'}</div>
          </div>

          <div className="auth-tabs">
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
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
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
              <div className="auth-location-card" onClick={getLoc} style={{borderColor:loc?'var(--green)':'var(--border)',background:loc?'#f0fdf4':'var(--bg)'}}>
                <span style={{fontSize:22}}>{loc?'●':'○'}</span>
                <div><div style={{fontWeight:700,fontSize:13}}>{loc?'Location captured':'Set shop location'}</div><div style={{color:'var(--muted)',fontSize:12}}>{loc?`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`:'Used for delivery radius'}</div></div>
              </div>
              {error && <div style={{color:'#dc2626',fontSize:13,padding:'10px 14px',background:'#fef2f2',borderRadius:10,fontWeight:600,border:'1px solid #fecaca'}}>{error}</div>}
              {tab==='login'
                ? <button className="btn btn-primary" style={{width:'100%',padding:'13px',fontSize:15}} onClick={submit} disabled={loading}>{loading?'Signing in...':'→ Sign In'}</button>
                : <button className="btn btn-primary" style={{width:'100%',padding:'13px',fontSize:15}} onClick={sendOtp} disabled={otpSending}>{otpSending?'Sending OTP...':'→ Send OTP & Continue'}</button>}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ shop, user, onOpenProducts, onOpenOrders, onOpenEarnings }) {
  const [analytics, setAnalytics] = useState(null)
  const [orders, setOrders] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [products, setProducts] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [focusPanel, setFocusPanel] = useState('')
  const [expandedRevenueOrder, setExpandedRevenueOrder] = useState(null)

  useEffect(() => {
    api.analytics().then(r => setAnalytics(r.data)).catch(() => {})
    api.shopOrders({ status: 'PENDING' }).then(r => setOrders(r.data)).catch(() => {})
    api.shopOrders().then(r => setAllOrders(r.data)).catch(() => {})
    api.myProducts().then(r => setProducts(r.data)).catch(() => {})
    api.lowStock().then(r => setLowStock(r.data.items || [])).catch(() => {})
  }, [])

  const stats = [
    { label: "Today's Revenue", val: `₹${analytics?.today?.revenue || 0}`, sub: `${analytics?.today?.orders || 0} orders`, color: '#6c47ff', letter: 'T' },
    { label: "This Month", val: `₹${analytics?.month?.revenue || 0}`, sub: `${analytics?.month?.orders || 0} orders`, color: '#0ea5e9', letter: 'M' },
    { label: "All Time", val: `₹${analytics?.allTime?.revenue || 0}`, sub: `${analytics?.allTime?.orders || 0} orders`, color: '#22c55e', letter: 'A' },
    { label: "Pending Returns", val: analytics?.pendingReturns ?? '—', sub: 'needs action', color: '#f97316', letter: 'R' },
  ]
  const totalStock = products.reduce((sum, p) => sum + Number(p.stock || 0), 0)
  const activeProducts = products.filter(p => p.isActive).length
  const periodStart = Date.now() - (2 * 24 * 60 * 60 * 1000)
  const deliveredLast2Days = allOrders.filter(o => {
    if (o.status !== 'DELIVERED') return false
    const stamp = o.deliveredAt || o.deliveredTime || o.placedAt
    if (!stamp) return false
    return new Date(stamp).getTime() >= periodStart
  })
  const grossLast2Days = deliveredLast2Days.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const platformFeeLast2Days = 0
  const netPayableLast2Days = grossLast2Days
  const healthCards = [
    {label:'Amount generated', value: `₹${analytics?.month?.revenue || 0}`, sub: `${analytics?.month?.orders || 0} orders generated this month`, color:'#16a34a'},
    {label:'Pending orders', value: `${orders.length}`, sub: orders.length > 0 ? 'Orders need quick action' : 'No pending orders right now', color:'#f59e0b'},
    {label:'Stock left', value: `${totalStock}`, sub: lowStock.length > 0 ? `${lowStock.length} product${lowStock.length !== 1 ? 's' : ''} running low on stock` : 'All products have healthy stock', color:'#0ea5e9'},
    {label:'Active products', value: `${activeProducts}`, sub: shop?.isOpen ? 'Products visible in your live store' : 'Open shop to make products visible', color:'#4aa8ff'},
  ]

  return (
    <div className="page">
      <div
        className="page-header"
        style={{
          background: 'linear-gradient(135deg,#0f4c81 0%, #1d6fb8 52%, #4aa8ff 100%)',
          border: '1px solid rgba(74,168,255,.55)',
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 16,
          boxShadow: '0 14px 30px rgba(29,111,184,.28)',
        }}
      >
        <div>
          <div className="page-title" style={{ color: '#ffffff' }}>Dashboard</div>
          <div className="page-sub" style={{ color: 'rgba(255,255,255,.86)' }}>{shop?.name} · {shop?.category}</div>
        </div>
        <div className="page-header-actions">
          <span
            className={`badge ${shop?.isOpen ? 'badge-success' : 'badge-danger'}`}
            style={{
              boxShadow: '0 4px 12px rgba(0,0,0,.16)',
              background: shop?.isOpen ? 'rgba(220,252,231,.95)' : 'rgba(254,226,226,.95)',
              color: shop?.isOpen ? '#166534' : '#991b1b',
            }}
          >
            {shop?.isOpen ? '● Open' : '● Closed'}
          </span>
          {shop?.isSuspended && <span className="badge badge-danger">Suspended</span>}
        </div>
      </div>

      <div className="card fade-up" style={{ marginBottom: 18, padding: 0, overflow: 'hidden', border:'1px solid rgba(74,168,255,.2)', background: 'linear-gradient(140deg,#ecf7ff 0%,#ffffff 58%,#e9f6ff 100%)' }}>
        <div style={{ padding: '18px', borderBottom: '1px solid rgba(74,168,255,.12)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.08em', color: 'var(--primary)', textTransform: 'uppercase' }}>Store Snapshot</div>
            <span style={{fontSize:11,fontWeight:800,padding:'5px 10px',borderRadius:999,background:shop?.isOpen?'rgba(34,197,94,.12)':'rgba(239,68,68,.12)',color:shop?.isOpen?'#15803d':'#b91c1c'}}>
              {shop?.isOpen ? 'Open now' : 'Currently closed'}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 24, color: 'var(--text)', lineHeight:1.1 }}>{shop?.name}</div>
          <div style={{ color: '#4f6b85', fontSize: 13, marginTop: 6 }}>Track sales, active orders, and stock health in one clean view.</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
            <span style={{fontSize:11,fontWeight:800,padding:'6px 10px',borderRadius:999,background:'rgba(59,130,246,.1)',color:'#1d4ed8'}}>{orders.length} pending orders</span>
            <span style={{fontSize:11,fontWeight:800,padding:'6px 10px',borderRadius:999,background:'rgba(14,165,233,.1)',color:'#0369a1'}}>{activeProducts} active products</span>
            <span style={{fontSize:11,fontWeight:800,padding:'6px 10px',borderRadius:999,background:'rgba(245,158,11,.12)',color:'#b45309'}}>{lowStock.length} low stock</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 0, background:'#fff' }}>
          {stats.map((s, i) => (
            <div key={s.label} className="fade-up" style={{ animationDelay: `${i * 0.06}s`, padding: '16px 18px', borderRight: '1px solid rgba(74,168,255,.08)', borderBottom: '1px solid rgba(74,168,255,.08)' }}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.6px' }}>{s.label}</div>
                <span style={{width:22,height:22,borderRadius:7,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,background:`${s.color}20`,color:s.color}}>{s.letter}</span>
              </div>
              <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 30, color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {orders.length > 0 && (
        <div className="card fade-up" style={{ animationDelay: '.28s', borderColor: '#fde68a', background: 'linear-gradient(180deg,#fffdf2,#ffffff)' }}>
          <div className="card-title" style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {orders.length} Pending Order{orders.length > 1 ? 's' : ''} need attention
          </div>
          {orders.slice(0, 2).map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border2)', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>#{o.orderCode} — {o.customer?.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{o.items?.length} items · ₹{o.total} · {o.paymentMethod?.toUpperCase()}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
                  Customer: {o.customer?.phone || 'No phone'}<br />
                  Location: {o.deliveryAddress || 'No delivery address'}
                </div>
              </div>
              <span className="badge badge-warning">Pending</span>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={onOpenOrders}>
            <Icons.Orders /> Open Orders
          </button>
        </div>
      )}

      <div className="card fade-up" style={{ animationDelay: '.3s', marginTop: 16, background:'linear-gradient(180deg,#ffffff,#f8fbff)' }}>
        <div className="card-title" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
          <span>Store Health</span>
          <span style={{fontSize:11,fontWeight:800,padding:'6px 10px',borderRadius:999,background:'rgba(37,99,235,.1)',color:'#1d4ed8'}}>Live status</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          {healthCards.map(({ label, value, sub, color }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (label === 'Pending orders') { onOpenOrders?.(); return }
                if (label === 'Active products' || label === 'Stock left') { onOpenProducts?.(); return }
                if (label === 'Amount generated') { setFocusPanel('revenue'); return }
              }}
              style={{ padding: '14px', background: '#fff', borderRadius: 14, border: '1px solid var(--border2)', boxShadow:'0 6px 18px rgba(15,23,42,.04)', textAlign:'left', cursor:'pointer' }}
            >
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.6px', marginBottom: 8 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font)', fontWeight: 900, fontSize: 22, color }}>{value}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{sub}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ flex: '1 1 220px' }} onClick={onOpenProducts}>
            <Icons.Products /> Check Low Stock
          </button>
          <div style={{ flex: '1 1 220px', minWidth: 0, padding: '11px 14px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
            {lowStock.length > 0
              ? `${lowStock.length} low-stock product${lowStock.length !== 1 ? 's are' : ' is'} ready for update in Products.`
              : 'All products currently have safe stock levels.'}
          </div>
        </div>
      </div>

      {focusPanel === 'revenue' && (
        <div className="card fade-up" style={{marginTop:16,borderColor:'rgba(34,197,94,.28)',background:'linear-gradient(180deg,#f7fff9,#ffffff)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:12}}>
            <div className="card-title" style={{margin:0}}>Last 2 Days Payout Summary</div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setFocusPanel('')}>Close</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:12}}>
            <div style={{padding:'12px',borderRadius:12,border:'1px solid var(--border2)',background:'#fff'}}>
              <div style={{fontSize:11,fontWeight:800,color:'var(--muted)',textTransform:'uppercase'}}>Deliveries</div>
              <div style={{fontSize:24,fontWeight:900,color:'#0ea5e9'}}>{deliveredLast2Days.length}</div>
            </div>
            <div style={{padding:'12px',borderRadius:12,border:'1px solid var(--border2)',background:'#fff'}}>
              <div style={{fontSize:11,fontWeight:800,color:'var(--muted)',textTransform:'uppercase'}}>Generated Amount</div>
              <div style={{fontSize:24,fontWeight:900,color:'#16a34a'}}>₹{Math.round(grossLast2Days)}</div>
            </div>
            <div style={{padding:'12px',borderRadius:12,border:'1px solid var(--border2)',background:'#fff'}}>
              <div style={{fontSize:11,fontWeight:800,color:'var(--muted)',textTransform:'uppercase'}}>Platform Fee</div>
              <div style={{fontSize:24,fontWeight:900,color:'#16a34a'}}>₹0</div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>No fee charged now</div>
            </div>
            <div style={{padding:'12px',borderRadius:12,border:'1px solid var(--border2)',background:'#fff'}}>
              <div style={{fontSize:11,fontWeight:800,color:'var(--muted)',textTransform:'uppercase'}}>Vendor Payable</div>
              <div style={{fontSize:24,fontWeight:900,color:'#0f766e'}}>₹{Math.round(netPayableLast2Days)}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:10}}>
            <button className="btn btn-primary" onClick={()=>onOpenEarnings?.()}><Icons.Analytics /> Open Earnings Tab</button>
            <button className="btn btn-ghost" onClick={()=>onOpenOrders?.()}><Icons.Orders /> View All Orders</button>
            <button className="btn btn-ghost" onClick={()=>onOpenProducts?.()}><Icons.Products /> View All Product Details</button>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setExpandedRevenueOrder(prev => prev === 'ALL' ? null : 'ALL')}>
              {expandedRevenueOrder === 'ALL' ? 'Hide All Product Details' : 'Show All Product Details'}
            </button>
          </div>
          <div style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>Delivered orders used in this 2-day calculation:</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {deliveredLast2Days.length === 0 && (
              <div style={{padding:'12px',borderRadius:10,border:'1px solid var(--border2)',background:'#fff',fontSize:13,color:'var(--muted)'}}>
                No delivered orders found in the last 2 days.
              </div>
            )}
            {deliveredLast2Days.map(o => (
              <div key={o.id} style={{padding:'12px',borderRadius:10,border:'1px solid var(--border2)',background:'#fff'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:14}}>#{o.orderCode} - ₹{o.total}</div>
                    <div style={{fontSize:12,color:'var(--muted)'}}>{o.customer?.name || 'Customer'} - {o.customer?.phone || 'No phone'}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setExpandedRevenueOrder(prev => prev === o.id ? null : o.id)}>
                    {(expandedRevenueOrder === o.id || expandedRevenueOrder === 'ALL') ? 'Hide Details' : 'Product Details'}
                  </button>
                </div>
                {(expandedRevenueOrder === o.id || expandedRevenueOrder === 'ALL') && (
                  <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border2)'}}>
                    <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>Products</div>
                    {(o.items || []).map((item, idx) => (
                      <div key={`${o.id}-item-${idx}`} style={{fontSize:13,marginBottom:5}}>
                        {item.name} x{item.qty}{item.size ? ` (${item.size})` : ''}
                      </div>
                    ))}
                    <div style={{fontSize:12,color:'var(--muted)',marginTop:6}}>Delivery: {o.deliveryAddress || 'No address'}</div>
                    <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>
                      Generated: ₹{Math.round(Number(o.total || 0))} · Vendor Payable: ₹{Math.round(Number(o.total || 0))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [pickupOtpMap, setPickupOtpMap] = useState({})

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

  const showPickupOtp = async (orderId, mode = 'generate') => {
    setActioning(`pickup-${orderId}`)
    try {
      const r = mode === 'fetch' ? await api.getPickupOtp(orderId) : await api.generatePickupOtp(orderId)
      setPickupOtpMap(prev => ({ ...prev, [orderId]: r.data.otp }))
      showToast(mode === 'fetch' ? 'Pickup OTP loaded' : 'Pickup OTP generated', 'success')
      load()
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed', 'error')
    }
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
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.45 }}>
                        Delivery location: {o.deliveryAddress || 'No address'}
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
                        <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 12 }}>Rider {o.rider?.name} will pick up when ready.<br/>Pack carefully and give the pickup OTP only when the rider arrives.</div>
                        {o.pickupOtpVerified ? (
                          <div style={{padding:'12px 14px',borderRadius:12,background:'#ecfdf5',border:'1px solid #86efac',color:'#15803d',fontSize:12,fontWeight:800}}>
                            Pickup verified. The rider entered the correct vendor OTP and the order has been handed over.
                          </div>
                        ) : (
                          <div style={{display:'grid',gap:10}}>
                            {pickupOtpMap[o.id] && (
                              <div style={{padding:'14px 16px',borderRadius:16,background:'#fff',border:'1.5px solid #c4b5fd',boxShadow:'0 10px 24px rgba(91,33,182,.08)'}}>
                                <div style={{fontSize:11,fontWeight:800,color:'#7c3aed',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}}>Vendor Pickup OTP</div>
                                <div style={{fontSize:30,fontWeight:900,color:'#5b21b6',letterSpacing:'6px',fontFamily:'var(--font)'}}>{pickupOtpMap[o.id]}</div>
                                <div style={{fontSize:11,color:'#6d28d9',marginTop:6}}>Ask the rider to enter this code in the rider app before pickup is marked complete.</div>
                              </div>
                            )}
                            <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                              <button onClick={() => showPickupOtp(o.id, pickupOtpMap[o.id] ? 'generate' : (o.pickupOtpGeneratedAt ? 'fetch' : 'generate'))} disabled={actioning === `pickup-${o.id}`}
                                style={{padding:'11px 16px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#6d28d9,#8b5cf6)',color:'#fff',fontWeight:800,cursor:'pointer',boxShadow:'0 12px 24px rgba(109,40,217,.2)'}}>
                                {actioning === `pickup-${o.id}` ? 'Loading...' : pickupOtpMap[o.id] ? 'Regenerate OTP' : o.pickupOtpGeneratedAt ? 'View Pickup OTP' : 'Generate Pickup OTP'}
                              </button>
                            </div>
                          </div>
                        )}
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
  const CATEGORY_OPTIONS = ['Shirt','Kurti','Saree','Jeans','Dress','Lehenga','Fashion']
  const COLOR_OPTIONS = ['Black','White','Grey','Blue','Navy','Red','Pink','Green','Yellow','Orange','Purple','Brown','Beige','Maroon','Teal']
  const BRAND_LIBRARY = {
    common: ['DOTT Fashion','DOTT Classics','Zara','H&M','Levis','Allen Solly','US Polo','Roadster','Max','Lifestyle','Pantaloons','Westside'],
    Shirt: ['Allen Solly','US Polo','Levis','Roadster','Peter England','Louis Philippe','Van Heusen','Arrow','Blackberrys','Mufti','Wrangler','Flying Machine'],
    Kurti: ['Biba','W for Woman','Aurelia','Global Desi','Libas','Rangriti','Anouk','Fabindia','Cotton Culture','Soch','Indya','Varanga'],
    Saree: ['Fabindia','Soch','Manyavar','Kalanjali','Nalli','Pothys','Sudarshan Silks','Mimosa','Mitera','Varkala Silk Sarees'],
    Jeans: ['Levis','Wrangler','Pepe Jeans','Flying Machine','Spykar','Lee','Jack & Jones','Roadster','Mufti','US Polo'],
    Dress: ['Zara','H&M','Global Desi','AND','Only','Vero Moda','Forever New','Mango','Berrylush','Chemistry'],
    Lehenga: ['Manyavar','Mohey','Indya','Soch','Kalki','Fabindia','Aachho','Libas','Biba','Aurelia'],
    Fashion: ['DOTT Fashion','Zara','H&M','Fabindia','Global Desi','Max','Westside','Lifestyle','Pantaloons','Only'],
    linen: ['Linen Club','Raymond Linen','Fabindia','Cotton Culture'],
    cotton: ['Cotton Culture','Fabindia','Biba','W for Woman','Aurelia'],
  }
  const GENDER_OPTIONS = ['Men','Women','Unisex','Boys','Girls']
  const PRESET_COLORS = [
    {name:'Black',   hex:'#1a1a1a'},{name:'White',  hex:'#ffffff'},{name:'Navy',    hex:'#1e3a8a'},
    {name:'Red',     hex:'#dc2626'},{name:'Pink',   hex:'#ec4899'},{name:'Green',   hex:'#16a34a'},
    {name:'Blue',    hex:'#2563eb'},{name:'Yellow', hex:'#eab308'},{name:'Orange',  hex:'#f97316'},
    {name:'Purple',  hex:'#9333ea'},{name:'Brown',  hex:'#92400e'},{name:'Grey',    hex:'#6b7280'},
    {name:'Beige',   hex:'#d4b896'},{name:'Maroon', hex:'#7f1d1d'},{name:'Teal',    hex:'#0d9488'},
  ]

  const blank = {
    name:'', title:'', description:'', price:'', category:'', productType:'', color:'',
    imageUrl:'', processedImageUrl:'', images:[], colors:[], brand:'', material:'', fabric:'',
    gender:'', pattern:'', fit:'', occasion:'', sleeveType:'', length:'', tags:[],
    stock:10, hasSizes:false, sizes:[], imageAiMeta:{}
  }
  const toForm = (d) => ({
    ...blank, ...d,
    sizes: Array.isArray(d?.sizes) ? d.sizes : [],
    colors: Array.isArray(d?.colors) ? d.colors : [],
    images: Array.isArray(d?.images) ? d.images : [],
    tags: Array.isArray(d?.tags) ? d.tags : [],
    imageAiMeta: typeof d?.imageAiMeta === 'object' && d?.imageAiMeta ? d.imageAiMeta : {},
  })
  const isEdit = !!initial?.id
  const draftKey = `${PRODUCT_FORM_DRAFT_PREFIX}_${isEdit ? `edit_${initial?.id}` : 'new'}`
  const getDraftSnapshot = () => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || !parsed.form) return null
      return parsed
    } catch {
      return null
    }
  }
  const [restoredDraftAt, setRestoredDraftAt] = useState(() => getDraftSnapshot()?.savedAt || null)
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState(null)
  const [form, setForm] = useState(() => {
    const fallback = initial ? toForm(initial) : blank
    const snapshot = getDraftSnapshot()
    if (!snapshot?.form) return fallback
    const draftForm = toForm(snapshot.form)
    return isEdit ? { ...draftForm, id: initial?.id } : draftForm
  })
  const [showCamera, setShowCamera] = useState(false)
  const [cameraTarget, setCameraTarget] = useState('main')   // 'main' | colorIdx
  const [aiApplied, setAiApplied] = useState(false)
  const [aiFields, setAiFields] = useState({})
  const [tagInput, setTagInput] = useState('')
  const [descriptionEdited, setDescriptionEdited] = useState(false)
  const [newColorName, setNewColorName] = useState('')
  const [newColorHex, setNewColorHex] = useState('#000000')
  const [activeColorIdx, setActiveColorIdx] = useState(null)
  const [expandedSection, setExpandedSection] = useState('images')  // 'images'|'colors'|'sizes'|'details'

  const imgRefs = { back: useRef(null), side: useRef(null), tag: useRef(null) }
  const colorImgRef = useRef(null)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const categoryBrands = Array.from(new Set([...(BRAND_LIBRARY.common || []), ...(BRAND_LIBRARY[form.category] || [])]))
  const categoryGenderDefaults = {
    Shirt: 'Men',
    Jeans: 'Men',
    Kurti: 'Women',
    Saree: 'Women',
    Lehenga: 'Women',
    Dress: 'Women',
    Fashion: 'Unisex',
  }
  const normalizeCategory = (value='') => {
    const raw = String(value || '').trim().toLowerCase()
    const map = {
      shirts:'Shirt', shirt:'Shirt',
      kurtis:'Kurti', kurti:'Kurti', kurta:'Kurti',
      sarees:'Saree', saree:'Saree',
      jeans:'Jeans', pants:'Jeans', trousers:'Jeans',
      dresses:'Dress', dress:'Dress',
      lehenga:'Lehenga', lehanga:'Lehenga',
      fashion:'Fashion'
    }
    return map[raw] || value
  }
  const colorHexByName = (name='') => PRESET_COLORS.find(c => c.name.toLowerCase() === String(name || '').toLowerCase())?.hex || '#888888'

  const applyCategoryChange = (value='') => {
    const normalized = normalizeCategory(value)
    setDescriptionEdited(false)
    setForm(f => ({
      ...f,
      category: normalized,
      gender: categoryGenderDefaults[normalized] || f.gender || 'Unisex',
    }))
  }

  const applyColorChange = (value='') => {
    const chosen = String(value || '').trim()
    if (!chosen) {
      setForm(f => ({ ...f, color: '' }))
      return
    }
    const hex = colorHexByName(chosen)
    setDescriptionEdited(false)
    setForm(f => {
      const nextColors = Array.isArray(f.colors) ? [...f.colors] : []
      if (nextColors.length === 0) {
        nextColors.push({ name: chosen, hex, imageUrl: f.imageUrl || '', images: [] })
      } else {
        nextColors[0] = { ...nextColors[0], name: chosen, hex }
      }
      return { ...f, color: chosen, colors: nextColors }
    })
  }

  const buildDescription = (draft) => {
    const name = (draft.name || '').trim()
    const category = (draft.category || '').trim()
    const color = (draft.color || '').trim()
    const gender = (draft.gender || '').trim()
    const brand = (draft.brand || '').trim()
    const baseName = name || [color, category].filter(Boolean).join(' ').trim() || 'Fashion product'
    const audience = gender || 'Unisex'
    const brandText = brand ? `${brand} ` : ''
    return `${brandText}${baseName} for ${audience} with a clean catalogue-ready look, easy styling, and everyday comfort.`
  }

  useEffect(() => {
    if (descriptionEdited) return
    setForm(f => ({ ...f, description: buildDescription(f) }))
  }, [form.name, form.category, form.color, form.gender, form.brand])

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedAt = Date.now()
        localStorage.setItem(draftKey, JSON.stringify({ savedAt, form }))
        setLastAutoSaveAt(savedAt)
      } catch {}
    }, 450)
    return () => clearTimeout(timer)
  }, [form, draftKey])

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey) } catch {}
    setRestoredDraftAt(null)
    setLastAutoSaveAt(null)
  }

  const formatDraftTime = (value) => {
    if (!value) return ''
    try {
      return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const handleSave = async () => {
    const ok = await onSave(form)
    if (ok) clearDraft()
  }

  // ── AI apply ──
  const applyAiResult = (ai) => {
    if (!ai) return
    const updates = {}; const filled = {}
    if (ai.name && !form.name)         { updates.name = ai.name; filled.name = true }
    if (ai.title)                      { updates.title = ai.title; filled.title = true }
    if (ai.category && !form.category) { updates.category = normalizeCategory(ai.category); filled.category = true }
    if (ai.productType)                { updates.productType = ai.productType; filled.productType = true }
    if (ai.brand)                      { updates.brand = ai.brand; filled.brand = true }
    if (ai.color)                      { updates.color = ai.color; filled.color = true }
    if (ai.gender)                     { updates.gender = ai.gender; filled.gender = true }
    if (!ai.gender && updates.category) { updates.gender = categoryGenderDefaults[updates.category] || 'Unisex'; filled.gender = true }
    if (ai.description && !form.description) { updates.description = ai.description; filled.description = true }
    if (ai.tags?.length)               { updates.tags = ai.tags; filled.tags = true }
    updates.imageAiMeta = ai
    if (ai.sizes && ai.sizes.includes(',')) {
      updates.hasSizes = true
      updates.sizes = ai.sizes.split(',').map(s=>s.trim()).filter(Boolean).map(sz=>({size:sz,stock:5}))
      filled.sizes = true
    }
    // Auto-add detected color as first color variant
    if (ai.color && form.colors.length === 0) {
      const hex = PRESET_COLORS.find(c => c.name.toLowerCase()===ai.color.toLowerCase())?.hex || '#888888'
      updates.colors = [{ name: ai.color, hex, imageUrl: form.imageUrl, images: [] }]
      filled.colorAdded = true
    } else if (ai.color && form.colors.length > 0) {
      const hex = PRESET_COLORS.find(c => c.name.toLowerCase()===ai.color.toLowerCase())?.hex || '#888888'
      updates.colors = [...form.colors]
      updates.colors[0] = { ...updates.colors[0], name: ai.color, hex }
      filled.colorAdded = true
    }
    setDescriptionEdited(false)
    setForm(f => ({ ...f, ...updates }))
    setExpandedSection('details')
    setAiFields(filled); setAiApplied(true)
  }

  // ── Image handlers ──
  const handleCapture = (url) => {
    const payload = typeof url === 'string' ? { imageUrl: url, processedImageUrl: url } : (url || {})
    const mainImageUrl = payload.imageUrl || payload.processedImageUrl || ''
    if (cameraTarget === 'main') {
      setForm(f => ({
        ...f,
        imageUrl: mainImageUrl,
        processedImageUrl: payload.processedImageUrl || mainImageUrl,
        imageAiMeta: payload.aiMeta || f.imageAiMeta,
      }))
    } else if (typeof cameraTarget === 'number') {
      setForm(f => {
        const colors = [...f.colors]
        colors[cameraTarget] = { ...colors[cameraTarget], imageUrl: mainImageUrl }
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

        <div style={{marginBottom:12,padding:'10px 12px',borderRadius:12,border:'1px solid var(--border2)',background:'linear-gradient(180deg,#f8fbff,#ffffff)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
          <div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>
            {restoredDraftAt ? `Draft restored (${formatDraftTime(restoredDraftAt)})` : 'Autosave is ON'}
            {lastAutoSaveAt ? ` · Last saved ${formatDraftTime(lastAutoSaveAt)}` : ''}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{padding:'7px 10px',fontSize:11}} onClick={clearDraft}>
            Clear Draft
          </button>
        </div>

        {aiApplied && (
          <div style={{background:'linear-gradient(135deg,var(--primary-light),rgba(167,139,250,.1))',border:'1.5px solid rgba(108,71,255,.2)',borderRadius:12,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>AI</span>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:13,color:'var(--primary)'}}>AI filled your product details!</div><div style={{fontSize:12,color:'var(--muted)'}}>Review all fields. Purple-highlighted = AI-detected.</div></div>
            <button onClick={()=>setAiApplied(false)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:16}}>×</button>
          </div>
        )}

        {!!Object.keys(form.imageAiMeta || {}).length && (
          <div style={{marginBottom:14,padding:14,borderRadius:14,border:'1px solid var(--border)',background:'linear-gradient(180deg,#fff,rgba(96,165,250,.06))'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:10}}>
              <div>
                <div style={{fontSize:12,fontWeight:900,color:'var(--primary)',textTransform:'uppercase',letterSpacing:'.06em'}}>AI Listing Draft</div>
                <div style={{fontSize:12,color:'var(--muted)'}}>Processed image, category, color, and fashion attributes are ready to review.</div>
              </div>
              {form.processedImageUrl && <img src={form.processedImageUrl} alt="Processed" style={{width:56,height:56,borderRadius:12,objectFit:'cover',border:'1px solid var(--border)'}}/>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
              {[
                ['Category', form.category || '—'],
                ['Color', form.color || '—'],
                ['Brand', form.brand || '—'],
                ['Gender', form.gender || '—'],
                ['Sizes', (form.sizes || []).length ? `${form.sizes.length} selected` : '—'],
                ['Price', form.price ? `Rs ${form.price}` : 'Manual'],
              ].map(([label, value]) => (
                <div key={label} style={{padding:'10px 12px',borderRadius:12,background:'rgba(255,255,255,.85)',border:'1px solid rgba(96,165,250,.14)'}}>
                  <div style={{fontSize:10,fontWeight:800,color:'var(--muted)',textTransform:'uppercase'}}>{label}</div>
                  <div style={{fontSize:13,fontWeight:800,color:'var(--text)',marginTop:3}}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{marginBottom:14,padding:'12px 14px',borderRadius:12,border:'1px solid rgba(96,165,250,.22)',background:'linear-gradient(180deg,#f8fbff,#ffffff)'}}>
          <div style={{fontSize:11,fontWeight:800,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:8}}>Quick Steps</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[
              { key:'details', label:'1. Fill Details' },
              { key:'colors', label:'2. Confirm Colors' },
              { key:'sizes', label:'3. Pick Sizes' },
            ].map(step => (
              <button
                key={step.key}
                type="button"
                onClick={()=>setExpandedSection(step.key)}
                style={{
                  padding:'7px 12px',
                  borderRadius:999,
                  border:`1px solid ${expandedSection===step.key?'rgba(37,99,235,.35)':'var(--border)'}`,
                  background:expandedSection===step.key?'rgba(37,99,235,.09)':'#fff',
                  color:expandedSection===step.key?'#1d4ed8':'var(--muted)',
                  fontSize:12,
                  fontWeight:800,
                  cursor:'pointer'
                }}
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>

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
          {form.processedImageUrl && form.processedImageUrl !== form.imageUrl && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
              <div style={{border:'1px solid var(--border)',borderRadius:12,padding:8}}>
                <div style={{fontSize:11,color:'var(--muted)',fontWeight:800,marginBottom:6}}>Original</div>
                <img src={form.imageUrl} alt="Original" style={{width:'100%',aspectRatio:'1',objectFit:'cover',borderRadius:10}}/>
              </div>
              <div style={{border:'1px solid var(--border)',borderRadius:12,padding:8,background:'rgba(96,165,250,.04)'}}>
                <div style={{fontSize:11,color:'var(--primary)',fontWeight:800,marginBottom:6}}>Processed Preview</div>
                <img src={form.processedImageUrl} alt="Processed" style={{width:'100%',aspectRatio:'1',objectFit:'cover',borderRadius:10}}/>
              </div>
            </div>
          )}
          <input className="input" placeholder="Or paste main image URL…" value={form.imageUrl||''} onChange={set('imageUrl')} style={{fontSize:12}}/>
        </FormSection>

        {/* ── SECTION 2: COLOR VARIANTS ── */}
        <FormSection id="colors" label={` Color Variants * ${form.colors.length>0?`(${form.colors.length})`:'(Required)'}`} isOpen={expandedSection==="colors"} onToggle={()=>setExpandedSection(s=>s==="colors"?null:"colors")}>
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
          {form.colors.length===0&&<div style={{textAlign:'center',padding:'20px 0',color:'var(--muted)',fontSize:13}}>Add at least one color before saving this product.</div>}
        </FormSection>

        {/* ── SECTION 3: PRODUCT DETAILS ── */}
        <FormSection id="details" label=" Product Details" isOpen={expandedSection==="details"} onToggle={()=>setExpandedSection(s=>s==="details"?null:"details")}>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="grid-2">
              <div>
                <label className="label">Name * {aiFields.name&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <input className={`input ${aiFields.name?'ai-glow':''}`} placeholder="Product name" value={form.name} onChange={set('name')}/>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label className="label">Price (₹) *</label>
                <input className="input" type="number" min="0" placeholder="Enter selling price manually" value={form.price} onChange={set('price')}/>
              </div>
              <div>
                <label className="label">Category {aiFields.category&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <select className={`input ${aiFields.category?'ai-glow':''}`} value={form.category||''} onChange={e=>applyCategoryChange(e.target.value)}>
                  <option value="">Select category</option>
                  {CATEGORY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label className="label">Color * {aiFields.color&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <select className={`input ${aiFields.color?'ai-glow':''}`} value={form.color||''} onChange={e=>applyColorChange(e.target.value)}>
                  <option value="">Select color</option>
                  {COLOR_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div />
            </div>
            <div className="grid-2">
              <div>
                <label className="label">Brand {aiFields.brand&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <select className={`input ${aiFields.brand?'ai-glow':''}`} value={form.brand||''} onChange={set('brand')}>
                  <option value="">Select brand</option>
                  {categoryBrands.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                  {categoryBrands.slice(0,6).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={()=>setForm(f=>({...f,brand:option}))}
                      style={{
                        padding:'5px 10px',
                        borderRadius:999,
                        border:`1px solid ${form.brand===option?'rgba(59,130,246,.28)':'var(--border)'}`,
                        background:form.brand===option?'rgba(59,130,246,.08)':'#fff',
                        color:form.brand===option?'#2563eb':'var(--muted)',
                        fontSize:11,
                        fontWeight:800,
                        cursor:'pointer'
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Gender {aiFields.gender&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
                <select className={`input ${aiFields.gender?'ai-glow':''}`} value={form.gender||''} onChange={set('gender')}>
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div>
                <label className="label">Stock</label>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>setForm(f=>({...f,stock:Math.max(0,(f.stock||0)-1)}))} style={{padding:'11px 14px',borderRadius:10,border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontWeight:900}}>−</button>
                  <input className="input" type="number" min="0" value={form.stock} onChange={set('stock')} style={{textAlign:'center'}}/>
                  <button onClick={()=>setForm(f=>({...f,stock:(f.stock||0)+1}))} style={{padding:'11px 14px',borderRadius:10,border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontWeight:900}}>+</button>
                </div>
              </div>
              <div />
            </div>
            <div>
              <label className="label">Description {aiFields.description&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</label>
              <textarea className={`input ${aiFields.description?'ai-glow':''}`} rows={3} value={form.description||''} onChange={e=>{setDescriptionEdited(true);setForm(f=>({...f,description:e.target.value}))}} style={{resize:'none'}} placeholder="Product description for customers"/>
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
        <FormSection id="sizes" label={` Size Variants * ${form.sizes.length>0?`(${form.sizes.length} sizes)`:'(Required)'}`} isOpen={expandedSection==="sizes"} onToggle={()=>setExpandedSection(s=>s==="sizes"?null:"sizes")}>
          <div style={{color:'var(--muted)',fontSize:13,marginBottom:14}}>Select at least one size for this product. {aiFields.sizes&&<span className="ai-badge" style={{padding:'1px 6px',fontSize:9}}>AI</span>}</div>
          {(()=>{
            const sizes=form.sizes||[]
            const addSize=(sz)=>{if(sizes.find(s=>s.size===sz))return;setForm(f=>({...f,hasSizes:true,sizes:[...f.sizes,{size:sz,stock:5}]}))}
            const removeSize=(sz)=>setForm(f=>{const next=f.sizes.filter(s=>s.size!==sz);return {...f,hasSizes:next.length>0,sizes:next}})
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
          <button className="btn btn-primary" style={{flex:2}} disabled={saving||!form.name||!form.price||!form.category||!form.color||!form.gender||form.colors.length===0||form.sizes.length===0} onClick={handleSave}>
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
  const [cardMode, setCardMode] = useState(() => {
    const saved = localStorage.getItem(PRODUCT_CARD_MODE_KEY)
    return saved === 'compact' ? 'compact' : 'comfortable'
  })

  const load = async () => { setLoading(true); try { const r = await api.myProducts(); setProducts(r.data) } catch (e) {}; setLoading(false) }
  useEffect(() => { load() }, [])
  useEffect(() => {
    try { localStorage.setItem(PRODUCT_CARD_MODE_KEY, cardMode) } catch {}
  }, [cardMode])

  const saveProduct = async (form) => {
    setSaving(true)
    let ok = false
    const body = {
      ...form,
      price: parseFloat(form.price),
      stock: parseInt(form.stock) || 0,
      sizes: JSON.stringify(form.sizes || []),
      images: JSON.stringify(form.images || []),
      colors: JSON.stringify(form.colors || []),
      tags: JSON.stringify(form.tags || []),
      title: form.name || null,
      productType: form.productType || form.category || null,
      color: form.color || null,
      brand: form.brand || null,
      material: form.material || null,
      fabric: form.fabric || null,
      gender: form.gender || null,
      pattern: form.pattern || null,
      fit: form.fit || null,
      occasion: form.occasion || null,
      sleeveType: form.sleeveType || null,
      length: form.length || null,
      processedImageUrl: form.processedImageUrl || form.imageUrl || null,
      imageAiMeta: JSON.stringify(form.imageAiMeta || {}),
      hasSizes: (form.sizes || []).length > 0,
    }
    try {
      if (form.id) { await api.updateProduct(form.id, body); showToast('Product updated ✓', 'success') }
      else { await api.addProduct(body); showToast('Product added ✓', 'success') }
      setModal(null); load()
      ok = true
    } catch (e) { showToast(e.response?.data?.detail || 'Save failed', 'error') }
    setSaving(false)
    return ok
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
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <Icons.Plus /> Add Product
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} style={{ width:'100%', maxWidth: 360 }} />
        <div className="view-toggle">
          <button type="button" className={`view-toggle-btn ${cardMode === 'comfortable' ? 'active' : ''}`} onClick={() => setCardMode('comfortable')}>
            Comfortable
          </button>
          <button type="button" className={`view-toggle-btn ${cardMode === 'compact' ? 'active' : ''}`} onClick={() => setCardMode('compact')}>
            Compact
          </button>
        </div>
      </div>

      {loading ? (
        <div className={`prod-grid ${cardMode === 'compact' ? 'compact' : ''}`}>{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: cardMode === 'compact' ? 190 : 240 }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">BOX</span>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>No products yet</div>
          <button className="btn btn-primary" onClick={() => setModal({})}>Add your first product</button>
        </div>
      ) : (
        <div className={`prod-grid ${cardMode === 'compact' ? 'compact' : ''}`}>
          {filtered.map((p, i) => (
            <div key={p.id} className={`prod-card fade-up ${cardMode === 'compact' ? 'compact' : ''}`} style={{ animationDelay: `${i * 0.05}s`, opacity: p.isActive ? 1 : .55 }}>
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
                  <span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icons.Star /></span>
                  {p.avgRating.toFixed(1)} ({p.reviewCount} reviews)
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
        <div className="card" style={{ textAlign:'center', padding:'28px 20px', background:'linear-gradient(180deg,#ffffff,#f8fbff)' }}>
          <div style={{ width:52, height:52, borderRadius:'50%', margin:'0 auto 12px', background:'rgba(74,168,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--primary)' }}>
            <Icons.Returns />
          </div>
          <div style={{ fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:6 }}>No {filter.toLowerCase()} returns</div>
          <div style={{ color:'var(--muted)', fontSize:13 }}>Customer return requests will appear here when they come in.</div>
        </div>
      ) : (
        filtered.map((r, i) => (
          <div key={r.id} className="card fade-up" style={{ animationDelay: `${i * 0.06}s`, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Return #{r.id} — Order #{r.orderCode}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{r.customerName} · {r.customerPhone}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
                  Address: {r.customerAddress || 'No address available'}
                </div>
              </div>
              <span className="badge" style={{ background: `${RETURN_COLORS[r.status]}18`, color: RETURN_COLORS[r.status] }}>{r.status}</span>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, fontSize: 13 }}>
              <strong>Reason:</strong> {r.reason}
              <div style={{ marginTop: 6, color: 'var(--text)', fontWeight: 700 }}>
                Refund amount: ₹{r.refundAmount || 0}
              </div>
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

function ShopSettings({ shop, setShop, showToast, user, onSignOut }) {
  const [form, setForm] = useState({ name: shop.name || '', description: shop.description || '', address: shop.address || '', city: shop.city || '', phone: shop.phone || '', deliveryTime: shop.deliveryTime || 25, minOrder: shop.minOrder || 0, imageUrl: shop.imageUrl || '', bannerUrl: '', storefrontUrl: '', acceptsReturns: shop.acceptsReturns || false, returnDays: shop.returnDays || 7, returnPolicyNote: shop.returnPolicyNote || '', whatsappMode: shop.whatsappMode || false, whatsappPhone: shop.whatsappPhone || '' })
  const [saving, setSaving] = useState(false)
  const [mapCoords, setMapCoords] = useState({ lat: shop.lat || 17.385, lng: shop.lng || 78.4867 })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const getLoc = async () => {
    try {
      const gps = await getCurrentGpsLocation()
      const coords = { lat: gps.lat, lng: gps.lng }
      setMapCoords(coords)
      const geo = await reverseGeocode(coords.lat, coords.lng)
      if (!form.address) setForm(f => ({ ...f, address: geo.full, city: geo.city }))
      showToast('Current location captured', 'success')
    } catch (err) {
      showToast(err?.message || 'Unable to detect current location', 'error')
    }
  }

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

  const profileSignals = [
    !!form.name?.trim(),
    !!form.phone?.trim(),
    !!form.address?.trim(),
    !!form.city?.trim(),
    !!form.imageUrl?.trim(),
    Number(form.deliveryTime) > 0,
    !!(mapCoords.lat && mapCoords.lng),
  ]
  const profileReady = profileSignals.filter(Boolean).length
  const profileScore = Math.round((profileReady / profileSignals.length) * 100)
  const profileTone = profileScore >= 85 ? '#16a34a' : profileScore >= 60 ? '#2563eb' : '#f97316'

  return (
    <div className="page">
      <div className="settings-hero fade-up">
        <div>
          <div className="settings-kicker">Store Control</div>
          <div className="page-title" style={{ color: '#fff' }}>Shop Settings</div>
          <div className="page-sub" style={{ color: 'rgba(255,255,255,.86)' }}>
            Keep your store profile fresh, delivery-ready, and easy for customers to trust.
          </div>
        </div>
        <div className="settings-hero-actions">
          <button className={`btn ${shop.isOpen ? 'btn-danger' : 'btn-success'}`} onClick={toggleOpen}>
            {shop.isOpen ? '● Close Shop' : '● Open Shop'}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : '✓ Save Changes'}
          </button>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-col">
          <div className="card fade-up">
            <div className="card-title">Payment Details</div>
            <PaymentDetailsForm
              user={user || {}}
              onSave={async (d) => {
                try { await api.updatePayment(d); showToast('Payment details saved ✓', 'success') } catch (e) { showToast('Save failed', 'error') }
              }}
            />
          </div>

          <div className="card fade-up" style={{ animationDelay: '.04s' }}>
            <div className="card-title">Basic Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Shop Name</label><input className="input" value={form.name} onChange={set('name')} /></div>
              <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={set('description')} style={{ resize: 'none' }} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
              <div>
                <label className="label">Shop Images</label>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>LOGO / MAIN PHOTO</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '1.5px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                      {form.imageUrl ? <img src={form.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} /> : ''}
                    </div>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: '2px dashed var(--primary)', background: 'var(--primary-light)', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: 12 }}>
                      <span></span> Upload Logo
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return
                        try { const r = await api.uploadImage(file); setForm(f => ({ ...f, imageUrl: r.data.url })) } catch (err) {}
                        e.target.value = ''
                      }} />
                    </label>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>BANNER IMAGE</div>
                  <label className="shop-banner-slot">
                    {form.bannerUrl
                      ? <img src={form.bannerUrl} alt="banner" />
                      : <div style={{ textAlign: 'center' }}><div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: .3 }}><svg viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Upload banner (wide photo)</div></div>}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return
                      try { const r = await api.uploadImage(file); setForm(f => ({ ...f, bannerUrl: r.data.url })) } catch (err) {}
                      e.target.value = ''
                    }} />
                  </label>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>STOREFRONT PHOTO</div>
                  <label className="shop-banner-slot">
                    {form.storefrontUrl
                      ? <img src={form.storefrontUrl} alt="storefront" />
                      : <div style={{ textAlign: 'center' }}><div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: .3 }}><svg viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Upload storefront photo</div></div>}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return
                      try { const r = await api.uploadImage(file); setForm(f => ({ ...f, storefrontUrl: r.data.url })) } catch (err) {}
                      e.target.value = ''
                    }} />
                  </label>
                </div>
                <input className="input" placeholder="Or paste logo URL" value={form.imageUrl || ''} onChange={set('imageUrl')} style={{ fontSize: 12, marginTop: 8 }} />
              </div>
              <div className="grid-2">
                <div><label className="label">Delivery Time (min)</label><input className="input" type="number" value={form.deliveryTime} onChange={set('deliveryTime')} /></div>
                <div><label className="label">Min Order (₹)</label><input className="input" type="number" value={form.minOrder} onChange={set('minOrder')} /></div>
              </div>
            </div>
          </div>

          <div className="card fade-up" style={{ animationDelay: '.08s' }}>
            <div className="card-title">Location</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Address</label><textarea className="input" rows={2} value={form.address} onChange={set('address')} style={{ resize: 'none' }} /></div>
              <div><label className="label">City</label><input className="input" value={form.city} onChange={set('city')} /></div>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={getLoc}><Icons.Loc /> Use Current Location</button>
              <LeafletMap lat={mapCoords.lat} lng={mapCoords.lng} onPinMove={(lat, lng) => setMapCoords({ lat, lng })} height={190} />
            </div>
          </div>
        </div>

        <div className="settings-col">
          <div className="card fade-up" style={{ animationDelay: '.02s' }}>
            <div className="card-title">Profile Health</div>
            <div className="settings-health-grid">
              <div className="settings-health-item">
                <div className="settings-health-label">Profile Completion</div>
                <div className="settings-health-value" style={{ color: profileTone }}>{profileScore}%</div>
                <div className="settings-health-sub">{profileReady} of {profileSignals.length} fields ready</div>
              </div>
              <div className="settings-health-item">
                <div className="settings-health-label">Store Visibility</div>
                <div className="settings-health-value" style={{ color: shop.isOpen ? '#16a34a' : '#ef4444' }}>{shop.isOpen ? 'Open' : 'Closed'}</div>
                <div className="settings-health-sub">{shop.isOpen ? 'Customers can discover your products' : 'Open store to receive more orders'}</div>
              </div>
              <div className="settings-health-item">
                <div className="settings-health-label">Delivery Setup</div>
                <div className="settings-health-value">{form.deliveryTime || 0}m</div>
                <div className="settings-health-sub">Estimated delivery in your local radius</div>
              </div>
              <div className="settings-health-item">
                <div className="settings-health-label">Returns</div>
                <div className="settings-health-value" style={{ color: form.acceptsReturns ? '#16a34a' : '#f97316' }}>{form.acceptsReturns ? 'Enabled' : 'Off'}</div>
                <div className="settings-health-sub">{form.acceptsReturns ? `${form.returnDays || 0} day return window` : 'Enable to improve conversion'}</div>
              </div>
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

          <div className="card fade-up" style={{ animationDelay: '.16s' }}>
            <div className="card-title">WhatsApp Mode</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border2)' }}>
                <div><div style={{ fontWeight: 700 }}>WhatsApp Orders</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>Get order alerts on WhatsApp</div></div>
                <button className={`toggle ${form.whatsappMode ? 'on' : 'off'}`} onClick={() => setForm(f => ({ ...f, whatsappMode: !f.whatsappMode }))} />
              </div>
              {form.whatsappMode && <div><label className="label">WhatsApp Number</label><input className="input" placeholder="10-digit number" value={form.whatsappPhone} onChange={set('whatsappPhone')} /></div>}
            </div>
          </div>

          <button className="btn settings-signout-btn" onClick={onSignOut}>
            <Icons.Logout /> Sign Out
          </button>
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
    try {
      const gps = await getCurrentGpsLocation()
      const geo = await reverseGeocode(gps.lat, gps.lng)
      setForm(f => ({ ...f, lat: gps.lat, lng: gps.lng, address: geo.full, city: geo.city }))
      showToast('Current location captured', 'success')
    } catch (err) {
      showToast(err?.message || 'Unable to detect current location', 'error')
    }
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
  const vendorPlatformFeeActive = false

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
            ['Net Earnings', `₹${(vendorPlatformFeeActive ? data.netEarnings : data.totalRevenue).toLocaleString('en-IN')}`, '#6c47ff', ''],
            ['This Month', `₹${data.thisMonth?.revenue?.toLocaleString('en-IN')||0}`, '#f59e0b', ''],
            ['Orders Delivered', data.totalOrders, '#0ea5e9', 'BOX'],
            ['Platform Fees', vendorPlatformFeeActive ? `₹${data.platformFees}` : '₹0', '#ef4444', '️'],
            ['Pending Payout', `₹${data.pendingPayout}`, '#8b5cf6', '…'],
          ].map(([label, val, color, icon]) => (
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

function OperationsHub({ shop, showToast, pendingCount }) {
  const [tab, setTab] = useState('orders')
  const [pendingReturns, setPendingReturns] = useState(0)

  useEffect(() => {
    let alive = true
    api.shopReturns()
      .then(r => {
        if (!alive) return
        const count = (r.data || []).filter(item => item.status === 'REQUESTED').length
        setPendingReturns(count)
      })
      .catch(() => { if (alive) setPendingReturns(0) })
    return () => { alive = false }
  }, [shop?.id])

  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="card hub-switch-card fade-up">
          <div className="hub-switch-row">
            <div className="hub-switch-title">Daily Operations</div>
            <div className="hub-counts">
              <span className="hub-count-pill">{pendingCount || 0} pending orders</span>
              <span className="hub-count-pill">{pendingReturns} return requests</span>
            </div>
          </div>
          <div className="tabs" style={{ marginBottom: 6 }}>
            <button className={`tab-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>Orders</button>
            <button className={`tab-btn ${tab === 'returns' ? 'active' : ''}`} onClick={() => setTab('returns')}>Returns</button>
          </div>
        </div>
      </div>
      {tab === 'orders' ? <OrdersPage showToast={showToast} /> : <ReturnsPage shop={shop} showToast={showToast} />}
    </>
  )
}

function InsightsHub({ showToast }) {
  const [tab, setTab] = useState('analytics')
  const [monthRevenue, setMonthRevenue] = useState(0)
  const [pendingPayout, setPendingPayout] = useState(0)

  useEffect(() => {
    let alive = true
    api.vendorEarnings()
      .then(r => {
        if (!alive) return
        setMonthRevenue(Number(r.data?.thisMonth?.revenue || 0))
        setPendingPayout(Number(r.data?.pendingPayout || 0))
      })
      .catch(() => {
        if (!alive) return
        setMonthRevenue(0)
        setPendingPayout(0)
      })
    return () => { alive = false }
  }, [])

  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="card hub-switch-card fade-up">
          <div className="hub-switch-row">
            <div className="hub-switch-title">Business Insights</div>
            <div className="hub-counts">
              <span className="hub-count-pill">Month: ₹{monthRevenue}</span>
              <span className="hub-count-pill">Pending payout: ₹{pendingPayout}</span>
            </div>
          </div>
          <div className="tabs" style={{ marginBottom: 6 }}>
            <button className={`tab-btn ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>Analytics</button>
            <button className={`tab-btn ${tab === 'earnings' ? 'active' : ''}`} onClick={() => setTab('earnings')}>Earnings</button>
          </div>
        </div>
      </div>
      {tab === 'analytics' ? <AnalyticsPage /> : <EarningsPage showToast={showToast} />}
    </>
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
    if (!token && !isVendorDemoMode()) { setLoading(false); return }
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
    localStorage.removeItem(DEMO_VENDOR_MODE_KEY)
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

  if (!user) return <><style>{CSS}</style><AuthPage onSuccess={(u, providedShop) => { setUser(u); if (providedShop) setShop(providedShop); else api.myShop().then(r => setShop(r.data)).catch(() => {}) }} /></>
  if (!shop) return <><style>{CSS}</style><ShopSetup onCreated={s => setShop(s)} showToast={showToast} /></>

  const activePage = (
    page === 'orders' || page === 'returns'
      ? 'operations'
      : page === 'analytics' || page === 'earnings'
        ? 'insights'
        : page
  )

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', Icon: Icons.Dashboard },
    { id: 'operations', label: 'Orders', Icon: Icons.Orders, count: pendingCount },
    { id: 'products', label: 'Products', Icon: Icons.Products },
    { id: 'insights', label: 'Insights', Icon: Icons.Analytics },
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
              <div key={id} className={`nav-item ${activePage === id ? 'active' : ''}`} onClick={() => setPage(id)}>
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
            <div className="topbar-title">{NAV.find(n => n.id === activePage)?.label}</div>
            <div className="topbar-actions">
              <div className="topbar-welcome" style={{ fontSize: 13, color: 'var(--muted)' }}>Welcome, <strong>{user.name}</strong></div>
              {pendingCount > 0 && <span className="badge badge-warning">{pendingCount} pending</span>}
            </div>
          </div>

          {activePage === 'dashboard' && <Dashboard shop={shop} user={user} onOpenProducts={() => setPage('products')} onOpenOrders={() => setPage('operations')} onOpenEarnings={() => setPage('insights')} />}
          {activePage === 'operations' && <OperationsHub shop={shop} showToast={showToast} pendingCount={pendingCount} />}
          {activePage === 'products' && <ProductsPage showToast={showToast} />}
          {activePage === 'insights' && <InsightsHub showToast={showToast} />}
          {activePage === 'settings' && <ShopSettings shop={shop} setShop={setShop} showToast={showToast} user={user} onSignOut={signOut} />}
        </main>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
