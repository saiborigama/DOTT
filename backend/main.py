import os, time, math, json, random, urllib.parse, urllib.request, urllib.error, mimetypes, base64, io, hashlib, contextlib
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
import httpx
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text, inspect
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, UTC
from collections import Counter, defaultdict
from pathlib import Path

try:
    import numpy as np
except Exception:
    np = None

try:
    from PIL import Image, ImageFilter, ImageOps, ImageEnhance, ImageChops
except Exception:
    Image = ImageFilter = ImageOps = ImageEnhance = ImageChops = None

rembg_remove = None
faiss = None
torch = None
CLIPModel = None
CLIPProcessor = None
SimpleCategoryCNN = None
preprocess_pil = None

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
except Exception:
    firebase_admin = None
    credentials = None
    messaging = None

from database import (Base, engine, get_db, User, Shop, Product, Order, OrderItem,
                      Review, ReturnRequest, RefreshToken, OTPStore, SettlementInvoice,
                      SettlementPayment, Notification, ShopLocationChangeRequest,
                      RoleEnum, OrderStatusEnum, ReturnStatusEnum)
from auth import (hash_password, verify_password, create_access_token, create_refresh_token,
                  decode_token, get_current_user)
from config import settings
from seed import seed_db

Base.metadata.create_all(bind=engine)

def utc_now():
    return datetime.now(UTC).replace(tzinfo=None)

def ensure_column(table_name: str, column_name: str, column_sql: str):
    with engine.begin() as conn:
        cols = {col["name"] for col in inspect(conn).get_columns(table_name)}
        if column_name not in cols:
            conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {column_sql}'))

for table_name, column_name, column_sql in [
    ("users", "is_premium", "BOOLEAN DEFAULT 0"),
    ("users", "subscription_plan", "VARCHAR DEFAULT 'standard'"),
    ("users", "returns_this_month", "INTEGER DEFAULT 0"),
    ("users", "high_return_user", "BOOLEAN DEFAULT 0"),
    ("users", "cod_enabled", "BOOLEAN DEFAULT 1"),
    ("users", "totp_secret", "VARCHAR"),
    ("users", "totp_enabled", "BOOLEAN DEFAULT 0"),
    ("users", "fcm_token", "VARCHAR"),
    ("users", "phonepe_number", "VARCHAR"),
    ("users", "gpay_number", "VARCHAR"),
    ("products", "processed_image_url", "VARCHAR"),
    ("products", "visual_embedding", "TEXT"),
    ("products", "visual_embedding_model", "VARCHAR DEFAULT 'fallback-histogram-v1'"),
    ("products", "image_ai_meta", "TEXT DEFAULT '{}'"),
    ("products", "title", "VARCHAR"),
    ("products", "product_type", "VARCHAR"),
    ("products", "color", "VARCHAR"),
    ("products", "gender", "VARCHAR"),
    ("products", "fabric", "VARCHAR"),
    ("products", "pattern", "VARCHAR"),
    ("products", "fit", "VARCHAR"),
    ("products", "occasion", "VARCHAR"),
    ("products", "sleeve_type", "VARCHAR"),
    ("products", "length", "VARCHAR"),
    ("orders", "base_delivery_fee", "FLOAT DEFAULT 20"),
    ("orders", "distance_fee", "FLOAT DEFAULT 0"),
    ("orders", "surge_fee", "FLOAT DEFAULT 0"),
    ("orders", "platform_fee", "FLOAT DEFAULT 10"),
    ("orders", "gst_rate", "FLOAT DEFAULT 0.05"),
    ("orders", "gst_amount", "FLOAT DEFAULT 0"),
    ("orders", "free_delivery_discount", "FLOAT DEFAULT 0"),
    ("orders", "pricing_meta", "TEXT DEFAULT '{}'"),
    ("orders", "try_and_return_eligible", "BOOLEAN DEFAULT 0"),
    ("orders", "return_window_hours", "INTEGER DEFAULT 48"),
    ("orders", "refund_amount", "FLOAT DEFAULT 0"),
    ("orders", "refund_status", "VARCHAR DEFAULT 'NOT_APPLICABLE'"),
    ("orders", "order_start_time", "DATETIME"),
    ("orders", "delivery_deadline", "DATETIME"),
    ("orders", "delivered_time", "DATETIME"),
    ("orders", "is_delayed", "BOOLEAN DEFAULT 0"),
    ("orders", "cod_due_amount", "FLOAT DEFAULT 0"),
    ("orders", "cod_collected", "BOOLEAN DEFAULT 0"),
    ("orders", "countdown_alert_level", "VARCHAR DEFAULT 'NONE'"),
    ("orders", "rider_bonus", "FLOAT DEFAULT 0"),
    ("orders", "rider_penalty", "FLOAT DEFAULT 0"),
    ("orders", "pickup_otp", "VARCHAR"),
    ("orders", "pickup_otp_used", "BOOLEAN DEFAULT 0"),
    ("orders", "pickup_otp_generated_at", "DATETIME"),
    ("orders", "pickup_otp_verified_at", "DATETIME"),
    ("return_requests", "reason_code", "VARCHAR DEFAULT 'OTHER'"),
    ("return_requests", "request_type", "VARCHAR DEFAULT 'refund'"),
    ("return_requests", "evidence_image_url", "VARCHAR"),
    ("return_requests", "policy_decision", "VARCHAR DEFAULT 'UNDER_REVIEW'"),
    ("return_requests", "return_fee", "FLOAT DEFAULT 0"),
    ("return_requests", "refund_amount", "FLOAT DEFAULT 0"),
    ("return_requests", "exchange_allowed", "BOOLEAN DEFAULT 0"),
    ("return_requests", "pickup_status", "VARCHAR DEFAULT 'PENDING'"),
    ("return_requests", "pickup_eta", "VARCHAR"),
    ("return_requests", "pickup_rider_id", "INTEGER"),
    ("return_requests", "pickup_completed_at", "DATETIME"),
    ("return_requests", "processed_at", "DATETIME"),
    ("reviews", "images", "TEXT DEFAULT '[]'"),
    ("settlement_invoices", "product_value", "FLOAT DEFAULT 0"),
    ("settlement_invoices", "delivery_collected", "FLOAT DEFAULT 0"),
    ("settlement_invoices", "rider_earning_amount", "FLOAT DEFAULT 0"),
    ("settlement_invoices", "payout_locked_at", "DATETIME"),
    ("settlement_payments", "payment_method", "VARCHAR DEFAULT 'UPI'"),
    ("settlement_payments", "payment_reference", "VARCHAR DEFAULT ''"),
]:
    ensure_column(table_name, column_name, column_sql)

seed_db()

# ── Static folder for uploaded images ──────────────────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if request.url.path.startswith("/api/auth"):
        response.headers["Cache-Control"] = "no-store"
    return response

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        stale = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)

ws_manager = ConnectionManager()

# ── Distance-based delivery fee calculator ────────────────────────
def haversine(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2): return 0.0
    R = 6371
    dlat = math.radians(lat2 - lat1); dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

BASE_DELIVERY_FEE = 20.0
DISTANCE_FEE_PER_KM = 8.0
FREE_BASE_DISTANCE_KM = 1.0
PLATFORM_FEE = 10.0
FREE_DELIVERY_THRESHOLD = 999.0
NO_RETURN_BELOW = 300.0
MAX_RETURNS_PER_MONTH = 3
MAX_ORDER_DISTANCE_KM = 10.0
MAX_DISCOVERY_RADIUS_KM = 10.0
RIDER_PUSH_RADIUS_KM = 10.0

def get_order_distance_limit(requested_radius_km: Optional[float] = None) -> float:
    if requested_radius_km is None:
        return MAX_ORDER_DISTANCE_KM
    return round(max(1.0, min(float(requested_radius_km), MAX_ORDER_DISTANCE_KM)), 2)

def get_discovery_radius_limit(requested_radius_km: Optional[float] = None) -> float:
    if requested_radius_km is None:
        return MAX_DISCOVERY_RADIUS_KM
    try:
        parsed = float(requested_radius_km)
    except Exception:
        parsed = MAX_DISCOVERY_RADIUS_KM
    return round(max(1.0, min(parsed, MAX_DISCOVERY_RADIUS_KM)), 2)
DELIVERY_PROMISE_MINUTES = 60
RIDER_ON_TIME_BONUS = 20.0
RIDER_DELAY_PENALTY = 10.0

def calc_delivery_fee(km: float) -> float:
    km = max(0.0, float(km or 0.0))
    extra_km = max(0, math.ceil(km) - 1)
    return round(BASE_DELIVERY_FEE + (extra_km * DISTANCE_FEE_PER_KM), 2)

def calc_rider_earning(km: float) -> float:
    """Rider gets base + per-km rate."""
    if km <= 0: return 20.0
    return round(20 + km * 8, 1)   # ₹20 base + ₹8/km

def calc_surge_fee(now: Optional[datetime] = None, weather: Optional[str] = None) -> tuple[float, list[str]]:
    now = now or utc_now()
    reasons = []
    surge = 0.0
    if now.hour in {8, 9, 13, 14, 19, 20, 21}:
        surge += 15.0
        reasons.append("peak_hour")
    if weather and "rain" in weather.lower():
        surge += 15.0
        reasons.append("rain")
    return min(surge, 30.0), reasons

def calc_gst_rate(km: float, subtotal: float) -> float:
    if subtotal >= 2000:
        return 0.18
    if subtotal >= 1200 or km >= 8:
        return 0.12
    return 0.05

def compute_pricing(subtotal: float, km: float, is_premium: bool = False, weather: Optional[str] = None):
    base_fee = BASE_DELIVERY_FEE
    safe_km = max(0.0, float(km or 0.0))
    billable_distance_km = max(0, math.ceil(safe_km) - 1)
    distance_fee = round(billable_distance_km * DISTANCE_FEE_PER_KM, 2)
    raw_delivery = round(base_fee + distance_fee, 2)
    surge_fee, surge_reasons = calc_surge_fee(weather=weather)
    gst_rate = calc_gst_rate(km, subtotal)
    gst_amount = round((raw_delivery + surge_fee) * gst_rate, 2)
    qualifies_free_delivery = is_premium or subtotal >= FREE_DELIVERY_THRESHOLD
    free_delivery_discount = raw_delivery if qualifies_free_delivery else 0.0
    delivery_fee = round(max(0.0, raw_delivery - free_delivery_discount) + surge_fee, 2)
    total = round(subtotal + delivery_fee + PLATFORM_FEE + gst_amount, 2)
    return {
        "subtotal": round(subtotal, 2),
        "km": round(km, 2),
        "baseDeliveryFee": round(base_fee, 2),
        "billableDistanceKm": billable_distance_km,
        "distanceFee": distance_fee,
        "rawDeliveryFee": raw_delivery,
        "surgeFee": round(surge_fee, 2),
        "surgeReasons": surge_reasons,
        "platformFee": round(PLATFORM_FEE, 2),
        "gstRate": gst_rate,
        "gstAmount": gst_amount,
        "freeDeliveryDiscount": round(free_delivery_discount, 2),
        "deliveryFee": delivery_fee,
        "total": total,
        "freeDeliveryApplied": qualifies_free_delivery,
        "pricingLabel": "Premium free delivery" if is_premium else ("Free delivery unlocked" if subtotal >= FREE_DELIVERY_THRESHOLD else "Standard delivery"),
    }

def get_return_reason_profile(reason_code: Optional[str], request_type: Optional[str]):
    code = (reason_code or "OTHER").upper()
    req_type = (request_type or "refund").lower()
    vendor_fault_codes = {"DAMAGED", "WRONG_PRODUCT", "WRONG_SIZE"}
    customer_reason_codes = {"CHANGED_MIND", "DID_NOT_LIKE", "NO_LONGER_NEEDED"}
    is_vendor_fault = code in vendor_fault_codes
    is_size_issue = code in {"WRONG_SIZE", "SIZE_ISSUE"}
    is_customer_reason = code in customer_reason_codes or not is_vendor_fault
    if is_vendor_fault:
        decision = "VENDOR_FAULT"
    elif is_size_issue and req_type == "exchange":
        decision = "FREE_EXCHANGE"
    else:
        decision = "CUSTOMER_RETURN"
    return {
        "reasonCode": code,
        "requestType": req_type,
        "isVendorFault": is_vendor_fault,
        "isSizeIssue": is_size_issue,
        "isCustomerReason": is_customer_reason,
        "decision": decision,
    }

def start_delivery_countdown(order: Order, start_time: Optional[datetime] = None):
    started_at = start_time or utc_now()
    order.order_start_time = started_at
    order.delivery_deadline = started_at + timedelta(minutes=DELIVERY_PROMISE_MINUTES)
    order.countdown_alert_level = "NORMAL"

def get_countdown_alert_level(minutes_left: Optional[float]) -> str:
    if minutes_left is None:
        return "NONE"
    if minutes_left <= 5:
        return "HIGH"
    if minutes_left <= 15:
        return "ELEVATED"
    if minutes_left <= 30:
        return "WATCH"
    return "NORMAL"

def order_timer_snapshot(order: Order, now: Optional[datetime] = None):
    now = now or utc_now()
    start = getattr(order, "order_start_time", None) or getattr(order, "confirmed_at", None)
    deadline = getattr(order, "delivery_deadline", None)
    delivered_time = getattr(order, "delivered_time", None) or getattr(order, "delivered_at", None)
    seconds_left = None
    progress = 0.0
    if deadline:
      seconds_left = int((deadline - now).total_seconds())
    if start and deadline:
      total = max(1, int((deadline - start).total_seconds()))
      elapsed = max(0, int((now - start).total_seconds()))
      progress = min(1.0, elapsed / total)
    minutes_left = None if seconds_left is None else round(seconds_left / 60.0, 1)
    delayed = bool(getattr(order, "is_delayed", False))
    if delivered_time and deadline:
        delayed = delivered_time > deadline
    alert_level = get_countdown_alert_level(minutes_left)
    return {
        "serverNow": now.isoformat(),
        "durationMinutes": DELIVERY_PROMISE_MINUTES,
        "startTime": start.isoformat() if start else None,
        "deadline": deadline.isoformat() if deadline else None,
        "deliveredTime": delivered_time.isoformat() if delivered_time else None,
        "secondsLeft": seconds_left,
        "minutesLeft": minutes_left,
        "progress": round(progress, 4),
        "isDelayed": delayed,
        "alertLevel": alert_level,
        "statusLabel": "Delayed" if delayed else ("Delivered on time" if delivered_time and deadline and delivered_time <= deadline else "On track"),
    }

def finalize_delivery_timing(order: Order):
    now = utc_now()
    order.delivered_at = now
    order.delivered_time = now
    deadline = getattr(order, "delivery_deadline", None)
    is_delayed = bool(deadline and now > deadline)
    order.is_delayed = is_delayed
    if (order.payment_method or "").lower() == "cod":
        order.cod_collected = True
    order.rider_bonus = 0.0 if is_delayed else RIDER_ON_TIME_BONUS
    order.rider_penalty = RIDER_DELAY_PENALTY if is_delayed else 0.0
    order.countdown_alert_level = "DELAYED" if is_delayed else "COMPLETED"
    order.rider_earning = round((order.rider_earning or 0.0) + order.rider_bonus - order.rider_penalty, 2)

# ── OTP helpers ────────────────────────────────────────────────────
def generate_otp() -> str:
    return str(random.randint(100000, 999999))

_otp_rate = defaultdict(list)
def rate_check(key: str, limit: int = 5, window: int = 60) -> bool:
    now = utc_now()
    cutoff = now - timedelta(seconds=window)
    _otp_rate[key] = [t for t in _otp_rate[key] if t > cutoff]
    if len(_otp_rate[key]) >= limit:
        return False
    _otp_rate[key].append(now)
    return True

def verify_otp_hash(stored_value: str, supplied_otp: str) -> bool:
    supplied = (supplied_otp or "").strip()
    if not supplied:
        return False
    try:
        return verify_password(supplied, stored_value)
    except Exception:
        return False

def normalize_otp_email(value: str) -> str:
    email = (value or "").strip().lower()
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(400, "Enter a valid email address")
    return email

def normalize_optional_phone(value: Optional[str]) -> str:
    phone = "".join(ch for ch in (value or "") if ch.isdigit())
    if not phone:
        return ""
    if len(phone) != 10:
        raise HTTPException(400, "Enter a valid 10-digit phone number")
    return phone

def normalize_account_password(value: Optional[str], required: bool = False) -> str:
    password = value or ""
    if not password:
        if required:
            raise HTTPException(400, "Enter your password")
        return ""
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    return password

def send_otp_email(to_email: str, otp: str) -> bool:
    host = (settings.otp_email_host or "").strip()
    user = (settings.otp_email_user or "").strip()
    password = (settings.otp_email_password or "").strip().replace(" ", "")
    sender = (settings.otp_email_from or user).strip()
    sender_name = (settings.otp_email_from_name or "DDOTT Updates").strip()
    if not host or not user or not password or not sender:
        return False
    msg = EmailMessage()
    msg["Subject"] = "Your DOTT login OTP"
    msg["From"] = formataddr((sender_name, sender))
    msg["To"] = to_email
    msg.set_content(
        f"Your DOTT verification code is {otp}.\n\n"
        "This code expires in 5 minutes. Do not share it with anyone."
    )
    try:
        with smtplib.SMTP(host, int(settings.otp_email_port or 587), timeout=15) as smtp:
            if settings.otp_email_use_tls:
                smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except Exception:
        raise HTTPException(502, "Unable to send OTP email. Check backend email settings.")

def normalize_configured_api_key(value: str) -> str:
    key = (value or "").strip().strip('"').strip("'")
    if key.lower() in {"your_key_here", "your_gemini_api_key_here", "paste_your_key_here"}:
        return ""
    return key

def configured_gemini_api_key() -> str:
    candidates = [
        getattr(settings, "gemini_api_key", ""),
        getattr(settings, "google_api_key", ""),
        getattr(settings, "google_generative_ai_api_key", ""),
        os.getenv("GEMINI_API_KEY", ""),
        os.getenv("GOOGLE_API_KEY", ""),
        os.getenv("GOOGLE_GENERATIVE_AI_API_KEY", ""),
    ]
    for value in candidates:
        key = normalize_configured_api_key(value)
        if key:
            return key
    return ""

GEMINI_API_KEY = configured_gemini_api_key()
GEMINI_MODEL = settings.gemini_model.strip() or "gemini-2.5-flash"
GEMINI_IMAGE_MODEL = (getattr(settings, "gemini_image_model", "") or "gemini-2.5-flash-image").strip()
PUBLIC_BASE_URL = settings.public_base_url
FIREBASE_SERVICE_ACCOUNT_JSON = (getattr(settings, "firebase_service_account_json", "") or "").strip()
VISUAL_EMBED_MODEL = "clip-vit-base-patch32" if CLIPModel and CLIPProcessor and torch else "fallback-histogram-v1"
_clip_bundle = None
_vendor_category_bundle = None

_firebase_app = None
def get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    if not firebase_admin or not FIREBASE_SERVICE_ACCOUNT_JSON:
        return None
    try:
        raw = FIREBASE_SERVICE_ACCOUNT_JSON
        if raw.startswith("{"):
            cred_dict = json.loads(raw)
        else:
            cred_dict = json.loads(base64.b64decode(raw).decode("utf-8"))
        cred = credentials.Certificate(cred_dict)
        _firebase_app = firebase_admin.initialize_app(cred)
        return _firebase_app
    except Exception:
        return None

def _safe_push_data(payload: Optional[dict]) -> dict:
    return {str(k): str(v) for k, v in (payload or {}).items()}

def send_push_to_user(user: Optional[User], title: str, body: str, data: Optional[dict] = None):
    if not user or not getattr(user, "fcm_token", None):
        return False
    app = get_firebase_app()
    if not app or not messaging:
        return False
    try:
        msg = messaging.Message(
            token=user.fcm_token,
            notification=messaging.Notification(title=title, body=body),
            data=_safe_push_data(data),
        )
        messaging.send(msg, app=app)
        return True
    except Exception:
        return False

def send_push_bulk(users: list[User], title: str, body: str, data: Optional[dict] = None):
    app = get_firebase_app()
    if not app or not messaging:
        return 0
    tokens = [u.fcm_token for u in users if u and getattr(u, "fcm_token", None)]
    if not tokens:
        return 0
    try:
        msg = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data=_safe_push_data(data),
        )
        resp = messaging.send_multicast(msg, app=app)
        return resp.success_count
    except Exception:
        return 0

def notification_dict(n: Notification) -> dict:
    payload = json_loads_safe(getattr(n, "data_json", "{}"), {})
    return {
        "id": n.id,
        "userId": n.user_id,
        "role": n.role,
        "title": n.title,
        "body": n.body,
        "category": n.category,
        "data": payload,
        "isRead": bool(n.is_read),
        "createdAt": n.created_at.isoformat() if n.created_at else None,
    }

def store_notification(db: Session, *, user: Optional[User] = None, role: Optional[str] = None,
                       title: str, body: str, category: str = "general",
                       data: Optional[dict] = None, push: bool = True):
    note = Notification(
        user_id=user.id if user else None,
        role=role,
        title=title,
        body=body,
        category=category,
        data_json=json.dumps(data or {}),
        is_read=False,
    )
    db.add(note)
    db.flush()
    if push and user:
        send_push_to_user(user, title, body, data)
    return note

def notify_user(db: Session, user: Optional[User], title: str, body: str,
                category: str = "general", data: Optional[dict] = None, push: bool = True):
    if not user:
        return None
    return store_notification(db, user=user, title=title, body=body, category=category, data=data, push=push)

def notify_users(db: Session, users: list[User], title: str, body: str,
                 category: str = "general", data: Optional[dict] = None, push: bool = True):
    seen = set()
    unique_users = []
    for user in users or []:
        if not user or user.id in seen:
            continue
        seen.add(user.id)
        unique_users.append(user)
        store_notification(db, user=user, title=title, body=body, category=category, data=data, push=False)
    if push and unique_users:
        send_push_bulk(unique_users, title, body, data)
    return unique_users

def _order_push_data(o: Order, extra: Optional[dict] = None) -> dict:
    data = {
        "type": "order",
        "orderId": o.id,
        "orderCode": o.order_code,
        "status": o.status,
        "shopId": o.shop_id,
        "customerId": o.customer_id,
        "riderId": o.rider_id or "",
    }
    if extra:
        data.update(extra)
    return data

def _return_push_data(rr: ReturnRequest, extra: Optional[dict] = None) -> dict:
    data = {
        "type": "return",
        "returnId": rr.id,
        "orderId": rr.order_id,
        "status": rr.status,
        "pickupStatus": rr.pickup_status or "",
        "shopId": rr.shop_id,
        "customerId": rr.customer_id,
        "pickupRiderId": rr.pickup_rider_id or "",
    }
    if extra:
        data.update(extra)
    return data

def _nearby_riders(db: Session, lat: Optional[float], lng: Optional[float], radius_km: float) -> list:
    if lat is None or lng is None:
        return []
    riders = db.query(User).filter(
        User.role == RoleEnum.RIDER,
        User.is_online == True,
        User.lat != None,
        User.lng != None
    ).all()
    nearby = []
    for r in riders:
        try:
            if haversine(lat, lng, r.lat, r.lng) <= radius_km:
                nearby.append(r)
        except Exception:
            continue
    return nearby

def notify_riders_new_order(db: Session, o: Order):
    shop = o.shop
    lat = shop.lat if shop else None
    lng = shop.lng if shop else None
    riders = _nearby_riders(db, lat, lng, RIDER_PUSH_RADIUS_KM)
    if not riders:
        return 0
    title = "New order nearby"
    body = f"Order {o.order_code} is ready to accept."
    notify_users(db, riders, title, body, "new_order", _order_push_data(o, {"action": "accept_or_reject"}), push=True)
    return len(riders)

def notify_riders_return_pickup(db: Session, rr: ReturnRequest):
    lat = rr.order.delivery_lat if rr.order else None
    lng = rr.order.delivery_lng if rr.order else None
    riders = _nearby_riders(db, lat, lng, RIDER_PUSH_RADIUS_KM)
    if not riders:
        return 0
    title = "Return pickup nearby"
    body = f"Return pickup requested for order {rr.order.order_code}."
    notify_users(db, riders, title, body, "return_pickup", _return_push_data(rr, {"action": "accept_or_reject"}), push=True)
    return len(riders)

def _nearby_customers(db: Session, lat: Optional[float], lng: Optional[float], radius_km: float) -> list:
    if lat is None or lng is None:
        return []
    users = db.query(User).filter(
        User.role == RoleEnum.CUSTOMER,
        User.lat != None,
        User.lng != None
    ).all()
    nearby = []
    for u in users:
        try:
            if haversine(lat, lng, u.lat, u.lng) <= radius_km:
                nearby.append(u)
        except Exception:
            continue
    return nearby

def notify_customers_new_shop(db: Session, shop: Shop):
    if not shop or shop.lat is None or shop.lng is None:
        return 0
    customers = _nearby_customers(db, shop.lat, shop.lng, MAX_DISCOVERY_RADIUS_KM)
    if not customers:
        return 0
    title = "New shop near you"
    body = f"{shop.name} just opened nearby. Check out new arrivals!"
    notify_users(db, customers, title, body, "new_shop", {"type": "new_shop", "shopId": shop.id, "shopName": shop.name}, push=True)
    return len(customers)

def _top_rated_shops(db: Session, lat: float, lng: float, radius_km: float, limit: int = 3) -> list:
    shops = db.query(Shop).filter(Shop.is_active == True, Shop.is_suspended == False).all()
    scored = []
    for s in shops:
        if s.lat is None or s.lng is None:
            continue
        dist = haversine(lat, lng, s.lat, s.lng)
        if dist > radius_km:
            continue
        score = (s.rating or 0.0, s.rating_count or 0, s.total_orders or 0)
        scored.append((score, s))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [s for _, s in scored[:limit]]

def _top_selling_products(db: Session, lat: float, lng: float, radius_km: float, limit: int = 4) -> list:
    shops = [s for s in db.query(Shop).filter(Shop.is_active == True, Shop.is_suspended == False).all()
             if s.lat is not None and s.lng is not None and haversine(lat, lng, s.lat, s.lng) <= radius_km]
    if not shops:
        return []
    shop_ids = [s.id for s in shops]
    since = utc_now() - timedelta(days=7)
    orders = db.query(Order).filter(Order.status == OrderStatusEnum.DELIVERED, Order.shop_id.in_(shop_ids), Order.placed_at >= since).all()
    if not orders:
        return []
    counts = Counter()
    for o in orders:
        for item in o.items:
            counts[item.product_id] += item.qty
    if not counts:
        return []
    top_ids = [pid for pid, _ in counts.most_common(limit)]
    products = db.query(Product).filter(Product.id.in_(top_ids)).all()
    prod_by_id = {p.id: p for p in products}
    return [prod_by_id[pid] for pid in top_ids if pid in prod_by_id]

LOCAL_ZERO_SHOT_LABELS = {
    "category": [
        ("Kids Ethnic Wear", "a catalog product photo of girls kids ethnic wear lehenga choli set with dupatta"),
        ("Dresses", "a catalog product photo of a women's dress or gown"),
        ("Kurtis", "a catalog product photo of a women's kurti"),
        ("Sarees", "a catalog product photo of a saree with drape"),
        ("Shirts", "a catalog product photo of a men's shirt"),
        ("T-Shirts", "a catalog product photo of a t-shirt"),
        ("Jeans", "a catalog product photo of jeans"),
        ("Trousers", "a catalog product photo of trousers or pants"),
        ("Jackets", "a catalog product photo of a jacket"),
        ("Accessories", "a catalog product photo of a fashion accessory"),
    ],
    "productType": [
        ("Lehenga Choli (3-piece set)", "a girls lehenga choli set with dupatta"),
        ("Dress", "a women's long dress"),
        ("Kurti", "a women's kurti top"),
        ("Saree", "a saree garment"),
        ("Shirt", "a men's button down shirt"),
        ("T-Shirt", "a t-shirt"),
        ("Jeans", "a pair of jeans"),
        ("Trousers", "a pair of trousers"),
        ("Jacket", "a jacket"),
    ],
    "pattern": [
        ("Embroidered", "an embroidered garment with decorative work"),
        ("Printed", "a printed garment with visible prints"),
        ("Striped", "a striped garment"),
        ("Floral", "a floral garment"),
        ("Plain", "a plain solid-color garment"),
    ],
    "gender": [
        ("Girls", "girls kids fashion clothing"),
        ("Women", "women fashion clothing"),
        ("Men", "men fashion clothing"),
        ("Unisex", "unisex clothing item"),
    ],
    "usage": [
        ("Festive", "festive ethnic occasion wear"),
        ("Partywear", "partywear fashion clothing"),
        ("Casual", "casual daily wear clothing"),
        ("Everyday", "everyday wearable clothing"),
    ],
}

PRODUCT_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "title": {"type": "string"},
        "productType": {"type": "string"},
        "category": {"type": "string"},
        "brand": {"type": "string"},
        "color": {"type": "string"},
        "material": {"type": "string"},
        "fabric": {"type": "string"},
        "pattern": {"type": "string"},
        "style": {"type": "string"},
        "gender": {"type": "string"},
        "usage": {"type": "string"},
        "fit": {"type": "string"},
        "occasion": {"type": "string"},
        "sleeveType": {"type": "string"},
        "length": {"type": "string"},
        "mrp": {"type": "string"},
        "suggestedPrice": {"type": "string"},
        "description": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "sizes": {"type": "string"},
        "confidence": {"type": "string"},
        "presentation": {"type": "string"},
        "detail": {"type": "string"},
    },
    "required": ["name", "title", "productType", "category", "brand", "color", "material", "fabric", "pattern", "style", "gender", "usage", "fit", "occasion", "sleeveType", "length", "mrp", "suggestedPrice", "description", "tags", "sizes", "confidence", "presentation", "detail"],
    "additionalProperties": False,
}

PRESENTATION_META = {
    "upper": {
        "badge": "MODEL FIT",
        "title": "Male model render",
        "detail": "Upper-wear detected. Edited onto a realistic male model with studio alignment, balanced lighting, and natural shadows.",
    },
    "drape": {
        "badge": "DRAPED",
        "title": "Female drape render",
        "detail": "Drape-style apparel detected. Edited onto a female model with natural folds, clean drape flow, and catalogue lighting.",
    },
    "lower": {
        "badge": "LOWER FIT",
        "title": "Lower-body render",
        "detail": "Bottom-wear detected. Edited onto a lower-body model with realistic fitting and balanced studio shadows.",
    },
    "fallback": {
        "badge": "STUDIO",
        "title": "Studio enhancement",
        "detail": "Product type was unclear. The original product image is preserved and upgraded with cleaner background, lighting, and shadow treatment.",
    },
}

def gemini_request(model: str, payload: dict) -> dict:
    api_key = configured_gemini_api_key()
    if not api_key:
        raise HTTPException(503, "GEMINI_API_KEY is not configured on the backend.")
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(model)}:generateContent",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        try:
            detail = json.loads(body)
        except Exception:
            detail = body or str(e)
        if e.code in {400, 401, 403}:
            raise HTTPException(503, {"message": "Gemini API key or model is not accepted", "detail": detail})
        raise HTTPException(502, {"message": "Gemini request failed", "detail": detail})
    except Exception as e:
        raise HTTPException(502, f"Gemini request failed: {e}")

def guess_media_type(filename: str, fallback: str = "image/jpeg") -> str:
    media, _ = mimetypes.guess_type(filename or "")
    return media or fallback

def save_image_bytes(user_id: int, image_bytes: bytes, suffix: str = "jpg") -> dict:
    filename = f"{user_id}_{int(time.time()*1000)}.{suffix}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    return {"filename": filename, "url": f"/uploads/{filename}"}

def optimize_upload_image(image_bytes: bytes, max_side: int = 1600, quality: int = 82) -> bytes:
    if Image is None:
        return image_bytes
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image.thumbnail((max_side, max_side), Image.LANCZOS)
        out = io.BytesIO()
        image.save(out, format="JPEG", quality=quality, optimize=True)
        return out.getvalue()
    except Exception:
        return image_bytes

def prepare_catalog_image_locally(image_bytes: bytes, canvas_size: int = 1200) -> bytes:
    if Image is None:
        return image_bytes
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image = ImageOps.contain(image, (int(canvas_size * 0.9), int(canvas_size * 0.9)), Image.LANCZOS)
        image = ImageEnhance.Color(image).enhance(1.04)
        image = ImageEnhance.Contrast(image).enhance(1.08)
        image = ImageEnhance.Sharpness(image).enhance(1.25)
        canvas = Image.new("RGB", (canvas_size, canvas_size), (255, 255, 255))
        x = (canvas_size - image.width) // 2
        y = (canvas_size - image.height) // 2
        canvas.paste(image, (x, y))
        out = io.BytesIO()
        canvas.save(out, format="JPEG", quality=88, optimize=True)
        return out.getvalue()
    except Exception:
        return image_bytes

def json_loads_safe(value, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback

def parse_price_hint(value: str) -> str:
    raw = (value or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    return digits or raw

def clean_filename_tokens(filename: str):
    stem = Path(filename or "").stem.replace("_", " ").replace("-", " ").strip().lower()
    if not stem:
        return []
    blocked = {
        "screenshot", "img", "image", "photo", "camera", "pic", "picture", "whatsapp",
        "bing", "google", "www", "jpeg", "jpg", "png", "webp", "upload"
    }
    tokens = []
    for token in stem.split():
        if token in blocked:
            continue
        if token.isdigit():
            continue
        if len(token) <= 2:
            continue
        tokens.append(token)
    return tokens

def detect_named_color(crop):
    thumb = ImageOps.fit(crop.convert("RGB"), (48, 48), method=Image.LANCZOS)
    pixels = list(thumb.getdata())
    filtered = []
    for r, g, b in pixels:
        if max(r, g, b) < 35:
            continue
        if min(r, g, b) > 242:
            continue
        filtered.append((r, g, b))
    if not filtered:
        filtered = pixels
    if np is not None:
        arr = np.asarray(filtered, dtype="float32")
        mean_r, mean_g, mean_b = arr.mean(axis=0).tolist()
    else:
        total = max(1, len(filtered))
        mean_r = sum(px[0] for px in filtered) / total
        mean_g = sum(px[1] for px in filtered) / total
        mean_b = sum(px[2] for px in filtered) / total

    palette = [
        ("Black", (35, 35, 35)), ("White", (245, 245, 245)), ("Grey", (125, 125, 125)),
        ("Cream", (236, 228, 202)), ("Beige", (209, 188, 157)), ("Gold", (205, 170, 95)),
        ("Navy", (38, 56, 110)), ("Blue", (58, 110, 196)), ("Teal", (30, 131, 139)),
        ("Green", (62, 132, 66)), ("Olive", (107, 121, 52)), ("Yellow", (220, 185, 50)),
        ("Orange", (217, 120, 47)), ("Red", (180, 55, 63)), ("Pink", (214, 112, 155)),
        ("Purple", (104, 72, 134)), ("Maroon", (104, 43, 60)), ("Brown", (116, 83, 52)),
    ]
    best = "Purple"
    best_score = float("inf")
    for name, (pr, pg, pb) in palette:
        score = (mean_r - pr) ** 2 + (mean_g - pg) ** 2 + (mean_b - pb) ** 2
        if score < best_score:
            best = name
            best_score = score
    return best

def infer_apparel_labels(presentation: str, bbox, image_size, filename: str):
    width = max(1, bbox[2] - bbox[0]) if bbox else image_size[0]
    height = max(1, bbox[3] - bbox[1]) if bbox else image_size[1]
    ratio = width / height
    coverage = (width * height) / max(1, image_size[0] * image_size[1])
    height_ratio = height / max(1, image_size[1])
    width_ratio = width / max(1, image_size[0])
    tokens = clean_filename_tokens(filename)
    token_text = " ".join(tokens)
    if "saree" in token_text or "sari" in token_text:
        return {"category": "Sarees", "productType": "saree", "name": "Saree"}
    if "kurti" in token_text or "kurta" in token_text:
        return {"category": "Kurtis", "productType": "kurti", "name": "Kurti"}
    if "dress" in token_text or "gown" in token_text:
        return {"category": "Dresses", "productType": "dress", "name": "Dress"}
    if "shirt" in token_text or "tshirt" in token_text or "t-shirt" in token_text:
        return {"category": "Shirts", "productType": "shirt", "name": "Shirt"}
    if "jeans" in token_text or "trouser" in token_text or "pants" in token_text:
        return {"category": "Jeans", "productType": "pants", "name": "Pants"}

    if presentation == "drape":
        if (width_ratio > 0.58 and height_ratio > 0.82 and coverage > 0.34) or (ratio < 0.68 and height_ratio > 0.78 and coverage > 0.22):
            return {"category": "Kids", "productType": "lehenga", "name": "Kids Lehenga Set"}
        if ratio < 0.58 and coverage > 0.28:
            return {"category": "Kurtis", "productType": "kurti", "name": "Embroidered Kurti"}
        if ratio < 0.75:
            return {"category": "Dresses", "productType": "dress", "name": "Long Dress"}
        return {"category": "Sarees", "productType": "saree", "name": "Saree"}
    if presentation == "upper":
        return {"category": "Shirts", "productType": "shirt", "name": "Shirt"}
    if presentation == "lower":
        return {"category": "Jeans", "productType": "pants", "name": "Pants"}
    return {"category": "Fashion", "productType": "apparel", "name": "Fashion Product"}

def infer_basic_product_analysis(filename: str, presentation: str = "fallback", color_name: str = "", bbox=None, image_size=(1000, 1000)) -> dict:
    labels = infer_apparel_labels(presentation, bbox, image_size, filename)
    pretty_color = color_name.strip() if color_name else ""
    product_name = f"{pretty_color} {labels['name']}".strip() if pretty_color else labels["name"]
    key = presentation if presentation in PRESENTATION_META else infer_presentation_key(" ".join(clean_filename_tokens(filename)))
    if key == "fallback":
        key = presentation if presentation in PRESENTATION_META else "fallback"
    meta = PRESENTATION_META[key]
    pattern = "plain"
    style = "everyday"
    gender = "unisex"
    usage = "general"
    if labels["productType"] in {"lehenga", "kurti", "dress", "saree"}:
        style = "ethnic" if labels["productType"] in {"lehenga", "kurti", "saree"} else "occasion"
        gender = "girls" if labels["productType"] == "lehenga" and labels["category"] == "Kids" else "women"
        usage = "festive" if labels["productType"] in {"lehenga", "saree"} else "partywear"
    elif labels["productType"] in {"shirt", "t-shirt", "jacket", "sweatshirt"}:
        style = "casual"
        gender = "men"
        usage = "everyday"
    elif labels["productType"] in {"pants", "jeans", "trousers"}:
        style = "casual"
        gender = "men"
        usage = "dailywear"
    return {
        "name": product_name,
        "title": product_name,
        "productType": labels["productType"],
        "category": labels["category"],
        "brand": "",
        "color": pretty_color,
        "material": "",
        "fabric": "",
        "pattern": pattern,
        "style": style,
        "gender": gender,
        "usage": usage,
        "fit": "",
        "occasion": "",
        "sleeveType": "",
        "length": "",
        "mrp": "",
        "suggestedPrice": "",
        "description": f"{product_name} prepared for a cleaner e-commerce listing image.",
        "tags": [],
        "sizes": "",
        "confidence": "low",
        "presentation": key,
        "badge": meta["badge"],
        "title": meta["title"],
        "detail": meta["detail"],
    }


def vendor_product_type_from_category(category: str) -> str:
    mapping = {
        "Accessories": "accessory",
        "Dress": "dress",
        "Dresses": "dress",
        "Fashion": "apparel",
        "Jackets": "jacket",
        "Jeans": "jeans",
        "Kids": "kids apparel",
        "Kids Ethnic Wear": "kids ethnic wear",
        "Kurta": "kurta",
        "Kurtas": "kurta",
        "Kurti": "kurti",
        "Kurtis": "kurti",
        "Lehenga": "lehenga",
        "Saree": "saree",
        "Sarees": "saree",
        "Shirt": "shirt",
        "Shirts": "shirt",
        "Skirts": "skirt",
        "Sweatshirts": "sweatshirt",
        "T-Shirts": "t-shirt",
        "Trousers": "trousers",
    }
    return mapping.get(normalize_category_name(category), "apparel")

def normalize_category_name(value: str) -> str:
    text = (value or "").strip().lower()
    compact = text.replace("_", " ").replace("-", " ")
    compact = " ".join(compact.split())
    mapping = {
        "accessories": "Accessories",
        "accessory": "Accessories",
        "bottomwear": "Trousers",
        "bottom wear": "Trousers",
        "dress": "Dresses",
        "dresses": "Dresses",
        "fashion": "Fashion",
        "girls lehenga": "Kids Ethnic Wear",
        "jacket": "Jackets",
        "jackets": "Jackets",
        "jean": "Jeans",
        "jeans": "Jeans",
        "kids": "Kids",
        "kids ethnic": "Kids Ethnic Wear",
        "kids ethnic wear": "Kids Ethnic Wear",
        "kurta": "Kurtas",
        "kurtas": "Kurtas",
        "kurti": "Kurtis",
        "kurtis": "Kurtis",
        "lehenga": "Lehenga",
        "lehenga choli": "Kids Ethnic Wear",
        "pant": "Trousers",
        "pants": "Trousers",
        "saree": "Sarees",
        "sarees": "Sarees",
        "shirt": "Shirt",
        "shirts": "Shirts",
        "skirt": "Skirts",
        "skirts": "Skirts",
        "sweatshirt": "Sweatshirts",
        "sweatshirts": "Sweatshirts",
        "tee": "T-Shirts",
        "t shirt": "T-Shirts",
        "t shirts": "T-Shirts",
        "tee shirt": "T-Shirts",
        "top": "Shirts",
        "tops": "Shirts",
        "trouser": "Trousers",
        "trousers": "Trousers",
    }
    return mapping.get(compact, (value or "Fashion").strip() or "Fashion")


def vendor_model_available() -> bool:
    return False


def get_vendor_category_bundle():
    global _vendor_category_bundle
    if _vendor_category_bundle is False:
        return None
    if _vendor_category_bundle is not None:
        return _vendor_category_bundle
    if not vendor_model_available():
        _vendor_category_bundle = False
        return None
    _vendor_category_bundle = False
    return None


def predict_vendor_category_from_model(image_bytes: bytes):
    bundle = get_vendor_category_bundle()
    if not bundle:
        return None
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = preprocess_pil(image, train_mode=False).unsqueeze(0)
        with torch.no_grad():
            logits = bundle["model"](tensor)
            probs = torch.softmax(logits, dim=1)[0]
            score, index = torch.max(probs, dim=0)
        category = normalize_category_name(bundle["classes"][index.item()])
        return {
            "category": category,
            "productType": vendor_product_type_from_category(category),
            "name": category,
            "modelScore": float(score.item()),
        }
    except Exception:
        return None


def merge_model_prediction(local_analysis: dict, image_bytes: bytes):
    analysis = dict(local_analysis or {})
    predicted = predict_vendor_category_from_model(image_bytes)
    if not predicted:
        return analysis
    score = float(predicted.get("modelScore") or 0.0)
    if score < 0.55:
        return analysis
    category = predicted["category"]
    analysis["category"] = category
    analysis["productType"] = predicted["productType"]
    color = title_case_words(analysis.get("color") or "")
    analysis["name"] = f"{color} {category}".strip() if color else category
    analysis["modelScore"] = score
    analysis["analysisSource"] = "trained-model"
    return analysis

def title_case_words(value: str) -> str:
    return " ".join(part.capitalize() for part in (value or "").replace("-", " ").split())

def infer_fashion_defaults(category: str, product_type: str, analysis: dict) -> dict:
    key = (product_type or category or "").strip().lower()
    color = title_case_words(analysis.get("color") or "Classic")
    material = (analysis.get("fabric") or analysis.get("material") or "").strip()
    pattern = title_case_words(analysis.get("pattern") or "")
    usage = (analysis.get("usage") or analysis.get("occasion") or "").strip().lower()
    gender = title_case_words(analysis.get("gender") or "")
    defaults = {
        "lehenga": {"gender": "Women", "fabric": "Silk Blend", "pattern": "Embroidered", "fit": "Regular", "occasion": "Festival", "sleeveType": "Half Sleeve", "length": "Long", "brand": "DOTT Fashion", "price": "2499"},
        "kurti": {"gender": "Women", "fabric": "Cotton Blend", "pattern": "Printed", "fit": "Regular", "occasion": "Casual", "sleeveType": "Three Quarter Sleeve", "length": "Long", "brand": "DOTT Fashion", "price": "999"},
        "saree": {"gender": "Women", "fabric": "Silk Blend", "pattern": "Woven", "fit": "Regular", "occasion": "Festival", "sleeveType": "Not Applicable", "length": "Long", "brand": "DOTT Fashion", "price": "1799"},
        "shirt": {"gender": "Men", "fabric": "Cotton", "pattern": "Plain", "fit": "Slim", "occasion": "Casual", "sleeveType": "Full Sleeve", "length": "Regular", "brand": "DOTT Classics", "price": "899"},
        "jeans": {"gender": "Men", "fabric": "Denim", "pattern": "Solid", "fit": "Regular", "occasion": "Casual", "sleeveType": "Not Applicable", "length": "Full Length", "brand": "DOTT Classics", "price": "1299"},
        "dress": {"gender": "Women", "fabric": "Polyester Blend", "pattern": "Printed", "fit": "Regular", "occasion": "Party", "sleeveType": "Sleeveless", "length": "Midi", "brand": "DOTT Fashion", "price": "1499"},
        "apparel": {"gender": "Unisex", "fabric": "Cotton Blend", "pattern": "Solid", "fit": "Regular", "occasion": "Casual", "sleeveType": "Regular", "length": "Regular", "brand": "DOTT Fashion", "price": "999"},
    }
    preset = defaults.get(key, defaults["apparel"]).copy()
    if material:
        preset["fabric"] = title_case_words(material)
    if pattern:
        preset["pattern"] = pattern
    if gender:
        preset["gender"] = gender
    if usage in {"festive", "festival"}:
        preset["occasion"] = "Festival"
    elif usage in {"partywear", "party"}:
        preset["occasion"] = "Party"
    elif usage in {"everyday", "dailywear", "casual"}:
        preset["occasion"] = "Casual"
    if key == "shirt" and "dress" in color.lower():
        preset["gender"] = "Women"
    return preset

def generate_product_copy(analysis: dict, image_path: str = "") -> dict:
    product_type = (analysis.get("productType") or analysis.get("category") or "apparel").strip().lower()
    category = normalize_category_name(analysis.get("category") or analysis.get("productType") or "Fashion")
    defaults = infer_fashion_defaults(category, product_type, analysis)
    color = title_case_words(analysis.get("color") or "Classic")
    fabric = title_case_words(analysis.get("fabric") or analysis.get("material") or defaults["fabric"])
    pattern = title_case_words(analysis.get("pattern") or defaults["pattern"])
    fit = title_case_words(analysis.get("fit") or defaults["fit"])
    occasion = title_case_words(analysis.get("occasion") or analysis.get("usage") or defaults["occasion"])
    gender = title_case_words(analysis.get("gender") or defaults["gender"])
    sleeve_type = title_case_words(analysis.get("sleeveType") or defaults["sleeveType"])
    length = title_case_words(analysis.get("length") or defaults["length"])
    brand = ""
    price = parse_price_hint(analysis.get("suggestedPrice") or analysis.get("mrp") or defaults["price"])

    descriptor_parts = [color]
    if pattern and pattern.lower() not in {"solid", "plain", "regular"}:
        descriptor_parts.append(pattern)
    if fabric and fabric.lower() not in {"not applicable"}:
        descriptor_parts.append(fabric)
    descriptor = " ".join(dict.fromkeys(part for part in descriptor_parts if part))
    base_name = title_case_words(analysis.get("name") or category)
    if base_name.lower() == category.lower():
        base_name = f"{descriptor} {category}".strip()
    raw_title = (analysis.get("title") or "").strip()
    presentation_titles = {meta["title"] for meta in PRESENTATION_META.values()}
    if raw_title in presentation_titles or any(token in raw_title.lower() for token in ["render", "enhancement", "model fit", "studio"]):
        raw_title = ""
    title = (raw_title or f"{descriptor} {category} for {gender}").strip()
    title = " ".join(title.split())

    description = (
        f"{title} with a clean catalogue-ready image, {pattern.lower()} finish, "
        f"{fabric.lower()} feel, and a {fit.lower()} fit. Ideal for {occasion.lower()} use."
    )
    tags = []
    free_size_categories = {"Saree", "Sarees", "Accessories"}
    sizes = "" if category in free_size_categories else (analysis.get("sizes") or "")
    return {
        "category": category,
        "color": color,
        "title": title,
        "name": base_name,
        "description": description,
        "tags": tags,
        "brand": "",
        "price": price,
        "gender": gender,
        "fabric": fabric,
        "pattern": pattern,
        "fit": fit,
        "occasion": occasion,
        "sleeveType": sleeve_type,
        "length": length,
        "productType": title_case_words(product_type),
        "sizes": sizes,
        "image_path": image_path,
    }

def pil_image_required():
    if Image is None:
        raise HTTPException(503, "Pillow is required for image processing on the backend.")

def _clip_required():
    return CLIPModel is not None and CLIPProcessor is not None and torch is not None

def get_clip_bundle():
    global _clip_bundle
    if not _clip_required():
        return None
    if _clip_bundle is None:
        processor = CLIPProcessor.from_pretrained(VISUAL_EMBED_MODEL)
        model = CLIPModel.from_pretrained(VISUAL_EMBED_MODEL)
        model.eval()
        _clip_bundle = (processor, model)
    return _clip_bundle

def classify_crop_with_clip(image, label_prompts: list[tuple[str, str]], threshold: float = 0.34):
    clip_bundle = get_clip_bundle()
    if not clip_bundle or not label_prompts:
        return None
    processor, model = clip_bundle
    labels = [item[0] for item in label_prompts]
    prompts = [item[1] for item in label_prompts]
    try:
        inputs = processor(text=prompts, images=image, return_tensors="pt", padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
            probs = outputs.logits_per_image.softmax(dim=1)[0].detach().cpu().tolist()
        best_idx = max(range(len(probs)), key=lambda idx: probs[idx])
        if probs[best_idx] < threshold:
            return None
        return {"label": labels[best_idx], "score": float(probs[best_idx])}
    except Exception:
        return None

def load_pil_image(image_bytes: bytes):
    pil_image_required()
    image = Image.open(io.BytesIO(image_bytes))
    image.load()
    return image.convert("RGBA")

def extract_border_palette(rgb_image, depth: int = 10, max_colors: int = 4):
    width, height = rgb_image.size
    border = Image.new("RGB", (width * 2 + height * 2, depth), (255, 255, 255))
    border.paste(rgb_image.crop((0, 0, width, depth)), (0, 0))
    border.paste(rgb_image.crop((0, height - depth, width, height)), (width, 0))
    left_strip = rgb_image.crop((0, 0, depth, height)).resize((height, depth), Image.BILINEAR)
    right_strip = rgb_image.crop((width - depth, 0, width, height)).resize((height, depth), Image.BILINEAR)
    border.paste(left_strip, (width * 2, 0))
    border.paste(right_strip, (width * 2 + height, 0))
    quantized = border.quantize(colors=max(8, max_colors * 3), method=Image.MEDIANCUT)
    palette = quantized.getpalette() or []
    colors = quantized.getcolors() or []
    ranked = []
    for count, index in sorted(colors, reverse=True):
        base = index * 3
        if base + 2 >= len(palette):
            continue
        color = tuple(palette[base:base + 3])
        if color not in ranked:
            ranked.append(color)
        if len(ranked) >= max_colors:
            break
    return ranked or [(255, 255, 255)]

def fallback_remove_background(image_bytes: bytes):
    image = load_pil_image(image_bytes)
    rgb = image.convert("RGB")
    if np is None:
        return image, False

    base = ImageOps.contain(rgb, (160, 160), method=Image.LANCZOS)
    arr = np.asarray(base, dtype="float32")
    h, w = arr.shape[:2]
    palette = extract_border_palette(base, depth=max(4, min(base.size) // 18), max_colors=6)
    palette_arr = np.asarray(palette, dtype="float32")
    diffs = arr[:, :, None, :] - palette_arr[None, None, :, :]
    min_dist = np.sqrt((diffs ** 2).sum(axis=3)).min(axis=2)
    candidate_bg = min_dist < 42

    visited = np.zeros((h, w), dtype=bool)
    background = np.zeros((h, w), dtype=bool)
    queue = []

    for x in range(w):
        queue.append((0, x))
        queue.append((h - 1, x))
    for y in range(h):
        queue.append((y, 0))
        queue.append((y, w - 1))

    while queue:
        y, x = queue.pop()
        if y < 0 or x < 0 or y >= h or x >= w or visited[y, x]:
            continue
        visited[y, x] = True
        if not candidate_bg[y, x]:
            continue
        background[y, x] = True
        queue.extend([(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)])

    subject = (~background).astype("uint8") * 255
    mask_img = Image.fromarray(subject, mode="L").resize(rgb.size, Image.LANCZOS)
    mask_img = mask_img.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
    mask_img = mask_img.point(lambda px: 255 if px > 108 else 0)

    bbox = mask_img.getbbox()
    if not bbox or (bbox[2] - bbox[0] > rgb.width * 0.96 and bbox[3] - bbox[1] > rgb.height * 0.96):
        candidate_subject = min_dist > 34
        visited_comp = np.zeros((h, w), dtype=bool)
        components = []
        for sy in range(h):
            for sx in range(w):
                if visited_comp[sy, sx] or not candidate_subject[sy, sx]:
                    continue
                stack = [(sy, sx)]
                visited_comp[sy, sx] = True
                pts = []
                while stack:
                    cy, cx = stack.pop()
                    pts.append((cy, cx))
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if ny < 0 or nx < 0 or ny >= h or nx >= w or visited_comp[ny, nx] or not candidate_subject[ny, nx]:
                            continue
                        visited_comp[ny, nx] = True
                        stack.append((ny, nx))
                if len(pts) < max(24, (h * w) // 200):
                    continue
                ys = [p[0] for p in pts]
                xs = [p[1] for p in pts]
                cy = sum(ys) / len(ys)
                cx = sum(xs) / len(xs)
                centrality = 1.0 - (((cx - (w / 2)) / max(1, w / 2)) ** 2 + ((cy - (h / 2)) / max(1, h / 2)) ** 2)
                score = len(pts) * max(0.05, centrality)
                components.append((score, pts))
        if components:
            best_pts = max(components, key=lambda item: item[0])[1]
            comp_mask = np.zeros((h, w), dtype="uint8")
            for py, px in best_pts:
                comp_mask[py, px] = 255
            mask_img = Image.fromarray(comp_mask, mode="L").resize(rgb.size, Image.LANCZOS)
            mask_img = mask_img.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2))
            mask_img = mask_img.point(lambda px: 255 if px > 96 else 0)
            bbox = mask_img.getbbox()
    if not bbox:
        return image, False
    if bbox[2] - bbox[0] > rgb.width * 0.97 and bbox[3] - bbox[1] > rgb.height * 0.97:
        return image, False

    result = image.copy()
    result.putalpha(mask_img)
    return result, True

def remove_background_with_model(image_bytes: bytes):
    if not rembg_remove:
        return fallback_remove_background(image_bytes)
    try:
        output = rembg_remove(image_bytes)
        return load_pil_image(output), True
    except Exception:
        return fallback_remove_background(image_bytes)

def remove_background_with_remove_bg(image_bytes: bytes, filename: str):
    return remove_background_with_model(image_bytes)

def remove_background_with_provider(image_bytes: bytes, filename: str):
    image, ok = remove_background_with_model(image_bytes)
    return image, ok, "local-fallback"

def longest_true_run(flags):
    best = None
    start = None
    for idx, flag in enumerate(flags):
        if flag and start is None:
            start = idx
        elif not flag and start is not None:
            run = (start, idx - 1)
            if best is None or (run[1] - run[0]) > (best[1] - best[0]):
                best = run
            start = None
    if start is not None:
        run = (start, len(flags) - 1)
        if best is None or (run[1] - run[0]) > (best[1] - best[0]):
            best = run
    return best

def refine_bbox_for_garment(image, bbox):
    if not bbox:
        return bbox
    alpha = image.getchannel("A")
    mask = alpha.point(lambda a: 255 if a > 18 else 0)
    crop = mask.crop(bbox)
    if np is not None:
        arr = np.asarray(crop, dtype="uint8") > 0
        row_counts = arr.sum(axis=1)
        col_counts = arr.sum(axis=0)
    else:
        row_counts = []
        col_counts = []
        for y in range(crop.height):
            count = 0
            for x in range(crop.width):
                if crop.getpixel((x, y)) > 0:
                    count += 1
            row_counts.append(count)
        for x in range(crop.width):
            count = 0
            for y in range(crop.height):
                if crop.getpixel((x, y)) > 0:
                    count += 1
            col_counts.append(count)

    if not row_counts or max(row_counts) <= 0:
        return bbox

    row_peak = max(row_counts)
    row_threshold = max(6, int(row_peak * 0.26))
    row_run = longest_true_run([count >= row_threshold for count in row_counts])
    if not row_run:
        return bbox

    top, bottom = row_run
    top = max(0, top - max(8, crop.height // 40))
    bottom = min(crop.height - 1, bottom + max(10, crop.height // 28))

    trimmed = crop.crop((0, top, crop.width, bottom + 1))
    if np is not None:
        trimmed_arr = np.asarray(trimmed, dtype="uint8") > 0
        col_counts = trimmed_arr.sum(axis=0)
    else:
        col_counts = []
        for x in range(trimmed.width):
            count = 0
            for y in range(trimmed.height):
                if trimmed.getpixel((x, y)) > 0:
                    count += 1
            col_counts.append(count)

    col_peak = max(col_counts) if col_counts else 0
    col_threshold = max(4, int(col_peak * 0.18))
    col_run = longest_true_run([count >= col_threshold for count in col_counts])
    if col_run:
        left, right = col_run
        left = max(0, left - max(8, trimmed.width // 36))
        right = min(trimmed.width - 1, right + max(8, trimmed.width // 36))
    else:
        left, right = 0, crop.width - 1

    refined = (
        bbox[0] + left,
        bbox[1] + top,
        bbox[0] + right + 1,
        bbox[1] + bottom + 1,
    )

    refined_w = refined[2] - refined[0]
    refined_h = refined[3] - refined[1]
    original_w = bbox[2] - bbox[0]
    original_h = bbox[3] - bbox[1]
    if refined_w < original_w * 0.35 or refined_h < original_h * 0.35:
        return bbox
    return refined

def detect_subject_bbox(image):
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 18 else 0).getbbox()
    if bbox:
        return refine_bbox_for_garment(image, bbox)
    rgb = image.convert("RGB")
    bg = Image.new("RGB", rgb.size, (255, 255, 255))
    diff = ImageOps.autocontrast(ImageChops.difference(rgb, bg))
    bbox = diff.getbbox() or (0, 0, image.width, image.height)
    return refine_bbox_for_garment(image, bbox)

def fit_within_box(width: int, height: int, max_width: int, max_height: int):
    if width <= 0 or height <= 0:
        return max_width, max_height
    scale = min(max_width / width, max_height / height)
    return max(1, int(width * scale)), max(1, int(height * scale))

def center_subject_on_canvas(source_image, bbox, canvas_size: int = 1000):
    subject = source_image.crop(bbox)
    target_w, target_h = fit_within_box(subject.width, subject.height, int(canvas_size * 0.76), int(canvas_size * 0.76))
    subject = subject.resize((target_w, target_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 255))

    shadow_alpha = subject.getchannel("A").resize((target_w, target_h), Image.LANCZOS)
    shadow = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    shadow.putalpha(shadow_alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    shadow_layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    paste_x = (canvas_size - target_w) // 2
    paste_y = max(int(canvas_size * 0.12), (canvas_size - target_h) // 2 - int(canvas_size * 0.02))
    shadow_y = min(canvas_size - target_h, paste_y + max(18, int(canvas_size * 0.035)))
    shadow_layer.alpha_composite(shadow, (paste_x, shadow_y))

    canvas = Image.alpha_composite(canvas, shadow_layer)
    canvas.alpha_composite(subject, (paste_x, paste_y))
    return canvas, {"x": paste_x, "y": paste_y, "width": target_w, "height": target_h}

def enhancement_quality_ok(image_size, bbox):
    if not bbox:
        return False
    width = max(1, image_size[0])
    height = max(1, image_size[1])
    box_w = max(1, bbox[2] - bbox[0])
    box_h = max(1, bbox[3] - bbox[1])
    width_ratio = box_w / width
    height_ratio = box_h / height
    area_ratio = (box_w * box_h) / max(1, width * height)
    bottom_ratio = bbox[3] / height

    if width_ratio < 0.26 or height_ratio < 0.24:
        return False
    if area_ratio < 0.09:
        return False
    if bottom_ratio > 0.96 and width_ratio < 0.58 and height_ratio > 0.72:
        return False
    if area_ratio < 0.16 and height_ratio > 0.76:
        return False
    return True

def add_soft_stage_background(image):
    canvas = image.copy()
    base = Image.new("RGBA", canvas.size, (255, 255, 255, 255))

    # Keep the marketplace background mostly pure white while adding a subtle floor fade.
    floor = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    for y in range(canvas.height):
        progress = y / max(1, canvas.height - 1)
        alpha = 0
        if progress > 0.58:
            alpha = int(min(20, ((progress - 0.58) / 0.42) * 20))
        band = Image.new("RGBA", (canvas.width, 1), (235, 238, 242, alpha))
        floor.alpha_composite(band, (0, y))

    composed = Image.alpha_composite(base, floor)
    return Image.alpha_composite(composed, canvas)

def serialize_embedding(vector):
    return json.dumps([round(float(v), 8) for v in vector])

def deserialize_embedding(raw: str):
    values = json_loads_safe(raw, [])
    return [float(v) for v in values] if values else []

def normalize_vector(vector):
    if not vector:
        return []
    denom = math.sqrt(sum(float(v) * float(v) for v in vector))
    if denom <= 1e-12:
        return [0.0 for _ in vector]
    return [float(v) / denom for v in vector]

def cosine_similarity(vec_a, vec_b):
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    return float(sum(a * b for a, b in zip(vec_a, vec_b)))

def compute_visual_embedding(image_bytes: bytes):
    image = load_pil_image(image_bytes).convert("RGB")
    clip_bundle = get_clip_bundle()
    if clip_bundle:
        processor, model = clip_bundle
        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            vector = model.get_image_features(**inputs)[0].detach().cpu().tolist()
        return normalize_vector(vector), VISUAL_EMBED_MODEL

    thumb = ImageOps.fit(image, (64, 64), method=Image.LANCZOS).convert("RGB")
    histogram = thumb.histogram()
    if np is not None:
        arr = np.asarray(thumb, dtype="float32") / 255.0
        channel_means = arr.mean(axis=(0, 1)).tolist()
        channel_stds = arr.std(axis=(0, 1)).tolist()
        flat = arr.reshape(-1, 3)
        stripe = arr[::8, ::8, :].flatten().tolist()
    else:
        pixels = list(thumb.getdata())
        total = max(1, len(pixels))
        channel_means = [sum(px[i] for px in pixels) / (255.0 * total) for i in range(3)]
        channel_stds = [0.0, 0.0, 0.0]
        stripe = []
        sample = pixels[::64]
        for r, g, b in sample:
            stripe.extend([r / 255.0, g / 255.0, b / 255.0])

    hist_slice = [h / max(1, sum(histogram)) for h in histogram[::4]]
    vector = hist_slice + channel_means + channel_stds + stripe[:192]
    return normalize_vector(vector), "fallback-histogram-v1"

def load_local_upload_bytes(image_url: str):
    if not image_url:
        return None
    parsed = urllib.parse.urlparse(image_url)
    if parsed.scheme in {"http", "https"}:
        if parsed.netloc and "localhost:8080" not in parsed.netloc and PUBLIC_BASE_URL.split("://")[-1] not in parsed.netloc:
            return None
        path = parsed.path
    else:
        path = image_url
    if "/uploads/" in path:
        filename = path.split("/uploads/")[-1]
        filepath = UPLOAD_DIR / filename
        if filepath.exists():
            return filepath.read_bytes()
    return None

def local_image_analysis(image_bytes: bytes, filename: str, prepared_image=None):
    image = prepared_image
    if image is None:
        image, _ = remove_background_with_model(image_bytes)
    bbox = detect_subject_bbox(image)
    crop = image.crop(bbox).convert("RGB")
    thumb = ImageOps.fit(crop, (48, 48), method=Image.LANCZOS)
    if np is not None:
        arr = np.asarray(thumb, dtype="float32")
        brightness = float(arr.mean())
        contrast = float(arr.std())
    else:
        pixels = list(thumb.getdata())
        values = [(r + g + b) / 3.0 for r, g, b in pixels]
        brightness = sum(values) / max(1, len(values))
        contrast = 0.0
    confidence = "high" if bbox and (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) > image.width * image.height * 0.18 else "medium"
    ratio = (bbox[2] - bbox[0]) / max(1, bbox[3] - bbox[1]) if bbox else 1.0
    width_ratio = (bbox[2] - bbox[0]) / max(1, image.width) if bbox else 1.0
    height_ratio = (bbox[3] - bbox[1]) / max(1, image.height) if bbox else 1.0
    presentation = "fallback"
    if ratio > 1.28:
        presentation = "lower"
    elif width_ratio > 0.82 and height_ratio < 0.82:
        presentation = "upper"
    elif ratio > 1.05 or (width_ratio > 0.56 and height_ratio < 0.84):
        presentation = "upper"
    elif ratio < 0.76 or height_ratio > 0.86:
        presentation = "drape"
    color_name = detect_named_color(crop)
    meta = infer_basic_product_analysis(filename, presentation=presentation, color_name=color_name, bbox=bbox, image_size=image.size)
    meta["presentation"] = presentation
    meta.update(PRESENTATION_META[presentation])
    meta["confidence"] = confidence
    meta["color"] = color_name
    analysis_model = "local-heuristic"

    clip_category = classify_crop_with_clip(crop, LOCAL_ZERO_SHOT_LABELS["category"], threshold=0.31)
    clip_type = classify_crop_with_clip(crop, LOCAL_ZERO_SHOT_LABELS["productType"], threshold=0.31)
    clip_pattern = classify_crop_with_clip(crop, LOCAL_ZERO_SHOT_LABELS["pattern"], threshold=0.29)
    clip_gender = classify_crop_with_clip(crop, LOCAL_ZERO_SHOT_LABELS["gender"], threshold=0.28)
    clip_usage = classify_crop_with_clip(crop, LOCAL_ZERO_SHOT_LABELS["usage"], threshold=0.28)
    if any([clip_category, clip_type, clip_pattern, clip_gender, clip_usage]):
        analysis_model = "local-clip-zero-shot"

    if clip_category:
        meta["category"] = clip_category["label"]
    if clip_type:
        meta["productType"] = clip_type["label"]
    if clip_pattern:
        meta["pattern"] = clip_pattern["label"].lower()
    if clip_gender:
        meta["gender"] = clip_gender["label"].lower()
    if clip_usage:
        meta["usage"] = clip_usage["label"].lower()

    if presentation == "drape" and meta["category"] == "Kurtis":
        meta["sizes"] = "S,M,L,XL"
        meta["material"] = "Rayon Blend"
        meta["pattern"] = "embroidered"
        meta["style"] = "ethnic"
        meta["gender"] = "women"
        meta["usage"] = "festive"
        meta["description"] = f"{color_name} ethnic kurti with a flowy silhouette, festive detailing, and catalogue-ready styling."
        meta["tags"] = [color_name.lower(), "kurti", "ethnicwear", "women", "festive", "embroidered"]
    elif presentation == "drape" and meta["productType"] in {"lehenga", "Lehenga Choli (3-piece set)"}:
        meta["sizes"] = "2Y,4Y,6Y,8Y"
        meta["material"] = "Net Blend"
        meta["pattern"] = "embroidered"
        meta["style"] = "ethnic"
        meta["gender"] = "girls"
        meta["usage"] = "festive"
        if color_name in {"Cream", "Beige", "Gold", "White"}:
            meta["color"] = "Ivory / Off-White with Gold Accents"
        meta["category"] = "Kids Ethnic Wear"
        meta["productType"] = "Lehenga Choli (3-piece set)"
        meta["name"] = "Girls Embroidered Lehenga Choli Set with Dupatta"
        meta["description"] = f"{meta['color']} girls embroidered lehenga choli set with dupatta, festive detailing, elegant flare, and a catalogue-ready ethnic look."
        meta["tags"] = ["girls", "kids-ethnic-wear", "lehenga-choli-set", "dupatta", "festive", "embroidered", meta["color"].lower().replace(' / ', '-').replace(' ', '-')]
    elif presentation == "drape" and meta["category"] == "Dresses":
        meta["sizes"] = "S,M,L,XL"
        meta["material"] = "Viscose Blend"
        meta["pattern"] = "printed" if contrast > 52 else "plain"
        meta["style"] = "occasion"
        meta["gender"] = "women"
        meta["usage"] = "partywear"
        meta["description"] = f"{color_name} long dress with a graceful fall, elegant fit, and polished everyday occasion styling."
        meta["tags"] = [color_name.lower(), "dress", "women", "fashion", "partywear", meta["pattern"]]
    elif presentation == "upper":
        meta["sizes"] = "M,L,XL"
        meta["material"] = "Cotton Blend"
        meta["pattern"] = "striped" if contrast > 58 else "plain"
        meta["style"] = "casual"
        meta["gender"] = "men"
        meta["usage"] = "everyday"
        meta["description"] = f"{color_name} casual shirt with a clean button-down profile, everyday comfort, and a polished smart-casual look."
        meta["tags"] = [color_name.lower(), "shirt", "menswear", "fashion", "casual", meta["pattern"]]
    elif presentation == "lower":
        meta["sizes"] = "30,32,34,36"
        meta["material"] = "Denim Blend"
        meta["pattern"] = "plain"
        meta["style"] = "casual"
        meta["gender"] = "men"
        meta["usage"] = "dailywear"
        meta["description"] = f"{color_name} bottom-wear with a structured fit, clean silhouette, and versatile everyday styling."
        meta["tags"] = [color_name.lower(), "pants", "bottomwear", "fashion", "casual"]
    meta["detail"] = f"{meta['detail']} Subject auto-centered with soft white-stage enhancement."
    meta["qualityScore"] = round(min(0.99, max(0.55, (contrast / 90.0) + (brightness / 512.0))), 2)
    meta["analysisSource"] = "local-model"
    meta["analysisModel"] = analysis_model
    return meta

def merge_product_analysis(local_analysis: dict, enriched: dict) -> dict:
    analysis = dict(local_analysis or {})
    enriched = enriched or {}

    for key, value in enriched.items():
        if value in [None, "", [], {}]:
            continue
        analysis[key] = value

    # Keep strong local color/category cues when the AI output is weak or generic.
    if local_analysis.get("color"):
        enriched_color = (enriched.get("color") or "").strip().lower()
        if not enriched_color or enriched_color in {"unknown", "multi", "mixed", "multiple"}:
            analysis["color"] = local_analysis["color"]

    if local_analysis.get("category"):
        enriched_category = (enriched.get("category") or "").strip().lower()
        if not enriched_category or enriched_category in {"fashion", "apparel", "clothing"}:
            analysis["category"] = local_analysis["category"]

    if local_analysis.get("productType"):
        enriched_type = (enriched.get("productType") or "").strip().lower()
        if not enriched_type or enriched_type in {"fashion", "apparel", "product"}:
            analysis["productType"] = local_analysis["productType"]

    if local_analysis.get("material") and not enriched.get("material"):
        analysis["material"] = local_analysis["material"]

    for key in ("pattern", "style", "gender", "usage"):
        if local_analysis.get(key) and not enriched.get(key):
            analysis[key] = local_analysis[key]

    if local_analysis.get("tags") and not enriched.get("tags"):
        analysis["tags"] = local_analysis["tags"]

    analysis["processingMode"] = local_analysis.get("processingMode", analysis.get("processingMode", "local-fallback"))
    return analysis

def process_product_image(image_bytes: bytes, filename: str):
    image, bg_removed, cleanup_provider = remove_background_with_provider(image_bytes, filename)
    bbox = detect_subject_bbox(image)
    if not enhancement_quality_ok(image.size, bbox):
        raise HTTPException(422, "Enhanced crop quality was not good enough. Use the original image or crop the garment more tightly.")
    canvas, placement = center_subject_on_canvas(image, bbox, 1000)
    final = add_soft_stage_background(canvas).convert("RGB")
    output = io.BytesIO()
    final.save(output, format="JPEG", quality=92, optimize=True)
    analysis = local_image_analysis(image_bytes, filename, prepared_image=image)
    analysis["backgroundRemoved"] = bg_removed
    analysis["canvasSize"] = 1000
    analysis["placement"] = placement
    analysis["processingMode"] = cleanup_provider if bg_removed else "local-fallback"
    return output.getvalue(), analysis

def index_product_visual_embedding(product: Product):
    source_url = getattr(product, "processed_image_url", None) or product.image_url
    image_bytes = load_local_upload_bytes(source_url)
    if not image_bytes:
        return False
    vector, model_name = compute_visual_embedding(image_bytes)
    product.visual_embedding = serialize_embedding(vector)
    product.visual_embedding_model = model_name
    return True

def build_visual_candidates(db: Session, lat: Optional[float] = None, lng: Optional[float] = None,
                            radius: Optional[float] = 20.0, category: Optional[str] = None):
    query = db.query(Product).filter(Product.is_active == True)
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))
    products = query.all()
    bounded_radius = get_discovery_radius_limit(radius)
    candidates = []
    for product in products:
        if lat is not None and lng is not None and product.shop and product.shop.lat and product.shop.lng:
            distance = haversine(lat, lng, product.shop.lat, product.shop.lng)
            if bounded_radius is not None and distance > bounded_radius:
                continue
        else:
            distance = None
        candidates.append((product, distance))
    return candidates

def rank_visual_matches(query_vector, candidates, limit: int = 12):
    scored = []
    vectors = []
    indexed_rows = []
    for product, distance in candidates:
        stored = deserialize_embedding(getattr(product, "visual_embedding", None))
        if not stored:
            if not index_product_visual_embedding(product):
                continue
            stored = deserialize_embedding(getattr(product, "visual_embedding", None))
        if not stored:
            continue
        score = cosine_similarity(query_vector, stored)
        scored.append((product, distance, score))
        vectors.append(stored)
        indexed_rows.append((product, distance))

    if faiss and vectors and np is not None:
        matrix = np.asarray(vectors, dtype="float32")
        q = np.asarray([query_vector], dtype="float32")
        index = faiss.IndexFlatIP(matrix.shape[1])
        index.add(matrix)
        scores, ids = index.search(q, min(limit, len(indexed_rows)))
        ordered = []
        for score, idx in zip(scores[0], ids[0]):
            if idx < 0:
                continue
            product, distance = indexed_rows[int(idx)]
            ordered.append((product, distance, float(score)))
        return ordered

    scored.sort(key=lambda row: row[2], reverse=True)
    return scored[:limit]

def infer_presentation_key(text: str) -> str:
    value = (text or "").lower()
    if any(token in value for token in ["shirt", "t-shirt", "tshirt", "tee", "kurta", "top", "hoodie", "jacket", "blazer", "sweatshirt"]):
        return "upper"
    if any(token in value for token in ["saree", "sari", "dress", "gown", "kurti", "lehenga", "dupatta"]):
        return "drape"
    if any(token in value for token in ["pant", "pants", "trouser", "trousers", "jean", "jeans", "jogger", "legging", "palazzo", "shorts", "bottom"]):
        return "lower"
    return "fallback"

def normalize_ai_product_analysis(result: dict, source: str) -> dict:
    combined = " ".join([
        str(result.get("productType", "")),
        str(result.get("category", "")),
        str(result.get("presentation", "")),
    ])
    key = infer_presentation_key(combined) if result.get("presentation") not in PRESENTATION_META else result["presentation"]
    meta = PRESENTATION_META[key]
    return {
        "name": result.get("name", ""),
        "productType": result.get("productType", ""),
        "category": result.get("category", ""),
        "brand": "",
        "color": result.get("color", ""),
        "material": result.get("material", ""),
        "fabric": result.get("fabric", result.get("material", "")),
        "pattern": result.get("pattern", ""),
        "style": result.get("style", ""),
        "gender": result.get("gender", ""),
        "usage": result.get("usage", result.get("occasion", "")),
        "fit": result.get("fit", ""),
        "occasion": result.get("occasion", result.get("usage", "")),
        "sleeveType": result.get("sleeveType", ""),
        "length": result.get("length", ""),
        "mrp": result.get("mrp", ""),
        "suggestedPrice": result.get("suggestedPrice", ""),
        "description": result.get("description", ""),
        "tags": [],
        "sizes": result.get("sizes", ""),
        "confidence": result.get("confidence", "medium"),
        "presentation": key,
        "badge": meta["badge"],
        "title": result.get("title") or meta["title"],
        "detail": result.get("detail") or meta["detail"],
        "analysisModel": source,
    }

def parse_json_text(text: str) -> dict:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end >= start:
        cleaned = cleaned[start:end + 1]
    return json.loads(cleaned)

def product_analysis_prompt() -> str:
    return (
        "Analyze this product photo for DOTT vendor product listing auto-fill. "
        "Detect only the exact visible product name/type, category, and dominant garment color first; also return useful listing details when clearly visible. "
        "Do not guess from filename. Use only the garment/product in the image. "
        "Do not detect or return brand names, logos, seller names, or tags. Set brand to an empty string and tags to an empty array. "
        "Choose category from: Kids, Dresses, Kurtis, Kurtas, Sarees, Shirts, T-Shirts, Jeans, Trousers, Jackets, Sweatshirts, Skirts, Accessories, Fashion. "
        "Use accurate Indian fashion labels where relevant, for example lehenga, kurti, kurta, saree, dress, shirt, t-shirt, jeans, trousers, jacket. "
        "Color must be accurate for the main garment fabric, not the background, phone screen, border, shadow, or model. Distinguish black, charcoal, navy, dark teal, teal, white, off-white, cream, beige, gold, grey, maroon, etc. "
        "Return sizes only for products that truly need size variants, such as shirts, kurtas, kurtis, jeans, trousers, dresses, lehengas, jackets, sweatshirts, skirts, and kids wear. For sarees and accessories, return sizes as an empty string. "
        "Presentation must be exactly one of upper, drape, lower, fallback. "
        "Return strict JSON with keys: name,title,productType,category,brand,color,material,fabric,pattern,style,gender,usage,fit,occasion,sleeveType,length,mrp,suggestedPrice,description,tags,sizes,confidence,presentation,detail."
    )

def analyze_product_image_with_gemini(image_bytes: bytes, filename: str) -> dict:
    media_type = guess_media_type(filename)
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {
                    "inline_data": {
                        "mime_type": media_type,
                        "data": base64.b64encode(image_bytes).decode("utf-8"),
                    }
                },
                {"text": product_analysis_prompt()},
            ],
        }],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    data = gemini_request(GEMINI_MODEL, payload)
    parts = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
    text = "\n".join(part.get("text", "") for part in parts if part.get("text"))
    if not text:
        raise HTTPException(502, "Gemini analysis returned no structured output.")
    try:
        parsed = parse_json_text(text)
    except Exception as exc:
        raise HTTPException(502, f"Gemini analysis returned invalid JSON: {exc}")
    return normalize_ai_product_analysis(parsed, "gemini")

def get_best_product_analysis(image_bytes: bytes, filename: str, local_analysis: dict):
    def local_fallback(issue: str = ""):
        try:
            _bytes, detected = process_product_image(image_bytes, filename)
            base = merge_product_analysis(local_analysis or {}, detected or {})
        except Exception:
            base = dict(local_analysis or {})
        base = merge_model_prediction(base, image_bytes)
        if not base.get("category") and not base.get("productType"):
            base.update(infer_basic_product_analysis(filename))
        base["analysisSource"] = "local-fallback"
        base["analysisIssue"] = issue
        return base

    if not configured_gemini_api_key():
        return local_fallback("Gemini API key is not configured; local draft used.")
    try:
        enriched = analyze_product_image_with_gemini(image_bytes, filename)
        analysis = merge_product_analysis(local_analysis or {}, enriched)
        analysis["analysisSource"] = "gemini"
        analysis["analysisIssue"] = ""
        return analysis
    except HTTPException as exc:
        return local_fallback(str(exc.detail))
    except Exception as exc:
        return local_fallback(str(exc))

def build_analysis_upload_response(user_id: int, optimized: bytes, filename: str, enhance_image: bool = False) -> dict:
    original_saved = save_image_bytes(user_id, optimized, "jpg")
    local_analysis = {
        "backgroundRemoved": False,
        "canvasSize": None,
        "placement": None,
        "processingMode": "analysis-only",
    }
    analysis = get_best_product_analysis(optimized, filename, local_analysis)
    autofill = generate_product_copy(analysis, original_saved["url"])
    if enhance_image:
        catalog_bytes, processing_mode, image_edited, image_issue = build_catalog_image(
            optimized,
            filename,
            analysis,
            True,
        )
        transformed_saved = save_image_bytes(user_id, catalog_bytes, "jpg")
    else:
        transformed_saved = original_saved
        processing_mode = "analysis-only"
        image_edited = False
        image_issue = ""
    analysis = {
        **analysis,
        **autofill,
        "title": autofill["title"],
        "name": autofill["name"],
        "category": autofill["category"],
        "color": autofill["color"],
        "brand": autofill["brand"],
        "description": autofill["description"],
        "tags": autofill["tags"],
        "suggestedPrice": autofill["price"],
        "gender": autofill["gender"],
        "fabric": autofill["fabric"],
        "pattern": autofill["pattern"],
        "fit": autofill["fit"],
        "occasion": autofill["occasion"],
        "sleeveType": autofill["sleeveType"],
        "length": autofill["length"],
        "productType": autofill["productType"],
        "image_path": autofill["image_path"],
        "processingMode": processing_mode,
    }
    return {
        "originalUrl": original_saved["url"],
        "transformedUrl": transformed_saved["url"],
        "analysis": analysis,
        "autofill": autofill,
        "analysisSource": analysis.get("analysisSource", "gemini"),
        "analysisIssue": image_issue or analysis.get("analysisIssue", ""),
        "imageEdited": image_edited,
        "enhancementRejected": bool(image_issue),
        "processingMode": processing_mode,
    }

def extract_gemini_inline_image(data: dict) -> tuple[bytes, str]:
    parts = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
    for part in parts:
        inline_data = part.get("inlineData") or part.get("inline_data")
        if not inline_data:
            continue
        raw = inline_data.get("data")
        if not raw:
            continue
        mime_type = inline_data.get("mimeType") or inline_data.get("mime_type") or "image/png"
        return base64.b64decode(raw), mime_type
    raise HTTPException(502, "Gemini image edit returned no image output.")

def gemini_edit_product_image(image_bytes: bytes, filename: str, analysis: dict) -> tuple[bytes, str]:
    media_type = guess_media_type(filename)
    prompt = build_image_edit_prompt(analysis)
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": media_type,
                        "data": base64.b64encode(image_bytes).decode("utf-8"),
                    }
                },
            ],
        }],
        "generationConfig": {
            "temperature": 0.25,
            "responseModalities": ["TEXT", "IMAGE"],
        },
    }
    data = gemini_request(GEMINI_IMAGE_MODEL, payload)
    edited_bytes, output_mime = extract_gemini_inline_image(data)
    return optimize_upload_image(edited_bytes, max_side=1600, quality=88), output_mime

def build_catalog_image(image_bytes: bytes, filename: str, analysis: dict, enhance_image: bool = True) -> tuple[bytes, str, bool, str]:
    if not enhance_image:
        return image_bytes, "original", False, ""
    try:
        edited, _mime_type = gemini_edit_product_image(image_bytes, filename, analysis)
        return edited, "gemini-image-edit", True, ""
    except HTTPException as exc:
        local = prepare_catalog_image_locally(image_bytes)
        return local, "local-catalog-fallback", False, str(exc.detail)
    except Exception as exc:
        local = prepare_catalog_image_locally(image_bytes)
        return local, "local-catalog-fallback", False, str(exc)

def build_image_edit_prompt(analysis: dict) -> str:
    base = (
        "Edit this product photo into a premium Amazon-style e-commerce catalogue image. "
        "Preserve the exact product color, fabric texture, logo placement, print, embroidery, silhouette, and all visible design details. "
        "Do not invent a different product, do not add text, do not add watermarks, and do not change the garment color. "
        "Improve low-quality lighting, sharpness, framing, and noise. Use a clean pure white or very light grey studio background, natural soft shadow, and centered square composition. "
    )
    presentation = analysis.get("presentation", "fallback")
    if presentation == "upper":
        return base + (
            "Place the garment on a realistic male model with natural torso proportions, proper fitting, aligned sleeves, and catalogue-quality styling."
        )
    if presentation == "drape":
        return base + (
            "Place or drape the garment on a realistic female model with natural folds, elegant styling, and accurate garment flow."
        )
    if presentation == "lower":
        return base + (
            "Fit the garment onto a realistic lower-body model with natural waist and leg proportions and balanced studio shadows."
        )
    return base + (
        "Do not place it on a model. Instead, enhance the original product shot with improved background cleanup, lighting, and shadow balance."
    )

# ── Schemas ────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str; email: str; phone: str; password: str; role: RoleEnum
    lat: Optional[float]=None; lng: Optional[float]=None

class LoginRequest(BaseModel):
    email: str; password: str
    lat: Optional[float]=None; lng: Optional[float]=None

class PhoneRegisterRequest(BaseModel):
    name: str; phone: str; pin: str
    role: Optional[RoleEnum]=RoleEnum.CUSTOMER
    lat: Optional[float]=None; lng: Optional[float]=None

class PhoneLoginRequest(BaseModel):
    phone: str; pin: str
    lat: Optional[float]=None; lng: Optional[float]=None

class SendOTPRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str
    name: Optional[str]=None
    phone: Optional[str]=None
    password: Optional[str]=None
    role: Optional[RoleEnum]=RoleEnum.CUSTOMER
    lat: Optional[float]=None
    lng: Optional[float]=None

class RiderLocationPing(BaseModel):
    lat: float; lng: float

class RefreshRequest(BaseModel):
    refreshToken: str

class LocationUpdate(BaseModel):
    lat: float; lng: float

class PushTokenRequest(BaseModel):
    token: str

class PushTestRequest(BaseModel):
    title: str
    body: str
    data: Optional[dict] = None

class AdminNearbyPushRequest(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    lat: float
    lng: float
    radiusKm: Optional[float] = None
    includeTopRated: Optional[bool] = True
    includeTopSelling: Optional[bool] = True
    includeOpenShops: Optional[bool] = True
    limit: Optional[int] = 3

class AdminBroadcastNotificationRequest(BaseModel):
    title: str
    body: str
    category: Optional[str] = "announcement"
    role: Optional[str] = None
    data: Optional[dict] = None

class PaymentDetailsUpdate(BaseModel):
    bankAccount:   Optional[str] = None
    bankIfsc:      Optional[str] = None
    bankName:      Optional[str] = None
    upiId:         Optional[str] = None
    phonepeNumber: Optional[str] = None
    gpayNumber:    Optional[str] = None
    paymentMethod: Optional[str] = "upi"  # "bank" or "upi" or "phonepe" or "gpay"

class RiderCodSettlementPay(BaseModel):
    amount: Optional[float] = None
    method: Optional[str] = "upi"
    paymentReference: Optional[str] = ""
    note: Optional[str] = None

class ShopCreate(BaseModel):
    name: str; description: Optional[str]=None; category: str; address: str
    city: Optional[str]="Hyderabad"; pincode: Optional[str]=None; phone: Optional[str]=None
    lat: Optional[float]=None; lng: Optional[float]=None; imageUrl: Optional[str]=None
    deliveryTime: Optional[int]=25; minOrder: Optional[float]=0.0
    acceptsReturns: Optional[bool]=False; returnDays: Optional[int]=0; returnPolicyNote: Optional[str]=""

class ShopUpdate(BaseModel):
    name: Optional[str]=None; description: Optional[str]=None
    address: Optional[str]=None; city: Optional[str]=None; phone: Optional[str]=None
    lat: Optional[float]=None; lng: Optional[float]=None
    isOpen: Optional[bool]=None; isSuspended: Optional[bool]=None
    deliveryTime: Optional[int]=None; minOrder: Optional[float]=None; imageUrl: Optional[str]=None
    acceptsReturns: Optional[bool]=None; returnDays: Optional[int]=None; returnPolicyNote: Optional[str]=None
    whatsappMode: Optional[bool]=None; whatsappPhone: Optional[str]=None

class ProductCreate(BaseModel):
    name: str; description: Optional[str]=None; price: float
    category: Optional[str]=None; imageUrl: Optional[str]=None
    processedImageUrl: Optional[str]=None
    title: Optional[str]=None
    productType: Optional[str]=None
    color: Optional[str]=None
    images: Optional[str]="[]"
    colors: Optional[str]="[]"
    brand: Optional[str]=None; material: Optional[str]=None
    fabric: Optional[str]=None; gender: Optional[str]=None
    pattern: Optional[str]=None; fit: Optional[str]=None
    occasion: Optional[str]=None; sleeveType: Optional[str]=None
    length: Optional[str]=None
    tags: Optional[str]="[]"
    imageAiMeta: Optional[str]="{}"
    stock: Optional[int]=10; isVeg: Optional[bool]=True
    hasSizes: Optional[bool]=False; sizes: Optional[str]="[]"

class ProductUpdate(BaseModel):
    name: Optional[str]=None; price: Optional[float]=None; description: Optional[str]=None
    category: Optional[str]=None; imageUrl: Optional[str]=None
    processedImageUrl: Optional[str]=None
    title: Optional[str]=None
    productType: Optional[str]=None
    color: Optional[str]=None
    images: Optional[str]=None; colors: Optional[str]=None
    brand: Optional[str]=None; material: Optional[str]=None
    fabric: Optional[str]=None; gender: Optional[str]=None
    pattern: Optional[str]=None; fit: Optional[str]=None
    occasion: Optional[str]=None; sleeveType: Optional[str]=None
    length: Optional[str]=None; tags: Optional[str]=None
    imageAiMeta: Optional[str]=None
    isActive: Optional[bool]=None; stock: Optional[int]=None; isVeg: Optional[bool]=None
    hasSizes: Optional[bool]=None; sizes: Optional[str]=None

class OrderItemIn(BaseModel):
    productId: int; qty: int; size: Optional[str]=None

class OrderCreate(BaseModel):
    shopId: int; items: List[OrderItemIn]; deliveryAddress: str
    deliveryLat: Optional[float]=None; deliveryLng: Optional[float]=None
    paymentMethod: Optional[str]="cod"; promoCode: Optional[str]=None; notes: Optional[str]=None
    weather: Optional[str]=None
    deliveryRadiusKm: Optional[float]=None
    maxRadiusKm: Optional[float]=None

class StatusUpdate(BaseModel):
    status: OrderStatusEnum; riderId: Optional[int]=None

class PickupOtpVerifyRequest(BaseModel):
    otp: str

class ReviewCreate(BaseModel):
    productId: int; orderId: int; rating: int; comment: Optional[str]=None; images: Optional[List[str]]=[]

class ReturnCreate(BaseModel):
    orderId: int
    reason: str
    reasonCode: Optional[str]="OTHER"
    requestType: Optional[str]="refund"
    evidenceImageUrl: Optional[str]=None
    conditionAccepted: Optional[bool]=False

class ReturnVendorUpdate(BaseModel):
    status: ReturnStatusEnum; vendorNote: Optional[str]=None

class BlockUpdate(BaseModel):
    isBlocked: bool

class ShopLocationReview(BaseModel):
    approved: bool
    note: Optional[str] = ""

# ── Serializers ────────────────────────────────────────────────────
def user_dict(u: User, dist=None):
    d = {"id":u.id,"name":u.name,"email":u.email,"phone":u.phone,
         "role":u.role,"isOnline":u.is_online,"isBlocked":u.is_blocked,
         "isVerified":u.is_verified,"lat":u.lat,"lng":u.lng,
         "upiId":u.upi_id,"bankAccount":u.bank_account,"bankIfsc":u.bank_ifsc,
         "bankName":u.bank_name,"phonepeNumber":getattr(u, "phonepe_number", None),
         "gpayNumber":getattr(u, "gpay_number", None),"paymentMethod":u.payment_method,
         "isPremium":getattr(u, "is_premium", False),
         "subscriptionPlan":getattr(u, "subscription_plan", "standard"),
         "returnsThisMonth":getattr(u, "returns_this_month", 0),
         "highReturnUser":getattr(u, "high_return_user", False),
         "codEnabled":getattr(u, "cod_enabled", True),
         "hasPushToken": bool(getattr(u, "fcm_token", None))}
    if dist is not None: d["distanceKm"] = round(dist, 1)
    return d

def shop_dict(s: Shop, dist=None):
    d = {"id":s.id,"name":s.name,"description":s.description,"category":s.category,
         "address":s.address,"city":s.city,"pincode":s.pincode,"phone":s.phone,
         "lat":s.lat,"lng":s.lng,"imageUrl":s.image_url,"openTime":s.open_time,
         "closeTime":s.close_time,"deliveryTime":s.delivery_time,"minOrder":s.min_order,
         "isOpen":s.is_open,"isSuspended":s.is_suspended,"isActive":s.is_active,"totalOrders":s.total_orders,
         "rating":round(s.rating, 1) if s.rating else 0.0,"ratingCount":s.rating_count,
         "ownerId":s.owner_id,"ownerName":s.owner.name if s.owner else None,
         "acceptsReturns":s.accepts_returns,"returnDays":s.return_days,
         "returnPolicyNote":s.return_policy_note,
         "whatsappMode":s.whatsapp_mode,"whatsappPhone":s.whatsapp_phone or s.phone}
    if dist is not None: d["distanceKm"] = round(dist, 1)
    return d

def location_changed(current_lat, current_lng, next_lat, next_lng) -> bool:
    if next_lat is None and next_lng is None:
        return False
    if current_lat is None or current_lng is None:
        return next_lat is not None and next_lng is not None
    if next_lat is None or next_lng is None:
        return False
    return abs(float(current_lat) - float(next_lat)) > 0.000001 or abs(float(current_lng) - float(next_lng)) > 0.000001

def shop_location_request_dict(req: "ShopLocationChangeRequest"):
    shop = req.shop
    owner = req.owner
    return {
        "id": req.id,
        "shopId": req.shop_id,
        "shopName": shop.name if shop else None,
        "ownerId": req.owner_id,
        "ownerName": owner.name if owner else None,
        "ownerPhone": owner.phone if owner else None,
        "oldLat": req.old_lat,
        "oldLng": req.old_lng,
        "newLat": req.new_lat,
        "newLng": req.new_lng,
        "oldAddress": req.old_address,
        "newAddress": req.new_address,
        "oldCity": req.old_city,
        "newCity": req.new_city,
        "status": req.status,
        "adminNote": req.admin_note or "",
        "createdAt": req.created_at.isoformat() if req.created_at else None,
        "reviewedAt": req.reviewed_at.isoformat() if req.reviewed_at else None,
    }

def product_dict(p: Product, include_reviews=False):
    sizes_list = []; colors_list = []; images_list = []; tags_list = []
    try: sizes_list = json.loads(p.sizes or "[]")
    except: pass
    try: colors_list = json.loads(p.colors or "[]")
    except: pass
    try: images_list = json.loads(getattr(p,'images',None) or "[]")
    except: pass
    try: tags_list = json.loads(getattr(p,'tags',None) or "[]")
    except: pass
    total_stock = sum(s.get("stock",0) for s in sizes_list) if (p.has_sizes and sizes_list) else p.stock
    shop = getattr(p, "shop", None)
    d = {"id":p.id,"shopId":p.shop_id,"name":p.name,"description":p.description,
         "price":p.price,"category":p.category,"imageUrl":p.image_url,
         "title":getattr(p, "title", None),
         "productType":getattr(p, "product_type", None),
         "color":getattr(p, "color", None),
         "images":images_list,"colors":colors_list,
         "brand":getattr(p,'brand',None),"material":getattr(p,'material',None),
         "fabric":getattr(p,'fabric',None),"gender":getattr(p,'gender',None),
         "pattern":getattr(p,'pattern',None),"fit":getattr(p,'fit',None),
         "occasion":getattr(p,'occasion',None),"sleeveType":getattr(p,'sleeve_type',None),
         "length":getattr(p,'length',None),"tags":tags_list,
         "processedImageUrl":getattr(p, "processed_image_url", None),
         "imageAiMeta":json_loads_safe(getattr(p, "image_ai_meta", "{}"), {}),
         "visualIndexed":bool(getattr(p, "visual_embedding", None)),
         "visualEmbeddingModel":getattr(p, "visual_embedding_model", None),
         "shopName":shop.name if shop else None,
         "shopLat":shop.lat if shop else None,
         "shopLng":shop.lng if shop else None,
         "shopIsOpen":bool(shop.is_open) if shop else True,
         "shopIsSuspended":bool(shop.is_suspended) if shop else False,
         "shopIsActive":bool(shop.is_active) if shop else True,
         "stock":total_stock,"isActive":p.is_active,"isVeg":p.is_veg,
         "hasSizes":p.has_sizes,"sizes":sizes_list,
         "avgRating": round(sum(r.rating for r in p.reviews)/len(p.reviews),1) if p.reviews else 0,
         "reviewCount": len(p.reviews)}
    if include_reviews:
        d["reviews"] = [{"id":r.id,"rating":r.rating,"comment":r.comment,
                         "images":json_loads_safe(getattr(r, "images", "[]"), []),
                         "customerName":r.customer.name,"createdAt":r.created_at.isoformat()} for r in p.reviews]
    return d

def order_dict(o: Order):
    timer = order_timer_snapshot(o)
    o.countdown_alert_level = timer["alertLevel"]
    ret = None
    if o.return_request:
        ret = {"id":o.return_request.id,"status":o.return_request.status,
               "reason":o.return_request.reason,"vendorNote":o.return_request.vendor_note,
               "reasonCode":getattr(o.return_request, "reason_code", "OTHER"),
               "requestType":getattr(o.return_request, "request_type", "refund"),
               "policyDecision":getattr(o.return_request, "policy_decision", "UNDER_REVIEW"),
               "returnFee":getattr(o.return_request, "return_fee", 0.0),
               "refundAmount":getattr(o.return_request, "refund_amount", 0.0),
               "pickupStatus":getattr(o.return_request, "pickup_status", "PENDING"),
               "pickupEta":getattr(o.return_request, "pickup_eta", None),
               "pickupRider": {"id": o.return_request.pickup_rider.id, "name": o.return_request.pickup_rider.name, "phone": o.return_request.pickup_rider.phone} if getattr(o.return_request, "pickup_rider", None) else None,
               "exchangeAllowed":getattr(o.return_request, "exchange_allowed", False),
               "evidenceImageUrl":getattr(o.return_request, "evidence_image_url", None),
               "createdAt":o.return_request.created_at.isoformat()}
    shop_ret = None
    if o.shop:
        shop_ret = {"acceptsReturns":o.shop.accepts_returns,"returnDays":o.shop.return_days,
                    "returnPolicyNote":o.shop.return_policy_note}
    return {
        "id":o.id,"orderCode":o.order_code,"status":o.status,
        "paymentMethod":o.payment_method,"subtotal":o.subtotal,
        "deliveryFee":o.delivery_fee,"deliveryKm":round(o.delivery_km or 0,1),
        "baseDeliveryFee":getattr(o, "base_delivery_fee", BASE_DELIVERY_FEE),
        "distanceFee":getattr(o, "distance_fee", 0.0),
        "surgeFee":getattr(o, "surge_fee", 0.0),
        "platformFee":getattr(o, "platform_fee", PLATFORM_FEE),
        "gstRate":getattr(o, "gst_rate", 0.05),
        "gstAmount":getattr(o, "gst_amount", 0.0),
        "freeDeliveryDiscount":getattr(o, "free_delivery_discount", 0.0),
        "discount":o.discount,"total":o.total,"riderEarning":o.rider_earning,
        "tryAndReturnEligible":getattr(o, "try_and_return_eligible", False),
        "returnWindowHours":getattr(o, "return_window_hours", 48),
        "refundAmount":getattr(o, "refund_amount", 0.0),
        "refundStatus":getattr(o, "refund_status", "NOT_APPLICABLE"),
        "codDueAmount":getattr(o, "cod_due_amount", o.total if (o.payment_method or "").lower() == "cod" else 0.0),
        "codCollected":getattr(o, "cod_collected", False),
        "riderBonus":getattr(o, "rider_bonus", 0.0),
        "riderPenalty":getattr(o, "rider_penalty", 0.0),
        "countdownAlertLevel":getattr(o, "countdown_alert_level", timer["alertLevel"]),
        "pricingMeta": json.loads(getattr(o, "pricing_meta", "{}") or "{}"),
        "deliveryAddress":o.delivery_address,"deliveryLat":o.delivery_lat,"deliveryLng":o.delivery_lng,
        "notes":o.notes,"promoCode":o.promo_code,"isReviewed":o.is_reviewed,
        "placedAt":o.placed_at.isoformat() if o.placed_at else None,
        "confirmedAt":o.confirmed_at.isoformat() if o.confirmed_at else None,
        "orderStartTime":getattr(o, "order_start_time", None).isoformat() if getattr(o, "order_start_time", None) else None,
        "deliveryDeadline":getattr(o, "delivery_deadline", None).isoformat() if getattr(o, "delivery_deadline", None) else None,
        "deliveredTime":getattr(o, "delivered_time", None).isoformat() if getattr(o, "delivered_time", None) else None,
        "deliveredAt":o.delivered_at.isoformat() if o.delivered_at else None,
        "isDelayed":timer["isDelayed"],
        "countdown":timer,
        "customer":{"id":o.customer.id,"name":o.customer.name,"phone":o.customer.phone} if o.customer else None,
        "shop":{"id":o.shop.id,"name":o.shop.name,"address":o.shop.address,
                "lat":o.shop.lat,"lng":o.shop.lng,"phone":o.shop.phone,**(shop_ret or {})} if o.shop else None,
        "rider":{"id":o.rider.id,"name":o.rider.name,"phone":o.rider.phone} if o.rider else None,
        "riderId":o.rider_id,
        "pickupOtpRequired": o.status == OrderStatusEnum.PACKING and bool(o.rider_id),
        "pickupOtpGeneratedAt": o.pickup_otp_generated_at.isoformat() if getattr(o, "pickup_otp_generated_at", None) else None,
        "pickupOtpVerified": bool(getattr(o, "pickup_otp_used", False)),
        "pickupOtpVerifiedAt": o.pickup_otp_verified_at.isoformat() if getattr(o, "pickup_otp_verified_at", None) else None,
        "items":[{"id":i.id,"productId":i.product_id,"name":i.name,
                  "price":i.price,"qty":i.qty,"size":i.size,"imageUrl":i.image_url} for i in o.items],
        "returnRequest": ret,
    }

def build_auth(user: User, db: Session):
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    rt = RefreshToken(user_id=user.id, token=refresh, expires_at=utc_now()+timedelta(days=7))
    db.add(rt); db.commit()
    return {"user":user_dict(user),"accessToken":access,"refreshToken":refresh}

def build_whatsapp_url(order, shop, customer, items_text):
    phone = (shop.whatsapp_phone or shop.phone or "").replace(" ","").replace("+","").replace("-","")
    if not phone: return None
    if not phone.startswith("91") and len(phone)==10: phone = "91" + phone
    maps_link = f"https://maps.google.com/?q={order.delivery_lat},{order.delivery_lng}" if order.delivery_lat else ""
    fee_line = f"Delivery fee: ₹{order.delivery_fee} ({round(order.delivery_km or 0,1)} km)"
    msg = (f"🛍 NEW ORDER on DOTT!\n{'─'*22}\n"
           f"Order: #{order.order_code}\nCustomer: {customer.name}\n📞 {customer.phone}\n"
           f"📍 {order.delivery_address}\n{maps_link}\n\nItems:\n{items_text}\n{'─'*22}\n"
           f"Subtotal: ₹{order.subtotal}\n{fee_line}\nTotal: ₹{order.total}\n"
           f"Payment: {order.payment_method.upper()}\n\nPlease confirm on DOTT app or reply here.")
    return f"https://wa.me/{phone}?text={urllib.parse.quote(msg)}"

# ═══════════════════════════════════════════════════════════════════
# OTP ENDPOINTS
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/otp/send")
def send_otp(req: SendOTPRequest, db: Session = Depends(get_db)):
    email = normalize_otp_email(req.email)
    if not rate_check(f"otp:{email}", limit=3, window=60):
        raise HTTPException(429, "Too many OTP requests. Try again in a minute.")
    otp = generate_otp()
    db.query(OTPStore).filter(OTPStore.phone == email, OTPStore.used == False).update({"used": True})
    db.add(OTPStore(phone=email, otp=hash_password(otp), expires_at=utc_now()+timedelta(minutes=5), used=False))
    db.commit()
    emailed = send_otp_email(email, otp)
    return {
        "sent": True,
        "email": email,
        "delivery": "email" if emailed else "demo",
        "devOtp": None if emailed else otp,
        "message": "OTP sent to email" if emailed else "OTP generated",
    }

@app.post("/api/otp/verify")
def verify_otp_endpoint(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    email = normalize_otp_email(req.email)
    supplied = req.otp.strip()
    if len(supplied) != 6 or not supplied.isdigit():
        raise HTTPException(400, "Enter the 6-digit OTP")
    row = (db.query(OTPStore)
           .filter(OTPStore.phone == email, OTPStore.used == False, OTPStore.expires_at >= utc_now())
           .order_by(OTPStore.created_at.desc())
           .first())
    if not row or not verify_otp_hash(row.otp, supplied):
        raise HTTPException(401, "Invalid or expired OTP")
    row.used = True
    user = db.query(User).filter(User.email == email).first()
    phone = normalize_optional_phone(req.phone)
    account_password = normalize_account_password(req.password)
    if phone:
        phone_owner = db.query(User).filter(User.phone == phone, User.email != email).first()
        if phone_owner:
            raise HTTPException(400, "Phone number already registered")
    if not user:
        role = req.role if req.role != RoleEnum.ADMIN else RoleEnum.CUSTOMER
        name = (req.name or email.split("@", 1)[0] or "Customer").strip()
        user = User(name=name, email=email, phone=phone,
                    password=hash_password(account_password or generate_otp()),
                    role=role or RoleEnum.CUSTOMER,
                    lat=req.lat, lng=req.lng, is_verified=True)
        db.add(user); db.commit(); db.refresh(user)
    else:
        if user.is_blocked:
            raise HTTPException(403, "Account is blocked")
        if phone:
            user.phone = phone
        if account_password:
            user.password = hash_password(account_password)
        if req.lat and req.lng:
            user.lat = req.lat; user.lng = req.lng
        db.commit()
    return build_auth(user, db)

# ═══════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(400, "Email already registered")
    if req.role == RoleEnum.ADMIN:
        raise HTTPException(400, "Cannot self-register as admin")
    user = User(name=req.name, email=req.email.lower(), phone=req.phone,
                password=hash_password(req.password), role=req.role,
                lat=req.lat, lng=req.lng, is_verified=True)
    db.add(user); db.commit(); db.refresh(user)
    return build_auth(user, db)

@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    login_id = (req.email or "").strip().lower()
    if "@" in login_id:
        user = db.query(User).filter(User.email == login_id).first()
    else:
        phone = normalize_optional_phone(login_id)
        user = db.query(User).filter(User.phone == phone).first() if phone else None
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(401, "Invalid credentials")
    if user.is_blocked: raise HTTPException(403, "Account is blocked")
    if req.lat and req.lng: user.lat = req.lat; user.lng = req.lng; db.commit()
    return build_auth(user, db)

@app.post("/api/auth/refresh")
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    token_user_id = decode_token(req.refreshToken, expected_type="refresh")
    rt = db.query(RefreshToken).filter(RefreshToken.token == req.refreshToken).first()
    if not rt or rt.expires_at < utc_now():
        if rt: db.delete(rt); db.commit()
        raise HTTPException(401, "Invalid or expired refresh token")
    if rt.user_id != token_user_id:
        raise HTTPException(401, "Invalid refresh token")
    return build_auth(rt.user, db)

@app.post("/api/auth/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
    db.commit(); return {"message":"Logged out"}

@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)): return user_dict(user)

@app.post("/api/notifications/register")
def register_push_token(body: PushTokenRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    token = body.token.strip()
    if len(token) < 20:
        raise HTTPException(400, "Invalid push token")
    user.fcm_token = token
    db.commit()
    return {"ok": True}

@app.post("/api/notifications/test")
def test_push(body: PushTestRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.fcm_token:
        raise HTTPException(400, "No push token registered")
    app = get_firebase_app()
    if not app or not messaging:
        raise HTTPException(503, "Firebase push is not configured on the backend")
    msg = messaging.Message(
        token=user.fcm_token,
        notification=messaging.Notification(title=body.title, body=body.body),
        data={k: str(v) for k,v in (body.data or {}).items()},
    )
    resp = messaging.send(msg, app=app)
    return {"ok": True, "messageId": resp}

@app.post("/api/admin/notifications/nearby-highlights")
def admin_nearby_highlights(body: AdminNearbyPushRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN:
        raise HTTPException(403)
    radius = get_discovery_radius_limit(body.radiusKm)
    customers = _nearby_customers(db, body.lat, body.lng, radius)
    if not customers:
        return {"sent": 0, "shops": 0, "products": 0}
    shops = _top_rated_shops(db, body.lat, body.lng, radius, limit=body.limit or 3) if body.includeTopRated else []
    products = _top_selling_products(db, body.lat, body.lng, radius, limit=body.limit or 3) if body.includeTopSelling else []
    if body.includeOpenShops:
        shops = [s for s in shops if s.is_open]
    title = body.title or "Near you now"
    body_text = body.body or "Top shops and popular products near your area."
    data = {
        "type": "nearby_highlights",
        "radiusKm": radius,
        "shopIds": ",".join([str(s.id) for s in shops]),
        "productIds": ",".join([str(p.id) for p in products]),
    }
    notify_users(db, customers, title, body_text, "nearby_highlights", data, push=True)
    db.commit()
    return {"sent": len(customers), "shops": len(shops), "products": len(products)}

@app.get("/api/notifications")
def list_notifications(limit: int = 50, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(max(1, min(limit, 100))).all()
    return [notification_dict(row) for row in rows]

@app.get("/api/notifications/unread-count")
def unread_notification_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).count()
    return {"count": count}

@app.post("/api/notifications/read-all")
def read_all_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"ok": True}

@app.post("/api/notifications/{notification_id}/read")
def read_notification(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not row:
        raise HTTPException(404, "Notification not found")
    row.is_read = True
    db.commit()
    return {"ok": True}

@app.post("/api/admin/notifications/festival")
def admin_broadcast_notification(body: AdminBroadcastNotificationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN:
        raise HTTPException(403)
    query = db.query(User)
    if body.role:
        query = query.filter(User.role == body.role)
    users = query.all()
    notify_users(db, users, body.title, body.body, body.category or "announcement", body.data or {}, push=True)
    db.commit()
    return {"sent": len(users)}

@app.post("/api/auth/phone/check")
def phone_check(data: dict, db: Session = Depends(get_db)):
    phone = str(data.get("phone","")).strip().replace(" ","").replace("-","")
    exists = db.query(User).filter(User.phone == phone).first() is not None
    return {"exists": exists}

@app.post("/api/auth/phone/register", status_code=201)
def phone_register(req: PhoneRegisterRequest, db: Session = Depends(get_db)):
    phone = req.phone.strip().replace(" ","").replace("-","")
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(400, "Enter a valid 10-digit number")
    if len(req.pin) != 4 or not req.pin.isdigit():
        raise HTTPException(400, "PIN must be 4 digits")
    if db.query(User).filter(User.phone == phone).first():
        raise HTTPException(400, "Number already registered")
    email = f"ph_{phone}@dott.in"
    user = User(name=req.name.strip(), email=email, phone=phone,
                password=hash_password(req.pin),
                role=req.role or RoleEnum.CUSTOMER,
                lat=req.lat, lng=req.lng, is_verified=True)
    db.add(user); db.commit(); db.refresh(user)
    return build_auth(user, db)

@app.post("/api/auth/phone/login")
def phone_login(req: PhoneLoginRequest, db: Session = Depends(get_db)):
    phone = req.phone.strip().replace(" ","").replace("-","")
    user = db.query(User).filter(User.phone == phone).first()
    if not user or not verify_password(req.pin, user.password):
        raise HTTPException(401, "Wrong number or PIN")
    if user.is_blocked: raise HTTPException(403, "Account blocked")
    if req.lat and req.lng: user.lat = req.lat; user.lng = req.lng; db.commit()
    return build_auth(user, db)

@app.put("/api/auth/location")
def update_location(body: LocationUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.lat = body.lat; user.lng = body.lng; db.commit()
    return {"ok": True}

@app.put("/api/auth/payment-details")
def update_payment_details(body: PaymentDetailsUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.bankAccount is not None:   user.bank_account = (body.bankAccount or "").strip()
    if body.bankIfsc is not None:      user.bank_ifsc = (body.bankIfsc or "").strip()
    if body.bankName is not None:      user.bank_name = (body.bankName or "").strip()
    if body.upiId is not None:         user.upi_id = (body.upiId or "").strip()
    if body.phonepeNumber is not None: user.phonepe_number = (body.phonepeNumber or "").strip()
    if body.gpayNumber is not None:    user.gpay_number = (body.gpayNumber or "").strip()
    if body.paymentMethod is not None: user.payment_method = (body.paymentMethod or "upi").strip().lower()
    db.commit()
    return user_dict(user)

# ═══════════════════════════════════════════════════════════════════
# IMAGE UPLOAD
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/upload/image")
async def upload_image(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    filename = f"{user.id}_{int(time.time()*1000)}.{ext}"
    filepath = UPLOAD_DIR / filename
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:   # 5 MB limit
        raise HTTPException(400, "Image too large. Max 5 MB.")
    with open(filepath, "wb") as f:
        f.write(contents)
    url = f"/uploads/{filename}"
    return {"url": url, "filename": filename}

@app.post("/api/upload/product-image-transform")
async def upload_product_image_transform(
    file: UploadFile = File(...),
    enhanceImage: bool = Form(False),
    user: User = Depends(get_current_user),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image too large. Max 8 MB.")

    optimized = optimize_upload_image(contents)
    try:
        return build_analysis_upload_response(user.id, optimized, file.filename or "product.jpg", bool(enhanceImage))
    except Exception as exc:
        analysis = infer_basic_product_analysis(file.filename or "product.jpg")
        analysis["analysisSource"] = "local-fallback"
        analysis["analysisIssue"] = str(exc)
        original_saved = save_image_bytes(user.id, optimized, "jpg")
        autofill = generate_product_copy(analysis, original_saved["url"])
        return {
            "originalUrl": original_saved["url"],
            "transformedUrl": original_saved["url"],
            "analysis": {**analysis, **autofill, "suggestedPrice": autofill["price"], "processingMode": "analysis-only"},
            "autofill": autofill,
            "analysisSource": "local-fallback",
            "analysisIssue": str(exc),
            "imageEdited": False,
            "enhancementRejected": False,
            "processingMode": "analysis-only",
        }

@app.post("/api/upload/product-image-transform/bulk")
async def upload_product_images_transform_bulk(
    files: List[UploadFile] = File(...),
    enhanceImage: bool = Form(False),
    user: User = Depends(get_current_user),
):
    if not files:
        raise HTTPException(400, "Upload at least one image.")
    if len(files) > 20:
        raise HTTPException(400, "Bulk upload supports up to 20 images at a time.")

    items = []
    for file in files:
        item = {
            "filename": file.filename or "product.jpg",
            "contentType": file.content_type or "",
        }
        try:
            if not (file.content_type or "").startswith("image/"):
                raise HTTPException(400, "File must be an image")

            contents = await file.read()
            if len(contents) > 8 * 1024 * 1024:
                raise HTTPException(400, "Image too large. Max 8 MB.")

            optimized = optimize_upload_image(contents)
            item.update({
                "status": "ok",
                **build_analysis_upload_response(user.id, optimized, file.filename or "product.jpg", bool(enhanceImage)),
            })
        except HTTPException as exc:
            item.update({
                "status": "error",
                "error": exc.detail,
            })
        except Exception:
            item.update({
                "status": "error",
                "error": "Processing failed for this image.",
            })
        items.append(item)

    success_count = len([item for item in items if item["status"] == "ok"])
    return {
        "items": items,
        "total": len(items),
        "succeeded": success_count,
        "failed": len(items) - success_count,
    }

# ═══════════════════════════════════════════════════════════════════
# RIDER LOCATION
# ═══════════════════════════════════════════════════════════════════
@app.put("/api/rider/location")
def rider_ping_location(body: RiderLocationPing, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER: raise HTTPException(403)
    user.lat = body.lat; user.lng = body.lng; db.commit()
    return {"ok": True}

@app.get("/api/orders/{order_id}/rider-location")
def get_rider_location(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    if o.customer_id != user.id: raise HTTPException(403)
    if not o.rider_id or o.status not in [OrderStatusEnum.PICKED_UP, OrderStatusEnum.OUT_FOR_DELIVERY]:
        return {"available": False, "status": o.status}
    rider = db.query(User).filter(User.id == o.rider_id).first()
    if not rider or not rider.lat:
        return {"available": False, "status": o.status}
    return {"available": True,"lat": round(rider.lat, 6),"lng": round(rider.lng, 6),
            "riderName": rider.name,"riderPhone": rider.phone,"status": o.status,
            "mapsUrl": f"https://maps.google.com/?q={rider.lat},{rider.lng}"}

# ═══════════════════════════════════════════════════════════════════
# SHOPS
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/shops")
def get_shops(category: Optional[str]=None, search: Optional[str]=None,
              lat: Optional[float]=None, lng: Optional[float]=None, radius: Optional[float]=10.0,
              db: Session = Depends(get_db)):
    q = db.query(Shop).filter(Shop.is_active == True, Shop.is_suspended == False)
    if category: q = q.filter(Shop.category == category)
    if search:   q = q.filter(Shop.name.ilike(f"%{search}%"))
    result = []
    bounded_radius = get_discovery_radius_limit(radius)
    for s in q.all():
        dist = haversine(lat, lng, s.lat, s.lng) if (lat and lng) else None
        if lat is not None and lng is not None:
            if s.lat is None or s.lng is None:
                continue
            if dist is not None and dist > bounded_radius:
                continue
        result.append(shop_dict(s, dist))
    result.sort(key=lambda x: x.get("distanceKm", 9999))
    return result

@app.get("/api/shops/my")
def my_shop(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404, "No shop found")
    return shop_dict(shop)

@app.post("/api/shops", status_code=201)
def create_shop(body: ShopCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.query(Shop).filter(Shop.owner_id == user.id).first():
        raise HTTPException(400, "You already have a shop")
    shop = Shop(owner_id=user.id, name=body.name[:100], description=body.description,
                category=body.category, address=body.address[:200], city=body.city or "Hyderabad",
                pincode=body.pincode, phone=body.phone, lat=body.lat, lng=body.lng,
                image_url=body.imageUrl, delivery_time=body.deliveryTime, min_order=body.minOrder,
                accepts_returns=body.acceptsReturns, return_days=body.returnDays,
                return_policy_note=body.returnPolicyNote, is_open=True, is_active=True)
    db.add(shop); db.commit(); db.refresh(shop)
    try:
        notify_customers_new_shop(db, shop)
    except Exception:
        pass
    return shop_dict(shop)

@app.put("/api/shops/{shop_id}")
def update_shop(shop_id: int, body: ShopUpdate,
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop: raise HTTPException(404)
    if user.role != RoleEnum.ADMIN and shop.owner_id != user.id: raise HTTPException(403)
    pending_location_request = None
    address_changed = body.address is not None and (body.address or "") != (shop.address or "")
    city_changed = body.city is not None and (body.city or "") != (shop.city or "")
    coords_changed = location_changed(shop.lat, shop.lng, body.lat, body.lng)
    vendor_requested_location_change = (
        user.role != RoleEnum.ADMIN
        and shop.lat is not None and shop.lng is not None
        and (coords_changed or address_changed or city_changed)
    )
    if vendor_requested_location_change:
        pending_location_request = db.query(ShopLocationChangeRequest).filter(
            ShopLocationChangeRequest.shop_id == shop.id,
            ShopLocationChangeRequest.status == "PENDING",
        ).first()
        if not pending_location_request:
            pending_location_request = ShopLocationChangeRequest(
                shop_id=shop.id,
                owner_id=user.id,
                old_lat=shop.lat,
                old_lng=shop.lng,
                old_address=shop.address,
                old_city=shop.city,
            )
            db.add(pending_location_request)
        pending_location_request.new_lat = body.lat if body.lat is not None else shop.lat
        pending_location_request.new_lng = body.lng if body.lng is not None else shop.lng
        pending_location_request.new_address = body.address if body.address is not None else shop.address
        pending_location_request.new_city = body.city if body.city is not None else shop.city
    for field, col in [("name","name"),("description","description"),("address","address"),
                       ("city","city"),("phone","phone"),("lat","lat"),("lng","lng"),
                       ("deliveryTime","delivery_time"),("minOrder","min_order"),("imageUrl","image_url"),
                       ("isOpen","is_open"),("isSuspended","is_suspended"),
                       ("acceptsReturns","accepts_returns"),("returnDays","return_days"),
                       ("returnPolicyNote","return_policy_note"),("whatsappPhone","whatsapp_phone")]:
        val = getattr(body, field, None)
        if val is None:
            continue
        if vendor_requested_location_change and field in {"address", "city", "lat", "lng"}:
            continue
        setattr(shop, col, val)
    if body.whatsappMode is not None: shop.whatsapp_mode = body.whatsappMode
    db.commit(); db.refresh(shop)
    result = shop_dict(shop)
    if pending_location_request:
        result["locationChangePending"] = True
        result["locationChangeRequestId"] = pending_location_request.id
    return result

# ═══════════════════════════════════════════════════════════════════
# PRODUCTS
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/products")
def get_products(shopId: Optional[int]=None, lat: Optional[float]=None,
                 lng: Optional[float]=None, radius: Optional[float]=10.0,
                 db: Session = Depends(get_db)):
    q = db.query(Product).filter(Product.is_active == True)
    if shopId: q = q.filter(Product.shop_id == shopId)
    products = q.all()
    visible_shops = {
        s.id: s for s in db.query(Shop).filter(Shop.is_active==True, Shop.is_suspended==False).all()
    }
    products = [p for p in products if p.shop_id in visible_shops]
    if lat and lng and not shopId:
        bounded_radius = get_discovery_radius_limit(radius)
        nearby_ids = {s.id for s in visible_shops.values()
                      if s.lat is not None and s.lng is not None and haversine(lat, lng, s.lat, s.lng) <= bounded_radius}
        products = [p for p in products if p.shop_id in nearby_ids]
    return [product_dict(p) for p in products]

@app.get("/api/products/my")
def my_products(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: return []
    return [product_dict(p) for p in db.query(Product).filter(Product.shop_id == shop.id).all()]

@app.get("/api/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p: raise HTTPException(404)
    return product_dict(p, include_reviews=True)

@app.post("/api/products", status_code=201)
def add_product(body: ProductCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(400, "Create a shop first")
    p = Product(shop_id=shop.id, name=body.name[:100], title=(body.title or body.name)[:160], description=body.description,
                price=body.price, category=body.category, image_url=body.imageUrl,
                product_type=body.productType, color=body.color,
                images=body.images or "[]", colors=body.colors or "[]",
                brand=body.brand, material=body.material, tags=body.tags or "[]",
                fabric=body.fabric, gender=body.gender, pattern=body.pattern, fit=body.fit,
                occasion=body.occasion, sleeve_type=body.sleeveType, length=body.length,
                processed_image_url=body.processedImageUrl, image_ai_meta=body.imageAiMeta or "{}",
                stock=body.stock, is_veg=body.isVeg if body.isVeg is not None else True,
                has_sizes=body.hasSizes or False, sizes=body.sizes or "[]")
    db.add(p); db.commit(); db.refresh(p)
    if index_product_visual_embedding(p):
        db.commit(); db.refresh(p)
    title = "New arrival near you"
    body_text = f"{p.name} is now available from {shop.name}."
    customers = _nearby_customers(db, shop.lat, shop.lng, MAX_DISCOVERY_RADIUS_KM) if shop.lat is not None and shop.lng is not None else []
    if customers:
        notify_users(db, customers, title, body_text, "new_arrival", {"type": "new_arrival", "shopId": shop.id, "productId": p.id}, push=True)
        db.commit()
    return product_dict(p)

@app.put("/api/products/{product_id}")
def update_product(product_id: int, body: ProductUpdate,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p: raise HTTPException(404)
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop or p.shop_id != shop.id: raise HTTPException(403)
    for attr, col in [("name","name"),("price","price"),("description","description"),
                       ("title","title"),("productType","product_type"),("color","color"),
                       ("category","category"),("imageUrl","image_url"),("processedImageUrl", "processed_image_url"),
                       ("isVeg","is_veg"),("sizes","sizes"),
                       ("images","images"),("colors","colors"),("brand","brand"),("material","material"),
                       ("fabric","fabric"),("gender","gender"),("pattern","pattern"),("fit","fit"),
                       ("occasion","occasion"),("sleeveType","sleeve_type"),("length","length"),
                       ("tags","tags"), ("imageAiMeta", "image_ai_meta")]:
        val = getattr(body, attr, None)
        if val is not None: setattr(p, col, val)
    if body.isActive is not None: p.is_active = body.isActive
    if body.stock is not None:    p.stock = body.stock
    if body.hasSizes is not None: p.has_sizes = body.hasSizes
    if body.imageUrl == '': p.image_url = None
    if body.processedImageUrl == '': p.processed_image_url = None
    db.commit(); db.refresh(p)
    if any(getattr(body, field, None) is not None for field in ["imageUrl", "processedImageUrl", "images", "colors"]):
        if index_product_visual_embedding(p):
            db.commit(); db.refresh(p)
    return product_dict(p)

# ═══════════════════════════════════════════════════════════════════
# ORDERS  (distance-based delivery fee)
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/orders", status_code=201)
def place_order(body: OrderCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.id == body.shopId).first()
    if not shop: raise HTTPException(404, "Shop not found")
    if not shop.is_active or shop.is_suspended: raise HTTPException(400, "Shop unavailable")
    if not shop.is_open: raise HTTPException(400, "Shop is currently closed")

    subtotal = 0.0; order_items = []; items_text_lines = []
    for ri in body.items:
        p = db.query(Product).filter(Product.id == ri.productId).first()
        if not p or not p.is_active: raise HTTPException(400, f"{ri.productId} unavailable")
        if p.shop_id != shop.id: raise HTTPException(400, f"{p.name} belongs to a different shop")
        if p.has_sizes and ri.size:
            try:
                sizes = json.loads(p.sizes or "[]")
                sz = next((s for s in sizes if s["size"]==ri.size), None)
                if not sz: raise HTTPException(400, f"Size {ri.size} not available")
                if sz["stock"] < ri.qty: raise HTTPException(400, f"Only {sz['stock']} left in size {ri.size}")
                sz["stock"] -= ri.qty; p.sizes = json.dumps(sizes)
            except HTTPException: raise
            except: pass
        elif p.has_sizes and not ri.size:
            raise HTTPException(400, f"Please select a size for {p.name}")
        display_name = f"{p.name} (Size: {ri.size})" if ri.size else p.name
        order_items.append(OrderItem(product_id=p.id, name=p.name, price=p.price, qty=ri.qty, size=ri.size, image_url=p.image_url))
        items_text_lines.append(f"  • {display_name} x{ri.qty} — ₹{p.price*ri.qty}")
        subtotal += p.price * ri.qty

    if (body.paymentMethod or "cod").lower() == "cod" and not getattr(user, "cod_enabled", True):
        raise HTTPException(400, "COD is disabled for this account due to return history. Please use prepaid payment.")

    # Distance-based delivery fee
    km = haversine(shop.lat, shop.lng, body.deliveryLat, body.deliveryLng)
    if km == 9999: km = 3.0   # default 3km if coords missing
    km = round(km, 2)
    allowed_km = get_order_distance_limit(body.deliveryRadiusKm if body.deliveryRadiusKm is not None else body.maxRadiusKm)
    if body.deliveryLat is not None and body.deliveryLng is not None and km > allowed_km:
        raise HTTPException(400, f"This shop is outside your local delivery range. NearNow only allows ordering within {allowed_km:g} km.")
    pricing = compute_pricing(subtotal, km, getattr(user, "is_premium", False), body.weather)
    delivery_fee = pricing["deliveryFee"]
    rider_earn   = calc_rider_earning(km)

    code = f"DT{int(time.time()*1000) % 1000000:06d}"
    order = Order(order_code=code, customer_id=user.id, shop_id=shop.id,
                  delivery_address=body.deliveryAddress, delivery_lat=body.deliveryLat,
                  delivery_lng=body.deliveryLng, payment_method=body.paymentMethod or "cod",
                  subtotal=subtotal, delivery_fee=delivery_fee, delivery_km=km,
                  base_delivery_fee=pricing["baseDeliveryFee"], distance_fee=pricing["distanceFee"],
                  surge_fee=pricing["surgeFee"], platform_fee=pricing["platformFee"],
                  gst_rate=pricing["gstRate"], gst_amount=pricing["gstAmount"],
                  free_delivery_discount=pricing["freeDeliveryDiscount"],
                  total=pricing["total"], rider_earning=rider_earn,
                  pricing_meta=json.dumps({"surgeReasons": pricing["surgeReasons"], "pricingLabel": pricing["pricingLabel"]}),
                  try_and_return_eligible=bool(getattr(user, "is_premium", False)),
                  return_window_hours=48, refund_amount=0.0, refund_status="NOT_APPLICABLE",
                  cod_due_amount=pricing["total"] if (body.paymentMethod or "cod").lower() == "cod" else 0.0,
                  cod_collected=False, is_delayed=False, countdown_alert_level="NONE",
                  rider_bonus=0.0, rider_penalty=0.0,
                  promo_code=body.promoCode, notes=body.notes, placed_at=utc_now())
    db.add(order); db.flush()
    for item in order_items: item.order_id = order.id; db.add(item)
    shop.total_orders = (shop.total_orders or 0) + 1
    db.commit(); db.refresh(order)
    result = order_dict(order)
    wa_url = build_whatsapp_url(order, shop, user, "\n".join(items_text_lines))
    result["vendorWhatsappUrl"] = wa_url
    result["shopWhatsappMode"] = shop.whatsapp_mode
    try:
        notify_user(db, user, "Order placed", f"Your order {order.order_code} was placed successfully.", "order", _order_push_data(order), push=True)
        if shop and shop.owner:
            notify_user(db, shop.owner, "New order received", f"New order {order.order_code} from {user.name}.", "order", _order_push_data(order), push=True)
        db.commit()
    except Exception:
        pass
    return result

@app.get("/api/orders/my")
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [order_dict(o) for o in
            db.query(Order).filter(Order.customer_id == user.id).order_by(Order.placed_at.desc()).all()]

@app.get("/api/orders/shop/all")
def shop_orders(status: Optional[str]=None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    q = db.query(Order).filter(Order.shop_id == shop.id)
    if status: q = q.filter(Order.status == status)
    return [order_dict(o) for o in q.order_by(Order.placed_at.desc()).all()]

@app.post("/api/orders/{order_id}/accept")
def vendor_accept(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    shop = db.query(Shop).filter(Shop.owner_id == user.id, Shop.id == o.shop_id).first()
    if not shop: raise HTTPException(403)
    if o.status != OrderStatusEnum.PENDING: raise HTTPException(400, "Order not pending")
    o.status = OrderStatusEnum.CONFIRMED
    o.confirmed_at = utc_now()
    start_delivery_countdown(o, o.confirmed_at)
    db.commit(); db.refresh(o)
    try:
        send_push_to_user(o.customer, "Order confirmed", f"Order {o.order_code} has been confirmed.", _order_push_data(o))
        notify_riders_new_order(db, o)
    except Exception:
        pass
    return order_dict(o)

@app.post("/api/orders/{order_id}/reject")
def vendor_reject(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    shop = db.query(Shop).filter(Shop.owner_id == user.id, Shop.id == o.shop_id).first()
    if not shop: raise HTTPException(403)
    if o.status != OrderStatusEnum.PENDING: raise HTTPException(400)
    o.status = OrderStatusEnum.CANCELLED
    db.commit(); db.refresh(o)
    try:
        send_push_to_user(o.customer, "Order cancelled", f"Order {o.order_code} was cancelled by the shop.", _order_push_data(o))
    except Exception:
        pass
    return order_dict(o)

@app.get("/api/orders/rider/available")
def rider_available(lat: Optional[float]=None, lng: Optional[float]=None, radius: Optional[float]=8.0,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.status == OrderStatusEnum.CONFIRMED, Order.rider_id == None).all()
    result = []
    for o in orders:
        dist = haversine(lat, lng, o.shop.lat, o.shop.lng) if (lat and lng and o.shop) else None
        if dist is not None and dist > radius: continue
        d = order_dict(o)
        if dist is not None: d["shopDistanceKm"] = round(dist, 1)
        result.append(d)
    return result

@app.post("/api/orders/{order_id}/rider-accept")
def rider_accept(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403, "Only rider accounts can accept delivery orders")
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    if o.status != OrderStatusEnum.CONFIRMED or o.rider_id: raise HTTPException(400, "Order not available")
    o.rider_id = user.id; o.status = OrderStatusEnum.PACKING
    db.commit(); db.refresh(o)
    try:
        send_push_to_user(o.customer, "Rider assigned", f"{user.name} is preparing your order.", _order_push_data(o))
        if o.shop and o.shop.owner:
            send_push_to_user(o.shop.owner, "Rider assigned", f"Rider {user.name} accepted order {o.order_code}.", _order_push_data(o))
    except Exception:
        pass
    return order_dict(o)

@app.get("/api/orders/rider/active")
def rider_active(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    excluded = [OrderStatusEnum.DELIVERED, OrderStatusEnum.CANCELLED]
    return [order_dict(o) for o in
            db.query(Order).filter(Order.rider_id == user.id, ~Order.status.in_(excluded)).all()]

@app.get("/api/orders/{order_id}")
def get_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    return order_dict(o)

@app.put("/api/orders/{order_id}/status")
def update_status(order_id: int, body: StatusUpdate,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)

    # ── STRICT ROLE-BASED RULES ──────────────────────────────────────
    if user.role == RoleEnum.OWNER:
        # Vendor can only move CONFIRMED→PACKING (start prep)
        # but ONLY after a rider has accepted (rider_id must be set)
        if body.status == OrderStatusEnum.PACKING:
            shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
            if not shop or o.shop_id != shop.id: raise HTTPException(403)
            if o.status != OrderStatusEnum.CONFIRMED:
                raise HTTPException(400, "Order must be CONFIRMED before preparing")
            if not o.rider_id:
                raise HTTPException(400, "⏳ Waiting for a rider to accept first. You can start preparing only after a rider accepts the delivery.")
            o.pickup_otp = None
            o.pickup_otp_used = False
            o.pickup_otp_generated_at = None
            o.pickup_otp_verified_at = None
        else:
            raise HTTPException(403, "Vendors can only mark order as Preparing. All delivery updates are handled by the rider.")

    elif user.role == RoleEnum.RIDER:
        # Rider can move: PICKED_UP→OUT_FOR_DELIVERY→DELIVERED
        if o.rider_id and o.rider_id != user.id: raise HTTPException(403, "This delivery is assigned to another rider")
        if body.status == OrderStatusEnum.PICKED_UP:
            raise HTTPException(400, "Vendor pickup OTP is required before marking this order as picked up")
        allowed_rider = [OrderStatusEnum.OUT_FOR_DELIVERY, OrderStatusEnum.DELIVERED]
        if body.status not in allowed_rider:
            raise HTTPException(403, "Riders can only update: Picked Up → Out for Delivery → Delivered")

    elif user.role == RoleEnum.ADMIN:
        pass  # admin can do anything

    else:
        raise HTTPException(403)

    o.status = body.status
    if body.riderId: o.rider_id = body.riderId
    if body.status == OrderStatusEnum.CONFIRMED:
        o.confirmed_at = utc_now()
        start_delivery_countdown(o, o.confirmed_at)
    if body.status in [OrderStatusEnum.PACKING, OrderStatusEnum.PICKED_UP, OrderStatusEnum.OUT_FOR_DELIVERY]:
        timer = order_timer_snapshot(o)
        o.countdown_alert_level = timer["alertLevel"]
    if body.status == OrderStatusEnum.DELIVERED:
        finalize_delivery_timing(o)
    db.commit(); db.refresh(o)
    try:
        if body.status == OrderStatusEnum.PACKING:
            send_push_to_user(o.customer, "Order is being prepared", f"Shop started preparing order {o.order_code}.", _order_push_data(o))
        elif body.status == OrderStatusEnum.OUT_FOR_DELIVERY:
            send_push_to_user(o.customer, "Out for delivery", f"Order {o.order_code} is on the way.", _order_push_data(o))
        elif body.status == OrderStatusEnum.DELIVERED:
            send_push_to_user(o.customer, "Delivered", f"Order {o.order_code} was delivered.", _order_push_data(o))
            if o.shop and o.shop.owner:
                send_push_to_user(o.shop.owner, "Order delivered", f"Order {o.order_code} has been delivered.", _order_push_data(o))
    except Exception:
        pass
    return order_dict(o)

@app.put("/api/orders/{order_id}/cancel")
def cancel_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    if user.role == RoleEnum.CUSTOMER:
        if o.customer_id != user.id: raise HTTPException(403)
        if o.status != OrderStatusEnum.PENDING: raise HTTPException(400, "Cannot cancel at this stage")
    o.status = OrderStatusEnum.CANCELLED
    db.commit(); db.refresh(o)
    try:
        send_push_to_user(o.customer, "Order cancelled", f"Order {o.order_code} was cancelled.", _order_push_data(o))
        if o.shop and o.shop.owner:
            send_push_to_user(o.shop.owner, "Order cancelled", f"Order {o.order_code} was cancelled by the customer.", _order_push_data(o))
    except Exception:
        pass
    return order_dict(o)

# ═══════════════════════════════════════════════════════════════════
@app.post("/api/orders/{order_id}/pickup-otp/generate")
def generate_pickup_otp(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(404)
    if user.role != RoleEnum.ADMIN:
        shop = db.query(Shop).filter(Shop.owner_id == user.id, Shop.id == o.shop_id).first()
        if not shop:
            raise HTTPException(403, "Only this shop owner can generate the pickup OTP")
    if o.status != OrderStatusEnum.PACKING:
        raise HTTPException(400, "Pickup OTP can only be generated after preparation starts")
    if not o.rider_id:
        raise HTTPException(400, "Assign a rider before generating the pickup OTP")
    otp = generate_otp()
    o.pickup_otp = otp
    o.pickup_otp_used = False
    o.pickup_otp_generated_at = utc_now()
    o.pickup_otp_verified_at = None
    db.commit()
    return {"otp": otp, "message": "Share this OTP with the rider at pickup time"}

@app.get("/api/orders/{order_id}/pickup-otp")
def get_pickup_otp(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(404)
    if user.role != RoleEnum.ADMIN:
        shop = db.query(Shop).filter(Shop.owner_id == user.id, Shop.id == o.shop_id).first()
        if not shop:
            raise HTTPException(403, "Only this shop owner can view the pickup OTP")
    if not o.pickup_otp or o.pickup_otp_used:
        raise HTTPException(404, "No active pickup OTP found")
    return {
        "otp": o.pickup_otp,
        "generatedAt": o.pickup_otp_generated_at.isoformat() if o.pickup_otp_generated_at else None,
    }

@app.post("/api/orders/{order_id}/pickup-otp/verify")
def verify_pickup_otp(order_id: int, body: PickupOtpVerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403)
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o or o.rider_id != user.id:
        raise HTTPException(403)
    if o.status != OrderStatusEnum.PACKING:
        raise HTTPException(400, "Order is not ready for pickup verification")
    if not o.pickup_otp or o.pickup_otp_used:
        raise HTTPException(400, "Vendor has not generated an active pickup OTP yet")
    if o.pickup_otp != body.otp.strip():
        raise HTTPException(400, "Wrong pickup OTP")
    o.pickup_otp_used = True
    o.pickup_otp_verified_at = utc_now()
    o.status = OrderStatusEnum.PICKED_UP
    timer = order_timer_snapshot(o)
    o.countdown_alert_level = timer["alertLevel"]
    db.commit()
    db.refresh(o)
    try:
        send_push_to_user(o.customer, "Order picked up", f"Rider picked up order {o.order_code}.", _order_push_data(o))
    except Exception:
        pass
    return order_dict(o)

# REVIEWS
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/reviews", status_code=201)
def add_review(body: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == body.orderId, Order.customer_id == user.id).first()
    if not order: raise HTTPException(404)
    if order.status != OrderStatusEnum.DELIVERED: raise HTTPException(400, "Order not delivered yet")
    if not (1 <= body.rating <= 5): raise HTTPException(400, "Rating must be 1-5")
    product = db.query(Product).filter(Product.id == body.productId).first()
    if not product: raise HTTPException(404)
    if not any(item.product_id == body.productId for item in order.items):
        raise HTTPException(400, "You can review only products from this order")
    existing = db.query(Review).filter(
        Review.product_id == body.productId,
        Review.order_id == body.orderId,
        Review.customer_id == user.id,
    ).first()
    if existing: raise HTTPException(400, "Already reviewed")
    review_images = [url for url in (body.images or []) if isinstance(url, str) and url.strip()][:5]
    review = Review(product_id=body.productId, shop_id=order.shop_id, order_id=body.orderId,
                    customer_id=user.id, rating=body.rating, comment=body.comment,
                    images=json.dumps(review_images))
    db.add(review); db.flush()
    shop = db.query(Shop).filter(Shop.id == order.shop_id).first()
    all_reviews = db.query(Review).filter(Review.shop_id == shop.id).all()
    shop.rating = sum(r.rating for r in all_reviews) / len(all_reviews)
    shop.rating_count = len(all_reviews)
    order.is_reviewed = True
    db.commit()
    return {"ok": True, "reviewId": review.id}

@app.get("/api/reviews/product/{product_id}")
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(Review.product_id == product_id).order_by(Review.created_at.desc()).all()
    return [{"id":r.id,"rating":r.rating,"comment":r.comment,
             "images":json_loads_safe(getattr(r, "images", "[]"), []),
             "customerName":r.customer.name,"createdAt":r.created_at.isoformat()} for r in reviews]

# ═══════════════════════════════════════════════════════════════════
# RETURNS
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/returns/preview")
def preview_return(body: ReturnCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == body.orderId, Order.customer_id == user.id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    profile = get_return_reason_profile(body.reasonCode, body.requestType)
    recent_returns = db.query(ReturnRequest).filter(
        ReturnRequest.customer_id == user.id,
        ReturnRequest.created_at >= utc_now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    ).count()
    return_fee = 0.0 if profile["decision"] in {"VENDOR_FAULT", "FREE_EXCHANGE"} else round(max(40.0, (order.delivery_fee or 0.0) * 1.5), 2)
    refund_amount = 0.0 if profile["requestType"] == "exchange" else round(max(0.0, order.subtotal - return_fee), 2)
    return {
        "decision": profile["decision"],
        "requestType": profile["requestType"],
        "returnFee": return_fee,
        "refundAmount": refund_amount,
        "monthlyReturnsUsed": recent_returns,
        "monthlyReturnsLimit": MAX_RETURNS_PER_MONTH,
        "codWillBeDisabled": recent_returns + 1 >= MAX_RETURNS_PER_MONTH,
    }

@app.post("/api/returns", status_code=201)
def request_return(body: ReturnCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == body.orderId, Order.customer_id == user.id).first()
    if not order: raise HTTPException(404)
    if order.status != OrderStatusEnum.DELIVERED: raise HTTPException(400, "Order not delivered")
    shop = db.query(Shop).filter(Shop.id == order.shop_id).first()
    if not shop.accepts_returns: raise HTTPException(400, "This shop does not accept returns")
    if order.subtotal < NO_RETURN_BELOW:
        raise HTTPException(400, f"Returns are unavailable for items below ₹{int(NO_RETURN_BELOW)}")
    now = utc_now()
    return_window_hours = getattr(order, "return_window_hours", 48) or 48
    if order.delivered_at and now > order.delivered_at + timedelta(hours=return_window_hours):
        raise HTTPException(400, f"Return window of {return_window_hours} hours has passed")
    if order.return_request: raise HTTPException(400, "Return already requested")
    if not body.conditionAccepted:
        raise HTTPException(400, "Please confirm the item is unused, unwashed, and has tags intact")
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    recent_returns = db.query(ReturnRequest).filter(
        ReturnRequest.customer_id == user.id,
        ReturnRequest.created_at >= current_month_start
    ).count()
    if recent_returns >= MAX_RETURNS_PER_MONTH:
        raise HTTPException(400, "Monthly return limit reached")

    profile = get_return_reason_profile(body.reasonCode, body.requestType)
    if profile["decision"] == "VENDOR_FAULT":
        return_fee = 0.0
        refund_amount = round(order.subtotal, 2)
        exchange_allowed = True
    elif profile["decision"] == "FREE_EXCHANGE":
        return_fee = 0.0
        refund_amount = 0.0
        exchange_allowed = True
    else:
        first_free_size_exchange = profile["isSizeIssue"] and not recent_returns
        return_fee = 0.0 if first_free_size_exchange and profile["requestType"] == "exchange" else round(max(40.0, (order.delivery_fee or 0.0) * 1.5), 2)
        refund_amount = 0.0 if profile["requestType"] == "exchange" else round(max(0.0, order.subtotal - return_fee), 2)
        exchange_allowed = profile["isSizeIssue"]

    rr = ReturnRequest(
        order_id=body.orderId,
        customer_id=user.id,
        shop_id=order.shop_id,
        reason=body.reason,
        reason_code=profile["reasonCode"],
        request_type=profile["requestType"],
        evidence_image_url=body.evidenceImageUrl,
        policy_decision=profile["decision"],
        return_fee=return_fee,
        refund_amount=refund_amount,
        exchange_allowed=exchange_allowed,
        pickup_status="REQUESTED",
        pickup_eta=(now + timedelta(hours=6)).isoformat(timespec="minutes")
    )
    order.refund_amount = refund_amount
    order.refund_status = "PENDING" if refund_amount else "EXCHANGE_ONLY"
    user.returns_this_month = recent_returns + 1
    user.high_return_user = user.returns_this_month >= MAX_RETURNS_PER_MONTH
    if user.high_return_user:
        user.cod_enabled = False
    db.add(rr); db.commit(); db.refresh(rr)
    try:
        send_push_to_user(user, "Return requested", f"Return requested for order {order.order_code}.", _return_push_data(rr))
        if shop and shop.owner:
            send_push_to_user(shop.owner, "Return requested", f"Return requested for order {order.order_code}.", _return_push_data(rr))
    except Exception:
        pass
    return {"ok": True, "returnId": rr.id, "status": rr.status, "returnFee": rr.return_fee, "refundAmount": rr.refund_amount, "policyDecision": rr.policy_decision}

@app.get("/api/returns/my")
def my_returns(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rrs = db.query(ReturnRequest).filter(ReturnRequest.customer_id == user.id).all()
    return [{"id":r.id,"orderId":r.order_id,"orderCode":r.order.order_code,
             "status":r.status,"reason":r.reason,"vendorNote":r.vendor_note,
             "createdAt":r.created_at.isoformat()} for r in rrs]

@app.get("/api/returns/shop")
def shop_returns(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    rrs = db.query(ReturnRequest).filter(ReturnRequest.shop_id == shop.id).order_by(ReturnRequest.created_at.desc()).all()
    return [{"id":r.id,"orderId":r.order_id,"orderCode":r.order.order_code,
             "customerName":r.customer.name,"customerPhone":r.customer.phone,
             "status":r.status,"reason":r.reason,"vendorNote":r.vendor_note,
             "createdAt":r.created_at.isoformat()} for r in rrs]

@app.put("/api/returns/{return_id}")
def update_return(return_id: int, body: ReturnVendorUpdate,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rr = db.query(ReturnRequest).filter(ReturnRequest.id == return_id).first()
    if not rr: raise HTTPException(404)
    shop = db.query(Shop).filter(Shop.owner_id == user.id, Shop.id == rr.shop_id).first()
    if not shop: raise HTTPException(403)
    rr.status = body.status
    if body.vendorNote: rr.vendor_note = body.vendorNote
    if body.status == ReturnStatusEnum.APPROVED:
        rr.policy_decision = rr.policy_decision or "APPROVED"
        rr.pickup_status = "AWAITING_RIDER"
    elif body.status == ReturnStatusEnum.REJECTED:
        rr.pickup_status = "REJECTED"
        rr.processed_at = utc_now()
        rr.order.refund_status = "REJECTED"
    elif body.status == ReturnStatusEnum.REFUNDED:
        rr.pickup_status = "COMPLETED"
        rr.processed_at = utc_now()
        rr.order.refund_status = "REFUNDED"
    rr.updated_at = utc_now()
    db.commit()
    try:
        if body.status == ReturnStatusEnum.APPROVED:
            send_push_to_user(rr.customer, "Return pickup scheduled", f"Return approved for order {rr.order.order_code}. A rider will be assigned soon.", _return_push_data(rr))
            notify_riders_return_pickup(db, rr)
        elif body.status == ReturnStatusEnum.REJECTED:
            send_push_to_user(rr.customer, "Return rejected", f"Return rejected for order {rr.order.order_code}.", _return_push_data(rr))
        elif body.status == ReturnStatusEnum.REFUNDED:
            send_push_to_user(rr.customer, "Refund processed", f"Refund processed for order {rr.order.order_code}.", _return_push_data(rr))
    except Exception:
        pass
    return {"ok": True, "status": rr.status}

@app.get("/api/returns/rider/available")
def rider_return_pickups(lat: Optional[float]=None, lng: Optional[float]=None, radius: Optional[float]=8.0,
                         user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403)
    q = db.query(ReturnRequest).filter(
        ReturnRequest.status == ReturnStatusEnum.APPROVED,
        ReturnRequest.pickup_status == "AWAITING_RIDER",
        ReturnRequest.pickup_rider_id == None
    ).order_by(ReturnRequest.created_at.desc()).all()
    result = []
    for rr in q:
        order = rr.order
        customer = rr.customer
        shop = rr.shop
        dist = haversine(lat, lng, order.delivery_lat, order.delivery_lng) if (lat and lng and order.delivery_lat and order.delivery_lng) else None
        if dist is not None and dist > radius:
            continue
        result.append({
            "id": rr.id,
            "type": "RETURN_PICKUP",
            "orderId": rr.order_id,
            "orderCode": order.order_code if order else None,
            "customerName": customer.name if customer else None,
            "customerPhone": customer.phone if customer else None,
            "customerLat": order.delivery_lat if order else None,
            "customerLng": order.delivery_lng if order else None,
            "customerAddress": order.delivery_address if order else None,
            "shopName": shop.name if shop else None,
            "productDetails": [{"name": i.name, "qty": i.qty, "size": i.size, "imageUrl": i.image_url} for i in (order.items if order else [])],
            "pickupTimeWindow": rr.pickup_eta,
            "reason": rr.reason,
            "distanceKm": round(dist, 1) if dist is not None else None,
            "returnFee": rr.return_fee,
            "refundAmount": rr.refund_amount,
        })
    return result

@app.post("/api/returns/{return_id}/rider-accept")
def accept_return_pickup(return_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403)
    rr = db.query(ReturnRequest).filter(ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(404)
    if rr.status != ReturnStatusEnum.APPROVED or rr.pickup_status != "AWAITING_RIDER" or rr.pickup_rider_id:
        raise HTTPException(400, "Return pickup not available")
    rr.pickup_rider_id = user.id
    rr.pickup_status = "RIDER_ACCEPTED"
    rr.updated_at = utc_now()
    db.commit()
    try:
        send_push_to_user(rr.customer, "Return pickup accepted", f"Rider accepted pickup for order {rr.order.order_code}.", _return_push_data(rr))
        if rr.shop and rr.shop.owner:
            send_push_to_user(rr.shop.owner, "Return pickup accepted", f"Rider accepted return pickup for order {rr.order.order_code}.", _return_push_data(rr))
    except Exception:
        pass
    return {"ok": True, "pickupStatus": rr.pickup_status}

@app.put("/api/returns/{return_id}/pickup-status")
def update_return_pickup_status(return_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403)
    rr = db.query(ReturnRequest).filter(ReturnRequest.id == return_id).first()
    if not rr or rr.pickup_rider_id != user.id:
        raise HTTPException(403)
    next_status = (body.get("pickupStatus") or "").upper()
    allowed = {"NAVIGATING", "PICKED_UP", "COMPLETED"}
    if next_status not in allowed:
        raise HTTPException(400, "Invalid pickup status")
    rr.pickup_status = next_status
    rr.updated_at = utc_now()
    if next_status == "COMPLETED":
        rr.status = ReturnStatusEnum.PICKED_UP
        rr.pickup_completed_at = utc_now()
    db.commit()
    try:
        if next_status == "PICKED_UP":
            send_push_to_user(rr.customer, "Return picked up", f"Return picked up for order {rr.order.order_code}.", _return_push_data(rr))
        elif next_status == "COMPLETED":
            send_push_to_user(rr.customer, "Return completed", f"Return completed for order {rr.order.order_code}.", _return_push_data(rr))
    except Exception:
        pass
    return {"ok": True, "pickupStatus": rr.pickup_status}

@app.get("/api/returns/rider/active")
def active_return_pickups(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403)
    q = db.query(ReturnRequest).filter(
        ReturnRequest.pickup_rider_id == user.id,
        ReturnRequest.pickup_status.in_(["RIDER_ACCEPTED", "NAVIGATING", "PICKED_UP"])
    ).order_by(ReturnRequest.updated_at.desc()).all()
    result = []
    for rr in q:
        order = rr.order
        result.append({
            "id": rr.id,
            "type": "RETURN_PICKUP",
            "orderId": rr.order_id,
            "orderCode": order.order_code if order else None,
            "customerName": rr.customer.name if rr.customer else None,
            "customerPhone": rr.customer.phone if rr.customer else None,
            "customerAddress": order.delivery_address if order else None,
            "customerLat": order.delivery_lat if order else None,
            "customerLng": order.delivery_lng if order else None,
            "pickupStatus": rr.pickup_status,
            "pickupTimeWindow": rr.pickup_eta,
            "productDetails": [{"name": i.name, "qty": i.qty, "size": i.size, "imageUrl": i.image_url} for i in (order.items if order else [])],
        })
    return result

# ═══════════════════════════════════════════════════════════════════
# RIDERS  (distance-based earnings)
# ═══════════════════════════════════════════════════════════════════
def _company_payout_details(db: Session):
    admin_user = db.query(User).filter(User.role == RoleEnum.ADMIN).order_by(User.id.asc()).first()
    if not admin_user:
        return {
            "companyName": "DOTT Marketplace",
            "contactPhone": "",
            "upiId": "",
            "bankAccount": "",
            "bankIfsc": "",
            "bankName": "",
        }
    phone = admin_user.phone or ""
    upi_id = (admin_user.upi_id or "").strip()
    if not upi_id:
        digits = "".join(ch for ch in phone if ch.isdigit())
        if digits:
            upi_id = f"{digits}@upi"
    return {
        "companyName": admin_user.name or "DOTT Marketplace",
        "contactPhone": phone,
        "upiId": upi_id,
        "phonepeNumber": getattr(admin_user, "phonepe_number", "") or "",
        "gpayNumber": getattr(admin_user, "gpay_number", "") or "",
        "bankAccount": admin_user.bank_account or "",
        "bankIfsc": admin_user.bank_ifsc or "",
        "bankName": admin_user.bank_name or "",
    }

def rider_cod_settlement_summary(db: Session, rider: User):
    cod_orders = db.query(Order).filter(
        Order.rider_id == rider.id,
        Order.status == OrderStatusEnum.DELIVERED,
        func.lower(Order.payment_method) == "cod",
        Order.cod_collected == True,
    ).order_by(Order.delivered_at.desc()).all()

    def cod_amount(order: Order) -> float:
        return round(order.cod_due_amount if (order.cod_due_amount or 0) > 0 else (order.total or 0.0), 2)

    cod_breakdown = {
        "productValue": round(sum(vendor_merchandise_total(o) for o in cod_orders), 2),
        "deliveryFee": round(sum((o.delivery_fee or 0.0) for o in cod_orders), 2),
        "platformFee": round(sum((getattr(o, "platform_fee", 0.0) or 0.0) for o in cod_orders), 2),
        "gstAmount": round(sum((getattr(o, "gst_amount", 0.0) or 0.0) for o in cod_orders), 2),
    }
    total_collected = round(sum(
        cod_amount(o) for o in cod_orders
    ), 2)
    cod_breakdown["otherAdjustments"] = round(
        total_collected
        - cod_breakdown["productValue"]
        - cod_breakdown["deliveryFee"]
        - cod_breakdown["platformFee"]
        - cod_breakdown["gstAmount"],
        2,
    )

    today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_collected = round(sum(
        cod_amount(o) for o in cod_orders if o.delivered_at and o.delivered_at >= today_start
    ), 2)

    payments = db.query(SettlementPayment).filter(
        SettlementPayment.entity_type == "rider_cod",
        SettlementPayment.user_id == rider.id,
    ).order_by(SettlementPayment.payment_date.desc()).all()

    settled_amount = round(sum(
        (p.amount or 0.0) for p in payments if (p.payment_status or "PAID").upper() != "FAILED"
    ), 2)
    today_settled = round(sum(
        (p.amount or 0.0) for p in payments
        if p.payment_date and p.payment_date >= today_start and (p.payment_status or "PAID").upper() != "FAILED"
    ), 2)
    pending_amount = round(max(total_collected - settled_amount, 0.0), 2)

    return {
        "totalCollected": total_collected,
        "settledAmount": settled_amount,
        "pendingAmount": pending_amount,
        "breakdown": cod_breakdown,
        "todayCollected": today_collected,
        "todaySettled": today_settled,
        "totalCodOrders": len(cod_orders),
        "companyAccount": _company_payout_details(db),
        "recentCodOrders": [{
            "orderId": o.id,
            "orderCode": o.order_code,
            "amount": cod_amount(o),
            "productValue": round(vendor_merchandise_total(o), 2),
            "deliveryFee": round(o.delivery_fee or 0.0, 2),
            "platformFee": round(getattr(o, "platform_fee", 0.0) or 0.0, 2),
            "gstAmount": round(getattr(o, "gst_amount", 0.0) or 0.0, 2),
            "otherAdjustments": round(
                cod_amount(o)
                - round(vendor_merchandise_total(o), 2)
                - round(o.delivery_fee or 0.0, 2)
                - round(getattr(o, "platform_fee", 0.0) or 0.0, 2)
                - round(getattr(o, "gst_amount", 0.0) or 0.0, 2),
                2,
            ),
            "customerName": o.customer.name if o.customer else "",
            "deliveredAt": o.delivered_at.isoformat() if o.delivered_at else None,
        } for o in cod_orders[:12]],
        "paymentHistory": [{
            "id": p.id,
            "amount": round(p.amount or 0.0, 2),
            "paymentStatus": p.payment_status or "PAID",
            "method": p.payment_method or "UPI",
            "paymentReference": p.payment_reference or "",
            "paymentDate": p.payment_date.isoformat() if p.payment_date else None,
            "notes": p.notes or "",
        } for p in payments[:20]],
    }

@app.post("/api/riders/status")
def set_rider_status(body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER: raise HTTPException(403)
    user.is_online = body.get("isOnline", False); db.commit()
    return {"isOnline": user.is_online}

@app.put("/api/riders/location")
def update_rider_location(body: LocationUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER: raise HTTPException(403)
    user.lat = body.lat; user.lng = body.lng; db.commit()
    return {"ok": True}

@app.get("/api/riders/earnings")
def rider_earnings(rangeKey: Optional[str] = "last2days", startDate: Optional[str] = None,
                   endDate: Optional[str] = None,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sync_settlement_invoices(db)
    applied_range, start, end = parse_dashboard_range(rangeKey, startDate, endDate)

    def calc(since):
        rows = db.query(Order).filter(
            Order.rider_id == user.id,
            Order.status == OrderStatusEnum.DELIVERED,
            Order.delivered_at >= since,
        ).all()
        return {
            "trips": len(rows),
            "earned": round(sum(o.rider_earning for o in rows), 1),
            "totalKm": round(sum(o.delivery_km or 0 for o in rows), 1),
        }

    summary = settlement_summary_for_entity(db, "rider", user.id, start, end)
    summary.update({
        "today": calc(utc_now().replace(hour=0, minute=0, second=0)),
        "week": calc(utc_now() - timedelta(days=7)),
        "month": calc(utc_now() - timedelta(days=30)),
        "allTime": calc(datetime(2000, 1, 1)),
        "filters": {
            "rangeKey": applied_range,
            "startDate": start.date().isoformat(),
            "endDate": end.date().isoformat(),
            "cycleDays": SETTLEMENT_CYCLE_DAYS,
        },
    })
    return summary

@app.get("/api/riders/history")
def rider_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sync_settlement_invoices(db)
    orders = db.query(Order).filter(Order.rider_id==user.id, Order.status==OrderStatusEnum.DELIVERED)\
               .order_by(Order.delivered_at.desc()).limit(50).all()
    return [{"id":o.id,"orderCode":o.order_code,"shopName":o.shop.name,
             "deliveryAddress":o.delivery_address,"total":o.total,
             "deliveryKm":round(o.delivery_km or 0,1),
             "earning":round(o.rider_earning,1),
             "deliveredAt":o.delivered_at.isoformat() if o.delivered_at else None} for o in orders]

@app.get("/api/riders/cod-settlement")
def rider_cod_settlement(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403, "Rider access only")
    return rider_cod_settlement_summary(db, user)

@app.post("/api/riders/cod-settlement/pay")
def rider_cod_settlement_pay(body: RiderCodSettlementPay, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403, "Rider access only")
    summary = rider_cod_settlement_summary(db, user)
    pending = round(float(summary.get("pendingAmount", 0.0) or 0.0), 2)
    amount = round(float(body.amount if body.amount is not None else pending), 2)
    if amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero")
    if amount > pending:
        raise HTTPException(400, "Amount cannot exceed pending COD settlement")
    method = (body.method or "upi").strip().lower()
    company = summary.get("companyAccount", {})
    destination = company.get("upiId") or company.get("bankAccount") or "company account"
    note = (body.note or f"COD settlement via {method.upper()} to {destination}").strip()
    payment_reference = (body.paymentReference or "").strip()
    if not payment_reference:
        raise HTTPException(400, "UTR / payment reference is required")
    payment = SettlementPayment(
        invoice_id=None,
        entity_type="rider_cod",
        user_id=user.id,
        shop_id=None,
        amount=amount,
        payment_status="PAID",
        payment_method=method.upper(),
        payment_reference=payment_reference,
        payment_date=utc_now(),
        notes=note,
    )
    db.add(payment)
    db.commit()
    return {
        "ok": True,
        "amount": amount,
        "method": method,
        "summary": rider_cod_settlement_summary(db, user),
    }

# ═══════════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/analytics")
def analytics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    now = utc_now()
    def stats(since):
        rows = db.query(Order).filter(Order.shop_id==shop.id,
                                      Order.status==OrderStatusEnum.DELIVERED,
                                      Order.delivered_at>=since).all()
        return {"orders":len(rows),"revenue":round(sum(vendor_merchandise_total(o) for o in rows),2)}
    pending_returns = db.query(ReturnRequest).filter(
        ReturnRequest.shop_id==shop.id, ReturnRequest.status==ReturnStatusEnum.REQUESTED).count()
    return {"today": stats(now.replace(hour=0,minute=0,second=0)),
            "week":  stats(now-timedelta(days=7)),
            "month": stats(now-timedelta(days=30)),
            "allTime":stats(datetime(2000,1,1)),
            "pendingReturns": pending_returns}

# ═══════════════════════════════════════════════════════════════════
# ADMIN
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/admin/stats")
def admin_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    now = utc_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start  = now - timedelta(days=7)

    # User counts by role
    all_users   = db.query(User).all()
    customers   = [u for u in all_users if u.role == RoleEnum.CUSTOMER]
    vendors     = [u for u in all_users if u.role == RoleEnum.OWNER]
    riders      = [u for u in all_users if u.role == RoleEnum.RIDER]
    online_riders = [u for u in riders if u.is_online]

    # New signups today / this week
    new_today = sum(1 for u in all_users if u.created_at and u.created_at >= today_start)
    new_week  = sum(1 for u in all_users if u.created_at and u.created_at >= week_start)

    # Orders
    all_orders  = db.query(Order).all()
    active_orders = [o for o in all_orders if o.status not in [OrderStatusEnum.DELIVERED, OrderStatusEnum.CANCELLED]]
    today_orders  = [o for o in all_orders if o.placed_at and o.placed_at >= today_start]
    delivered_all = [o for o in all_orders if o.status == OrderStatusEnum.DELIVERED]
    on_time_orders = [o for o in delivered_all if not getattr(o, "is_delayed", False)]
    late_orders = [o for o in delivered_all if getattr(o, "is_delayed", False)]

    # Revenue
    total_rev = round(sum(o.total for o in delivered_all), 2)
    today_rev = round(sum(o.total for o in delivered_all if o.delivered_at and o.delivered_at >= today_start), 2)
    week_rev  = round(sum(o.total for o in delivered_all if o.delivered_at and o.delivered_at >= week_start), 2)

    # Shops
    all_shops = db.query(Shop).all()
    visible_shops = [s for s in all_shops if s.is_active and not s.is_suspended]
    active_shops = len(visible_shops)
    open_shops = [s for s in visible_shops if s.is_open]
    closed_shops = [s for s in visible_shops if not s.is_open]
    suspended_shops = [s for s in all_shops if s.is_suspended]
    active_vendor_ids_today = {o.shop.owner_id for o in today_orders if getattr(o, "shop", None) and getattr(o.shop, "owner_id", None)}
    active_customer_ids_today = {o.customer_id for o in today_orders if getattr(o, "customer_id", None)}
    accepted_orders = [o for o in all_orders if o.status == OrderStatusEnum.ACCEPTED]
    out_for_delivery_orders = [o for o in all_orders if o.status == OrderStatusEnum.OUT_FOR_DELIVERY]
    rider_perf = {}
    for o in delivered_all:
        if not o.rider_id:
            continue
        row = rider_perf.setdefault(o.rider_id, {"onTime": 0, "late": 0})
        if getattr(o, "is_delayed", False):
            row["late"] += 1
        else:
            row["onTime"] += 1

    return {
        "users":         len(all_users),
        "customers":     len(customers),
        "vendors":       len(vendors),
        "riders":        len(riders),
        "onlineRiders":  len(online_riders),
        "shops":         active_shops,
        "openShops":     len(open_shops),
        "closedShops":   len(closed_shops),
        "suspendedShops": len(suspended_shops),
        "orders":        len(all_orders),
        "activeOrders":  len(active_orders),
        "todayOrders":   len(today_orders),
        "acceptedOrders": len(accepted_orders),
        "outForDeliveryOrders": len(out_for_delivery_orders),
        "revenue":       total_rev,
        "todayRevenue":  today_rev,
        "weekRevenue":   week_rev,
        "onTimeDeliveries": len(on_time_orders),
        "lateDeliveries": len(late_orders),
        "codOrders": sum(1 for o in all_orders if (o.payment_method or "").lower() == "cod"),
        "deliveredWithin60": len(on_time_orders),
        "newToday":      new_today,
        "newThisWeek":   new_week,
        "activeVendorsToday": len(active_vendor_ids_today),
        "activeCustomersToday": len(active_customer_ids_today),
        "blockedUsers":  sum(1 for u in all_users if u.is_blocked),
        "pendingOrders": sum(1 for o in all_orders if o.status == OrderStatusEnum.PENDING),
        "riderPerformance": rider_perf,
    }

@app.get("/api/admin/users")
def admin_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    return [user_dict(u) for u in db.query(User).all()]

@app.patch("/api/admin/users/{user_id}/block")
def block_user(user_id: int, body: BlockUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    target = db.query(User).filter(User.id == user_id).first()
    if not target: raise HTTPException(404)
    target.is_blocked = body.isBlocked; db.commit()
    return user_dict(target)

@app.get("/api/admin/shops")
def admin_shops(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    pending = {
        r.shop_id: r.id for r in db.query(ShopLocationChangeRequest).filter(
            ShopLocationChangeRequest.status == "PENDING"
        ).all()
    }
    rows = []
    for s in db.query(Shop).all():
        item = shop_dict(s)
        item["locationChangePending"] = s.id in pending
        item["locationChangeRequestId"] = pending.get(s.id)
        rows.append(item)
    return rows

@app.patch("/api/admin/shops/{shop_id}/suspend")
def suspend_shop(shop_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop: raise HTTPException(404)
    shop.is_suspended = body.get("isSuspended", True); db.commit()
    return shop_dict(shop)

@app.get("/api/admin/shop-location-requests")
def admin_shop_location_requests(status: Optional[str] = "PENDING",
                                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    q = db.query(ShopLocationChangeRequest)
    if status:
        q = q.filter(ShopLocationChangeRequest.status == status.upper())
    return [shop_location_request_dict(r) for r in q.order_by(ShopLocationChangeRequest.created_at.desc()).all()]

@app.post("/api/admin/shop-location-requests/{request_id}/review")
def admin_review_shop_location_request(request_id: int, body: ShopLocationReview,
                                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    req = db.query(ShopLocationChangeRequest).filter(ShopLocationChangeRequest.id == request_id).first()
    if not req: raise HTTPException(404)
    if req.status != "PENDING": raise HTTPException(400, "Location request already reviewed")
    req.status = "APPROVED" if body.approved else "REJECTED"
    req.admin_note = body.note or ""
    req.reviewed_at = utc_now()
    req.reviewed_by = user.id
    if body.approved:
        shop = req.shop
        if not shop: raise HTTPException(404, "Shop not found")
        shop.lat = req.new_lat
        shop.lng = req.new_lng
        if req.new_address is not None: shop.address = req.new_address
        if req.new_city is not None: shop.city = req.new_city
    db.commit()
    return shop_location_request_dict(req)

@app.get("/api/admin/orders")
def admin_orders(timing: Optional[str] = None, paymentMethod: Optional[str] = None,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    q = db.query(Order)
    if timing == "on_time":
        q = q.filter(Order.is_delayed == False)
    elif timing == "late":
        q = q.filter(Order.is_delayed == True)
    if paymentMethod:
        q = q.filter(func.lower(Order.payment_method) == paymentMethod.lower())
    return [order_dict(o) for o in q.order_by(Order.placed_at.desc()).limit(200).all()]

@app.get("/api/admin/revenue")
def admin_revenue(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    now = utc_now()
    def rev(since):
        rows = db.query(Order).filter(Order.status==OrderStatusEnum.DELIVERED, Order.delivered_at>=since).all()
        return {"orders":len(rows),"revenue":round(sum(o.total for o in rows),2)}
    daily = []
    for i in range(6,-1,-1):
        day_start = (now-timedelta(days=i)).replace(hour=0,minute=0,second=0,microsecond=0)
        day_end = day_start+timedelta(days=1)
        rows = db.query(Order).filter(Order.status==OrderStatusEnum.DELIVERED,
                                      Order.delivered_at>=day_start,Order.delivered_at<day_end).all()
        daily.append({"day":day_start.strftime("%a"),"date":day_start.strftime("%d %b"),
                      "orders":len(rows),"revenue":round(sum(o.total for o in rows),2)})
    return {"today":rev(now.replace(hour=0,minute=0,second=0)),"week":rev(now-timedelta(days=7)),
            "month":rev(now-timedelta(days=30)),"allTime":rev(datetime(2000,1,1)),"daily":daily}

@app.get("/api/admin/returns")
def admin_returns(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    rrs = db.query(ReturnRequest).order_by(ReturnRequest.created_at.desc()).all()
    return [{"id":r.id,"orderId":r.order_id,"orderCode":r.order.order_code,
             "customerName":r.customer.name,"shopName":r.shop.name if r.shop else None,
             "status":r.status,"reason":r.reason,"createdAt":r.created_at.isoformat()} for r in rrs]

@app.get("/api/delivery-fee")
def get_delivery_fee(shopLat: float, shopLng: float, custLat: float, custLng: float,
                     subtotal: Optional[float] = 0.0, isPremium: Optional[bool] = False,
                     weather: Optional[str] = None):
    km = haversine(shopLat, shopLng, custLat, custLng)
    if km == 9999: km = 3.0
    km = round(km, 2)
    pricing = compute_pricing(subtotal or 0.0, km, bool(isPremium), weather)
    pricing["riderEarning"] = calc_rider_earning(km)
    return pricing

@app.get("/api/orders/pricing-preview")
def pricing_preview(shopId: int, subtotal: float, custLat: Optional[float] = None, custLng: Optional[float] = None,
                    weather: Optional[str] = None, maxRadiusKm: Optional[float] = None,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.id == shopId).first()
    if not shop:
        raise HTTPException(404, "Shop not found")
    km = haversine(shop.lat, shop.lng, custLat, custLng)
    if km == 9999:
        km = 3.0
    km = round(km, 2)
    allowed_km = get_order_distance_limit(maxRadiusKm)
    if custLat is not None and custLng is not None and km > allowed_km:
        raise HTTPException(400, f"This shop is outside your local delivery range. NearNow only allows ordering within {allowed_km:g} km.")
    pricing = compute_pricing(subtotal, km, getattr(user, "is_premium", False), weather)
    pricing["premiumEligible"] = getattr(user, "is_premium", False)
    pricing["freeDeliveryThreshold"] = FREE_DELIVERY_THRESHOLD
    pricing["maxOrderDistanceKm"] = allowed_km
    pricing["orderAllowed"] = True
    return pricing

@app.get("/")
def root(): return {"message":"DOTT API v5.0","docs":"/docs"}

# ══════════════════════════════════════════════════════════════════
# NEW FEATURE IMPORTS & ENDPOINTS (v7)
# ══════════════════════════════════════════════════════════════════
from database import Wishlist, Referral, UserPoints, VerifiedSeller
import string, secrets

def gen_ref_code(n=8):
    return ''.join(secrets.choice(string.ascii_uppercase+string.digits) for _ in range(n))

def get_or_create_points(user_id: int, db: Session) -> UserPoints:
    up = db.query(UserPoints).filter(UserPoints.user_id == user_id).first()
    if not up:
        up = UserPoints(user_id=user_id, points=0, total_earned=0)
        db.add(up); db.flush()
    return up

# ── WISHLIST ─────────────────────────────────────────────────────
@app.get("/api/wishlist")
def get_wishlist(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Wishlist).filter(Wishlist.user_id == user.id).all()
    return [{"id": w.id, "productId": w.product_id,
             "product": product_dict(w.product) if w.product else None} for w in items]

@app.post("/api/wishlist/{product_id}")
def add_wishlist(product_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(Wishlist).filter(Wishlist.user_id == user.id, Wishlist.product_id == product_id).first()
    if existing:
        db.delete(existing); db.commit()
        return {"action": "removed", "productId": product_id}
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p: raise HTTPException(404)
    db.add(Wishlist(user_id=user.id, product_id=product_id)); db.commit()
    return {"action": "added", "productId": product_id}

@app.get("/api/wishlist/ids")
def wishlist_ids(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = [w.product_id for w in db.query(Wishlist).filter(Wishlist.user_id == user.id).all()]
    return {"ids": ids}

# ── REFERRAL ─────────────────────────────────────────────────────
@app.get("/api/referral/my")
def my_referral(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ref = db.query(Referral).filter(Referral.referrer_id == user.id, Referral.referred_id == None).first()
    if not ref:
        ref = Referral(referrer_id=user.id, code=gen_ref_code()); db.add(ref); db.commit(); db.refresh(ref)
    used_count = db.query(Referral).filter(Referral.referrer_id == user.id, Referral.is_used == True).count()
    up = get_or_create_points(user.id, db); db.commit()
    return {"code": ref.code, "usedCount": used_count, "points": up.points, "totalEarned": up.total_earned,
            "shareLink": f"https://dott.in/join?ref={ref.code}"}

@app.post("/api/referral/apply")
def apply_referral(body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    code = body.get("code", "").strip().upper()
    ref = db.query(Referral).filter(Referral.code == code, Referral.referred_id == None).first()
    if not ref: raise HTTPException(400, "Invalid or already used referral code")
    if ref.referrer_id == user.id: raise HTTPException(400, "Cannot use your own code")
    ref.is_used = True; ref.referred_id = user.id; ref.reward_points = 50
    up_referrer = get_or_create_points(ref.referrer_id, db)
    up_referrer.points += 50; up_referrer.total_earned += 50
    up_me = get_or_create_points(user.id, db)
    up_me.points += 25; up_me.total_earned += 25
    db.commit()
    return {"message": "Code applied! You earned 25 points. Referrer earned 50 points.", "pointsEarned": 25}

# ── POINTS ───────────────────────────────────────────────────────
@app.get("/api/points")
def get_points(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    up = get_or_create_points(user.id, db); db.commit()
    return {"points": up.points, "totalEarned": up.total_earned, "rupeeValue": up.points // 10}

# ── VERIFIED SELLERS ─────────────────────────────────────────────
@app.get("/api/shops/{shop_id}/verified")
def shop_verified(shop_id: int, db: Session = Depends(get_db)):
    v = db.query(VerifiedSeller).filter(VerifiedSeller.shop_id == shop_id).first()
    return {"isVerified": v is not None, "badgeType": v.badge_type if v else None}

@app.post("/api/admin/shops/{shop_id}/verify")
def admin_verify_shop(shop_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    existing = db.query(VerifiedSeller).filter(VerifiedSeller.shop_id == shop_id).first()
    if existing: db.delete(existing)
    badge = body.get("badgeType", "verified")
    db.add(VerifiedSeller(shop_id=shop_id, badge_type=badge)); db.commit()
    return {"ok": True, "badgeType": badge}

@app.post("/api/products/reindex-visual")
def reindex_visual_catalog(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in [RoleEnum.VENDOR, RoleEnum.ADMIN]:
        raise HTTPException(403)
    query = db.query(Product)
    if user.role == RoleEnum.VENDOR:
        shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
        if not shop:
            raise HTTPException(400, "Create a shop first")
        query = query.filter(Product.shop_id == shop.id)
    products = query.all()
    indexed = 0
    for product in products:
        if index_product_visual_embedding(product):
            indexed += 1
    db.commit()
    return {"ok": True, "indexed": indexed, "total": len(products), "model": VISUAL_EMBED_MODEL}

# ── SMART SEARCH ─────────────────────────────────────────────────
@app.post("/api/search/image")
async def search_by_image(file: UploadFile = File(...), lat: Optional[float] = Form(None),
                          lng: Optional[float] = Form(None), radius: Optional[float] = Form(20.0),
                          category: Optional[str] = Form(None), limit: Optional[int] = Form(12),
                          db: Session = Depends(get_db)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image too large. Max 8 MB.")

    query_vector, model_name = compute_visual_embedding(contents)
    candidates = build_visual_candidates(db, lat=lat, lng=lng, radius=get_discovery_radius_limit(radius), category=category)
    matches = rank_visual_matches(query_vector, candidates, limit=min(max(limit or 12, 1), 24))
    db.commit()

    results = []
    for product, distance, score in matches:
        item = product_dict(product)
        item["visualScore"] = round(float(score), 4)
        item["shopName"] = product.shop.name if product.shop else None
        item["shopRating"] = product.shop.rating if product.shop else 0
        item["shopVerified"] = db.query(VerifiedSeller).filter(VerifiedSeller.shop_id == product.shop_id).first() is not None
        if distance is not None:
            item["distanceKm"] = round(distance, 1)
        results.append(item)

    preview_saved = save_image_bytes(0, contents, "jpg")
    return {
        "results": results,
        "total": len(results),
        "queryImageUrl": preview_saved["url"],
        "model": model_name,
        "fallbackMode": model_name != "clip-vit-base-patch32",
    }

@app.get("/api/search")
def smart_search(q: str, lat: Optional[float]=None, lng: Optional[float]=None,
                 category: Optional[str]=None, minPrice: Optional[float]=None,
                 maxPrice: Optional[float]=None, minRating: Optional[float]=None,
                 sortBy: Optional[str]="relevance", radius: Optional[float]=None,
                 db: Session = Depends(get_db)):
    pq = db.query(Product).filter(Product.is_active == True)
    if q:
        term = f"%{q}%"
        pq = pq.filter(
            Product.name.ilike(term) |
            Product.description.ilike(term) |
            Product.category.ilike(term) |
            Product.brand.ilike(term) |
            Product.tags.ilike(term)
        )
    if category: pq = pq.filter(Product.category.ilike(f"%{category}%"))
    if minPrice:  pq = pq.filter(Product.price >= minPrice)
    if maxPrice:  pq = pq.filter(Product.price <= maxPrice)
    products = pq.all()
    results = []
    bounded_radius = get_discovery_radius_limit(radius)
    for p in products:
        dist = None
        if lat and lng and p.shop:
            dist = haversine(lat, lng, p.shop.lat, p.shop.lng)
        if dist is not None and dist > bounded_radius: continue
        d = product_dict(p)
        d["shopName"] = p.shop.name if p.shop else None
        d["shopRating"] = p.shop.rating if p.shop else 0
        d["shopVerified"] = db.query(VerifiedSeller).filter(VerifiedSeller.shop_id==p.shop_id).first() is not None
        if dist is not None: d["distanceKm"] = round(dist, 1)
        if minRating and d["avgRating"] < minRating: continue
        results.append(d)
    if sortBy == "price_asc":  results.sort(key=lambda x: x["price"])
    elif sortBy == "price_desc": results.sort(key=lambda x: -x["price"])
    elif sortBy == "rating":   results.sort(key=lambda x: -x["avgRating"])
    elif sortBy == "distance" and lat: results.sort(key=lambda x: x.get("distanceKm", 999))
    return {"results": results, "total": len(results), "query": q}

# ── RESELLER ─────────────────────────────────────────────────────
@app.get("/api/reseller/products")
def reseller_products(db: Session = Depends(get_db)):
    """Products available for reselling — all active products"""
    products = db.query(Product).filter(Product.is_active == True).all()
    return [{ **product_dict(p), "shopName": p.shop.name if p.shop else None,
              "resellerMargin": round(p.price * 0.1, 2) } for p in products]

# ── ORDER TRACKING ────────────────────────────────────────────────
@app.get("/api/orders/{order_id}/track")
def track_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    if o.customer_id != user.id and o.rider_id != user.id: raise HTTPException(403)
    steps = [
        {"key": "PENDING",           "label": "Order Placed",     "icon": "📦", "done": True},
        {"key": "CONFIRMED",         "label": "Confirmed",        "icon": "✅", "done": o.status not in ["PENDING"]},
        {"key": "PACKING",           "label": "Being Packed",     "icon": "🎁", "done": o.status in ["PACKING","PICKED_UP","OUT_FOR_DELIVERY","DELIVERED"]},
        {"key": "PICKED_UP",         "label": "Rider Picked Up",  "icon": "🏍", "done": o.status in ["PICKED_UP","OUT_FOR_DELIVERY","DELIVERED"]},
        {"key": "OUT_FOR_DELIVERY",  "label": "Out for Delivery", "icon": "🚀", "done": o.status in ["OUT_FOR_DELIVERY","DELIVERED"]},
        {"key": "DELIVERED",         "label": "Delivered",        "icon": "🏠", "done": o.status == "DELIVERED"},
    ]
    rider_loc = None
    if o.rider_id and o.status in ["PICKED_UP","OUT_FOR_DELIVERY"]:
        r = db.query(User).filter(User.id == o.rider_id).first()
        if r and r.lat: rider_loc = {"lat": r.lat, "lng": r.lng, "name": r.name, "phone": r.phone}
    return {**order_dict(o), "steps": steps, "riderLocation": rider_loc}

# ══════════════════════════════════════════════════════════════════
# v8 — PRODUCTION FEATURES
# ══════════════════════════════════════════════════════════════════
from database import PromoCode, SavedAddress, DeliveryOTP, RiderRating

# ── RATE-LIMITING (in-memory, resets on server restart) ───────────
# Patch OTP send with rate limit
# (wraps existing endpoint behavior)
@app.post("/api/otp/send/limited")
def send_otp_limited(body: dict, request_ip: str = "0.0.0.0", db: Session = Depends(get_db)):
    email = str(body.get("email", "")).strip()
    return send_otp(SendOTPRequest(email=email), db)

# ── PAGINATION HELPER ─────────────────────────────────────────────
def paginate(q, page: int = 1, per_page: int = 20):
    total = q.count()
    items = q.offset((page-1)*per_page).limit(per_page).all()
    return {"items": items, "total": total, "page": page,
            "pages": (total + per_page - 1) // per_page, "perPage": per_page}

# ── PROMO CODES ────────────────────────────────────────────────────
class PromoCreate(BaseModel):
    code: str; discountType: str = "percent"; discountValue: float
    minOrder: float = 0; maxUses: int = 100; expiresAt: Optional[str] = None

@app.get("/api/promo/{code}")
def validate_promo(code: str, orderTotal: float = 0, db: Session = Depends(get_db)):
    p = db.query(PromoCode).filter(PromoCode.code == code.upper(), PromoCode.is_active == True).first()
    if not p: raise HTTPException(404, "Invalid promo code")
    if p.expires_at and utc_now() > p.expires_at: raise HTTPException(400, "Promo code expired")
    if p.used_count >= p.max_uses: raise HTTPException(400, "Promo code fully used")
    if orderTotal < p.min_order: raise HTTPException(400, f"Minimum order ₹{p.min_order} required")
    discount = round(p.discount_value if p.discount_type == "flat" else orderTotal * p.discount_value / 100, 2)
    return {"code": p.code, "discountType": p.discount_type, "discountValue": p.discount_value,
            "discount": discount, "message": f"🎉 ₹{discount} off applied!"}

@app.post("/api/admin/promo", status_code=201)
def create_promo(body: PromoCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    if db.query(PromoCode).filter(PromoCode.code == body.code.upper()).first():
        raise HTTPException(400, "Code already exists")
    expires = datetime.fromisoformat(body.expiresAt) if body.expiresAt else None
    p = PromoCode(code=body.code.upper(), discount_type=body.discountType, discount_value=body.discountValue,
                  min_order=body.minOrder, max_uses=body.maxUses, expires_at=expires, created_by=user.id)
    db.add(p); db.commit(); db.refresh(p)
    customers = db.query(User).filter(User.role == RoleEnum.CUSTOMER).all()
    notify_users(
        db,
        customers,
        "New coupon available",
        f"Use code {p.code} on DOTT and save on your next order.",
        "coupon",
        {"type": "coupon", "code": p.code, "promoId": p.id},
        push=True,
    )
    db.commit()
    return {"id": p.id, "code": p.code, "discountType": p.discount_type, "discountValue": p.discount_value,
            "minOrder": p.min_order, "maxUses": p.max_uses, "usedCount": p.used_count, "isActive": p.is_active}

@app.get("/api/admin/promo")
def list_promos(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    promos = db.query(PromoCode).order_by(PromoCode.created_at.desc()).all()
    return [{"id": p.id, "code": p.code, "discountType": p.discount_type, "discountValue": p.discount_value,
             "minOrder": p.min_order, "maxUses": p.max_uses, "usedCount": p.used_count,
             "isActive": p.is_active, "expiresAt": p.expires_at.isoformat() if p.expires_at else None} for p in promos]

@app.patch("/api/admin/promo/{promo_id}/toggle")
def toggle_promo(promo_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    p = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not p: raise HTTPException(404)
    p.is_active = not p.is_active; db.commit()
    return {"id": p.id, "isActive": p.is_active}

# ── ADDRESS BOOK ──────────────────────────────────────────────────
class AddressCreate(BaseModel):
    label: str = "Home"; address: str; lat: Optional[float]=None; lng: Optional[float]=None; isDefault: bool=False

@app.get("/api/addresses")
def get_addresses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    addrs = db.query(SavedAddress).filter(SavedAddress.user_id == user.id).order_by(SavedAddress.is_default.desc()).all()
    return [{"id":a.id,"label":a.label,"address":a.address,"lat":a.lat,"lng":a.lng,"isDefault":a.is_default} for a in addrs]

@app.post("/api/addresses", status_code=201)
def add_address(body: AddressCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.isDefault:
        db.query(SavedAddress).filter(SavedAddress.user_id == user.id).update({"is_default": False})
    a = SavedAddress(user_id=user.id, label=body.label, address=body.address, lat=body.lat, lng=body.lng, is_default=body.isDefault)
    db.add(a); db.commit(); db.refresh(a)
    return {"id":a.id,"label":a.label,"address":a.address,"lat":a.lat,"lng":a.lng,"isDefault":a.is_default}

@app.delete("/api/addresses/{addr_id}")
def del_address(addr_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.query(SavedAddress).filter(SavedAddress.id == addr_id, SavedAddress.user_id == user.id).first()
    if not a: raise HTTPException(404)
    db.delete(a); db.commit()
    return {"ok": True}

# ── DELIVERY OTP ──────────────────────────────────────────────────
@app.post("/api/orders/{order_id}/delivery-otp/generate")
def gen_delivery_otp(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o or o.customer_id != user.id: raise HTTPException(403)
    existing = db.query(DeliveryOTP).filter(DeliveryOTP.order_id == order_id, DeliveryOTP.is_used == False).first()
    if existing:
        return {"otp": existing.otp, "message": "Share this OTP with the rider when they arrive"}
    otp = generate_otp()
    db.add(DeliveryOTP(order_id=order_id, otp=otp)); db.commit()
    return {"otp": otp, "message": "Share this OTP with the rider when they arrive"}

@app.post("/api/orders/{order_id}/delivery-otp/request")
def request_delivery_otp(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER:
        raise HTTPException(403)
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o or o.rider_id != user.id:
        raise HTTPException(403)
    if o.status not in [OrderStatusEnum.PICKED_UP, OrderStatusEnum.OUT_FOR_DELIVERY]:
        raise HTTPException(400, "Delivery OTP can be requested only after pickup")
    if not o.customer:
        raise HTTPException(400, "Customer not found for this order")
    rider_name = (user.name or "Your rider").strip()
    notify_user(
        db,
        o.customer,
        "Delivery OTP needed",
        f"{rider_name} is asking for the delivery OTP for order {o.order_code}. Open the order and share the OTP.",
        "delivery_otp",
        _order_push_data(o, {
            "type": "delivery_otp",
            "action": "generate_delivery_otp",
            "orderId": o.id,
            "orderCode": o.order_code,
        }),
        push=True,
    )
    db.commit()
    return {"ok": True, "message": "Customer notified to share delivery OTP"}

@app.post("/api/orders/{order_id}/delivery-otp/verify")
def verify_delivery_otp(order_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o or o.rider_id != user.id: raise HTTPException(403)
    d = db.query(DeliveryOTP).filter(DeliveryOTP.order_id == order_id, DeliveryOTP.is_used == False).first()
    if not d: raise HTTPException(400, "No OTP found")
    if d.otp != body.get("otp","").strip(): raise HTTPException(400, "Wrong OTP")
    d.is_used = True
    o.status = OrderStatusEnum.DELIVERED
    finalize_delivery_timing(o)
    db.commit()
    try:
        send_push_to_user(o.customer, "Delivered", f"Order {o.order_code} was delivered.", _order_push_data(o))
        if o.shop and o.shop.owner:
            send_push_to_user(o.shop.owner, "Order delivered", f"Order {o.order_code} has been delivered.", _order_push_data(o))
    except Exception:
        pass
    return {"ok": True, "message": "Delivery confirmed ✓"}

# ── ORDER CANCELLATION WITH REASON ───────────────────────────────
@app.put("/api/orders/{order_id}/cancel/v2")
def cancel_order_v2(order_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    if o.customer_id != user.id: raise HTTPException(403)
    if o.status not in [OrderStatusEnum.PENDING]: raise HTTPException(400, "Can only cancel PENDING orders")
    o.status = OrderStatusEnum.CANCELLED
    o.notes = (o.notes or "") + f"\n[CANCELLED] Reason: {body.get('reason','No reason given')}"
    db.commit(); db.refresh(o)
    try:
        send_push_to_user(o.customer, "Order cancelled", f"Order {o.order_code} was cancelled.", _order_push_data(o))
        if o.shop and o.shop.owner:
            send_push_to_user(o.shop.owner, "Order cancelled", f"Order {o.order_code} was cancelled by the customer.", _order_push_data(o))
    except Exception:
        pass
    return order_dict(o)

# ── ORDER REAL-TIME POLL (lightweight) ────────────────────────────
@app.get("/api/orders/{order_id}/status")
def order_status(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o or (o.customer_id != user.id and o.rider_id != user.id): raise HTTPException(403)
    timer = order_timer_snapshot(o)
    return {"id": o.id, "status": o.status, "orderCode": o.order_code,
            "riderId": o.rider_id, "updatedAt": o.confirmed_at.isoformat() if o.confirmed_at else None,
            "paymentMethod": o.payment_method, "countdown": timer,
            "deliveryDeadline": timer["deadline"], "serverNow": timer["serverNow"],
            "isDelayed": timer["isDelayed"], "codDueAmount": getattr(o, "cod_due_amount", 0.0)}

# ── RIDER PERFORMANCE ────────────────────────────────────────────
@app.get("/api/riders/performance")
def rider_performance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.RIDER: raise HTTPException(403)
    delivered = db.query(Order).filter(Order.rider_id == user.id, Order.status == OrderStatusEnum.DELIVERED).count()
    cancelled = db.query(Order).filter(Order.rider_id == user.id, Order.status == OrderStatusEnum.CANCELLED).count()
    ratings = db.query(RiderRating).filter(RiderRating.rider_id == user.id).all()
    avg_rating = round(sum(r.rating for r in ratings)/len(ratings), 1) if ratings else 0
    rows = db.query(Order).filter(Order.rider_id == user.id, Order.status == OrderStatusEnum.DELIVERED).all()
    total_earned = sum(o.rider_earning or 0 for o in rows)
    on_time = sum(1 for o in rows if not getattr(o, "is_delayed", False))
    late = sum(1 for o in rows if getattr(o, "is_delayed", False))
    total_bonus = sum(getattr(o, "rider_bonus", 0.0) or 0.0 for o in rows)
    total_penalty = sum(getattr(o, "rider_penalty", 0.0) or 0.0 for o in rows)
    on_time_rate = round((on_time / len(rows)) * 100, 1) if rows else 0
    return {"deliveredOrders": delivered, "cancelledOrders": cancelled,
            "avgRating": avg_rating, "totalRatings": len(ratings),
            "totalEarned": round(total_earned, 2), "onTimeRate": on_time_rate,
            "onTimeDeliveries": on_time, "lateDeliveries": late,
            "bonusEarned": round(total_bonus, 2), "penaltyApplied": round(total_penalty, 2)}

# ── RATE RIDER ────────────────────────────────────────────────────
@app.post("/api/orders/{order_id}/rate-rider")
def rate_rider(order_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id, Order.customer_id == user.id).first()
    if not o or not o.rider_id: raise HTTPException(404)
    if o.status != OrderStatusEnum.DELIVERED: raise HTTPException(400, "Order not delivered")
    existing = db.query(RiderRating).filter(RiderRating.order_id == order_id).first()
    if existing: raise HTTPException(400, "Already rated")
    rating = body.get("rating", 5)
    db.add(RiderRating(order_id=order_id, rider_id=o.rider_id, customer_id=user.id, rating=rating))
    db.commit()
    return {"ok": True}

# ── ADMIN: VERIFY SHOP ────────────────────────────────────────────
@app.get("/api/admin/verify-requests")
def verify_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    shops = db.query(Shop).filter(Shop.is_active == True).all()
    verified_ids = {v.shop_id for v in db.query(VerifiedSeller).all()}
    return [{"id": s.id, "name": s.name, "category": s.category, "city": s.city,
             "totalOrders": s.total_orders, "rating": s.rating, "ratingCount": s.rating_count,
             "isVerified": s.id in verified_ids,
             "owner": s.owner.name if s.owner else None} for s in shops]

# ── ADMIN: COMMISSION SETTINGS ────────────────────────────────────
_commission_rate = {
    "platform_fee_flat": 10,
    "reseller_pct": 10,
    "rider_base": 20,
    "vendor_commission_pct": 0,
}

SETTLEMENT_CYCLE_DAYS = 2

def parse_dashboard_range(range_key: Optional[str], start_date: Optional[str], end_date: Optional[str]):
    now = utc_now()
    key = (range_key or "last2days").lower()
    if key == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
    elif key == "weekly":
        end = now
        start = now - timedelta(days=7)
    elif key == "monthly":
        end = now
        start = now - timedelta(days=30)
    elif key == "all":
        start = datetime(2024, 1, 1)
        end = now
    elif key == "custom" and start_date and end_date:
        start = datetime.fromisoformat(start_date).replace(hour=0, minute=0, second=0, microsecond=0)
        end = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999)
    else:
        end = now
        start = now - timedelta(days=SETTLEMENT_CYCLE_DAYS)
        key = "last2days"
    return key, start, end

def settlement_cycle_bounds(dt: datetime):
    start = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    epoch = datetime(2024, 1, 1)
    cycle_index = max(0, (start - epoch).days // SETTLEMENT_CYCLE_DAYS)
    cycle_start = epoch + timedelta(days=cycle_index * SETTLEMENT_CYCLE_DAYS)
    cycle_end = cycle_start + timedelta(days=SETTLEMENT_CYCLE_DAYS) - timedelta(microseconds=1)
    cycle_key = cycle_start.strftime("%Y%m%d")
    return cycle_key, cycle_start, cycle_end

def vendor_merchandise_total(order: Order) -> float:
    items_total = round(sum((item.price or 0.0) * (item.qty or 0) for item in (order.items or [])), 2)
    if items_total > 0:
        return items_total
    subtotal = float(order.subtotal or 0.0)
    total = float(order.total or 0.0)
    non_vendor_charges = round(
        float(order.delivery_fee or 0.0) +
        float(getattr(order, "platform_fee", 0.0) or 0.0) +
        float(getattr(order, "gst_amount", 0.0) or 0.0),
        2,
    )
    adjusted_total = round(max(0.0, total - non_vendor_charges), 2) if total > 0 else 0.0
    if total > 0 and non_vendor_charges > 0 and (subtotal <= 0 or abs(subtotal - total) < 0.01 or subtotal > total):
        return adjusted_total
    return round(subtotal or adjusted_total, 2)

def vendor_settlement_product_value(order: Order) -> float:
    """Product value owed to vendor after completed refunds are removed."""
    product_value = vendor_merchandise_total(order)
    if (getattr(order, "refund_status", "") or "").upper() == "REFUNDED":
        product_value = max(0.0, product_value - float(getattr(order, "refund_amount", 0.0) or 0.0))
    return round(product_value, 2)

def invoice_status(invoice: SettlementInvoice):
    pending = round(max((invoice.net_payable or 0.0) - (invoice.paid_amount or 0.0), 0.0), 2)
    if pending <= 0:
        return "PAID"
    if (invoice.paid_amount or 0.0) > 0:
        return "PARTIAL"
    return "PENDING"

def sync_settlement_invoices(db: Session):
    delivered_orders = db.query(Order).filter(
        Order.status == OrderStatusEnum.DELIVERED,
        Order.delivered_at != None,
    ).all()
    grouped = {}
    for order in delivered_orders:
        cycle_key, period_start, period_end = settlement_cycle_bounds(order.delivered_at)
        if order.shop and order.shop.owner_id:
            vendor_key = ("vendor", order.shop_id or order.shop.owner_id, order.shop_id, cycle_key)
            grouped.setdefault(vendor_key, {
                "entity_type": "vendor",
                "user_id": order.shop.owner_id,
                "shop_id": order.shop_id,
                "period_start": period_start,
                "period_end": period_end,
                "orders": [],
            })["orders"].append(order)
        if order.rider_id:
            rider_key = ("rider", order.rider_id, None, cycle_key)
            grouped.setdefault(rider_key, {
                "entity_type": "rider",
                "user_id": order.rider_id,
                "shop_id": None,
                "period_start": period_start,
                "period_end": period_end,
                "orders": [],
            })["orders"].append(order)

    for (entity_type, _group_owner, shop_id, cycle_key), meta in grouped.items():
        user_id = meta["user_id"]
        rows = meta["orders"]
        order_ids = sorted({o.id for o in rows})
        invoice_query = db.query(SettlementInvoice).filter(
            SettlementInvoice.entity_type == entity_type,
            SettlementInvoice.cycle_key == cycle_key,
        )
        if entity_type == "vendor" and shop_id is not None:
            invoice_query = invoice_query.filter(SettlementInvoice.shop_id == shop_id)
        else:
            invoice_query = invoice_query.filter(SettlementInvoice.user_id == user_id)

        locked_invoices = invoice_query.filter(
            (SettlementInvoice.status == "PAID") | (SettlementInvoice.payout_locked_at != None)
        ).all()
        locked_order_ids = set()
        for locked_invoice in locked_invoices:
            try:
                locked_order_ids.update(json.loads(locked_invoice.order_ids_json or "[]"))
            except Exception:
                pass
        rows = [o for o in rows if o.id not in locked_order_ids]
        if not rows:
            continue
        order_ids = sorted({o.id for o in rows})

        invoice = invoice_query.filter(
            SettlementInvoice.status != "PAID",
            SettlementInvoice.payout_locked_at == None,
        ).first()

        if entity_type == "vendor":
            product_value = round(sum(vendor_settlement_product_value(o) for o in rows), 2)
            delivery_collected = round(sum((o.delivery_fee or 0.0) for o in rows), 2)
            rider_earning_amount = round(sum((o.rider_earning or 0.0) for o in rows), 2)
            total_sales = product_value
            commission_pct = float(_commission_rate.get("vendor_commission_pct", 0))
            commission_amount = round(product_value * commission_pct / 100.0, 2)
            gross_earnings = product_value
            net_payable = round(product_value - commission_amount, 2)
        else:
            product_value = round(sum(vendor_merchandise_total(o) for o in rows), 2)
            delivery_collected = round(sum((o.delivery_fee or 0.0) for o in rows), 2)
            rider_earning_amount = round(sum((o.rider_earning or 0.0) for o in rows), 2)
            total_sales = delivery_collected
            commission_pct = 0.0
            commission_amount = 0.0
            gross_earnings = rider_earning_amount
            net_payable = gross_earnings

        if not invoice:
            invoice = SettlementInvoice(
                entity_type=entity_type,
                user_id=user_id,
                shop_id=shop_id,
                period_start=meta["period_start"],
                period_end=meta["period_end"],
                cycle_key=cycle_key,
            )
            db.add(invoice)
            db.flush()
        invoice.shop_id = shop_id
        invoice.period_start = meta["period_start"]
        invoice.period_end = meta["period_end"]
        invoice.total_orders = len(order_ids)
        invoice.total_sales = total_sales
        invoice.product_value = product_value
        invoice.delivery_collected = delivery_collected
        invoice.rider_earning_amount = rider_earning_amount
        invoice.commission_pct = commission_pct
        invoice.commission_amount = commission_amount
        invoice.gross_earnings = gross_earnings
        invoice.net_payable = net_payable
        invoice.order_ids_json = json.dumps(order_ids)
        invoice.pending_amount = round(max(net_payable - (invoice.paid_amount or 0.0), 0.0), 2)
        invoice.status = invoice_status(invoice)
        invoice.updated_at = utc_now()
    db.commit()

def invoice_dict(invoice: SettlementInvoice):
    return {
        "id": invoice.id,
        "entityType": invoice.entity_type,
        "userId": invoice.user_id,
        "shopId": invoice.shop_id,
        "periodStart": invoice.period_start.isoformat() if invoice.period_start else None,
        "periodEnd": invoice.period_end.isoformat() if invoice.period_end else None,
        "cycleKey": invoice.cycle_key,
        "totalOrders": invoice.total_orders,
        "totalSales": round(invoice.total_sales or 0.0, 2),
        "productValue": round(invoice.product_value or 0.0, 2),
        "deliveryCollected": round(invoice.delivery_collected or 0.0, 2),
        "riderEarning": round(invoice.rider_earning_amount or 0.0, 2),
        "vendorPayout": round(invoice.net_payable or 0.0, 2) if invoice.entity_type == "vendor" else 0.0,
        "commissionPct": round(invoice.commission_pct or 0.0, 2),
        "commissionAmount": round(invoice.commission_amount or 0.0, 2),
        "grossEarnings": round(invoice.gross_earnings or 0.0, 2),
        "netPayable": round(invoice.net_payable or 0.0, 2),
        "paidAmount": round(invoice.paid_amount or 0.0, 2),
        "pendingAmount": round(invoice.pending_amount or 0.0, 2),
        "status": invoice.status,
        "isLocked": bool(invoice.payout_locked_at),
        "lockedAt": invoice.payout_locked_at.isoformat() if invoice.payout_locked_at else None,
        "createdAt": invoice.created_at.isoformat() if invoice.created_at else None,
        "updatedAt": invoice.updated_at.isoformat() if invoice.updated_at else None,
    }

def settlement_summary_for_entity(db: Session, entity_type: str, user_id: int, start: datetime, end: datetime, shop_id: Optional[int] = None):
    query = db.query(SettlementInvoice).filter(
        SettlementInvoice.entity_type == entity_type,
        SettlementInvoice.user_id == user_id,
        SettlementInvoice.period_start <= end,
        SettlementInvoice.period_end >= start,
    )
    if shop_id is not None:
        query = query.filter(SettlementInvoice.shop_id == shop_id)
    invoices = query.order_by(SettlementInvoice.period_start.desc()).all()

    payments_query = db.query(SettlementPayment).filter(
        SettlementPayment.entity_type == entity_type,
        SettlementPayment.user_id == user_id,
        SettlementPayment.payment_date >= start,
        SettlementPayment.payment_date <= end,
    )
    if shop_id is not None:
        payments_query = payments_query.filter(SettlementPayment.shop_id == shop_id)
    payments = payments_query.order_by(SettlementPayment.payment_date.desc()).all()

    total_orders = sum(i.total_orders or 0 for i in invoices)
    total_sales = round(sum(i.total_sales or 0.0 for i in invoices), 2)
    product_value = round(sum(i.product_value or 0.0 for i in invoices), 2)
    delivery_collected = round(sum(i.delivery_collected or 0.0 for i in invoices), 2)
    rider_earning_amount = round(sum(i.rider_earning_amount or 0.0 for i in invoices), 2)
    gross_earnings = round(sum(i.gross_earnings or 0.0 for i in invoices), 2)
    commission_amount = round(sum(i.commission_amount or 0.0 for i in invoices), 2)
    net_payable = round(sum(i.net_payable or 0.0 for i in invoices), 2)
    paid_amount = round(sum(i.paid_amount or 0.0 for i in invoices), 2)
    pending_amount = round(sum(i.pending_amount or 0.0 for i in invoices), 2)

    return {
        "totalOrders": total_orders,
        "totalSales": total_sales,
        "productValue": product_value,
        "deliveryCollected": delivery_collected,
        "riderEarning": rider_earning_amount,
        "vendorPayout": net_payable if entity_type == "vendor" else 0.0,
        "grossEarnings": gross_earnings,
        "commissionPct": round(invoices[0].commission_pct, 2) if invoices else float(_commission_rate.get("vendor_commission_pct", 0) if entity_type == "vendor" else 0),
        "commissionAmount": commission_amount,
        "netPayable": net_payable,
        "paidAmount": paid_amount,
        "pendingAmount": pending_amount,
        "earningsPerDelivery": round((gross_earnings / total_orders), 2) if total_orders else 0.0,
        "invoiceCount": len(invoices),
        "invoices": [invoice_dict(i) for i in invoices],
        "paymentHistory": [{
            "id": p.id,
            "invoiceId": p.invoice_id,
            "entityType": p.entity_type,
            "userId": p.user_id,
            "shopId": p.shop_id,
            "amount": round(p.amount or 0.0, 2),
            "paymentMethod": p.payment_method or "UPI",
            "paymentReference": p.payment_reference or "",
            "paymentStatus": p.payment_status,
            "paymentDate": p.payment_date.isoformat() if p.payment_date else None,
            "periodStart": p.period_start.isoformat() if p.period_start else None,
            "periodEnd": p.period_end.isoformat() if p.period_end else None,
            "notes": p.notes or "",
        } for p in payments],
    }

def admin_settlement_dashboard(db: Session, start: datetime, end: datetime):
    vendor_invoices = db.query(SettlementInvoice).filter(
        SettlementInvoice.entity_type == "vendor",
        SettlementInvoice.period_start <= end,
        SettlementInvoice.period_end >= start,
    ).all()
    rider_invoices = db.query(SettlementInvoice).filter(
        SettlementInvoice.entity_type == "rider",
        SettlementInvoice.period_start <= end,
        SettlementInvoice.period_end >= start,
    ).all()
    payment_history = db.query(SettlementPayment).filter(
        SettlementPayment.payment_date >= start,
        SettlementPayment.payment_date <= end,
    ).order_by(SettlementPayment.payment_date.desc()).all()

    by_vendor = {}
    for invoice in vendor_invoices:
        group_key = ("shop", invoice.shop_id) if invoice.shop_id is not None else ("vendor", invoice.user_id)
        existing = by_vendor.get(group_key)
        base_row = {
                "vendorId": invoice.user_id,
                "shopId": invoice.shop_id,
                "vendorName": invoice.user.name if invoice.user else "Vendor",
                "shopName": invoice.shop.name if invoice.shop else "Shop",
                "totalOrders": invoice.total_orders or 0,
                "totalSales": invoice.total_sales or 0.0,
                "productValue": invoice.product_value or 0.0,
                "deliveryCollected": invoice.delivery_collected or 0.0,
                "riderEarning": invoice.rider_earning_amount or 0.0,
                "commissionPct": invoice.commission_pct or float(_commission_rate.get("vendor_commission_pct", 0)),
                "commissionAmount": invoice.commission_amount or 0.0,
                "netPayable": invoice.net_payable or 0.0,
                "paidAmount": invoice.paid_amount or 0.0,
                "pendingAmount": invoice.pending_amount or 0.0,
                "invoiceCount": 1,
                "invoiceIds": [invoice.id],
                "latestInvoiceId": invoice.id,
                "periodStart": invoice.period_start,
                "status": "PENDING",
        }
        if not existing:
            by_vendor[group_key] = base_row
            continue
        existing["totalOrders"] += base_row["totalOrders"]
        existing["totalSales"] += base_row["totalSales"]
        existing["productValue"] += base_row["productValue"]
        existing["deliveryCollected"] += base_row["deliveryCollected"]
        existing["riderEarning"] += base_row["riderEarning"]
        existing["commissionAmount"] += base_row["commissionAmount"]
        existing["netPayable"] += base_row["netPayable"]
        existing["paidAmount"] += base_row["paidAmount"]
        existing["pendingAmount"] += base_row["pendingAmount"]
        existing["invoiceCount"] += 1
        existing["invoiceIds"].append(invoice.id)
        if (
            (invoice.period_start or datetime.min) > (existing["periodStart"] or datetime.min)
            or (
                (invoice.period_start or datetime.min) == (existing["periodStart"] or datetime.min)
                and invoice.id > existing["latestInvoiceId"]
            )
        ):
            existing["latestInvoiceId"] = invoice.id
            existing["periodStart"] = invoice.period_start

    by_rider = {}
    for invoice in rider_invoices:
        existing = by_rider.get(invoice.user_id)
        cod_summary = rider_cod_settlement_summary(db, invoice.user) if invoice.user else {}
        cod_breakdown = cod_summary.get("breakdown", {}) or {}
        base_row = {
            "riderId": invoice.user_id,
            "riderName": invoice.user.name if invoice.user else "Rider",
            "totalDeliveries": invoice.total_orders or 0,
            "earningsPerDelivery": 0.0,
            "deliveryCollected": invoice.delivery_collected or 0.0,
            "totalEarnings": invoice.gross_earnings or 0.0,
            "paidAmount": invoice.paid_amount or 0.0,
            "pendingAmount": invoice.pending_amount or 0.0,
            "codCollected": cod_summary.get("totalCollected", 0.0),
            "codSettled": cod_summary.get("settledAmount", 0.0),
            "codPending": cod_summary.get("pendingAmount", 0.0),
            "codOrders": cod_summary.get("totalCodOrders", 0),
            "codProductValue": cod_breakdown.get("productValue", 0.0),
            "codDeliveryFee": cod_breakdown.get("deliveryFee", 0.0),
            "codPlatformFee": cod_breakdown.get("platformFee", 0.0),
            "codGstAmount": cod_breakdown.get("gstAmount", 0.0),
            "codOtherAdjustments": cod_breakdown.get("otherAdjustments", 0.0),
            "codSummary": cod_summary,
            "invoiceCount": 1,
            "invoiceIds": [invoice.id],
            "latestInvoiceId": invoice.id,
            "periodStart": invoice.period_start,
            "status": "PENDING",
        }
        if not existing:
            by_rider[invoice.user_id] = {
                **base_row
            }
            continue
        existing["totalDeliveries"] += base_row["totalDeliveries"]
        existing["deliveryCollected"] += base_row["deliveryCollected"]
        existing["totalEarnings"] += base_row["totalEarnings"]
        existing["paidAmount"] += base_row["paidAmount"]
        existing["pendingAmount"] += base_row["pendingAmount"]
        existing["codCollected"] = base_row["codCollected"]
        existing["codSettled"] = base_row["codSettled"]
        existing["codPending"] = base_row["codPending"]
        existing["codOrders"] = base_row["codOrders"]
        existing["codProductValue"] = base_row["codProductValue"]
        existing["codDeliveryFee"] = base_row["codDeliveryFee"]
        existing["codPlatformFee"] = base_row["codPlatformFee"]
        existing["codGstAmount"] = base_row["codGstAmount"]
        existing["codOtherAdjustments"] = base_row["codOtherAdjustments"]
        existing["codSummary"] = base_row["codSummary"]
        existing["invoiceCount"] += 1
        existing["invoiceIds"].append(invoice.id)
        if (
            (invoice.period_start or datetime.min) > (existing["periodStart"] or datetime.min)
            or (
                (invoice.period_start or datetime.min) == (existing["periodStart"] or datetime.min)
                and invoice.id > existing["latestInvoiceId"]
            )
        ):
            existing["latestInvoiceId"] = invoice.id
            existing["periodStart"] = invoice.period_start

    vendors = []
    for row in by_vendor.values():
        row["totalSales"] = round(row["totalSales"], 2)
        row["commissionAmount"] = round(row["commissionAmount"], 2)
        row["productValue"] = round(row["productValue"], 2)
        row["deliveryCollected"] = round(row["deliveryCollected"], 2)
        row["riderEarning"] = round(row["riderEarning"], 2)
        row["netPayable"] = round(row["netPayable"], 2)
        row["paidAmount"] = round(row["paidAmount"], 2)
        row["pendingAmount"] = round(row["pendingAmount"], 2)
        row["status"] = "PAID" if row["pendingAmount"] <= 0 else ("PARTIAL" if row["paidAmount"] > 0 else "PENDING")
        row.pop("periodStart", None)
        vendors.append(row)

    riders = []
    for row in by_rider.values():
        row["totalEarnings"] = round(row["totalEarnings"], 2)
        row["deliveryCollected"] = round(row["deliveryCollected"], 2)
        row["paidAmount"] = round(row["paidAmount"], 2)
        row["pendingAmount"] = round(row["pendingAmount"], 2)
        row["codCollected"] = round(row.get("codCollected", 0.0), 2)
        row["codSettled"] = round(row.get("codSettled", 0.0), 2)
        row["codPending"] = round(row.get("codPending", 0.0), 2)
        row["codProductValue"] = round(row.get("codProductValue", 0.0), 2)
        row["codDeliveryFee"] = round(row.get("codDeliveryFee", 0.0), 2)
        row["codPlatformFee"] = round(row.get("codPlatformFee", 0.0), 2)
        row["codGstAmount"] = round(row.get("codGstAmount", 0.0), 2)
        row["codOtherAdjustments"] = round(row.get("codOtherAdjustments", 0.0), 2)
        row["netAdminPayable"] = round(max(row["pendingAmount"] - row["codPending"], 0.0), 2)
        row["netRiderOwes"] = round(max(row["codPending"] - row["pendingAmount"], 0.0), 2)
        row["earningsPerDelivery"] = round(row["totalEarnings"] / row["totalDeliveries"], 2) if row["totalDeliveries"] else 0.0
        row["status"] = "PAID" if row["pendingAmount"] <= 0 else ("PARTIAL" if row["paidAmount"] > 0 else "PENDING")
        row.pop("periodStart", None)
        riders.append(row)

    return {
        "vendors": sorted(vendors, key=lambda item: item["pendingAmount"], reverse=True),
        "riders": sorted(riders, key=lambda item: item["pendingAmount"], reverse=True),
        "vendorInvoices": [invoice_dict(i) for i in sorted(vendor_invoices, key=lambda item: item.period_start, reverse=True)],
        "riderInvoices": [invoice_dict(i) for i in sorted(rider_invoices, key=lambda item: item.period_start, reverse=True)],
        "paymentHistory": [{
            "id": p.id,
            "invoiceId": p.invoice_id,
            "entityType": p.entity_type,
            "userId": p.user_id,
            "userName": p.user.name if p.user else "",
            "shopName": p.shop.name if p.shop else None,
            "amount": round(p.amount or 0.0, 2),
            "paymentMethod": p.payment_method or "UPI",
            "paymentReference": p.payment_reference or "",
            "paymentStatus": p.payment_status,
            "paymentDate": p.payment_date.isoformat() if p.payment_date else None,
            "periodStart": p.period_start.isoformat() if p.period_start else None,
            "periodEnd": p.period_end.isoformat() if p.period_end else None,
            "notes": p.notes or "",
        } for p in payment_history],
        "riderCod": {
            "totalCollected": round(sum(row.get("codCollected", 0.0) for row in riders), 2),
            "settledAmount": round(sum(row.get("codSettled", 0.0) for row in riders), 2),
            "pendingAmount": round(sum(row.get("codPending", 0.0) for row in riders), 2),
            "breakdown": {
                "productValue": round(sum(row.get("codProductValue", 0.0) for row in riders), 2),
                "deliveryFee": round(sum(row.get("codDeliveryFee", 0.0) for row in riders), 2),
                "platformFee": round(sum(row.get("codPlatformFee", 0.0) for row in riders), 2),
                "gstAmount": round(sum(row.get("codGstAmount", 0.0) for row in riders), 2),
                "otherAdjustments": round(sum(row.get("codOtherAdjustments", 0.0) for row in riders), 2),
            },
        },
    }

def mark_invoice_paid(db: Session, invoice_id: int, note: str = "", method: str = "UPI", payment_reference: str = ""):
    invoice = db.query(SettlementInvoice).filter(SettlementInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    amount = round(invoice.pending_amount or 0.0, 2)
    if amount <= 0:
        return invoice
    invoice.paid_amount = round((invoice.paid_amount or 0.0) + amount, 2)
    invoice.pending_amount = 0.0
    invoice.status = "PAID"
    invoice.payout_locked_at = utc_now()
    invoice.updated_at = utc_now()
    db.add(SettlementPayment(
        invoice_id=invoice.id,
        entity_type=invoice.entity_type,
        user_id=invoice.user_id,
        shop_id=invoice.shop_id,
        amount=amount,
        payment_status="PAID",
        payment_method=(method or "UPI").upper(),
        payment_reference=(payment_reference or "").strip(),
        payment_date=utc_now(),
        period_start=invoice.period_start,
        period_end=invoice.period_end,
        notes=note or f"Marked as paid from admin {invoice.entity_type} settlement dashboard",
    ))
    db.commit()
    db.refresh(invoice)
    return invoice

@app.get("/api/admin/commission")
def get_commission(user: User = Depends(get_current_user)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    return _commission_rate

@app.put("/api/admin/commission")
def set_commission(body: dict, user: User = Depends(get_current_user)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    _commission_rate.update({k: v for k,v in body.items() if k in _commission_rate})
    return _commission_rate

@app.get("/api/admin/settlements")
def admin_settlements(rangeKey: Optional[str] = "last2days", startDate: Optional[str] = None,
                      endDate: Optional[str] = None,
                      user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN:
        raise HTTPException(403)
    sync_settlement_invoices(db)
    applied_range, start, end = parse_dashboard_range(rangeKey, startDate, endDate)
    payload = admin_settlement_dashboard(db, start, end)
    payload["filters"] = {
        "rangeKey": applied_range,
        "startDate": start.date().isoformat(),
        "endDate": end.date().isoformat(),
        "cycleDays": SETTLEMENT_CYCLE_DAYS,
    }
    return payload

@app.post("/api/admin/settlements/invoices/{invoice_id}/pay")
def admin_mark_invoice_paid(invoice_id: int, body: Optional[dict] = None,
                            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN:
        raise HTTPException(403)
    payload = body or {}
    payment_reference = (payload.get("paymentReference", "") or "").strip()
    if not payment_reference:
        raise HTTPException(400, "UTR / payment reference is required")
    invoice = mark_invoice_paid(
        db,
        invoice_id,
        payload.get("note", ""),
        payload.get("method", "UPI"),
        payment_reference,
    )
    return {"ok": True, "invoice": invoice_dict(invoice)}

@app.post("/api/admin/riders/{rider_id}/cod-settlement/pay")
def admin_record_rider_cod_payment(rider_id: int, body: RiderCodSettlementPay,
                                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN:
        raise HTTPException(403)
    rider = db.query(User).filter(User.id == rider_id, User.role == RoleEnum.RIDER).first()
    if not rider:
        raise HTTPException(404, "Rider not found")
    summary = rider_cod_settlement_summary(db, rider)
    pending = round(float(summary.get("pendingAmount", 0.0) or 0.0), 2)
    amount = round(float(body.amount if body.amount is not None else pending), 2)
    if amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero")
    if amount > pending:
        raise HTTPException(400, "Amount cannot exceed pending COD settlement")
    method = (body.method or "upi").strip().upper()
    payment_reference = (body.paymentReference or "").strip()
    if not payment_reference:
        raise HTTPException(400, "UTR / payment reference is required")
    db.add(SettlementPayment(
        invoice_id=None,
        entity_type="rider_cod",
        user_id=rider.id,
        shop_id=None,
        amount=amount,
        payment_status="PAID",
        payment_method=method,
        payment_reference=payment_reference,
        payment_date=utc_now(),
        notes=(body.note or f"Admin recorded COD deposit from {rider.name}").strip(),
    ))
    db.commit()
    return {"ok": True, "summary": rider_cod_settlement_summary(db, rider)}

# ── ADMIN: CSV EXPORT ─────────────────────────────────────────────
import csv, io

@app.get("/api/admin/export/orders")
def export_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    orders = db.query(Order).order_by(Order.placed_at.desc()).limit(1000).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Order Code","Status","Customer","Shop","Total","Delivery Fee","Payment","Date"])
    for o in orders:
        w.writerow([o.order_code, o.status, o.customer.name if o.customer else "", o.shop.name if o.shop else "",
                    o.total, o.delivery_fee, o.payment_method, o.placed_at.strftime("%Y-%m-%d %H:%M")])
    buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.read().encode()), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=orders.csv"})

@app.get("/api/admin/export/users")
def export_users(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    users = db.query(User).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ID","Name","Email","Phone","Role","Verified","Blocked","Joined"])
    for u in users:
        w.writerow([u.id, u.name, u.email, u.phone, u.role, u.is_verified, u.is_blocked, u.created_at.strftime("%Y-%m-%d")])
    buf.seek(0)
    return StreamingResponse(io.BytesIO(buf.read().encode()), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=users.csv"})

# ── VENDOR: LOW STOCK ALERT ────────────────────────────────────────
@app.get("/api/vendor/low-stock")
def low_stock(threshold: int = 3, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    products = db.query(Product).filter(Product.shop_id == shop.id, Product.is_active == True).all()
    low = []
    for p in products:
        if p.has_sizes:
            try:
                sizes = json.loads(p.sizes or "[]")
                for s in sizes:
                    if s.get("stock", 0) <= threshold:
                        low.append({"id": p.id, "name": p.name, "size": s["size"], "stock": s["stock"], "imageUrl": p.image_url})
            except: pass
        elif (p.stock or 0) <= threshold:
            low.append({"id": p.id, "name": p.name, "size": None, "stock": p.stock, "imageUrl": p.image_url})
    return {"items": low, "count": len(low), "threshold": threshold}

# ── VENDOR: CLONE PRODUCT ─────────────────────────────────────────
@app.post("/api/products/{product_id}/clone", status_code=201)
def clone_product(product_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    p = db.query(Product).filter(Product.id == product_id, Product.shop_id == shop.id).first()
    if not p: raise HTTPException(404)
    clone = Product(shop_id=shop.id, name=p.name + " (Copy)", description=p.description,
                    price=p.price, category=p.category, image_url=p.image_url,
                    images=p.images, colors=p.colors, brand=p.brand, material=p.material,
                    tags=p.tags, stock=p.stock, sizes=p.sizes, has_sizes=p.has_sizes, is_active=False)
    db.add(clone); db.commit(); db.refresh(clone)
    return product_dict(clone)

# ── VENDOR: EARNINGS SUMMARY ──────────────────────────────────────
@app.get("/api/vendor/earnings")
def vendor_earnings(rangeKey: Optional[str] = "last2days", startDate: Optional[str] = None,
                    endDate: Optional[str] = None,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    sync_settlement_invoices(db)
    applied_range, start, end = parse_dashboard_range(rangeKey, startDate, endDate)
    delivered = db.query(Order).filter(Order.shop_id == shop.id, Order.status == OrderStatusEnum.DELIVERED).all()
    total_revenue = round(sum(vendor_merchandise_total(o) for o in delivered), 2)
    total_platform = round(sum(vendor_merchandise_total(o) * (float(_commission_rate.get("vendor_commission_pct", 0)) / 100.0) for o in delivered), 2)
    net_earnings = total_revenue - total_platform
    this_month = [o for o in delivered if o.delivered_at and o.delivered_at.month == utc_now().month]
    summary = settlement_summary_for_entity(db, "vendor", user.id, start, end, shop_id=shop.id)
    summary.update({
        "totalOrders": len(delivered),
        "totalRevenue": round(total_revenue, 2),
        "platformFees": total_platform,
        "netEarnings": round(net_earnings, 2),
        "thisMonth": {"orders": len(this_month), "revenue": round(sum(vendor_merchandise_total(o) for o in this_month), 2)},
        "pendingPayout": summary["pendingAmount"],
        "filters": {
            "rangeKey": applied_range,
            "startDate": start.date().isoformat(),
            "endDate": end.date().isoformat(),
            "cycleDays": SETTLEMENT_CYCLE_DAYS,
        },
    })
    return summary

# ── VENDOR: REPLY TO REVIEW ────────────────────────────────────────
@app.post("/api/reviews/{review_id}/reply")
def reply_review(review_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    r = db.query(Review).filter(Review.id == review_id, Review.shop_id == shop.id).first()
    if not r: raise HTTPException(404)
    r.comment = (r.comment or "") + f"\n\n[Vendor reply]: {body.get('reply','')}"
    db.commit()
    return {"ok": True}

# ── SHARE PRODUCT URL ─────────────────────────────────────────────
@app.get("/api/products/{product_id}/share")
def share_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p: raise HTTPException(404)
    return {"url": f"https://dott.in/product/{product_id}",
            "title": p.name, "description": p.description or f"Check out {p.name} on DOTT!",
            "image": p.image_url}


# ══════════════════════════════════════════════════════════════════
# STARTUP
# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn

    print(
        "\n"
        + "=" * 64 + "\n"
        + "DOTT API SERVER v8.0\n"
        + "=" * 64 + "\n"
        + "Backend  : http://localhost:8080\n"
        + "API Docs : http://localhost:8080/docs\n"
        + "Customer : http://localhost:3001 (npm run dev)\n"
        + "Vendor   : http://localhost:3002 (npm run dev)\n"
        + "Rider    : http://localhost:3003 (npm run dev)\n"
        + "Admin    : http://localhost:3004 (npm run dev)\n"
        + "=" * 64 + "\n"
    )

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=os.getenv("DOTT_BACKEND_RELOAD", "0") == "1",
        reload_dirs=["."],
    )
