# 🛍 DOTT — On-Demand Fashion Marketplace
## Full Stack Setup Guide

---

## WHAT'S INSIDE

```
Dott/
├── backend/          ← Python FastAPI server (port 8080)
├── customer/         ← Customer shopping app  (port 3001)
├── vendor/           ← Vendor management app  (port 3002)
├── rider/            ← Rider delivery app     (port 3003)
├── admin/            ← Admin control panel    (port 3004)
```

---

## QUICK START (5 terminals)

### Terminal 1 — Backend API
```bash
cd Dott/backend
pip install fastapi uvicorn sqlalchemy python-jose passlib[bcrypt] python-multipart aiofiles
python main.py
# OR: uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```
API runs at: http://localhost:8080
API docs at: http://localhost:8080/docs

### Terminal 2 — Customer App
```bash
cd Dott/customer
npm install
npm run dev
# Opens at: http://localhost:3001
```

### Terminal 3 — Vendor App
```bash
cd Dott/vendor
npm install
npm run dev
# Opens at: http://localhost:3002
```

### Terminal 4 — Rider App
```bash
cd Dott/rider
npm install
npm run dev
# Opens at: http://localhost:3003
```

### Terminal 5 — Admin Panel
```bash
cd Dott/admin
npm install
npm run dev
# Opens at: http://localhost:3004
```

---

## DEMO ACCOUNTS (password: password123)

| Role     | Email                  | Notes                    |
|----------|------------------------|--------------------------|
| Customer | arjun@example.com      | Has order history        |
| Vendor   | rahul@dott.in          | Shop: Rahul Fashion      |
| Vendor   | suresh@dott.in         | Shop: Suresh Textiles    |
| Rider    | ramesh@dott.in         | Active rider             |
| Rider    | venkat@dott.in         | Active rider             |
| Admin    | admin@dott.in          | Full access              |

**Phone login (OTP):** 9876543210 → PIN: 1234
All demo accounts skip OTP verification (is_verified=True)

**Dev OTP:** When registering new accounts, the OTP is printed
to the backend console AND returned in the API response as `dev_otp`

---

## FEATURES BUILT (98% complete)

### Customer App
- Amazon-style nav with live search suggestions
- 12-category filter bar
- Auto-advancing banner carousel
- Product cards with colour swatch dots
- Product detail: image zoom, colour variants, size grid
- Rating breakdown bar chart + write review
- Wishlist (heart button on all products)
- Smart search page with 4 filter dropdowns
- 3-step checkout wizard
- Address book (save multiple delivery addresses)
- Promo code validation
- Min-order warning in cart
- Order tracking with live step progression
- Order cancellation with reason
- Rider rating after delivery
- Real-time status polling every 20s
- Referral & Earn page (copy code, apply friend's code)
- Reseller earn section
- Recently viewed products (localStorage)
- Share product via Web Share API

### Vendor App
- AI product analyze from camera (Claude API)
- Camera capture + image enhancement
- 15 preset colour swatches + custom colour picker
- Per-colour photo upload
- Clone / duplicate product
- Dashboard with live order stats
- Earnings page with net revenue + payout
- Low-stock alerts panel
- Orders: accept / reject / status update
- Returns management
- Analytics with revenue charts
- Shop settings with map pin

### Rider App
- Toggle online / offline
- Nearby available orders
- Delivery OTP confirmation (enter customer OTP)
- Customer & shop call links
- Order notes visible to rider
- Google Maps navigation link
- Earnings with km breakdown
- Performance stats (rating, on-time %)

### Admin Panel
- Dashboard with live stats
- Orders, Users, Shops, Riders management
- Revenue analytics with 7-day chart
- Returns management
- Block users / suspend shops

### Backend API (91 endpoints)
- JWT auth + OTP + rate limiting
- Distance-based delivery fees
- Promo code create + validate
- Wishlist, referral, points system
- Saved address book
- Delivery OTP generate + verify
- Rider performance + customer ratings
- Vendor earnings + low-stock alerts
- Admin CSV export (orders + users)
- Admin commission settings
- Admin vendor verification

---

## FOR PRODUCTION

1. **Payment Gateway:** Sign up at razorpay.com, add API key to backend
2. **Real SMS OTP:** Sign up at msg91.com or twilio.com, replace console OTP
3. **Database:** Switch SQLite → PostgreSQL in database.py
4. **Secrets:** Move SECRET_KEY from auth.py to environment variables
5. **Remove dev_otp** from the OTP send response in main.py

---

## TECH STACK

- **Backend:** Python 3.10+, FastAPI, SQLAlchemy, SQLite, JWT
- **Frontend:** React 18, Vite, Axios
- **Maps:** Leaflet.js (OpenStreetMap)
- **AI:** Anthropic Claude API (vendor product analyze)
- **Fonts:** Plus Jakarta Sans, Outfit

