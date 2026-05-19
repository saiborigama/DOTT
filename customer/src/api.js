import axios from 'axios'

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const ax = axios.create({ baseURL: BASE })
const clearAuthTokens = () => {
  localStorage.removeItem('dott_access')
  localStorage.removeItem('dott_refresh')
}

ax.interceptors.request.use(cfg => {
  const t = localStorage.getItem('dott_access')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
ax.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401) {
    const rt = localStorage.getItem('dott_refresh')
    if (rt) {
      try {
        const r = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rt })
        localStorage.setItem('dott_access', r.data.accessToken)
        localStorage.setItem('dott_refresh', r.data.refreshToken)
        err.config.headers.Authorization = `Bearer ${r.data.accessToken}`
        return ax(err.config)
      } catch { clearAuthTokens() }
    }
  }
  return Promise.reject(err)
})

export const setTokens = (a, r) => { localStorage.setItem('dott_access', a); localStorage.setItem('dott_refresh', r) }
export const clearTokens = clearAuthTokens
export const hasToken = () => !!localStorage.getItem('dott_access')

export const api = {
  // Auth
  sendOtp:        email => ax.post('/otp/send', { email }),
  verifyOtp:      (email, otp, extra = {}) => ax.post('/otp/verify', { email, otp, ...extra }),
  register:       d => ax.post('/auth/register', d),
  login:          d => ax.post('/auth/login', d),
  logout:         () => ax.post('/auth/logout'),
  me:             () => ax.get('/auth/me'),
  updateLocation: d => ax.put('/auth/location', d),
  totpSetup:      () => ax.post('/auth/totp/setup'),
  totpEnable:     code => ax.post('/auth/totp/enable', { code }),
  totpDisable:    code => ax.post('/auth/totp/disable', { code }),
  registerPush:   token => ax.post('/notifications/register', { token }),
  testPush:       (title, body, data = null) => ax.post('/notifications/test', { title, body, data }),

  // Shops & Products
  getShops:          p => ax.get('/shops', { params: p }),
  getProducts:       p => ax.get('/products', { params: p }),
  getProductReviews: id => ax.get(`/reviews/product/${id}`),
  search:            p => ax.get('/search', { params: p }),
  searchByImage:     ({ file, lat, lng, radius = 20, category = '', limit = 12 }) => {
    const fd = new FormData()
    fd.append('file', file)
    if (lat !== undefined && lat !== null) fd.append('lat', String(lat))
    if (lng !== undefined && lng !== null) fd.append('lng', String(lng))
    if (radius !== undefined && radius !== null) fd.append('radius', String(radius))
    if (category) fd.append('category', category)
    fd.append('limit', String(limit))
    return ax.post('/search/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadImage:       file => {
    const fd = new FormData()
    fd.append('file', file)
    return ax.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  shareProduct:      id => ax.get(`/products/${id}/share`),

  // Orders
  placeOrder:     d => ax.post('/orders', d),
  myOrders:       () => ax.get('/orders/my'),
  cancelOrder:    (id, reason) => ax.put(`/orders/${id}/cancel/v2`, { reason }),
  trackOrder:     id => ax.get(`/orders/${id}/track`),
  riderLocation:  id => ax.get(`/orders/${id}/rider-location`),
  pollStatus:     id => ax.get(`/orders/${id}/status`),
  getDeliveryFee: (shopLat, shopLng, custLat, custLng, subtotal = 0, isPremium = false, weather = null) =>
    ax.get('/delivery-fee', { params: { shopLat, shopLng, custLat, custLng, subtotal, isPremium, weather } }),
  pricingPreview: (shopId, subtotal, custLat, custLng, weather = null, maxRadiusKm = null) =>
    ax.get('/orders/pricing-preview', { params: { shopId, subtotal, custLat, custLng, weather, maxRadiusKm } }),
  genDeliveryOtp: id => ax.post(`/orders/${id}/delivery-otp/generate`),
  rateRider:      (id, rating) => ax.post(`/orders/${id}/rate-rider`, { rating }),

  // Reviews
  addReview:     d => ax.post('/reviews', d),
  previewReturn: d => ax.post('/returns/preview', d),
  requestReturn: d => ax.post('/returns', d),
  myReturns:     () => ax.get('/returns/my'),

  // Wishlist
  getWishlist:    () => ax.get('/wishlist'),
  getWishlistIds: () => ax.get('/wishlist/ids'),
  toggleWishlist: id => ax.post(`/wishlist/${id}`),

  // Referral & Points
  getMyReferral: () => ax.get('/referral/my'),
  applyReferral: code => ax.post('/referral/apply', { code }),
  getPoints:     () => ax.get('/points'),

  // Promo
  validatePromo: (code, total) => ax.get(`/promo/${code}`, { params: { orderTotal: total } }),

  // Saved Addresses
  getAddresses: () => ax.get('/addresses'),
  addAddress:   d => ax.post('/addresses', d),
  delAddress:   id => ax.delete(`/addresses/${id}`),

  // Reseller
  getResellerProducts: () => ax.get('/reseller/products'),
}

export default ax
