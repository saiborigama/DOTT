import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

// â”€â”€ SVG Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Ic = {
  Map:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>,
  Home:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Nearby:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Active:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  Earn:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Me:      (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Package: (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Dollar:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Check:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Phone:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.07 6.07l1.06-.97a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  MapPin:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Star:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  User:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  LogOut:  (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Wifi:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  Sun:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>,
  Moon:    (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Close:   (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Loc:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Nav:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>,
  Out:     (p={}) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
}


const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const ax = axios.create({ baseURL: BASE })
ax.interceptors.request.use(cfg => {
  const t = localStorage.getItem('rdr_access')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
ax.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401) {
    const rt = localStorage.getItem('rdr_refresh')
    if (rt) {
      try {
        const r = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rt })
        localStorage.setItem('rdr_access', r.data.accessToken)
        localStorage.setItem('rdr_refresh', r.data.refreshToken)
        err.config.headers.Authorization = `Bearer ${r.data.accessToken}`
        return ax(err.config)
      } catch {
        localStorage.removeItem('rdr_access')
        localStorage.removeItem('rdr_refresh')
      }
    }
  }
  return Promise.reject(err)
})

const S_COLOR = {
  CONFIRMED: '#3b82f6', PACKING: '#8b5cf6', PICKED_UP: '#06b6d4',
  OUT_FOR_DELIVERY: '#f97316', DELIVERED: '#22c55e', CANCELLED: '#ef4444'
}
const S_LABEL = {
  CONFIRMED: 'Ready for Pickup', PACKING: 'Being Prepared',
  PICKED_UP: 'Picked Up', OUT_FOR_DELIVERY: 'On the Way',
  DELIVERED: 'Delivered', CANCELLED: 'Cancelled'
}
const NEXT = { PICKED_UP: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' }
const NEXT_LABEL = { PACKING: 'Enter Vendor OTP', PICKED_UP: 'Start Delivery', OUT_FOR_DELIVERY: 'Mark Delivered' }
const DEMO_RIDER_MODE = false
const DEMO_RIDER_MODE_KEY = 'dott_rider_demo_mode'
const DEMO_RIDER_DB_KEY = 'dott_rider_demo_db'
const DEMO_RIDER_USER_ID = 'demo-rider-1'
const RIDER_DELIVERY_RANGE_KEY = 'dott_rider_delivery_range_km'
const RIDER_COMPACT_MODE_KEY = 'dott_rider_compact_mode'
const RIDER_LAST_LOCATION_KEY = 'dott_rider_last_location'
const demoResponse = (data) => Promise.resolve({ data })
const isRiderDemoMode = () => (DEMO_RIDER_MODE && localStorage.getItem(DEMO_RIDER_MODE_KEY) === '1')
const clampRiderRange = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 10
  return Math.max(1, Math.min(10, Math.round(n)))
}
const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.orders)) return payload.orders
  if (Array.isArray(payload?.returns)) return payload.returns
  return []
}
const geoNeedsSecureContext = () => {
  if (typeof window === 'undefined') return false
  const host = window.location?.hostname || ''
  return !window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1'
}
const geoErrorMessage = (error) => {
  if (geoNeedsSecureContext()) return 'Current GPS needs HTTPS on mobile. Use secure link or map pin.'
  switch (error?.code) {
    case 1: return 'Location permission denied. Please allow GPS access.'
    case 2: return 'Location unavailable. Move to open sky and retry.'
    case 3: return 'Location request timed out. Please retry.'
    default: return 'Unable to detect current location.'
  }
}
const getCurrentGpsLocation = async () => {
  if (!navigator?.geolocation) throw new Error('GPS is not supported on this device.')
  if (geoNeedsSecureContext()) throw new Error(geoErrorMessage())
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
  throw new Error(geoErrorMessage(second?.error || first?.error))
}

const getStoredRiderLocation = () => {
  try {
    const raw = localStorage.getItem(RIDER_LAST_LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.lat != null && parsed?.lng != null) {
      return { lat: Number(parsed.lat), lng: Number(parsed.lng) }
    }
  } catch {}
  return null
}

const saveStoredRiderLocation = (coords) => {
  if (coords?.lat == null || coords?.lng == null) return
  try {
    localStorage.setItem(RIDER_LAST_LOCATION_KEY, JSON.stringify({ lat: Number(coords.lat), lng: Number(coords.lng) }))
  } catch {}
}

const clearRiderSession = () => {
  try {
    localStorage.removeItem('rdr_access')
    localStorage.removeItem('rdr_refresh')
    localStorage.removeItem(DEMO_RIDER_MODE_KEY)
  } catch {}
}

const formatSyncTime = (value) => {
  if (!value) return 'Waiting for first refresh'
  try {
    return `Updated ${new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return 'Updated just now'
  }
}

const getNearbyEmptyState = ({ isOnline, loc, nearbyTotal, deliveryRangeKm }) => {
  if (!isOnline) return { title: "You're offline", note: 'Go online from the header to start receiving nearby alerts.' }
  if (!loc?.lat || !loc?.lng) return { title: 'Location needed', note: 'Update rider GPS to load nearby orders inside your delivery range.' }
  if (nearbyTotal > 0) return null
  return { title: 'No live pickups in range', note: `No delivery or return requests are currently available within ${clampRiderRange(deliveryRangeKm)} km.` }
}

function DeliveryStepStrip({ status }) {
  const steps = [
    { key: 'CONFIRMED', label: 'Accepted' },
    { key: 'PACKING', label: 'Pickup OTP' },
    { key: 'OUT_FOR_DELIVERY', label: 'On way' },
    { key: 'DELIVERED', label: 'Done' },
  ]
  const currentIndex = steps.findIndex(step => step.key === status)
  const activeIndex = currentIndex === -1 && status === 'PICKED_UP' ? 2 : currentIndex
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
      {steps.map((step, index) => {
        const done = activeIndex >= index
        return (
          <div key={step.key} style={{ textAlign: 'center' }}>
            <div style={{ height: 6, borderRadius: 999, background: done ? 'linear-gradient(90deg,#69bbff,#4aa8ff)' : 'rgba(207,230,251,.9)', marginBottom: 6 }} />
            <div style={{ fontSize: 10, fontWeight: 800, color: done ? 'var(--green2)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{step.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function createDemoRiderDb() {
  const now = Date.now()
  const user = {
    id: DEMO_RIDER_USER_ID,
    name: 'Ramesh Rider',
    email: 'ramesh@dott.in',
    phone: '9876543210',
    isOnline: true,
    paymentMethod: 'upi',
    upiId: 'ramesh@upi',
    bankAccount: '',
    bankIfsc: '',
    bankName: '',
    lat: 17.385,
    lng: 78.4867,
  }
  const availableOrders = [
    {
      id: 'demo-order-1',
      orderCode: 'NN2401',
      status: 'CONFIRMED',
      total: 899,
      paymentMethod: 'cod',
      codDueAmount: 899,
      placedAt: new Date(now - 1000 * 60 * 9).toISOString(),
      deliveryDeadline: new Date(now + 1000 * 60 * 42).toISOString(),
      countdown: { serverNow: new Date(now).toISOString(), deadline: new Date(now + 1000 * 60 * 42).toISOString() },
      items: [
        { name: 'Pearl Day Midi Dress', qty: 1, size: 'M' },
        { name: 'White Sling Bag', qty: 1 },
      ],
      shop: { name: 'Skyline Dresses', address: 'Banjara Hills Road No 12, Hyderabad', phone: '9000012345', lat: 17.4138, lng: 78.4392 },
      shopDistanceKm: 2.4,
      customer: { name: 'Sai Kumar', phone: '6303142328' },
      deliveryAddress: 'Janakpuri 1-28, Near Hanuman Temple, Hyderabad',
      deliveryLat: 17.4014,
      deliveryLng: 78.4772,
      notes: 'Call before pickup',
      pickupOtp: '4821',
    },
    {
      id: 'demo-order-2',
      orderCode: 'NN2402',
      status: 'CONFIRMED',
      total: 1299,
      paymentMethod: 'online',
      placedAt: new Date(now - 1000 * 60 * 4).toISOString(),
      deliveryDeadline: new Date(now + 1000 * 60 * 51).toISOString(),
      countdown: { serverNow: new Date(now).toISOString(), deadline: new Date(now + 1000 * 60 * 51).toISOString() },
      items: [
        { name: 'Cloud Mist Anarkali Kurta', qty: 1, size: 'L' },
      ],
      shop: { name: 'White Petal Studio', address: 'Madhapur Main Road, Hyderabad', phone: '9000015678', lat: 17.4474, lng: 78.3911 },
      shopDistanceKm: 4.1,
      customer: { name: 'Bhavana', phone: '9012345678' },
      deliveryAddress: 'Jubilee Hills Checkpost, Hyderabad',
      deliveryLat: 17.4323,
      deliveryLng: 78.4071,
      notes: '',
      pickupOtp: '5512',
    },
  ]
  const activeOrders = [
    {
      id: 'demo-order-3',
      orderCode: 'NN2398',
      status: 'OUT_FOR_DELIVERY',
      total: 1099,
      paymentMethod: 'online',
      placedAt: new Date(now - 1000 * 60 * 24).toISOString(),
      deliveryDeadline: new Date(now + 1000 * 60 * 18).toISOString(),
      countdown: { serverNow: new Date(now).toISOString(), deadline: new Date(now + 1000 * 60 * 18).toISOString() },
      items: [
        { name: 'Ivory Festive Kurti Set', qty: 1, size: 'S' },
      ],
      shop: { name: 'NearNow Fashion Hub', address: 'Road No 12, Banjara Hills, Hyderabad', phone: '9876543210', lat: 17.4124, lng: 78.4347 },
      customer: { name: 'Asha', phone: '9123456780' },
      deliveryAddress: 'Gachibowli, Hyderabad',
      deliveryLat: 17.4401,
      deliveryLng: 78.3489,
      notes: 'Leave at security gate',
      riderEarning: 92,
      deliveryOtp: '3001',
      pickupOtp: '9244',
      riderId: DEMO_RIDER_USER_ID,
    },
  ]
  const availableReturns = [
    {
      id: 'demo-return-1',
      orderCode: 'NN2377',
      customerName: 'Priya',
      customerPhone: '9090909090',
      customerAddress: 'Madhapur, Hyderabad',
      customerLat: 17.4482,
      customerLng: 78.3909,
      productDetails: [{ name: 'Pearl Day Midi Dress' }],
      pickupTimeWindow: 'Today 4 PM - 6 PM',
      distanceKm: 3.2,
      pickupStatus: 'REQUESTED',
    },
  ]
  const activeReturns = [
    {
      id: 'demo-return-2',
      orderCode: 'NN2366',
      customerName: 'Anil',
      customerPhone: '9888777666',
      customerAddress: 'Banjara Hills, Hyderabad',
      customerLat: 17.4186,
      customerLng: 78.4382,
      productDetails: [{ name: 'Cloud Mist Anarkali Kurta' }],
      pickupTimeWindow: 'Today 6 PM - 8 PM',
      distanceKm: 2.1,
      pickupStatus: 'NAVIGATING',
      riderId: DEMO_RIDER_USER_ID,
    },
  ]
  const history = [
    { id: 'hist-1', orderCode: 'NN2301', shopName: 'NearNow Fashion Hub', earning: 84, total: 999, customerName: 'Sai Kumar', customerPhone: '6303142328', deliveryCharge: 40, paymentMethod: 'cod', codDueAmount: 999, deliveredAt: new Date(now - 1000 * 60 * 60 * 20).toISOString() },
    { id: 'hist-2', orderCode: 'NN2297', shopName: 'Skyline Dresses', earning: 92, total: 1299, customerName: 'Bhavana', customerPhone: '9012345678', deliveryCharge: 55, paymentMethod: 'online', codDueAmount: 0, deliveredAt: new Date(now - 1000 * 60 * 60 * 28).toISOString() },
    { id: 'hist-3', orderCode: 'NN2289', shopName: 'White Petal Studio', earning: 76, total: 899, customerName: 'Asha', customerPhone: '9123456780', deliveryCharge: 35, paymentMethod: 'cod', codDueAmount: 899, deliveredAt: new Date(now - 1000 * 60 * 60 * 35).toISOString() },
  ]
  const codSettlements = [
    { id: `cod-settle-${now - 1000 * 60 * 60 * 12}`, amount: 500, method: 'phonepe', paymentDate: new Date(now - 1000 * 60 * 60 * 12).toISOString(), note: 'COD settlement to DOTT' },
  ]
  const companyAccount = {
    companyName: 'DOTT Marketplace',
    contactPhone: '9000000000',
    upiId: '9000000000@upi',
    bankAccount: 'DOTT-SETTLEMENT-001',
    bankIfsc: 'DOTT0001234',
    bankName: 'DOTT Payments Bank',
  }
  return { user, availableOrders, activeOrders, availableReturns, activeReturns, history, codSettlements, companyAccount }
}

function getDemoRiderDb() {
  try {
    const raw = localStorage.getItem(DEMO_RIDER_DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  const seeded = createDemoRiderDb()
  localStorage.setItem(DEMO_RIDER_DB_KEY, JSON.stringify(seeded))
  return seeded
}

function saveDemoRiderDb(db) {
  localStorage.setItem(DEMO_RIDER_DB_KEY, JSON.stringify(db))
}

function getDemoRiderEarnings(db) {
  const deliveredCount = db.history.length + db.activeOrders.filter(o => o.status === 'DELIVERED').length
  const deliveredEarned = db.history.reduce((sum, item) => sum + Number(item.earning || 0), 0)
  const activeEarned = db.activeOrders
    .filter(o => ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status))
    .reduce((sum, item) => sum + Number(item.riderEarning || Math.round((item.total || 0) * 0.08)), 0)
  return {
    today: { earned: 184, trips: 2 },
    week: { earned: 960, trips: 11 },
    month: { earned: 3840, trips: 38 },
    allTime: { earned: deliveredEarned + activeEarned, trips: deliveredCount, totalKm: 248 },
    points: 420,
  }
}

function getDemoRiderPerformance(db) {
  return {
    acceptanceRate: 94,
    onTimeRate: 96,
    rating: 4.8,
    totalTrips: db.history.length + 38,
  }
}

function toUpiFromPhone(phone = '') {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits ? `${digits}@upi` : ''
}

function getDemoCompanyAccount(db) {
  const company = db?.companyAccount || {}
  return {
    companyName: company.companyName || 'DOTT Marketplace',
    contactPhone: company.contactPhone || '9000000000',
    upiId: company.upiId || toUpiFromPhone(company.contactPhone || '9000000000'),
    bankAccount: company.bankAccount || '',
    bankIfsc: company.bankIfsc || '',
    bankName: company.bankName || '',
  }
}

function getDemoCodSettlement(db) {
  const history = Array.isArray(db?.history) ? db.history : []
  const codTrips = history.filter(item => String(item.paymentMethod || '').toLowerCase() === 'cod')
  const totalCollected = codTrips.reduce((sum, item) => sum + Number(item.codDueAmount || item.total || 0), 0)
  const payments = Array.isArray(db?.codSettlements) ? db.codSettlements : []
  const settledAmount = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const pendingAmount = Math.max(totalCollected - settledAmount, 0)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayCollected = codTrips
    .filter(item => item.deliveredAt && new Date(item.deliveredAt).getTime() >= todayStart.getTime())
    .reduce((sum, item) => sum + Number(item.codDueAmount || item.total || 0), 0)
  const todaySettled = payments
    .filter(item => item.paymentDate && new Date(item.paymentDate).getTime() >= todayStart.getTime())
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return {
    totalCollected: Number(totalCollected.toFixed(2)),
    settledAmount: Number(settledAmount.toFixed(2)),
    pendingAmount: Number(pendingAmount.toFixed(2)),
    todayCollected: Number(todayCollected.toFixed(2)),
    todaySettled: Number(todaySettled.toFixed(2)),
    totalCodOrders: codTrips.length,
    companyAccount: getDemoCompanyAccount(db),
    paymentHistory: payments.slice().sort((a, b) => new Date(b.paymentDate || 0).getTime() - new Date(a.paymentDate || 0).getTime()).slice(0, 8),
  }
}

function openUpiPaymentLink(app, upiId, amount, note) {
  const pa = encodeURIComponent(upiId || '')
  const pn = encodeURIComponent('DOTT Marketplace')
  const am = encodeURIComponent(Number(amount || 0).toFixed(2))
  const cu = encodeURIComponent('INR')
  const tn = encodeURIComponent(note || 'Rider COD settlement')
  if (!pa || Number(amount || 0) <= 0) return false
  const base = `pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`
  const urls = {
    phonepe: `phonepe://pay?${base}`,
    gpay: `gpay://upi/pay?${base}`,
    upi: `upi://pay?${base}`,
  }
  const url = urls[app] || urls.upi
  try {
    window.location.href = url
    return true
  } catch {
    return false
  }
}

const api = {
  sendOtp: phone => isRiderDemoMode() ? demoResponse({ sent: true, phone, dev_otp: '123456' }) : ax.post('/otp/send', { phone }),
  verifyOtp: (phone, otp) => isRiderDemoMode() ? demoResponse({ verified: true, phone, otp }) : ax.post('/otp/verify', { phone, otp }),
  updatePayment: d => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      db.user = { ...db.user, ...d }
      saveDemoRiderDb(db)
      return demoResponse(db.user)
    }
    return ax.put('/auth/payment-details', d)
  },
  login: d => ax.post('/auth/login', d),
  register: d => ax.post('/auth/register', d),
  me: () => isRiderDemoMode() ? demoResponse(getDemoRiderDb().user) : ax.get('/auth/me'),
  logout: () => isRiderDemoMode() ? demoResponse({ ok: true }) : ax.post('/auth/logout'),
  setStatus: b => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      db.user = { ...db.user, ...b }
      saveDemoRiderDb(db)
      return demoResponse(db.user)
    }
    return ax.post('/riders/status', b)
  },
  updateLocation: b => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      db.user = { ...db.user, ...b }
      saveDemoRiderDb(db)
      return demoResponse(db.user)
    }
    return ax.put('/riders/location', b)
  },
  availableOrders: p => isRiderDemoMode() ? demoResponse(getDemoRiderDb().availableOrders) : ax.get('/orders/rider/available', { params: p }),
  availableReturns: p => isRiderDemoMode() ? demoResponse(getDemoRiderDb().availableReturns) : ax.get('/returns/rider/available', { params: p }),
  activeOrders: () => isRiderDemoMode() ? demoResponse(getDemoRiderDb().activeOrders) : ax.get('/orders/rider/active'),
  activeReturns: () => isRiderDemoMode() ? demoResponse(getDemoRiderDb().activeReturns) : ax.get('/returns/rider/active'),
  acceptOrder: id => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      const order = db.availableOrders.find(o => o.id === id)
      if (!order) return Promise.reject({ response: { data: { detail: 'Already taken' } } })
      db.availableOrders = db.availableOrders.filter(o => o.id !== id)
      db.activeOrders = [{ ...order, status: 'PACKING', riderId: DEMO_RIDER_USER_ID }, ...db.activeOrders]
      saveDemoRiderDb(db)
      return demoResponse({ ok: true })
    }
    return ax.post(`/orders/${id}/rider-accept`)
  },
  acceptReturnPickup: id => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      const item = db.availableReturns.find(r => r.id === id)
      if (!item) return Promise.reject({ response: { data: { detail: 'Already taken' } } })
      db.availableReturns = db.availableReturns.filter(r => r.id !== id)
      db.activeReturns = [{ ...item, pickupStatus: 'RIDER_ACCEPTED', riderId: DEMO_RIDER_USER_ID }, ...db.activeReturns]
      saveDemoRiderDb(db)
      return demoResponse({ ok: true })
    }
    return ax.post(`/returns/${id}/rider-accept`)
  },
  advanceStatus: (id, s) => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      db.activeOrders = db.activeOrders.map(o => o.id === id ? { ...o, status: s } : o)
      if (s === 'DELIVERED') {
        const delivered = db.activeOrders.find(o => o.id === id)
        if (delivered) db.history.unshift({
          id: `hist-${Date.now()}`,
          orderCode: delivered.orderCode,
          shopName: delivered.shop?.name || 'NearNow Shop',
          earning: delivered.riderEarning || Math.round((delivered.total || 0) * 0.08),
          total: delivered.total,
          paymentMethod: delivered.paymentMethod || 'online',
          codDueAmount: delivered.codDueAmount || ((delivered.paymentMethod || '').toLowerCase() === 'cod' ? delivered.total : 0),
          deliveredAt: new Date().toISOString(),
        })
        db.activeOrders = db.activeOrders.filter(o => o.id !== id)
      }
      saveDemoRiderDb(db)
      return demoResponse({ ok: true })
    }
    return ax.put(`/orders/${id}/status`, { status: s })
  },
  verifyPickupOtp: (id, otp) => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      const order = db.activeOrders.find(o => o.id === id)
      if (!order || String(order.pickupOtp) !== String(otp)) return Promise.reject({ response: { data: { detail: 'Wrong pickup OTP' } } })
      order.status = 'PICKED_UP'
      saveDemoRiderDb(db)
      return demoResponse({ ok: true })
    }
    return ax.post(`/orders/${id}/pickup-otp/verify`, { otp })
  },
  confirmDeliveryOtp: (id, otp) => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      const order = db.activeOrders.find(o => o.id === id)
      if (!order || String(order.deliveryOtp) !== String(otp)) return Promise.reject({ response: { data: { detail: 'Wrong OTP' } } })
      db.activeOrders = db.activeOrders.filter(o => o.id !== id)
      db.history.unshift({
        id: `hist-${Date.now()}`,
        orderCode: order.orderCode,
        shopName: order.shop?.name || 'NearNow Shop',
        earning: order.riderEarning || Math.round((order.total || 0) * 0.08),
        total: order.total,
        paymentMethod: order.paymentMethod || 'online',
        codDueAmount: order.codDueAmount || ((order.paymentMethod || '').toLowerCase() === 'cod' ? order.total : 0),
        deliveredAt: new Date().toISOString(),
      })
      saveDemoRiderDb(db)
      return demoResponse({ ok: true })
    }
    return ax.post(`/orders/${id}/delivery-otp/verify`, { otp })
  },
  advanceReturnPickup: (id, pickupStatus) => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      db.activeReturns = db.activeReturns.map(o => o.id === id ? { ...o, pickupStatus } : o)
      if (pickupStatus === 'COMPLETED') db.activeReturns = db.activeReturns.filter(o => o.id !== id)
      saveDemoRiderDb(db)
      return demoResponse({ ok: true })
    }
    return ax.put(`/returns/${id}/pickup-status`, { pickupStatus })
  },
  earnings: p => isRiderDemoMode() ? demoResponse(getDemoRiderEarnings(getDemoRiderDb())) : ax.get('/riders/earnings', { params: p }),
  history: () => isRiderDemoMode() ? demoResponse(getDemoRiderDb().history) : ax.get('/riders/history'),
  performance: () => isRiderDemoMode() ? demoResponse(getDemoRiderPerformance(getDemoRiderDb())) : ax.get('/riders/performance'),
  codSettlement: () => isRiderDemoMode() ? demoResponse(getDemoCodSettlement(getDemoRiderDb())) : ax.get('/riders/cod-settlement'),
  payCodSettlement: payload => {
    if (isRiderDemoMode()) {
      const db = getDemoRiderDb()
      const summary = getDemoCodSettlement(db)
      const amount = Number(payload?.amount || summary.pendingAmount || 0)
      if (amount <= 0 || amount > summary.pendingAmount) {
        return Promise.reject({ response: { data: { detail: 'Invalid COD settlement amount' } } })
      }
      const now = new Date().toISOString()
      db.codSettlements = [
        {
          id: `cod-settle-${Date.now()}`,
          amount,
          method: String(payload?.method || 'upi').toLowerCase(),
          paymentDate: now,
          note: payload?.note || 'COD settlement to DOTT',
        },
        ...(db.codSettlements || []),
      ]
      saveDemoRiderDb(db)
      return demoResponse({ ok: true, summary: getDemoCodSettlement(db) })
    }
    return ax.post('/riders/cod-settlement/pay', payload || {})
  },
}

/* â”€â”€ CSS â”€â”€ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#eef7ff;--surface:#ffffff;--card:#ffffff;--border:#cfe6fb;
  --green:#4aa8ff;--green2:#4aa8ff;--blue:#4aa8ff;--orange:#4aa8ff;--red:#ef4444;--purple:#4aa8ff;
  --text:#31506b;--text2:#12324d;--muted:#6b8aa3;--font:'Plus Jakarta Sans',sans-serif;--body:'Inter',sans-serif;
}
body{background:linear-gradient(180deg,#f7fbff 0%,#eef7ff 52%,#f9fcff 100%);color:var(--text);font-family:var(--body);min-height:100vh}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse-green{0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,.5)}70%{box-shadow:0 0 0 10px rgba(63,185,80,0)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes bgShift{0%{background-position:0 0}100%{background-position:40px 40px}}
@keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes ripple{0%{transform:scale(0);opacity:.6}100%{transform:scale(3);opacity:0}}
.fade-up{animation:fadeUp .32s ease both}
.fade-in{animation:fadeIn .25s ease both}

.header{
  position:sticky;top:0;z-index:100;
  background:rgba(255,255,255,.92);backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);
  padding:12px 18px;display:flex;align-items:center;justify-content:space-between;
  box-shadow:0 10px 28px rgba(42,116,189,.08);
}
.logo{font-family:var(--font);font-weight:900;font-size:20px;letter-spacing:-.4px}
.logo .hi{color:var(--blue)}
.header-meta{display:flex;align-items:center;gap:12px}

.online-btn{
  display:flex;align-items:center;gap:8px;padding:7px 14px;
  border-radius:100px;border:none;cursor:pointer;font-family:var(--font);
  font-weight:800;font-size:12px;transition:.25s;position:relative;overflow:hidden;
}
.online-btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,0);transition:.2s}
.online-btn:hover::after{background:rgba(255,255,255,.1)}
.online-btn:active{transform:scale(.97)}
.online-btn.on{background:rgba(74,168,255,.12);color:var(--green2);border:1.5px solid rgba(74,168,255,.35);animation:pulse-green 2s infinite}
.online-btn.off{background:var(--card);color:var(--muted);border:1.5px solid var(--border)}
.live-dot{width:8px;height:8px;border-radius:50%}
.live-dot.on{background:var(--green2)}.live-dot.off{background:var(--muted)}

.content{padding:14px;padding-bottom:86px;min-height:100vh;max-width:1200px;margin:0 auto;overflow-x:hidden}

.bottom-nav{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:1200px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.96);backdrop-filter:blur(20px);
  border-top:1px solid var(--border);display:flex;
  padding:10px 0 max(10px,env(safe-area-inset-bottom));z-index:100;
  box-shadow:0 -8px 26px rgba(42,116,189,.08);
}
.nav-btn{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:4px;background:none;border:none;cursor:pointer;
  color:var(--muted);font-family:var(--font);font-size:10px;font-weight:800;
  text-transform:uppercase;letter-spacing:.5px;transition:.2s;position:relative;
}
.nav-btn.active{color:var(--green2)}
.nav-btn:hover:not(.active){color:rgba(74,168,255,.7)}
.nav-btn svg{width:22px;height:22px}
.nav-pill{
  position:absolute;top:0;right:calc(50% - 20px);
  background:var(--orange);color:#fff;font-size:9px;font-weight:900;
  padding:2px 6px;border-radius:100px;min-width:16px;text-align:center;
}

.card{
  background:var(--card);border:1px solid var(--border);
  border-radius:16px;padding:14px;margin-bottom:10px;transition:.25s;
}
.card:hover{border-color:rgba(255,255,255,.08)}
.card.new-order{border-color:rgba(74,168,255,.45);background:rgba(74,168,255,.05)}
.card.new-order:hover{border-color:rgba(74,168,255,.7)}
.card.active-order{border-color:rgba(74,168,255,.35);background:rgba(74,168,255,.05)}

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:10px 14px;border-radius:11px;border:none;cursor:pointer;
  font-family:var(--font);font-weight:800;font-size:13px;transition:.22s;
  position:relative;overflow:hidden;
}
.btn-compact{padding:9px 10px;font-size:12px;border-radius:10px;min-height:38px}
.btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,0);transition:.15s}
.btn:hover::after{background:rgba(255,255,255,.12)}
.btn:active:not(:disabled){transform:scale(.97)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-green{background:linear-gradient(135deg,#69bbff,#4aa8ff);color:#fff;box-shadow:0 4px 16px rgba(74,168,255,.3)}
.btn-green:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(74,168,255,.4)}
.btn-blue{background:linear-gradient(135deg,#69bbff,#4aa8ff);color:#fff;box-shadow:0 4px 16px rgba(74,168,255,.3)}
.btn-blue:hover{transform:translateY(-1px)}
.btn-orange{background:linear-gradient(135deg,#69bbff,#4aa8ff);color:#fff}
.btn-ghost{background:var(--surface);color:var(--text);border:1.5px solid var(--border)}
.btn-ghost:hover{border-color:var(--green2);color:var(--green2)}
.btn-purple{background:linear-gradient(135deg,#69bbff,#4aa8ff);color:#fff;box-shadow:0 4px 16px rgba(74,168,255,.3)}
.btn-purple:hover{transform:translateY(-1px)}

.input{
  width:100%;padding:13px 16px;background:var(--surface);
  border:1.5px solid var(--border);border-radius:13px;
  color:var(--text2);font-family:var(--body);font-size:14px;outline:none;transition:.2s;
}
.input:focus{border-color:var(--green2);box-shadow:0 0 0 3px rgba(63,185,80,.1)}
.input::placeholder{color:var(--muted)}
.label{font-size:11px;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;display:block}

.badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:800}

.section-title{font-size:16px;font-weight:900;color:var(--text2);margin-bottom:10px;letter-spacing:-.25px;font-family:var(--font)}
.sec-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}

.empty{text-align:center;padding:56px 20px;color:var(--muted)}
.empty-icon{font-size:44px;margin-bottom:12px;opacity:.5;display:block;animation:float 3s ease-in-out infinite}

.toast{
  position:fixed;top:76px;left:50%;transform:translateX(-50%);z-index:500;
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  padding:10px 20px;font-size:13px;font-weight:800;
  animation:fadeUp .3s ease;box-shadow:0 10px 28px rgba(42,116,189,.16);white-space:nowrap;
  font-family:var(--font);
}

.route-line{display:flex;flex-direction:column;gap:0}
.route-stop{display:flex;align-items:flex-start;gap:12px;padding:8px 0;position:relative}
.route-stop:not(:last-child)::after{content:'';position:absolute;left:7px;top:24px;height:24px;width:2px;border-left:2.5px dashed rgba(74,168,255,.18)}
.r-dot{width:16px;height:16px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;color:#fff;margin-top:2px}

.earn-hero{
  border-radius:18px;padding:18px;margin-bottom:10px;
  background:linear-gradient(140deg,#eaf6ff 0%,#d8edff 50%,#ffffff 100%);
  border:1px solid rgba(74,168,255,.2);position:relative;overflow:hidden;
}
.earn-hero::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(74,168,255,.12),transparent 70%);pointer-events:none}
.earn-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.earn-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:11px;text-align:center;transition:.2s}
.earn-card:hover{border-color:rgba(74,168,255,.3)}
.earn-val{font-size:22px;font-weight:900;color:var(--green2);margin-bottom:2px;font-family:var(--font)}
.earn-label{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.earn-main-amount{font-size:clamp(30px,9vw,40px);font-weight:900;color:#3fb950;margin-bottom:4px;font-family:var(--font);line-height:1}
.earn-month-amount{font-size:clamp(32px,10vw,44px);font-weight:900;color:#3fb950;font-family:var(--font);line-height:1}
.earn-sub-amount{font-weight:900;font-size:18px;color:#3fb950;font-family:var(--font)}
.cod-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
.cod-stat{padding:10px;border:1px solid var(--border);border-radius:10px;background:#f8fbff}
.cod-stat-label{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px}
.cod-stat-value{font-size:17px;font-weight:900;color:var(--text2);font-family:var(--font);line-height:1.1}
.cod-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.range-card{margin-top:10px;padding:10px;border-radius:12px;border:1px solid var(--border);background:#f9fcff}
.range-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.range-badge{padding:4px 8px;border-radius:100px;background:rgba(74,168,255,.15);color:var(--green2);font-size:10px;font-weight:800}
.range-slider{width:100%;accent-color:#4aa8ff}

.history-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(48,54,61,.5)}
.history-item:last-child{border-bottom:none}

.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:14px;border-radius:14px;background:var(--surface);border:1px solid var(--border);margin-bottom:10px;transition:.2s}
.toggle-row:hover{border-color:rgba(74,168,255,.3)}
.toggle{width:46px;height:25px;border-radius:13px;border:none;cursor:pointer;position:relative;transition:.25s;flex-shrink:0}
.toggle::after{content:'';position:absolute;width:19px;height:19px;border-radius:50%;background:#fff;top:3px;transition:.25s;box-shadow:0 1px 5px rgba(0,0,0,.2)}
.toggle.on{background:var(--green2)}.toggle.on::after{left:24px}
.toggle.off{background:var(--border)}.toggle.off::after{left:3px}

.offline-banner{
  margin:0 0 16px;padding:16px;border-radius:16px;
  background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.2);
  text-align:center;font-size:14px;color:var(--red);font-weight:700;
}

/* Map modal */
.map-overlay{position:fixed;inset:0;z-index:400;background:rgba(18,50,77,.24);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease;backdrop-filter:blur(4px)}
.map-modal{background:var(--card);border-radius:20px;padding:0;width:100%;max-width:480px;overflow:hidden;animation:slideUp .3s cubic-bezier(.22,1,.36,1);border:1px solid var(--border)}
@media(max-width:640px){
  .header{padding:12px 14px;gap:10px;flex-wrap:wrap}
  .header-meta{width:100%;justify-content:space-between}
  .online-btn{width:100%;justify-content:center}
  .content{padding:12px 10px 92px}
  .sec-row{flex-direction:column;align-items:flex-start;gap:10px}
  .earn-grid{grid-template-columns:1fr 1fr}
  .cod-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .cod-actions{grid-template-columns:repeat(2,minmax(0,1fr))}
  .bottom-nav{border-radius:22px 22px 0 0}
  .map-modal{max-width:none}
  .btn{width:100%}
  .card{padding:12px}
  .history-item{align-items:flex-start}
  .auth-side{display:none!important}
  .auth-main{padding:20px 12px!important}
  .auth-card{max-width:none!important;padding:22px 16px!important;border-radius:20px!important}
  .auth-toggle,.auth-loc-row,.mobile-stack{flex-direction:column!important}
  .mobile-stack > *{width:100%}
}
@media(max-width:420px){
  .header{padding:10px 10px;gap:8px}
  .logo{font-size:18px}
  .header-meta{gap:8px}
  .online-btn{padding:6px 10px;font-size:11px}
  .content{padding:10px 8px 88px}
  .earn-hero{padding:14px;border-radius:14px}
  .section-title{font-size:15px}
  .cod-stat{padding:8px}
  .cod-stat-label{font-size:9px}
  .cod-stat-value{font-size:15px}
  .cod-actions .btn{padding:8px 8px;font-size:11px;border-radius:9px}
  .range-card{padding:9px}
  .bottom-nav{padding:8px 0 max(8px,env(safe-area-inset-bottom));}
  .nav-btn{font-size:9px;gap:2px}
  .nav-btn svg{width:20px;height:20px}
}
`

/* â”€â”€ Icons â”€â”€ */

function Toast({ msg, type }) {
  const c = type === 'error' ? '#f85149' : type === 'success' ? '#3fb950' : '#388bfd'
  return <div className="toast" style={{ borderColor: c, color: c }}>{msg}</div>
}

/* â”€â”€ LEAFLET MAP PICKER â”€â”€ */
function MapPicker({ lat, lng, onPinMove, height = 260 }) {
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
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '(c) OSM', maxZoom: 19 }).addTo(map)
      const icon = L.divIcon({ html: `<div style="width:28px;height:28px;background:#3fb950;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,.4)"></div>`, iconSize: [28, 28], iconAnchor: [14, 28], className: '' })
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
      leafletMapRef.current.setView([lat, lng], 15, { animate: true })
    }
  }, [lat, lng])

  return (
    <div style={{ position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height, background: '#f2f8ff' }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 999, background: 'rgba(255,255,255,.95)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#31506b', border: '1px solid #cfe6fb' }}>
         Drag pin or tap map
      </div>
    </div>
  )
}

/* â”€â”€ MAP LOCATION MODAL â”€â”€ */
function MapLocationModal({ currentLat, currentLng, onSave, onClose }) {
  const initialCoords = (currentLat != null && currentLng != null)
    ? { lat: Number(currentLat), lng: Number(currentLng) }
    : (getStoredRiderLocation() || { lat: 20.5937, lng: 78.9629 })
  const [coords, setCoords] = useState(initialCoords)
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')

  const reverseGeocode = async (lat, lng) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } })
      const d = await r.json()
      if (d?.display_name) setAddress(d.display_name.split(',').slice(0, 3).join(','))
    } catch (e) {
      setAddress('')
    }
  }

  useEffect(() => { reverseGeocode(coords.lat, coords.lng) }, [])

  const handlePinMove = async (lat, lng) => {
    setCoords({ lat, lng })
    await reverseGeocode(lat, lng)
  }

  const useGPS = () => {
    setGpsError('')
    setLoading(true)
    getCurrentGpsLocation()
      .then(async c => {
        setCoords({ lat: c.lat, lng: c.lng })
        saveStoredRiderLocation({ lat: c.lat, lng: c.lng })
        await reverseGeocode(c.lat, c.lng)
      })
      .catch(err => setGpsError(err?.message || 'Unable to detect current location'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="map-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="map-modal">
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 16, color: 'var(--text2)' }}>Update Location</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Drop pin where you are now</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, cursor: 'pointer', padding: '6px 8px', display: 'flex' }}><Ic.Close /></button>
        </div>

        <MapPicker lat={coords.lat} lng={coords.lng} onPinMove={handlePinMove} height={280} />

        <div style={{ padding: 16 }}>
          {gpsError && <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}>{gpsError}</div>}
          {address && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(63,185,80,.07)', borderRadius: 10, fontSize: 12, color: 'var(--green2)', fontWeight: 600, border: '1px solid rgba(63,185,80,.2)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><Ic.Loc /></span>
              <span style={{ lineHeight: 1.5 }}>{address}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={useGPS} disabled={loading}>
              {loading ? 'Getting...' : 'Use GPS'}
            </button>
            <button className="btn btn-green" style={{ flex: 2 }} onClick={() => { saveStoredRiderLocation(coords); onSave(coords, address) }}>
              Set This Location
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   AUTH PAGE â€” full page with animated background
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AuthPage({ onSuccess }) {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loc, setLoc] = useState(null)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [otpStep, setOtpStep] = useState('form')
  const [otpValue, setOtpValue] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpTimer, setOtpTimer] = useState(0)
  const timerRef = useRef(null)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const enterDemoRider = () => {
    localStorage.setItem(DEMO_RIDER_MODE_KEY, '1')
    const db = getDemoRiderDb()
    onSuccess(db.user)
  }

  const startTimer = () => {
    setOtpTimer(60)
    timerRef.current = setInterval(() => setOtpTimer(t => { if(t<=1){clearInterval(timerRef.current);return 0} return t-1 }), 1000)
  }

  const sendOtp = async () => {
    const phone = form.phone.replace(/\D/g,'')
    if (phone.length !== 10) { setError('Enter valid 10-digit phone'); return }
    setOtpSending(true); setError('')
    try {
      const r = await api.sendOtp(phone)
      setOtpStep('otp'); startTimer()
      if (r.data.dev_otp) setOtpValue(r.data.dev_otp)
    } catch(e) { setError(e.response?.data?.detail || 'Failed to send OTP') }
    setOtpSending(false)
  }

  const getLoc = async () => {
    try {
      const gps = await getCurrentGpsLocation()
      setLoc({ lat: gps.lat, lng: gps.lng })
      setError('')
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
        if (!form.name || !form.email || !form.password) { setError('Fill all fields'); setLoading(false); return }
        r = await api.register({ ...form, role: 'RIDER', otp: otpValue, ...loc })
      }
      if (r.data?.user?.role !== 'RIDER') {
        clearRiderSession()
        setError('This account is not a rider account. Please sign in with a rider login.')
        setLoading(false)
        return
      }
      localStorage.setItem('rdr_access', r.data.accessToken)
      localStorage.setItem('rdr_refresh', r.data.refreshToken)
      onSuccess(r.data.user)
    } catch (e) { setError(e.response?.data?.detail || 'Failed') }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh',display:'flex',overflow:'hidden',position:'relative',background:'linear-gradient(180deg,#dff0ff 0%,#eef7ff 52%,#f8fbff 100%)' }}>
      <div style={{ position:'absolute',inset:0,backgroundImage:'radial-gradient(circle,rgba(74,168,255,.14) 1px,transparent 1px)',backgroundSize:'28px 28px',animation:'bgShift 10s linear infinite',pointerEvents:'none' }}/>
      <div className="auth-side" style={{ width:'44%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:40,position:'relative' }}>
        <div style={{ textAlign:'center',color:'var(--text2)' }}>
          <div style={{ fontSize:68,marginBottom:12,animation:'float 3s ease-in-out infinite' }}>RIDER</div>
          <div style={{ fontFamily:'var(--font)',fontWeight:900,fontSize:32,letterSpacing:'-.5px',marginBottom:8 }}>DOTT <span style={{color:'var(--green2)'}}>Rider</span></div>
          <div style={{ color:'var(--muted)',fontSize:14,lineHeight:1.6,marginBottom:24 }}>Deliver fast. Earn per km.</div>
          {['Distance-based pay - earn per km','First to accept gets the order','Earnings to UPI/Bank directly','Built-in navigation support'].map(f => (
            <div key={f} style={{ padding:'10px 14px',background:'rgba(74,168,255,.08)',borderRadius:12,marginBottom:8,border:'1px solid rgba(74,168,255,.18)',textAlign:'left',fontSize:13,color:'#2563eb',fontWeight:600 }}>{f}</div>
          ))}
        </div>
      </div>
      <div className="auth-main" style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 20px' }}>
        <div className="auth-card" style={{ width:'100%',maxWidth:400,background:'var(--card)',borderRadius:24,padding:32,border:'1px solid var(--border)',boxShadow:'0 24px 64px rgba(42,116,189,.16)',animation:'slideUp .4s cubic-bezier(.22,1,.36,1)' }}>
          <div style={{ marginBottom:22 }}>
            <div style={{ fontFamily:'var(--font)',fontWeight:900,fontSize:24,color:'var(--text2)' }}>{tab==='login'?'Welcome back':'Join as Rider'}</div>
            <div style={{ color:'var(--muted)',fontSize:13,marginTop:4 }}>{tab==='login'?'Sign in to your rider account':'Start earning today'}</div>
          </div>
          <div className="auth-toggle" style={{ display:'flex',background:'var(--surface)',borderRadius:12,padding:4,gap:4,marginBottom:22 }}>
            {['login','register'].map(t => (
              <button key={t} onClick={()=>{setTab(t);setOtpStep('form');setOtpValue('');setError('')}} style={{ flex:1,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',background:tab===t?'var(--green2)':'transparent',color:tab===t?'#fff':'var(--muted)',fontFamily:'var(--font)',fontWeight:800,fontSize:13,transition:'.2s' }}>
                {t==='login'?'Sign In':'Register'}
              </button>
            ))}
          </div>

          {tab==='register' && otpStep==='otp' ? (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{textAlign:'center',padding:16,background:'rgba(63,185,80,.08)',borderRadius:14,border:'1px solid rgba(63,185,80,.2)'}}>
                <div style={{width:44,height:44,borderRadius:12,background:'rgba(63,185,80,.1)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px'}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.72 12 19.79 19.79 0 011.61 3.38 2 2 0 013.6 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.9a16 16 0 006.07 6.07l.97-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></div>
                <div style={{fontWeight:800,fontSize:14,color:'var(--green2)'}}>OTP Sent!</div>
                <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>Enter the 6-digit code sent to {form.phone}</div>
              </div>
              <div>
                <label className="label">Enter OTP</label>
                <input className="input" placeholder="6-digit OTP" value={otpValue} onChange={e=>setOtpValue(e.target.value)} maxLength={6} style={{textAlign:'center',fontSize:22,letterSpacing:6,fontWeight:800}}/>
              </div>
              {error && <div style={{color:'#f85149',fontSize:13,padding:'10px 14px',background:'rgba(248,81,73,.07)',borderRadius:10,fontWeight:600}}>{error}</div>}
              <button className="btn btn-green" style={{width:'100%',padding:'13px'}} onClick={submit} disabled={loading||otpValue.length!==6}>
                {loading?'Verifying...':'Verify and Join'}
              </button>
              <div className="mobile-stack" style={{display:'flex',justifyContent:'space-between',gap:10}}>
                <button onClick={()=>{setOtpStep('form');setOtpValue('')}} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:12}}>Back</button>
                {otpTimer>0 ? <span style={{fontSize:12,color:'var(--muted)'}}>Resend in {otpTimer}s</span> : <button onClick={sendOtp} style={{background:'none',border:'none',color:'var(--green2)',cursor:'pointer',fontSize:12,fontWeight:800}}>Resend OTP</button>}
              </div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {tab==='register' && <>
                <div><label className="label">Full Name</label><input className="input" placeholder="Your full name" value={form.name} onChange={set('name')}/></div>
                <div><label className="label">Phone *</label><input className="input" placeholder="10-digit number" value={form.phone} onChange={set('phone')}/></div>
              </>}
              <div><label className="label">Email</label><input className="input" type="email" placeholder="rider@email.com" value={form.email} onChange={set('email')}/></div>
              <div><label className="label">Password</label><input className="input" type="password" placeholder="Password" value={form.password} onChange={set('password')} onKeyDown={e=>e.key==='Enter'&&(tab==='login'?submit():sendOtp())}/></div>
              <div className="auth-loc-row" style={{display:'flex',gap:8}}>
                <div onClick={getLoc} style={{flex:1,display:'flex',alignItems:'center',gap:8,padding:'11px 13px',borderRadius:12,border:`1.5px solid ${loc?'var(--green2)':'var(--border)'}`,background:loc?'rgba(63,185,80,.07)':'var(--surface)',cursor:'pointer',transition:'.2s'}}>
                  <span style={{fontSize:18}}>{loc?'OK':''}</span>
                  <div><div style={{fontWeight:700,fontSize:12,color:'var(--text2)'}}>{loc?'GPS set':'Use GPS'}</div><div style={{color:'var(--muted)',fontSize:10}}>{loc?`${loc.lat.toFixed(3)}`:'Auto-detect'}</div></div>
                </div>
                <div onClick={()=>setShowMapPicker(true)} style={{flex:1,display:'flex',alignItems:'center',gap:8,padding:'11px 13px',borderRadius:12,border:'1.5px solid var(--border)',background:'var(--surface)',cursor:'pointer',transition:'.2s'}}>
                  <span style={{fontSize:18}}></span>
                  <div><div style={{fontWeight:700,fontSize:12,color:'var(--text2)'}}>Pick Map</div><div style={{color:'var(--muted)',fontSize:10}}>Pin location</div></div>
                </div>
              </div>
              {error && <div style={{color:'#f85149',fontSize:13,padding:'10px 14px',background:'rgba(248,81,73,.07)',borderRadius:10,fontWeight:600}}>{error}</div>}
              {tab==='login'
                ? <button className="btn btn-green" style={{width:'100%',padding:'13px',fontSize:14}} onClick={submit} disabled={loading}>{loading?'Signing in...':'Sign In'}</button>
                : <button className="btn btn-green" style={{width:'100%',padding:'13px',fontSize:14}} onClick={sendOtp} disabled={otpSending}>{otpSending?'Sending OTP...':'Send OTP and Continue'}</button>}
            </div>
          )}
        </div>
      </div>
      {showMapPicker && <MapLocationModal currentLat={loc?.lat ?? getStoredRiderLocation()?.lat} currentLng={loc?.lng ?? getStoredRiderLocation()?.lng} onSave={(coords)=>{setLoc(coords); saveStoredRiderLocation(coords); setShowMapPicker(false)}} onClose={()=>setShowMapPicker(false)}/>}
    </div>
  )
}


// â”€â”€â”€ Delivery Countdown (shared with vendor) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DeliveryCountdown({ placedAt, compact=false }) {
  const endTime = useRef(new Date(placedAt).getTime() + 60 * 60 * 1000)
  const [secsLeft, setSecsLeft] = useState(Math.max(0, Math.floor((endTime.current - Date.now()) / 1000)))
  useEffect(() => {
    const t = setInterval(() => {
      setSecsLeft(Math.max(0, Math.floor((endTime.current - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.floor(secsLeft / 60)
  const secs = secsLeft % 60
  const urgent = secsLeft < 600
  const pct = secsLeft / 3600
  const circumference = 125.6
  const dash = circumference * pct
  if (secsLeft <= 0) return <span style={{fontSize:11,fontWeight:800,color:'#f85149',background:'rgba(248,81,73,.1)',padding:'3px 8px',borderRadius:100}}>Time expired</span>
  if (compact) return (
    <span style={{fontSize:11,fontWeight:800,color:urgent?'#f85149':'#3fb950',background:urgent?'rgba(248,81,73,.1)':'rgba(63,185,80,.1)',padding:'3px 8px',borderRadius:100}}>
      {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')} left
    </span>
  )
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,background:urgent?'rgba(248,81,73,.07)':'rgba(63,185,80,.07)',border:`1px solid ${urgent?'rgba(248,81,73,.2)':'rgba(63,185,80,.2)'}`,marginBottom:10}}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{transform:'rotate(-90deg)',flexShrink:0}}>
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3"/>
        <circle cx="20" cy="20" r="16" fill="none" stroke={urgent?'#f85149':'#3fb950'} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${dash * 0.8} ${circumference * 0.8}`} strokeDashoffset="0"/>
      </svg>
      <div>
        <div style={{fontSize:20,fontWeight:900,color:urgent?'#f85149':'#3fb950',fontFamily:'var(--font)',lineHeight:1}}>{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</div>
        <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{urgent?'Delivery time running low':'Min remaining for 60-min delivery'}</div>
      </div>
      {urgent && <div style={{marginLeft:'auto',padding:'5px 10px',background:'rgba(248,81,73,.15)',borderRadius:8,fontSize:11,fontWeight:800,color:'#f85149',flexShrink:0}}>URGENT</div>}
    </div>
  )
}

// â”€â”€â”€ Rider Points System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DeliveryCountdownSync({ placedAt, deadline, serverNow, compact=false }) {
  const endTime = useRef(deadline ? new Date(deadline).getTime() : new Date(placedAt).getTime() + 60 * 60 * 1000)
  const serverOffset = useRef(serverNow ? (new Date(serverNow).getTime() - Date.now()) : 0)
  const [secsLeft, setSecsLeft] = useState(Math.max(0, Math.floor((endTime.current - (Date.now() + serverOffset.current)) / 1000)))
  useEffect(() => {
    const t = setInterval(() => {
      setSecsLeft(Math.max(0, Math.floor((endTime.current - (Date.now() + serverOffset.current)) / 1000)))
    }, 1000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.floor(secsLeft / 60)
  const secs = secsLeft % 60
  const urgent = secsLeft < 600
  const warning = secsLeft < 1800 && secsLeft >= 600
  const tone = urgent ? '#f85149' : warning ? '#f59e0b' : '#3fb950'
  const pct = secsLeft / 3600
  const circumference = 125.6
  const dash = circumference * pct
  if (secsLeft <= 0) return <span style={{fontSize:11,fontWeight:800,color:'#f85149',background:'rgba(248,81,73,.1)',padding:'3px 8px',borderRadius:100}}>Time expired</span>
  if (compact) return (
    <span style={{fontSize:11,fontWeight:800,color:tone,background:urgent?'rgba(248,81,73,.1)':warning?'rgba(245,158,11,.12)':'rgba(63,185,80,.1)',padding:'3px 8px',borderRadius:100}}>
      {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')} left
    </span>
  )
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,background:urgent?'rgba(248,81,73,.07)':warning?'rgba(245,158,11,.08)':'rgba(63,185,80,.07)',border:`1px solid ${urgent?'rgba(248,81,73,.2)':warning?'rgba(245,158,11,.2)':'rgba(63,185,80,.2)'}`,marginBottom:10}}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{transform:'rotate(-90deg)',flexShrink:0}}>
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3"/>
        <circle cx="20" cy="20" r="16" fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${dash * 0.8} ${circumference * 0.8}`} strokeDashoffset="0"/>
      </svg>
      <div>
        <div style={{fontSize:20,fontWeight:900,color:tone,fontFamily:'var(--font)',lineHeight:1}}>{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</div>
        <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{urgent?'High priority order':warning?'Timer entering alert zone':'min remaining for 60-min delivery'}</div>
      </div>
      <div style={{marginLeft:'auto',padding:'5px 10px',background:urgent?'rgba(248,81,73,.15)':warning?'rgba(245,158,11,.14)':'rgba(63,185,80,.14)',borderRadius:8,fontSize:11,fontWeight:800,color:tone,flexShrink:0}}>{urgent?'HIGH':warning?'WATCH':'SAFE'}</div>
    </div>
  )
}

function RiderPointsBadge({ points }) {
  const level = points >= 1000 ? 'GOLD' : points >= 500 ? 'SILVER' : 'BRONZE'
  const colors = { GOLD: '#f59e0b', SILVER: '#94a3b8', BRONZE: '#b45309' }
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:100,background:`${colors[level]}18`,border:`1px solid ${colors[level]}35`,fontSize:12,fontWeight:800,color:colors[level]}}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill={colors[level]} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      {points} pts - {level}
    </div>
  )
}


function HomeTab({
  user,
  isOnline,
  loc,
  onOpenActive,
  onOpenProfile,
  onOpenNearby,
  nearbyCount,
  onShowToast,
  deliveryRangeKm,
  onRangeChange,
}) {
  const [earnings, setEarnings] = useState(null)
  const [active, setActive] = useState([])
  const [codSummary, setCodSummary] = useState(null)
  const [settling, setSettling] = useState('')

  useEffect(() => {
    api.earnings().then(r => setEarnings(r.data)).catch(() => {})
    api.activeOrders().then(r => setActive(r.data)).catch(() => {})
    api.codSettlement().then(r => setCodSummary(r.data?.summary || r.data)).catch(() => {})
  }, [])

  const todayEarn = earnings?.today?.earned || 0
  const todayTrips = earnings?.today?.trips || 0
  const monthEarn = earnings?.month?.earned || 0
  const pendingCod = Number(codSummary?.pendingAmount || 0)
  const company = codSummary?.companyAccount || {}

  const settleCod = async (method) => {
    if (!pendingCod) {
      onShowToast?.('No pending COD amount to settle', 'info')
      return
    }
    const upiId = company.upiId || toUpiFromPhone(company.contactPhone)
    if (upiId) openUpiPaymentLink(method, upiId, pendingCod, `COD settlement by ${user?.name || 'Rider'}`)
    setSettling(method)
    try {
      const r = await api.payCodSettlement({
        amount: pendingCod,
        method,
        note: `COD settlement from rider app via ${String(method || 'upi').toUpperCase()}`,
      })
      setCodSummary(r.data?.summary || r.data)
      onShowToast?.(`COD settled: Rs ${pendingCod.toFixed(2)}`, 'success')
    } catch (e) {
      onShowToast?.(e?.response?.data?.detail || 'COD settlement failed', 'error')
    } finally {
      setSettling('')
    }
  }

  return (
    <div>
      <div className="earn-hero fade-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'rgba(63,185,80,.6)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Today's Earnings</div>
            <div className="earn-main-amount">Rs {todayEarn}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{todayTrips} deliveries - Rs {monthEarn} this month</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Status</div>
            <div style={{ fontWeight: 900, fontSize: 14, color: isOnline ? '#3fb950' : '#f85149' }}>{isOnline ? 'Online' : 'Offline'}</div>
          </div>
        </div>
        {loc && <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(63,185,80,.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          Lat: {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
        </div>}
      </div>

      <div className="earn-grid fade-up" style={{ animationDelay: '.06s' }}>
        {[
          { label: 'This Week', val: `Rs ${earnings?.week?.earned || 0}`, sub: `${earnings?.week?.trips || 0} trips` },
          { label: 'All Time', val: `Rs ${earnings?.allTime?.earned || 0}`, sub: `${earnings?.allTime?.trips || 0} trips` },
        ].map(c => (
          <div key={c.label} className="earn-card">
            <div className="earn-val">{c.val}</div>
            <div className="earn-label">{c.label}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="card fade-up" style={{ animationDelay: '.08s' }}>
        <div className="section-title" style={{ marginBottom: 10 }}>COD Settlement</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Track collected cash and settle to company daily.</div>
        <div className="cod-grid">
          <div className="cod-stat">
            <div className="cod-stat-label">Collected COD</div>
            <div className="cod-stat-value">Rs {Number(codSummary?.totalCollected || 0).toFixed(0)}</div>
          </div>
          <div className="cod-stat">
            <div className="cod-stat-label">Settled</div>
            <div className="cod-stat-value" style={{ color: '#22c55e' }}>Rs {Number(codSummary?.settledAmount || 0).toFixed(0)}</div>
          </div>
          <div className="cod-stat">
            <div className="cod-stat-label">Pending</div>
            <div className="cod-stat-value" style={{ color: pendingCod > 0 ? '#f97316' : '#22c55e' }}>Rs {pendingCod.toFixed(0)}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: '#f8fbff', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Company payout details</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)' }}>{company.companyName || 'DOTT Marketplace'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>UPI: {company.upiId || toUpiFromPhone(company.contactPhone) || 'Not configured'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Phone: {company.contactPhone || 'Not configured'}</div>
        </div>
        <div className="cod-actions">
          <button className="btn btn-blue btn-compact" disabled={pendingCod <= 0 || settling === 'phonepe'} onClick={() => settleCod('phonepe')}>
            {settling === 'phonepe' ? 'Processing...' : 'Settle via PhonePe'}
          </button>
          <button className="btn btn-blue btn-compact" disabled={pendingCod <= 0 || settling === 'gpay'} onClick={() => settleCod('gpay')}>
            {settling === 'gpay' ? 'Processing...' : 'Settle via GPay'}
          </button>
        </div>
      </div>

      <div className="range-card fade-up" style={{ animationDelay: '.09s' }}>
        <div className="range-meta">
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text2)' }}>Delivery range</div>
          <div className="range-badge">{deliveryRangeKm} km</div>
        </div>
        <input
          className="range-slider"
          type="range"
          min={1}
          max={10}
          step={1}
          value={deliveryRangeKm}
          onChange={(e) => onRangeChange?.(Number(e.target.value))}
        />
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
          <span>1 km</span>
          <span>10 km max</span>
        </div>
      </div>

      {active.length > 0 && (
        <div className="fade-up" style={{ animationDelay: '.1s' }}>
          <div className="section-title">Active Delivery</div>
          {active.slice(0, 1).map(o => (
            <button key={o.id} className="card active-order" onClick={onOpenActive} style={{ width:'100%', textAlign:'left', cursor:'pointer', background:'rgba(74,168,255,.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: 'var(--text2)', fontFamily: 'var(--font)' }}>#{o.orderCode}</div>
                <span className="badge" style={{ background: `${S_COLOR[o.status]}18`, color: S_COLOR[o.status] }}>{S_LABEL[o.status]}</span>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>{o.deliveryAddress?.substring(0, 55)}...</div>
              <div style={{ marginTop: 10, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#3fb950', fontFamily: 'var(--font)' }}>+Rs {o.riderEarning || Math.round(o.total * 0.08)} earning</div>
                <span style={{ fontSize:12, fontWeight:800, color:'var(--green2)' }}>Open details</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="fade-up" style={{ animationDelay: '.12s' }}>
        <div className="section-title">Rider Tools</div>
        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { title:'Nearby Orders', value: nearbyCount || 0, note:'orders ready to accept', onClick: onOpenNearby },
            { title:'Location Ready', value: loc ? 'GPS set' : 'Update', note: loc ? 'matching is active' : 'set location now', onClick: onOpenProfile },
            { title:'Today Trips', value: todayTrips, note:'deliveries completed', onClick: null },
            { title:'This Month', value: `Rs ${monthEarn}`, note:'earnings generated', onClick: null },
          ].map(({ title, value, note, onClick }) => (
            <button key={title} onClick={onClick || undefined} style={{ textAlign:'left', padding:'14px', borderRadius:14, border:'1px solid var(--border)', background:'#f9fcff', cursor:onClick ? 'pointer' : 'default' }}>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:800, textTransform:'uppercase', letterSpacing:.4, marginBottom:6 }}>{title}</div>
              <div style={{ fontSize:20, color:'var(--text2)', fontWeight:900, fontFamily:'var(--font)', marginBottom:4 }}>{value}</div>
              <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.4 }}>{note}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* â”€â”€ NEARBY ORDERS â”€â”€ */
function NearbyTab({ isOnline, loc, showToast, onAccepted, deliveryRangeKm, orders = [], returns = [], loading = false, onRefresh }) {
  const [accepting, setAccepting] = useState(null)

  const accept = async (id) => {
    setAccepting(id)
    try {
      await api.acceptOrder(id)
      showToast('Order accepted! Head to shop ', 'success')
      await onRefresh?.()
      onAccepted()
    } catch (e) {
      const msg = e.response?.data?.detail || ''
      if (msg.toLowerCase().includes('only rider accounts')) {
        clearRiderSession()
        setAccepting(null)
        showToast('Please sign in with a rider account to accept deliveries', 'error')
        return
      }
      showToast(msg || 'Already taken', 'error')
    }
    setAccepting(null)
  }

  const acceptReturn = async (id) => {
    setAccepting(`return-${id}`)
    try {
      await api.acceptReturnPickup(id)
      showToast('Return pickup accepted', 'success')
      await onRefresh?.()
      onAccepted()
    } catch (e) { showToast(e.response?.data?.detail || 'Already taken', 'error') }
    setAccepting(null)
  }

  if (!isOnline) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ width:64,height:64,borderRadius:16,background:'rgba(248,81,73,.08)',border:'1px solid rgba(248,81,73,.15)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,animation:'float 3s ease-in-out infinite' }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text2)', marginBottom: 8, fontFamily: 'var(--font)' }}>You're Offline</div>
      <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>Go online from the header to start receiving nearby order alerts</div>
    </div>
  )

  return (
    <div>
      <div className="sec-row">
        <div className="section-title">Orders Near You {orders.length > 0 && <span style={{ color: 'var(--green2)', fontWeight: 900 }}>({orders.length})</span>}</div>
        <button onClick={onRefresh} style={{ background: 'none', border: 'none', color: 'var(--green2)', cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font)' }}>Refresh</button>
      </div>

      {loc && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, display: 'flex', gap: 4, alignItems: 'center' }}>
         Showing within {clampRiderRange(deliveryRangeKm)}km of your location
      </div>}

      {!loc?.lat || !loc?.lng ? (
        <div className="empty">
          <div style={{fontWeight:800,fontSize:13,color:"#94a3b8",marginBottom:8}}>Location needed</div>
          <div style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 12 }}>Update rider GPS to load nearby orders inside your delivery range</div>
        </div>
      ) : (
        <>

      {returns.length > 0 && (
        <div style={{marginBottom:18}}>
          <div className="section-title" style={{fontSize:15,marginBottom:10}}>Return Pickup Requests <span style={{ color: 'var(--orange)', fontWeight: 900 }}>({returns.length})</span></div>
          {returns.map((r, i) => (
            <div key={r.id} className="card fade-up" style={{ animationDelay: `${i * 0.06}s`, borderColor:'rgba(247,129,102,.32)', background:'rgba(247,129,102,.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:15, color:'var(--text2)', fontFamily:'var(--font)' }}>Return Pickup Request</div>
                  <div style={{ color:'var(--muted)', fontSize:12, marginTop:3 }}>Order #{r.orderCode} - {r.customerName}</div>
                </div>
                <span className="badge" style={{ background:'rgba(247,129,102,.15)', color:'var(--orange)' }}>RETURN</span>
              </div>
              <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:'10px 12px', marginBottom:12 }}>
                <div style={{ fontWeight:800, fontSize:13, color:'var(--text2)' }}>{r.productDetails?.[0]?.name || 'Fashion item'}</div>
                <div style={{ color:'var(--muted)', fontSize:11, marginTop:4 }}>{r.customerAddress}</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:8 }}>
                  <span style={{ color:'#388bfd', fontSize:11, fontWeight:800 }}>Window: {r.pickupTimeWindow || 'Today'}</span>
                  {r.distanceKm !== null && r.distanceKm !== undefined && <span style={{ color:'#f78166', fontSize:11, fontWeight:800 }}>{r.distanceKm} km away</span>}
                </div>
              </div>
              <button className="btn btn-orange" style={{ width:'100%' }} disabled={accepting===`return-${r.id}`} onClick={() => acceptReturn(r.id)}>
                {accepting===`return-${r.id}` ? 'Accepting...' : 'Accept Return Pickup'}
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="empty">
          <span style={{ fontSize: 32, display: 'inline-block', animation: 'spin 1s linear infinite' }}>Loading</span>
          <div style={{ marginTop: 12 }}>Scanning nearby orders...</div>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty">
          <div style={{fontWeight:800,fontSize:13,color:"#94a3b8",marginBottom:8}}>No orders nearby</div>
          <div style={{ fontWeight: 500, color: 'var(--muted)', fontSize: 12 }}>Stay online - orders refresh every 12 seconds</div>
        </div>
      ) : (
        orders.map((o, i) => (
          <div key={o.id} className="card new-order fade-up" style={{ animationDelay: `${i * 0.07}s` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text2)', marginBottom: 2, fontFamily: 'var(--font)' }}>#{o.orderCode}</div>
<div style={{ color: 'var(--muted)', fontSize: 12 }}>{o.items?.length} item{o.items?.length !== 1 ? 's' : ''} - {o.paymentMethod?.toUpperCase()} - Rs {o.total}</div>
{o.paymentMethod?.toUpperCase()==='COD' && <div style={{ color:'#f59e0b', fontSize:11, fontWeight:800, marginTop:4 }}>Collect cash: Rs {o.codDueAmount||o.total}</div>}
                {o.items?.slice(0, 2).map((item, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>- {item.name}{item.size ? ` (${item.size})` : ''} x{item.qty}</div>
                ))}
                {o.items?.length > 2 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>+{o.items.length - 2} more</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, fontSize: 22, color: '#3fb950', fontFamily: 'var(--font)' }}>+Rs {Math.round(o.total * 0.08)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>your earning</div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: '8px 12px', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 8 }}>
                <div className="r-dot" style={{ background: '#388bfd' }}>P</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text2)' }}>{o.shop?.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{o.shop?.address}</div>
                  {o.shopDistanceKm !== undefined && <div style={{ color: '#388bfd', fontSize: 11, fontWeight: 800, marginTop: 2 }}>{o.shopDistanceKm} km pickup</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div className="r-dot" style={{ background: '#3fb950' }}>D</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text2)' }}>{o.customer?.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{o.deliveryAddress?.substring(0, 55)}{o.deliveryAddress?.length > 55 ? '...' : ''}</div>
                </div>
              </div>
            </div>

            <button className="btn btn-green" style={{ width: '100%' }} disabled={accepting === o.id} onClick={() => accept(o.id)}>
              {accepting === o.id ? 'Accepting...' : 'Accept Delivery'}
            </button>
          </div>
        ))
      )}
        </>
      )}
    </div>
  )
}

/* â”€â”€ ACTIVE DELIVERIES â”€â”€ */
function ActiveTab({ showToast }) {
  const [orders, setOrders] = useState([])
  const [returnPickups, setReturnPickups] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  const load = async () => {
    try {
      const [r, rr] = await Promise.all([api.activeOrders(), api.activeReturns()])
      setOrders(r.data)
      setReturnPickups(rr.data)
    } catch (e) {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  const advance = async (o) => {
    if (o.status === 'PACKING') {
      const otp = window.prompt('Enter the 6-digit pickup OTP shown in the vendor app:')
      if (!otp) return
      setActioning(o.id)
      try {
        await api.verifyPickupOtp(o.id, otp.trim())
        showToast('Pickup confirmed. Order marked as picked up.', 'success')
        load()
      } catch (e) {
        showToast(e.response?.data?.detail || 'Wrong pickup OTP', 'error')
      }
      setActioning(null)
      return
    }
    const next = NEXT[o.status]
    if (!next) return
    setActioning(o.id)
    try {
      await api.advanceStatus(o.id, next)
      showToast(next === 'DELIVERED' ? 'Delivered! Earning added' : 'Status updated', 'success')
      load()
    } catch (e) { showToast('Update failed', 'error') }
    setActioning(null)
  }

  const openMaps = (o) => {
    const dest = o.status === 'PACKING' ? `${o.shop?.lat},${o.shop?.lng}` : `${o.deliveryLat},${o.deliveryLng}`
    if (dest && !dest.includes('null')) window.location.href = `https://maps.google.com/?daddr=${dest}`
    else showToast('No navigation data', 'error')
  }

  const advanceReturn = async (o, pickupStatus) => {
    setActioning(`return-${o.id}`)
    try {
      await api.advanceReturnPickup(o.id, pickupStatus)
      showToast(pickupStatus === 'COMPLETED' ? 'Return pickup completed' : 'Pickup status updated', 'success')
      load()
    } catch (e) { showToast('Update failed', 'error') }
    setActioning(null)
  }

  return (
    <div>
      <div className="sec-row">
        <div className="section-title">My Deliveries {orders.length > 0 && <span style={{ color: '#f97316' }}>({orders.length})</span>}</div>
        <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--green2)', cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'var(--font)' }}>Refresh</button>
      </div>

      {loading ? (
        <div className="empty"><span style={{ fontSize: 28 }}>Loading</span></div>
      ) : orders.length === 0 && returnPickups.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">RIDER</span>
          <div style={{ fontWeight: 800, color: 'var(--text2)', marginBottom: 6, fontFamily: 'var(--font)' }}>No active deliveries</div>
          <div style={{ fontSize: 13 }}>Accept orders from the Nearby tab</div>
        </div>
      ) : (
        <>
        {returnPickups.map((o, i) => (
          <div key={`return-${o.id}`} className="card fade-up" style={{ animationDelay: `${i * 0.06}s`, borderColor:'rgba(247,129,102,.36)', background:'rgba(247,129,102,.04)' }}>
            <div className="mobile-stack" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:10 }}>
              <div>
                <div style={{ fontWeight:900, fontSize:15, color:'var(--text2)', fontFamily:'var(--font)' }}>Return Pickup #{o.orderCode}</div>
                <div style={{ color:'var(--muted)', fontSize:12, marginTop:2 }}>{o.customerName} - {o.productDetails?.length || 0} item(s)</div>
              </div>
              <span className="badge" style={{ background:'rgba(247,129,102,.15)', color:'var(--orange)' }}>{o.pickupStatus}</span>
            </div>
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:'10px 12px', marginBottom:12 }}>
              <div style={{ fontWeight:700, fontSize:12, color:'var(--text2)' }}>{o.customerAddress}</div>
              <div style={{ color:'var(--muted)', fontSize:11, marginTop:3 }}>Window: {o.pickupTimeWindow || 'Today'}</div>
            </div>
            <div className="mobile-stack" style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => o.customerLat && (window.location.href = `https://maps.google.com/?q=${o.customerLat},${o.customerLng}`)}>Navigate</button>
              {o.pickupStatus !== 'COMPLETED' && (
                <button className="btn btn-orange" style={{ flex:1 }} disabled={actioning===`return-${o.id}`} onClick={() => advanceReturn(o, o.pickupStatus === 'RIDER_ACCEPTED' ? 'NAVIGATING' : o.pickupStatus === 'NAVIGATING' ? 'PICKED_UP' : 'COMPLETED')}>
                  {actioning===`return-${o.id}` ? 'Updating...' : o.pickupStatus === 'RIDER_ACCEPTED' ? 'Start Pickup' : o.pickupStatus === 'NAVIGATING' ? 'Mark Picked Up' : 'Complete Pickup'}
                </button>
              )}
            </div>
          </div>
        ))}
        {orders.map((o, i) => (
          <div key={o.id} className="card active-order fade-up" style={{ animationDelay: `${i * 0.07}s`, borderColor: `${S_COLOR[o.status]}40` }}>
            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap:10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--text2)', fontFamily: 'var(--font)' }}>#{o.orderCode}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{o.items?.length} items - Rs {o.total}</div>
              </div>
              <span className="badge" style={{ background: `${S_COLOR[o.status]}15`, color: S_COLOR[o.status] }}>{S_LABEL[o.status]}</span>
            </div>

            <button className="btn btn-ghost" style={{ width:'100%', marginBottom:12, padding:'10px 12px', fontSize:12 }} onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}>
              {expandedOrderId === o.id ? 'Hide delivery details' : 'Show delivery details'}
            </button>

            {expandedOrderId === o.id && <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: o.status === 'PACKING' ? 'var(--text2)' : 'var(--muted)' }}>{o.shop?.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 1 }}>{o.shop?.address?.substring(0, 50)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {o.shop?.phone && <a href={`tel:${o.shop.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#388bfd', fontSize: 11, textDecoration: 'none', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(56,139,253,.1)' }}>Call Shop</a>}
                  {o.shop?.lat && <button onClick={() => { window.location.href = `https://maps.google.com/?q=${o.shop.lat},${o.shop.lng}` }} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#388bfd', fontSize: 11, textDecoration: 'none', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(56,139,253,.1)', border:'none', cursor:'pointer' }}>Map</button>}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: o.status === 'OUT_FOR_DELIVERY' ? 'var(--text2)' : 'var(--muted)' }}>{o.customer?.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 1 }}>{o.deliveryAddress}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {o.customer?.phone && <a href={`tel:${o.customer.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#3fb950', fontSize: 11, textDecoration: 'none', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(63,185,80,.1)' }}>Call Customer</a>}
                  {o.deliveryLat && <button onClick={() => { window.location.href = `https://maps.google.com/?q=${o.deliveryLat},${o.deliveryLng}` }} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f0883e', fontSize: 11, textDecoration: 'none', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(240,136,62,.1)', border:'none', cursor:'pointer' }}>Dest Map</button>}
                </div>
              </div>
            </div>}

            <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
                <div style={{ fontWeight: 900, fontSize: 17, color: '#3fb950', fontFamily: 'var(--font)' }}>
                  +Rs {o.riderEarning || Math.round(o.total * 0.08)} <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>earning</span>
                </div>
{o.placedAt && <DeliveryCountdownSync placedAt={o.placedAt} deadline={o.deliveryDeadline||o.countdown?.deadline} serverNow={o.countdown?.serverNow} compact={true} />}
              </div>
            </div>

            {/* Order notes */}
            {o.notes && (
              <div style={{ background: 'rgba(249,115,22,.1)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12, color: '#f97316', fontWeight: 600 }}>
                Note: {o.notes}
              </div>
            )}
            <div className="mobile-stack" style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => openMaps(o)}>
                <Ic.Nav width="16" height="16" /> Navigate
              </button>
              {o.status === 'OUT_FOR_DELIVERY' ? (
                <button className="btn btn-green" style={{ flex: 2, fontSize: 13 }}
                  onClick={() => {
                    const otp = window.prompt('Enter the 6-digit OTP from the customer:')
                    if (!otp) return
                    setActioning(o.id)
                    api.confirmDeliveryOtp(o.id, otp.trim())
                      .then(() => { showToast('Delivery confirmed!', 'success'); load() })
                      .catch(e => showToast(e.response?.data?.detail || 'Wrong OTP', 'error'))
                      .finally(() => setActioning(null))
                  }} disabled={actioning === o.id}>
                  {actioning === o.id ? 'Loading...' : 'Confirm Delivery'}
                </button>
              ) : (o.status === 'PACKING' || NEXT[o.status]) ? (
                <button className="btn btn-green" style={{ flex: 2, fontSize: 13 }} disabled={actioning === o.id} onClick={() => advance(o)}>
                  {actioning === o.id ? 'Loading...' : NEXT_LABEL[o.status]}
                </button>
              ) : null}
            </div>
          </div>
        ))}
        </>
      )}
    </div>
  )
}

/* â”€â”€ EARNINGS TAB â”€â”€ */
function EarningsTab() {
  const [perf, setPerf] = useState(null)
  useEffect(() => { api.performance().then(r => setPerf(r.data)).catch(() => {}) }, [])
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [view, setView] = useState('stats')
  const [selectedHistory, setSelectedHistory] = useState(null)

  useEffect(() => {
    api.earnings().then(r => setData(r.data)).catch(() => {})
    api.history().then(r => setHistory(r.data)).catch(() => {})
  }, [])

  return (
    <div>
      <div className="earn-hero fade-up">
        <div className="mobile-stack" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, gap:8 }}>
          <div style={{ color: 'rgba(63,185,80,.5)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Monthly Earnings</div>
          <RiderPointsBadge points={data?.points || 0} />
        </div>
        <div className="earn-month-amount">Rs {data?.month?.earned || 0}</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{data?.month?.trips || 0} deliveries completed</div>
        <div style={{ marginTop: 16, height: 1, background: 'rgba(63,185,80,.15)' }} />
        <div className="mobile-stack" style={{ marginTop: 14, display: 'flex', gap: 24 }}>
          {[{l:'Today',d:data?.today},{l:'This Week',d:data?.week}].map(({l,d})=>(
            <div key={l}>
              <div className="earn-sub-amount">Rs {d?.earned || 0}</div>
              <div style={{ color: 'var(--muted)', fontSize: 11 }}>{l} - {d?.trips || 0} trips</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['stats', 'history'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: `1.5px solid ${view === v ? 'var(--green2)' : 'var(--border)'}`, background: view === v ? 'rgba(63,185,80,.08)' : 'none', color: view === v ? '#3fb950' : 'var(--muted)', fontFamily: 'var(--font)', fontWeight: 800, fontSize: 12, cursor: 'pointer', transition: '.2s' }}>
            {v === 'stats' ? 'Stats' : 'History'}
          </button>
        ))}
      </div>

      {/* Points rewards info */}
      <div style={{background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:14,padding:'14px 16px',marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:13,color:'#f59e0b',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Rewards Points
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          {[{l:'On-time',p:'+50 pts'},{l:'Under 30min',p:'+100 pts'},{l:'5-star rating',p:'+75 pts'}].map(({l,p})=>(
            <div key={l} style={{background:'rgba(245,158,11,.08)',borderRadius:8,padding:'8px',textAlign:'center'}}>
              <div style={{fontWeight:800,color:'#f59e0b',fontSize:13}}>{p}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {view === 'stats' ? (
        <div className="card fade-up">
          <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--text2)', marginBottom: 14, fontFamily: 'var(--font)' }}>All Time Performance</div>
          {[
            {k:'Total Earned',    v:`Rs ${data?.allTime?.earned || 0}`},
            {k:'Total KM',        v:`${data?.allTime?.totalKm || 0} km`},
            {k:'Total Deliveries',v:`${data?.allTime?.trips || 0} trips`},
            {k:'Avg per Delivery',v:`Rs ${data?.allTime?.trips ? Math.round((data.allTime.earned || 0) / data.allTime.trips) : 0}`},
            {k:'Pay Model',       v:'Rs 20 base + Rs 8 per km'},
          ].map(({k,v}) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(48,54,61,.5)', fontSize: 14 }}>
              <span style={{ color: 'var(--muted)' }}>{k}</span>
              <span style={{ fontWeight: 800, color: 'var(--text2)' }}>{v}</span>
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="empty"><span className="empty-icon"></span><div>No history yet</div></div>
      ) : (
        <div className="card fade-up">
          {history.map((d, i) => (
            <button key={d.id} className="history-item" onClick={() => setSelectedHistory(selectedHistory?.id === d.id ? null : d)} style={{ width:'100%', background:'transparent', border:'none', textAlign:'left', cursor:'pointer' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(63,185,80,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>RIDER</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font)' }}>#{d.orderCode}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.shopName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, color: '#3fb950', fontSize: 15, fontFamily: 'var(--font)' }}>+Rs {d.earning}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>Rs {d.total} order</div>
              </div>
            </button>
          ))}
          {selectedHistory && (
            <div style={{ marginTop:14, padding:'14px', borderRadius:14, background:'#f7fbff', border:'1px solid var(--border)' }}>
              <div style={{ fontWeight:900, fontSize:14, color:'var(--text2)', marginBottom:10, fontFamily:'var(--font)' }}>Order #{selectedHistory.orderCode} details</div>
              {[
                ['Customer', selectedHistory.customerName || 'Customer not available'],
                ['Phone', selectedHistory.customerPhone || 'Phone not available'],
                ['Order Price', `Rs ${selectedHistory.total || 0}`],
                ['Delivery Charges', `Rs ${selectedHistory.deliveryCharge || 0}`],
              ].map(([label, value]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'8px 0', borderBottom:'1px solid rgba(207,230,251,.7)', fontSize:12 }}>
                  <span style={{ color:'var(--muted)' }}>{label}</span>
                  <span style={{ color:'var(--text2)', fontWeight:800, textAlign:'right' }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* â”€â”€ PROFILE TAB â”€â”€ */

/* â”€â”€ RIDER PAYMENT FORM â”€â”€ */
function RiderPaymentForm({ user, onSave }) {
  const [mode, setMode] = useState(user?.paymentMethod || 'upi')
  const [upi, setUpi] = useState(user?.upiId || '')
  const [bank, setBank] = useState(user?.bankAccount || '')
  const [ifsc, setIfsc] = useState(user?.bankIfsc || '')
  const [bname, setBname] = useState(user?.bankName || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await onSave({ paymentMethod: mode, upiId: upi, bankAccount: bank, bankIfsc: ifsc, bankName: bname })
    setSaving(false)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',gap:8}}>
        {[{v:'upi',l:'UPI / PhonePe'},{v:'bank',l:'Bank Account'}].map(({v,l})=>(
          <div key={v} onClick={()=>setMode(v)} style={{flex:1,padding:'10px',borderRadius:10,border:`1.5px solid ${mode===v?'var(--green2)':'var(--border)'}`,background:mode===v?'rgba(63,185,80,.08)':'var(--surface)',cursor:'pointer',textAlign:'center',fontSize:12,fontWeight:800,color:mode===v?'var(--green2)':'var(--muted)',transition:'.2s'}}>
            {l}
          </div>
        ))}
      </div>
      {mode==='upi' ? (
        <div>
          <label className="label">UPI ID / PhonePe</label>
          <input className="input" placeholder="9876543210@upi or name@phonepe" value={upi} onChange={e=>setUpi(e.target.value)}/>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:5}}>Delivery earnings will be sent to this UPI after each trip</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div><label className="label">Account Holder Name</label><input className="input" placeholder="Name as on bank" value={bname} onChange={e=>setBname(e.target.value)}/></div>
          <div><label className="label">Account Number</label><input className="input" placeholder="Bank account number" value={bank} onChange={e=>setBank(e.target.value)}/></div>
          <div><label className="label">IFSC Code</label><input className="input" placeholder="e.g. SBIN0001234" value={ifsc} onChange={e=>setIfsc(e.target.value)}/></div>
        </div>
      )}
      <button className="btn btn-green" style={{alignSelf:'flex-start',padding:'9px 20px',fontSize:13}} onClick={save} disabled={saving}>
        {saving?'Saving...':'Save Details'}
      </button>
    </div>
  )
}

function ProfileTab({ user, isOnline, onToggleOnline, loc, onLocUpdate, onSignOut, onShowToast }) {
  const [showMapUpdate, setShowMapUpdate] = useState(false)

  return (
    <div>
      <div className="card fade-up" style={{ background: 'linear-gradient(135deg,#e4f3ff,#f7fcff)', border: '1px solid rgba(74,168,255,.28)', marginBottom: 14 }}>
        <div className="mobile-stack" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,#69bbff,#4aa8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, color: '#fff', fontFamily: 'var(--font)' }}>{user.name[0]}</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--text2)', fontFamily: 'var(--font)' }}>{user.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{user.email}</div>
            {user.phone && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{user.phone}</div>}
          </div>
        </div>
        <span className="badge" style={{ background: 'rgba(74,168,255,.12)', color: 'var(--green2)', padding: '6px 14px', fontSize: 12 }}>RIDER Delivery Partner</span>
      </div>

      <div className="toggle-row fade-up" style={{ animationDelay: '.06s' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text2)', marginBottom: 2, fontFamily: 'var(--font)' }}>Online Status</div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{isOnline ? 'You appear in nearby order alerts' : 'Go online to receive orders'}</div>
        </div>
        <button className={`toggle ${isOnline ? 'on' : 'off'}`} onClick={onToggleOnline} />
      </div>

      {/* â”€â”€ LOCATION SECTION â”€â”€ */}
      <div className="card fade-up" style={{ animationDelay: '.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Ic.Loc width="18" height="18" />
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text2)', fontFamily: 'var(--font)' }}>My Location</div>
        </div>
        <div style={{ marginBottom: 12, padding:'12px 14px', borderRadius:14, background:'#f7fbff', border:'1px solid var(--border)' }}>
          {loc ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 700, marginBottom: 2 }}>Current coordinates</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</div>
              <a href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, color: '#388bfd', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                View on map
              </a>
            </>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Location not set. Update it to receive better nearby matches.</div>
          )}
        </div>

        <div className="mobile-stack" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={onLocUpdate}>
            Quick GPS
          </button>
          <button className="btn btn-purple" style={{ flex: 2, fontSize: 12 }} onClick={() => setShowMapUpdate(true)}>
            <Ic.Map width="16" height="16" /> Update on Map
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
          Tip: Update location when going online for accurate delivery matching
        </div>
      </div>

      <div className="card fade-up" style={{ animationDelay: '.14s' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text2)', marginBottom: 12, fontFamily: 'var(--font)' }}>Rider Support</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { title:'Payout Mode', value:user?.paymentMethod === 'bank' ? 'Bank account' : 'UPI active' },
            { title:'Trip Status', value:isOnline ? 'Receiving orders' : 'Go online' },
            { title:'Location', value:loc ? 'Synced' : 'Needs update' },
            { title:'Help', value:'Call support if stuck' },
          ].map((item) => (
            <div key={item.title} style={{ padding:'12px', border:'1px solid var(--border)', borderRadius:14, background:'#f9fcff' }}>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:800, textTransform:'uppercase', marginBottom:6 }}>{item.title}</div>
              <div style={{ fontSize:13, color:'var(--text2)', fontWeight:800 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Details */}
      <div className="card fade-up" style={{ animationDelay: '.16s', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text2)', marginBottom: 14, fontFamily: 'var(--font)' }}>Payment Details</div>
        <RiderPaymentForm user={user} onSave={async(d)=>{try{await api.updatePayment(d);onShowToast('Payment details saved','success')}catch(e){onShowToast('Save failed','error')}}}/>
      </div>
      <button className="btn fade-up" style={{ width: '100%', background: 'rgba(248,81,73,.08)', color: '#f85149', border: '1.5px solid rgba(248,81,73,.2)', marginTop: 4, animationDelay: '.18s', padding:'12px 16px', fontSize:13 }} onClick={onSignOut}>
        <span style={{ display:'inline-flex', width:18, height:18 }}><Ic.Out /></span> Sign Out
      </button>

      {showMapUpdate && (
        <MapLocationModal
          currentLat={loc?.lat ?? getStoredRiderLocation()?.lat}
          currentLng={loc?.lng ?? getStoredRiderLocation()?.lng}
          onSave={(coords, address) => {
            setShowMapUpdate(false)
            onLocUpdate(coords)
          }}
          onClose={() => setShowMapUpdate(false)}
        />
      )}
    </div>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   APP ROOT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('home')
  const [isOnline, setIsOnline] = useState(false)
  const [loc, setLoc] = useState(null)
  const [deliveryRangeKm, setDeliveryRangeKm] = useState(() => clampRiderRange(localStorage.getItem(RIDER_DELIVERY_RANGE_KEY) || 10))
  const [toast, setToast] = useState(null)
  const [activeCount, setActiveCount] = useState(0)
  const [nearbyCount, setNearbyCount] = useState(0)
  const [nearbyOrders, setNearbyOrders] = useState([])
  const [nearbyReturns, setNearbyReturns] = useState([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const toastTimer = useRef(null)

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const getLocation = async () => {
    try {
      const gps = await getCurrentGpsLocation()
      return { lat: gps.lat, lng: gps.lng }
    } catch (err) {
      return { error: err?.message || 'Unable to detect current location.' }
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('rdr_access')
    if (!token && !isRiderDemoMode()) { setLoading(false); return }
    api.me().then(r => {
      if (r.data?.role !== 'RIDER') {
        clearRiderSession()
        setUser(null)
        setIsOnline(false)
        setLoc(null)
        return
      }
      setUser(r.data)
      setIsOnline(r.data.isOnline || false)
      if (r.data?.lat != null && r.data?.lng != null) {
        const saved = { lat: Number(r.data.lat), lng: Number(r.data.lng) }
        setLoc(saved)
        saveStoredRiderLocation(saved)
      }
    }).catch(() => { clearRiderSession() }).finally(() => setLoading(false))
    getLocation().then(l => {
      if (l?.lat != null && l?.lng != null) {
        const saved = { lat: l.lat, lng: l.lng }
        setLoc(saved)
        saveStoredRiderLocation(saved)
      }
    })
  }, [])

  useEffect(() => {
    try { localStorage.setItem(RIDER_DELIVERY_RANGE_KEY, String(clampRiderRange(deliveryRangeKm))) } catch {}
  }, [deliveryRangeKm])

  const refreshNearby = useCallback(async () => {
    if (!user || !isOnline || !loc?.lat || !loc?.lng) {
      setNearbyOrders([])
      setNearbyReturns([])
      setNearbyCount(0)
      if (user) {
        const ac = await api.activeOrders().catch(() => ({ data: [] }))
        setActiveCount(normalizeApiList(ac?.data).length)
      }
      return
    }
    setNearbyLoading(true)
    try {
      const params = { lat: loc.lat, lng: loc.lng, radius: clampRiderRange(deliveryRangeKm) }
      const [av, ar, ac] = await Promise.all([
        api.availableOrders(params).catch(() => ({ data: [] })),
        api.availableReturns(params).catch(() => ({ data: [] })),
        api.activeOrders().catch(() => ({ data: [] })),
      ])
      const nextOrders = normalizeApiList(av?.data)
      const nextReturns = normalizeApiList(ar?.data)
      setNearbyOrders(nextOrders)
      setNearbyReturns(nextReturns)
      setNearbyCount(nextOrders.length + nextReturns.length)
      setActiveCount(normalizeApiList(ac?.data).length)
    } catch (e) {
      setNearbyOrders([])
      setNearbyReturns([])
      setNearbyCount(0)
    } finally {
      setNearbyLoading(false)
    }
  }, [user, isOnline, loc, deliveryRangeKm])

  useEffect(() => {
    if (!user) return
    refreshNearby()
    if (isOnline) { const t = setInterval(refreshNearby, 12000); return () => clearInterval(t) }
  }, [user, isOnline, refreshNearby])

  const toggleOnline = async () => {
    const next = !isOnline
    try {
      await api.setStatus({ isOnline: next })
      setIsOnline(next)
      if (next) {
        const l = await getLocation()
        if (l?.lat != null && l?.lng != null) {
          const saved = { lat: l.lat, lng: l.lng }
          setLoc(saved)
          saveStoredRiderLocation(saved)
          await api.updateLocation(saved)
          showToast('You are now online', 'success')
        } else {
          showToast(l?.error || 'Online enabled. Update location to get nearby orders.', 'info')
        }
      } else {
        showToast('You are now offline', 'info')
      }
    } catch (e) { showToast('Failed to update status', 'error') }
  }

  const updateLoc = async (coords) => {
    let l = coords
    if (!l) l = await getLocation()
    if (l?.lat != null && l?.lng != null) {
      const saved = { lat: l.lat, lng: l.lng }
      setLoc(saved)
      saveStoredRiderLocation(saved)
      try { await api.updateLocation(saved); showToast('Location updated', 'success') }
      catch (e) { showToast('Could not sync location', 'error') }
    } else { showToast(l?.error || 'Unable to detect current location.', 'error') }
  }

  const handleSignOut = async () => {
    try { await api.logout() } catch (e) {}
    localStorage.removeItem('rdr_access'); localStorage.removeItem('rdr_refresh')
    localStorage.removeItem(DEMO_RIDER_MODE_KEY)
    setUser(null); setIsOnline(false)
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)', flexDirection: 'column', gap: 14 }}>
      <style>{CSS}</style>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--green2)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: 'var(--muted)', fontWeight: 700 }}>Loading DOTT Rider...</div>
    </div>
  )

  if (!user) return <><style>{CSS}</style><AuthPage onSuccess={u => { setUser(u); setIsOnline(u.isOnline || false); if (u?.lat && u?.lng) setLoc({ lat: u.lat, lng: u.lng }) }} /></>

  const TABS = [
    { id: 'home', label: 'Home', Icon: Ic.Home },
    { id: 'nearby', label: 'Nearby', Icon: Ic.Nearby, count: isOnline ? nearbyCount : 0 },
    { id: 'active', label: 'Active', Icon: Ic.Active, count: activeCount },
    { id: 'earnings', label: 'Earnings', Icon: Ic.Earn },
    { id: 'profile', label: 'Profile', Icon: Ic.Me },
  ]

  return (
    <>
      <style>{CSS}</style>
      <header className="header">
        <div className="logo">DOTT <span className="hi">Rider</span></div>
        <div className="header-meta">
          <button className={`online-btn ${isOnline ? 'on' : 'off'}`} onClick={toggleOnline}>
            <span className={`live-dot ${isOnline ? 'on' : 'off'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </button>
        </div>
      </header>

      {!isOnline && tab !== 'profile' && tab !== 'earnings' && (
        <div className="offline-banner">You're offline - go online to receive orders</div>
      )}

      <main className="content">
        {tab === 'home' && <HomeTab user={user} isOnline={isOnline} loc={loc} nearbyCount={nearbyCount} onOpenActive={() => setTab('active')} onOpenProfile={() => setTab('profile')} onOpenNearby={() => setTab('nearby')} onShowToast={showToast} deliveryRangeKm={deliveryRangeKm} onRangeChange={setDeliveryRangeKm} />}
        {tab === 'nearby' && <NearbyTab isOnline={isOnline} loc={loc} showToast={showToast} onAccepted={() => setTab('active')} deliveryRangeKm={deliveryRangeKm} orders={nearbyOrders} returns={nearbyReturns} loading={nearbyLoading} onRefresh={refreshNearby} />}
        {tab === 'active' && <ActiveTab showToast={showToast} />}
        {tab === 'earnings' && <EarningsTab />}
        {tab === 'profile' && <ProfileTab user={user} isOnline={isOnline} onToggleOnline={toggleOnline} loc={loc} onLocUpdate={updateLoc} onSignOut={handleSignOut} onShowToast={showToast} />}
      </main>

      <nav className="bottom-nav">
        {TABS.map(({ id, label, Icon, count }) => (
          <button key={id} className={`nav-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Icon />
              {count > 0 && <span className="nav-pill">{count}</span>}
            </div>
            {label}
          </button>
        ))}
      </nav>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </>
  )
}


