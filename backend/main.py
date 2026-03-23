import os, time, math, json, random, urllib.parse, urllib.request, urllib.error, mimetypes, base64
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from pathlib import Path

from database import (Base, engine, get_db, User, Shop, Product, Order, OrderItem,
                      Review, ReturnRequest, RefreshToken, OTPStore,
                      RoleEnum, OrderStatusEnum, ReturnStatusEnum)
from auth import (hash_password, verify_password, create_access_token, create_refresh_token,
                  decode_token, get_current_user)
from seed import seed_db

Base.metadata.create_all(bind=engine)

def ensure_column(table_name: str, column_name: str, column_sql: str):
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table_name})"))}
        if column_name not in cols:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}"))

for table_name, column_name, column_sql in [
    ("users", "is_premium", "BOOLEAN DEFAULT 0"),
    ("users", "subscription_plan", "VARCHAR DEFAULT 'standard'"),
    ("users", "returns_this_month", "INTEGER DEFAULT 0"),
    ("users", "high_return_user", "BOOLEAN DEFAULT 0"),
    ("users", "cod_enabled", "BOOLEAN DEFAULT 1"),
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
]:
    ensure_column(table_name, column_name, column_sql)

seed_db()

# ── Static folder for uploaded images ──────────────────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

def load_env_file(path: Path):
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

load_env_file(Path(".env"))
load_env_file(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="DOTT API", version="5.0.0")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001","http://localhost:3002",
                   "http://localhost:3003","http://localhost:3004","http://localhost:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

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
DISTANCE_FEE_PER_KM = 5.0
PLATFORM_FEE = 10.0
FREE_DELIVERY_THRESHOLD = 999.0
NO_RETURN_BELOW = 300.0
MAX_RETURNS_PER_MONTH = 3
DELIVERY_PROMISE_MINUTES = 60
RIDER_ON_TIME_BONUS = 20.0
RIDER_DELAY_PENALTY = 10.0

def calc_delivery_fee(km: float) -> float:
    km = max(0.0, float(km or 0.0))
    return round(BASE_DELIVERY_FEE + (km * DISTANCE_FEE_PER_KM), 2)

def calc_rider_earning(km: float) -> float:
    """Rider gets base + per-km rate."""
    if km <= 0: return 20.0
    return round(20 + km * 8, 1)   # ₹20 base + ₹8/km

def calc_surge_fee(now: Optional[datetime] = None, weather: Optional[str] = None) -> tuple[float, list[str]]:
    now = now or datetime.utcnow()
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
    distance_fee = round(max(0.0, km) * DISTANCE_FEE_PER_KM, 2)
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
    started_at = start_time or datetime.utcnow()
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
    now = now or datetime.utcnow()
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
    now = datetime.utcnow()
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

def send_otp_mock(phone: str, otp: str):
    """In production replace with MSG91 / Twilio / Fast2SMS."""
    print(f"\n{'='*40}\nOTP for {phone}: {otp}\n{'='*40}\n")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-5")

PRODUCT_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "productType": {"type": "string"},
        "category": {"type": "string"},
        "brand": {"type": "string"},
        "color": {"type": "string"},
        "material": {"type": "string"},
        "mrp": {"type": "string"},
        "suggestedPrice": {"type": "string"},
        "description": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "sizes": {"type": "string"},
        "confidence": {"type": "string"},
        "presentation": {"type": "string"},
        "title": {"type": "string"},
        "detail": {"type": "string"},
    },
    "required": ["name", "productType", "category", "brand", "color", "material", "mrp", "suggestedPrice", "description", "tags", "sizes", "confidence", "presentation", "title", "detail"],
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

def openai_request(path: str, payload: dict) -> dict:
    if not OPENAI_API_KEY:
        raise HTTPException(503, "OPENAI_API_KEY is not configured on the backend.")
    req = urllib.request.Request(
        f"{OPENAI_BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        try:
            detail = json.loads(body)
        except Exception:
            detail = body or str(e)
        raise HTTPException(502, {"message": "OpenAI request failed", "detail": detail})
    except Exception as e:
        raise HTTPException(502, f"OpenAI request failed: {e}")

def guess_media_type(filename: str, fallback: str = "image/jpeg") -> str:
    media, _ = mimetypes.guess_type(filename or "")
    return media or fallback

def save_image_bytes(user_id: int, image_bytes: bytes, suffix: str = "jpg") -> dict:
    filename = f"{user_id}_{int(time.time()*1000)}.{suffix}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    return {"filename": filename, "url": f"http://localhost:8080/uploads/{filename}"}

def infer_presentation_key(text: str) -> str:
    value = (text or "").lower()
    if any(token in value for token in ["shirt", "t-shirt", "tshirt", "tee", "kurta", "top", "hoodie", "jacket", "blazer", "sweatshirt"]):
        return "upper"
    if any(token in value for token in ["saree", "sari", "dress", "gown", "kurti", "lehenga", "dupatta"]):
        return "drape"
    if any(token in value for token in ["pant", "pants", "trouser", "trousers", "jean", "jeans", "jogger", "legging", "palazzo", "shorts", "bottom"]):
        return "lower"
    return "fallback"

def analyze_product_image_with_openai(image_bytes: bytes, filename: str) -> dict:
    media_type = guess_media_type(filename)
    image_url = f"data:{media_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    prompt = (
        "Analyze this product photo for e-commerce listing preparation. "
        "Also extract e-commerce product fields for auto-fill: name, category, brand, color, material, mrp, suggestedPrice, description, tags, and sizes. "
        "Identify the product type and choose exactly one presentation mode from: upper, drape, lower, fallback. "
        "Use upper for shirts/t-shirts/tops/upper wear on a realistic male model. "
        "Use drape for sarees/dresses/female drape garments on a realistic female model. "
        "Use lower for pants/jeans/trousers/lower-body garments on a lower-body model. "
        "Use fallback if the product type is unclear or not suitable for model fitting. "
        "Return strict JSON only."
    )
    payload = {
        "model": OPENAI_IMAGE_MODEL,
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": image_url},
            ],
        }],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "product_image_analysis",
                "schema": PRODUCT_ANALYSIS_SCHEMA,
                "strict": True,
            }
        },
    }
    data = openai_request("/responses", payload)
    text = data.get("output_text", "").strip()
    if not text:
        raise HTTPException(502, "OpenAI analysis returned no structured output.")
    result = json.loads(text)
    combined = " ".join([
        result.get("productType", ""),
        result.get("category", ""),
        result.get("presentation", ""),
    ])
    key = infer_presentation_key(combined) if result.get("presentation") not in PRESENTATION_META else result["presentation"]
    meta = PRESENTATION_META[key]
    return {
        "name": result.get("name", ""),
        "productType": result.get("productType", ""),
        "category": result.get("category", ""),
        "brand": result.get("brand", ""),
        "color": result.get("color", ""),
        "material": result.get("material", ""),
        "mrp": result.get("mrp", ""),
        "suggestedPrice": result.get("suggestedPrice", ""),
        "description": result.get("description", ""),
        "tags": result.get("tags", []),
        "sizes": result.get("sizes", ""),
        "confidence": result.get("confidence", "medium"),
        "presentation": key,
        "badge": meta["badge"],
        "title": result.get("title") or meta["title"],
        "detail": result.get("detail") or meta["detail"],
    }

def build_image_edit_prompt(analysis: dict) -> str:
    base = (
        "Edit this product photo into a premium Amazon-style e-commerce listing image. "
        "Preserve the exact product color, texture, logo placement, print, embroidery, and all visible design details. "
        "Do not change the product itself. Keep the product recognizable and faithful to the original photograph. "
        "Use clean professional studio lighting, realistic shadows, neat framing, and a polished white-to-light-gray e-commerce background. "
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

def transform_product_image_with_openai(image_bytes: bytes, filename: str, analysis: dict) -> bytes:
    media_type = guess_media_type(filename)
    image_url = f"data:{media_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    payload = {
        "model": OPENAI_IMAGE_MODEL,
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": build_image_edit_prompt(analysis)},
                {"type": "input_image", "image_url": image_url},
            ],
        }],
        "tools": [{
            "type": "image_generation",
            "size": "1024x1024",
            "quality": "high",
            "background": "opaque",
            "format": "png",
            "action": "edit",
        }],
        "tool_choice": {"type": "image_generation"},
    }
    data = openai_request("/responses", payload)
    for item in data.get("output", []):
        if item.get("type") == "image_generation_call" and item.get("result"):
            return base64.b64decode(item["result"])
    raise HTTPException(502, "OpenAI image transform returned no image.")

# ── Schemas ────────────────────────────────────────────────────────
class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str; otp: str

class RegisterRequest(BaseModel):
    name: str; email: str; phone: str; password: str; role: RoleEnum
    otp: Optional[str] = None
    lat: Optional[float]=None; lng: Optional[float]=None

class LoginRequest(BaseModel):
    email: str; password: str
    lat: Optional[float]=None; lng: Optional[float]=None

class PhoneRegisterRequest(BaseModel):
    name: str; phone: str; pin: str
    otp: Optional[str] = None
    role: Optional[RoleEnum]=RoleEnum.CUSTOMER
    lat: Optional[float]=None; lng: Optional[float]=None

class PhoneLoginRequest(BaseModel):
    phone: str; pin: str
    lat: Optional[float]=None; lng: Optional[float]=None

class RiderLocationPing(BaseModel):
    lat: float; lng: float

class RefreshRequest(BaseModel):
    refreshToken: str

class LocationUpdate(BaseModel):
    lat: float; lng: float

class PaymentDetailsUpdate(BaseModel):
    bankAccount:   Optional[str] = None
    bankIfsc:      Optional[str] = None
    bankName:      Optional[str] = None
    upiId:         Optional[str] = None
    paymentMethod: Optional[str] = "upi"  # "bank" or "upi"

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
    images: Optional[str]="[]"
    colors: Optional[str]="[]"
    brand: Optional[str]=None; material: Optional[str]=None
    tags: Optional[str]="[]"
    stock: Optional[int]=10; isVeg: Optional[bool]=True
    hasSizes: Optional[bool]=False; sizes: Optional[str]="[]"

class ProductUpdate(BaseModel):
    name: Optional[str]=None; price: Optional[float]=None; description: Optional[str]=None
    category: Optional[str]=None; imageUrl: Optional[str]=None
    images: Optional[str]=None; colors: Optional[str]=None
    brand: Optional[str]=None; material: Optional[str]=None; tags: Optional[str]=None
    isActive: Optional[bool]=None; stock: Optional[int]=None; isVeg: Optional[bool]=None
    hasSizes: Optional[bool]=None; sizes: Optional[str]=None

class OrderItemIn(BaseModel):
    productId: int; qty: int; size: Optional[str]=None

class OrderCreate(BaseModel):
    shopId: int; items: List[OrderItemIn]; deliveryAddress: str
    deliveryLat: Optional[float]=None; deliveryLng: Optional[float]=None
    paymentMethod: Optional[str]="cod"; promoCode: Optional[str]=None; notes: Optional[str]=None
    weather: Optional[str]=None

class StatusUpdate(BaseModel):
    status: OrderStatusEnum; riderId: Optional[int]=None

class ReviewCreate(BaseModel):
    productId: int; orderId: int; rating: int; comment: Optional[str]=None

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

# ── Serializers ────────────────────────────────────────────────────
def user_dict(u: User, dist=None):
    d = {"id":u.id,"name":u.name,"email":u.email,"phone":u.phone,
         "role":u.role,"isOnline":u.is_online,"isBlocked":u.is_blocked,
         "isVerified":u.is_verified,"lat":u.lat,"lng":u.lng,
         "upiId":u.upi_id,"bankAccount":u.bank_account,"bankIfsc":u.bank_ifsc,
         "bankName":u.bank_name,"paymentMethod":u.payment_method,
         "isPremium":getattr(u, "is_premium", False),
         "subscriptionPlan":getattr(u, "subscription_plan", "standard"),
         "returnsThisMonth":getattr(u, "returns_this_month", 0),
         "highReturnUser":getattr(u, "high_return_user", False),
         "codEnabled":getattr(u, "cod_enabled", True)}
    if dist is not None: d["distanceKm"] = round(dist, 1)
    return d

def shop_dict(s: Shop, dist=None):
    d = {"id":s.id,"name":s.name,"description":s.description,"category":s.category,
         "address":s.address,"city":s.city,"pincode":s.pincode,"phone":s.phone,
         "lat":s.lat,"lng":s.lng,"imageUrl":s.image_url,"openTime":s.open_time,
         "closeTime":s.close_time,"deliveryTime":s.delivery_time,"minOrder":s.min_order,
         "isOpen":s.is_open,"isSuspended":s.is_suspended,"totalOrders":s.total_orders,
         "rating":round(s.rating, 1) if s.rating else 0.0,"ratingCount":s.rating_count,
         "ownerId":s.owner_id,"ownerName":s.owner.name if s.owner else None,
         "acceptsReturns":s.accepts_returns,"returnDays":s.return_days,
         "returnPolicyNote":s.return_policy_note,
         "whatsappMode":s.whatsapp_mode,"whatsappPhone":s.whatsapp_phone or s.phone}
    if dist is not None: d["distanceKm"] = round(dist, 1)
    return d

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
    d = {"id":p.id,"shopId":p.shop_id,"name":p.name,"description":p.description,
         "price":p.price,"category":p.category,"imageUrl":p.image_url,
         "images":images_list,"colors":colors_list,
         "brand":getattr(p,'brand',None),"material":getattr(p,'material',None),"tags":tags_list,
         "stock":total_stock,"isActive":p.is_active,"isVeg":p.is_veg,
         "hasSizes":p.has_sizes,"sizes":sizes_list,
         "avgRating": round(sum(r.rating for r in p.reviews)/len(p.reviews),1) if p.reviews else 0,
         "reviewCount": len(p.reviews)}
    if include_reviews:
        d["reviews"] = [{"id":r.id,"rating":r.rating,"comment":r.comment,
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
        "items":[{"id":i.id,"productId":i.product_id,"name":i.name,
                  "price":i.price,"qty":i.qty,"size":i.size,"imageUrl":i.image_url} for i in o.items],
        "returnRequest": ret,
    }

def build_auth(user: User, db: Session):
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    rt = RefreshToken(user_id=user.id, token=refresh, expires_at=datetime.utcnow()+timedelta(days=7))
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
    phone = req.phone.strip().replace(" ","").replace("-","")
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(400, "Enter a valid 10-digit number")
    # Invalidate any old OTPs for this phone
    db.query(OTPStore).filter(OTPStore.phone == phone, OTPStore.used == False).update({"used": True})
    otp = generate_otp()
    expires = datetime.utcnow() + timedelta(minutes=10)
    db.add(OTPStore(phone=phone, otp=otp, expires_at=expires))
    db.commit()
    send_otp_mock(phone, otp)
    return {"message": f"OTP sent to {phone}", "dev_otp": otp}  # remove dev_otp in production

@app.post("/api/otp/verify")
def verify_otp_endpoint(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    phone = req.phone.strip().replace(" ","").replace("-","")
    record = db.query(OTPStore).filter(
        OTPStore.phone == phone,
        OTPStore.otp == req.otp,
        OTPStore.used == False,
        OTPStore.expires_at > datetime.utcnow()
    ).first()
    if not record:
        raise HTTPException(400, "Invalid or expired OTP")
    record.used = True
    db.commit()
    return {"verified": True}

def _check_otp(phone: str, otp: Optional[str], db: Session):
    """Validate OTP during registration. Raises if invalid."""
    if not otp:
        raise HTTPException(400, "OTP is required for registration")
    phone = phone.strip().replace(" ","").replace("-","")
    record = db.query(OTPStore).filter(
        OTPStore.phone == phone,
        OTPStore.otp == otp,
        OTPStore.used == False,
        OTPStore.expires_at > datetime.utcnow()
    ).first()
    if not record:
        raise HTTPException(400, "Invalid or expired OTP. Please verify your number first.")
    record.used = True

# ═══════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(400, "Email already registered")
    if req.role == RoleEnum.ADMIN:
        raise HTTPException(400, "Cannot self-register as admin")
    _check_otp(req.phone, req.otp, db)
    user = User(name=req.name, email=req.email.lower(), phone=req.phone,
                password=hash_password(req.password), role=req.role,
                lat=req.lat, lng=req.lng, is_verified=True)
    db.add(user); db.commit(); db.refresh(user)
    return build_auth(user, db)

@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(401, "Invalid credentials")
    if user.is_blocked: raise HTTPException(403, "Account is blocked")
    if req.lat and req.lng: user.lat = req.lat; user.lng = req.lng; db.commit()
    return build_auth(user, db)

@app.post("/api/auth/refresh")
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    rt = db.query(RefreshToken).filter(RefreshToken.token == req.refreshToken).first()
    if not rt or rt.expires_at < datetime.utcnow():
        if rt: db.delete(rt); db.commit()
        raise HTTPException(401, "Invalid or expired refresh token")
    return build_auth(rt.user, db)

@app.post("/api/auth/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
    db.commit(); return {"message":"Logged out"}

@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)): return user_dict(user)

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
    _check_otp(phone, req.otp, db)
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
    if body.bankAccount:   user.bank_account   = body.bankAccount
    if body.bankIfsc:      user.bank_ifsc       = body.bankIfsc
    if body.bankName:      user.bank_name       = body.bankName
    if body.upiId:         user.upi_id          = body.upiId
    if body.paymentMethod: user.payment_method  = body.paymentMethod
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
    url = f"http://localhost:8080/uploads/{filename}"
    return {"url": url, "filename": filename}

@app.post("/api/upload/product-image-transform")
async def upload_product_image_transform(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image too large. Max 8 MB.")

    original_saved = save_image_bytes(user.id, contents, "jpg")
    if not OPENAI_API_KEY:
        fallback = {
            "productType": "",
            "category": "",
            "confidence": "low",
            "presentation": "fallback",
            "badge": PRESENTATION_META["fallback"]["badge"],
            "title": PRESENTATION_META["fallback"]["title"],
            "detail": "OPENAI_API_KEY is not configured, so the original uploaded image is being used.",
        }
        return {
            "originalUrl": original_saved["url"],
            "transformedUrl": original_saved["url"],
            "analysis": fallback,
        }

    analysis = analyze_product_image_with_openai(contents, file.filename or "product.jpg")
    transformed_bytes = transform_product_image_with_openai(contents, file.filename or "product.jpg", analysis)
    transformed_saved = save_image_bytes(user.id, transformed_bytes, "png")
    return {
        "originalUrl": original_saved["url"],
        "transformedUrl": transformed_saved["url"],
        "analysis": analysis,
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
    for s in q.all():
        dist = haversine(lat, lng, s.lat, s.lng) if (lat and lng) else None
        if dist is not None and s.lat and s.lng and dist > radius: continue
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
    return shop_dict(shop)

@app.put("/api/shops/{shop_id}")
def update_shop(shop_id: int, body: ShopUpdate,
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop: raise HTTPException(404)
    if user.role != RoleEnum.ADMIN and shop.owner_id != user.id: raise HTTPException(403)
    for field, col in [("name","name"),("description","description"),("address","address"),
                       ("city","city"),("phone","phone"),("lat","lat"),("lng","lng"),
                       ("deliveryTime","delivery_time"),("minOrder","min_order"),("imageUrl","image_url"),
                       ("isOpen","is_open"),("isSuspended","is_suspended"),
                       ("acceptsReturns","accepts_returns"),("returnDays","return_days"),
                       ("returnPolicyNote","return_policy_note"),("whatsappPhone","whatsapp_phone")]:
        val = getattr(body, field, None)
        if val is not None: setattr(shop, col, val)
    if body.whatsappMode is not None: shop.whatsapp_mode = body.whatsappMode
    db.commit(); db.refresh(shop)
    return shop_dict(shop)

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
    if lat and lng and not shopId:
        nearby_ids = {s.id for s in db.query(Shop).filter(Shop.is_active==True,Shop.is_suspended==False).all()
                      if not s.lat or not s.lng or haversine(lat, lng, s.lat, s.lng) <= radius}
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
    p = Product(shop_id=shop.id, name=body.name[:100], description=body.description,
                price=body.price, category=body.category, image_url=body.imageUrl,
                images=body.images or "[]", colors=body.colors or "[]",
                brand=body.brand, material=body.material, tags=body.tags or "[]",
                stock=body.stock, is_veg=body.isVeg if body.isVeg is not None else True,
                has_sizes=body.hasSizes or False, sizes=body.sizes or "[]")
    db.add(p); db.commit(); db.refresh(p)
    return product_dict(p)

@app.put("/api/products/{product_id}")
def update_product(product_id: int, body: ProductUpdate,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p: raise HTTPException(404)
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop or p.shop_id != shop.id: raise HTTPException(403)
    for attr, col in [("name","name"),("price","price"),("description","description"),
                       ("category","category"),("imageUrl","image_url"),("isVeg","is_veg"),("sizes","sizes"),
                       ("images","images"),("colors","colors"),("brand","brand"),("material","material"),("tags","tags")]:
        val = getattr(body, attr, None)
        if val is not None: setattr(p, col, val)
    if body.isActive is not None: p.is_active = body.isActive
    if body.stock is not None:    p.stock = body.stock
    if body.hasSizes is not None: p.has_sizes = body.hasSizes
    if body.imageUrl == '': p.image_url = None
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
                  promo_code=body.promoCode, notes=body.notes, placed_at=datetime.utcnow())
    db.add(order); db.flush()
    for item in order_items: item.order_id = order.id; db.add(item)
    shop.total_orders = (shop.total_orders or 0) + 1
    db.commit(); db.refresh(order)
    result = order_dict(order)
    wa_url = build_whatsapp_url(order, shop, user, "\n".join(items_text_lines))
    result["vendorWhatsappUrl"] = wa_url
    result["shopWhatsappMode"] = shop.whatsapp_mode
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
    o.confirmed_at = datetime.utcnow()
    start_delivery_countdown(o, o.confirmed_at)
    db.commit(); db.refresh(o); return order_dict(o)

@app.post("/api/orders/{order_id}/reject")
def vendor_reject(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    shop = db.query(Shop).filter(Shop.owner_id == user.id, Shop.id == o.shop_id).first()
    if not shop: raise HTTPException(403)
    if o.status != OrderStatusEnum.PENDING: raise HTTPException(400)
    o.status = OrderStatusEnum.CANCELLED; db.commit(); db.refresh(o); return order_dict(o)

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
    if user.role != RoleEnum.RIDER: raise HTTPException(403)
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    if o.status != OrderStatusEnum.CONFIRMED or o.rider_id: raise HTTPException(400, "Order not available")
    o.rider_id = user.id; o.status = OrderStatusEnum.PACKING
    db.commit(); db.refresh(o); return order_dict(o)

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
        else:
            raise HTTPException(403, "Vendors can only mark order as Preparing. All delivery updates are handled by the rider.")

    elif user.role == RoleEnum.RIDER:
        # Rider can move: PACKING→PICKED_UP→OUT_FOR_DELIVERY→DELIVERED
        if o.rider_id and o.rider_id != user.id: raise HTTPException(403, "This delivery is assigned to another rider")
        allowed_rider = [OrderStatusEnum.PICKED_UP, OrderStatusEnum.OUT_FOR_DELIVERY, OrderStatusEnum.DELIVERED]
        if body.status not in allowed_rider:
            raise HTTPException(403, "Riders can only update: Picked Up → Out for Delivery → Delivered")

    elif user.role == RoleEnum.ADMIN:
        pass  # admin can do anything

    else:
        raise HTTPException(403)

    o.status = body.status
    if body.riderId: o.rider_id = body.riderId
    if body.status == OrderStatusEnum.CONFIRMED:
        o.confirmed_at = datetime.utcnow()
        start_delivery_countdown(o, o.confirmed_at)
    if body.status in [OrderStatusEnum.PACKING, OrderStatusEnum.PICKED_UP, OrderStatusEnum.OUT_FOR_DELIVERY]:
        timer = order_timer_snapshot(o)
        o.countdown_alert_level = timer["alertLevel"]
    if body.status == OrderStatusEnum.DELIVERED:
        finalize_delivery_timing(o)
    db.commit(); db.refresh(o); return order_dict(o)

@app.put("/api/orders/{order_id}/cancel")
def cancel_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o: raise HTTPException(404)
    if user.role == RoleEnum.CUSTOMER:
        if o.customer_id != user.id: raise HTTPException(403)
        if o.status != OrderStatusEnum.PENDING: raise HTTPException(400, "Cannot cancel at this stage")
    o.status = OrderStatusEnum.CANCELLED; db.commit(); db.refresh(o); return order_dict(o)

# ═══════════════════════════════════════════════════════════════════
# REVIEWS
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/reviews", status_code=201)
def add_review(body: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == body.orderId, Order.customer_id == user.id).first()
    if not order: raise HTTPException(404)
    if order.status != OrderStatusEnum.DELIVERED: raise HTTPException(400, "Order not delivered yet")
    if order.is_reviewed: raise HTTPException(400, "Already reviewed")
    if not (1 <= body.rating <= 5): raise HTTPException(400, "Rating must be 1-5")
    product = db.query(Product).filter(Product.id == body.productId).first()
    if not product: raise HTTPException(404)
    review = Review(product_id=body.productId, shop_id=order.shop_id, order_id=body.orderId,
                    customer_id=user.id, rating=body.rating, comment=body.comment)
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
        ReturnRequest.created_at >= datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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
    now = datetime.utcnow()
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
        rr.processed_at = datetime.utcnow()
        rr.order.refund_status = "REJECTED"
    elif body.status == ReturnStatusEnum.REFUNDED:
        rr.pickup_status = "COMPLETED"
        rr.processed_at = datetime.utcnow()
        rr.order.refund_status = "REFUNDED"
    rr.updated_at = datetime.utcnow()
    db.commit()
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
    rr.updated_at = datetime.utcnow()
    db.commit()
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
    rr.updated_at = datetime.utcnow()
    if next_status == "COMPLETED":
        rr.status = ReturnStatusEnum.PICKED_UP
        rr.pickup_completed_at = datetime.utcnow()
    db.commit()
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
@app.post("/api/riders/status")
def set_rider_status(body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.is_online = body.get("isOnline", False); db.commit()
    return {"isOnline": user.is_online}

@app.put("/api/riders/location")
def update_rider_location(body: LocationUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.lat = body.lat; user.lng = body.lng; db.commit()
    return {"ok": True}

@app.get("/api/riders/earnings")
def rider_earnings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    def calc(since):
        rows = db.query(Order).filter(Order.rider_id==user.id,
                                      Order.status==OrderStatusEnum.DELIVERED,
                                      Order.delivered_at>=since).all()
        return {"trips":len(rows),
                "earned":round(sum(o.rider_earning for o in rows), 1),
                "totalKm":round(sum(o.delivery_km or 0 for o in rows), 1)}
    return {"today":  calc(now.replace(hour=0,minute=0,second=0)),
            "week":   calc(now-timedelta(days=7)),
            "month":  calc(now-timedelta(days=30)),
            "allTime":calc(datetime(2000,1,1))}

@app.get("/api/riders/history")
def rider_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.rider_id==user.id, Order.status==OrderStatusEnum.DELIVERED)\
               .order_by(Order.delivered_at.desc()).limit(50).all()
    return [{"id":o.id,"orderCode":o.order_code,"shopName":o.shop.name,
             "deliveryAddress":o.delivery_address,"total":o.total,
             "deliveryKm":round(o.delivery_km or 0,1),
             "earning":round(o.rider_earning,1),
             "deliveredAt":o.delivered_at.isoformat() if o.delivered_at else None} for o in orders]

# ═══════════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/analytics")
def analytics(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    now = datetime.utcnow()
    def stats(since):
        rows = db.query(Order).filter(Order.shop_id==shop.id,
                                      Order.status==OrderStatusEnum.DELIVERED,
                                      Order.delivered_at>=since).all()
        return {"orders":len(rows),"revenue":round(sum(o.total for o in rows),2)}
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
    now = datetime.utcnow()
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
    active_shops = db.query(Shop).filter(Shop.is_active==True, Shop.is_suspended==False).count()
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
        "orders":        len(all_orders),
        "activeOrders":  len(active_orders),
        "todayOrders":   len(today_orders),
        "revenue":       total_rev,
        "todayRevenue":  today_rev,
        "weekRevenue":   week_rev,
        "onTimeDeliveries": len(on_time_orders),
        "lateDeliveries": len(late_orders),
        "codOrders": sum(1 for o in all_orders if (o.payment_method or "").lower() == "cod"),
        "deliveredWithin60": len(on_time_orders),
        "newToday":      new_today,
        "newThisWeek":   new_week,
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
    return [shop_dict(s) for s in db.query(Shop).all()]

@app.patch("/api/admin/shops/{shop_id}/suspend")
def suspend_shop(shop_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop: raise HTTPException(404)
    shop.is_suspended = body.get("isSuspended", True); db.commit()
    return shop_dict(shop)

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
    now = datetime.utcnow()
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
                    weather: Optional[str] = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.id == shopId).first()
    if not shop:
        raise HTTPException(404, "Shop not found")
    km = haversine(shop.lat, shop.lng, custLat, custLng)
    if km == 9999:
        km = 3.0
    pricing = compute_pricing(subtotal, round(km, 2), getattr(user, "is_premium", False), weather)
    pricing["premiumEligible"] = getattr(user, "is_premium", False)
    pricing["freeDeliveryThreshold"] = FREE_DELIVERY_THRESHOLD
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

# ── SMART SEARCH ─────────────────────────────────────────────────
@app.get("/api/search")
def smart_search(q: str, lat: Optional[float]=None, lng: Optional[float]=None,
                 category: Optional[str]=None, minPrice: Optional[float]=None,
                 maxPrice: Optional[float]=None, minRating: Optional[float]=None,
                 sortBy: Optional[str]="relevance",
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
    for p in products:
        dist = None
        if lat and lng and p.shop:
            dist = haversine(lat, lng, p.shop.lat, p.shop.lng)
        if dist is not None and dist > 20: continue
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
from collections import defaultdict

# ── RATE-LIMITING (in-memory, resets on server restart) ───────────
_rate = defaultdict(list)
def rate_check(key: str, limit: int = 5, window: int = 60) -> bool:
    """Returns True if allowed, False if blocked."""
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=window)
    _rate[key] = [t for t in _rate[key] if t > cutoff]
    if len(_rate[key]) >= limit:
        return False
    _rate[key].append(now)
    return True

# Patch OTP send with rate limit
# (wraps existing endpoint behavior)
@app.post("/api/otp/send/limited")
def send_otp_limited(body: dict, request_ip: str = "0.0.0.0", db: Session = Depends(get_db)):
    """Rate-limited OTP - 5 per phone per minute"""
    phone = body.get("phone","")
    if not rate_check(f"otp:{phone}", 5, 60):
        raise HTTPException(429, "Too many OTP requests. Wait 60 seconds.")
    return {"ok": True}

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
    if p.expires_at and datetime.utcnow() > p.expires_at: raise HTTPException(400, "Promo code expired")
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
    existing = db.query(DeliveryOTP).filter(DeliveryOTP.order_id == order_id).first()
    if existing: db.delete(existing)
    otp = generate_otp()
    db.add(DeliveryOTP(order_id=order_id, otp=otp)); db.commit()
    return {"otp": otp, "message": "Share this OTP with the rider when they arrive"}

@app.post("/api/orders/{order_id}/delivery-otp/verify")
def verify_delivery_otp(order_id: int, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o or o.rider_id != user.id: raise HTTPException(403)
    d = db.query(DeliveryOTP).filter(DeliveryOTP.order_id == order_id, DeliveryOTP.is_used == False).first()
    if not d: raise HTTPException(400, "No OTP found")
    if d.otp != body.get("otp","").strip(): raise HTTPException(400, "Wrong OTP")
    d.is_used = True
    o.status = OrderStatusEnum.DELIVERED; o.delivered_at = datetime.utcnow()
    db.commit()
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
_commission_rate = {"platform_fee_flat": 10, "reseller_pct": 10, "rider_base": 20}

@app.get("/api/admin/commission")
def get_commission(user: User = Depends(get_current_user)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    return _commission_rate

@app.put("/api/admin/commission")
def set_commission(body: dict, user: User = Depends(get_current_user)):
    if user.role != RoleEnum.ADMIN: raise HTTPException(403)
    _commission_rate.update({k: v for k,v in body.items() if k in _commission_rate})
    return _commission_rate

# ── ADMIN: CSV EXPORT ─────────────────────────────────────────────
import csv, io
from fastapi.responses import StreamingResponse

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
def vendor_earnings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_id == user.id).first()
    if not shop: raise HTTPException(404)
    delivered = db.query(Order).filter(Order.shop_id == shop.id, Order.status == OrderStatusEnum.DELIVERED).all()
    total_revenue = sum(o.subtotal for o in delivered)
    total_platform = len(delivered) * 10  # ₹10 platform fee
    net_earnings = total_revenue - total_platform
    this_month = [o for o in delivered if o.delivered_at and o.delivered_at.month == datetime.utcnow().month]
    return {
        "totalOrders": len(delivered), "totalRevenue": round(total_revenue, 2),
        "platformFees": total_platform, "netEarnings": round(net_earnings, 2),
        "thisMonth": {"orders": len(this_month), "revenue": round(sum(o.subtotal for o in this_month), 2)},
        "pendingPayout": round(net_earnings * 0.1, 2)  # placeholder 10% pending
    }

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

    print("""
╔══════════════════════════════════════════════════════════════╗
║              🛍  DOTT API SERVER  v8.0                       ║
╠══════════════════════════════════════════════════════════════╣
║  Backend   →  http://localhost:8080                          ║
║  API Docs  →  http://localhost:8080/docs                     ║
╠══════════════════════════════════════════════════════════════╣
║  Customer  →  http://localhost:3001  (npm run dev)           ║
║  Vendor    →  http://localhost:3002  (npm run dev)           ║
║  Rider     →  http://localhost:3003  (npm run dev)           ║
║  Admin     →  http://localhost:3004  (npm run dev)           ║
╠══════════════════════════════════════════════════════════════╣
║  Demo login  →  arjun@example.com / password123              ║
║  Vendor      →  rahul@dott.in    / password123               ║
║  Admin       →  admin@dott.in    / password123               ║
╚══════════════════════════════════════════════════════════════╝
""")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        reload_dirs=["."],
    )
