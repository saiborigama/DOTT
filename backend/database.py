from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from datetime import datetime, UTC
import enum
from config import settings

DATABASE_URL = settings.database_url
engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def utc_now():
    return datetime.now(UTC).replace(tzinfo=None)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RoleEnum(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    OWNER    = "OWNER"
    RIDER    = "RIDER"
    ADMIN    = "ADMIN"

class OrderStatusEnum(str, enum.Enum):
    PENDING           = "PENDING"
    CONFIRMED         = "CONFIRMED"
    PACKING           = "PACKING"
    PICKED_UP         = "PICKED_UP"
    OUT_FOR_DELIVERY  = "OUT_FOR_DELIVERY"
    DELIVERED         = "DELIVERED"
    CANCELLED         = "CANCELLED"

class ReturnStatusEnum(str, enum.Enum):
    REQUESTED = "REQUESTED"
    APPROVED  = "APPROVED"
    REJECTED  = "REJECTED"
    PICKED_UP = "PICKED_UP"
    REFUNDED  = "REFUNDED"

class User(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    email      = Column(String, unique=True, nullable=False, index=True)
    phone      = Column(String)
    password   = Column(String, nullable=False)
    role       = Column(Enum(RoleEnum), nullable=False)
    lat        = Column(Float, nullable=True)
    lng        = Column(Float, nullable=True)
    is_online  = Column(Boolean, default=False)
    is_blocked = Column(Boolean, default=False)
    is_verified= Column(Boolean, default=False)   # OTP verified
    created_at = Column(DateTime, default=utc_now)
    # Payment details
    bank_account   = Column(String, nullable=True)   # account number
    bank_ifsc      = Column(String, nullable=True)
    bank_name      = Column(String, nullable=True)
    upi_id         = Column(String, nullable=True)   # UPI / PhonePe
    phonepe_number = Column(String, nullable=True)
    gpay_number    = Column(String, nullable=True)
    payment_method = Column(String, default="upi")   # "bank" or "upi"
    is_premium     = Column(Boolean, default=False)
    subscription_plan = Column(String, default="standard")
    returns_this_month = Column(Integer, default=0)
    high_return_user = Column(Boolean, default=False)
    cod_enabled    = Column(Boolean, default=True)
    totp_secret    = Column(String, nullable=True)
    totp_enabled   = Column(Boolean, default=False)
    fcm_token      = Column(String, nullable=True)

class OTPStore(Base):
    __tablename__ = "otp_store"
    id         = Column(Integer, primary_key=True, index=True)
    phone      = Column(String, nullable=False, index=True)
    otp        = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

class Shop(Base):
    __tablename__ = "shops"
    id                 = Column(Integer, primary_key=True, index=True)
    owner_id           = Column(Integer, ForeignKey("users.id"), nullable=False)
    name               = Column(String, nullable=False)
    description        = Column(Text)
    category           = Column(String)
    address            = Column(Text)
    city               = Column(String, default="Hyderabad")
    pincode            = Column(String)
    phone              = Column(String)
    lat                = Column(Float)
    lng                = Column(Float)
    image_url          = Column(String)
    open_time          = Column(String, default="09:00")
    close_time         = Column(String, default="21:00")
    delivery_time      = Column(Integer, default=25)
    min_order          = Column(Float, default=0.0)
    is_open            = Column(Boolean, default=True)
    is_active          = Column(Boolean, default=True)
    is_suspended       = Column(Boolean, default=False)
    total_orders       = Column(Integer, default=0)
    rating             = Column(Float, default=0.0)
    rating_count       = Column(Integer, default=0)
    accepts_returns    = Column(Boolean, default=False)
    return_days        = Column(Integer, default=0)
    return_policy_note = Column(Text, default="")
    whatsapp_mode      = Column(Boolean, default=False)
    whatsapp_phone     = Column(String)
    created_at         = Column(DateTime, default=utc_now)
    owner    = relationship("User", foreign_keys=[owner_id])
    products = relationship("Product", back_populates="shop")

class Product(Base):
    __tablename__ = "products"
    id          = Column(Integer, primary_key=True, index=True)
    shop_id     = Column(Integer, ForeignKey("shops.id"), nullable=False)
    name        = Column(String, nullable=False)
    title       = Column(String)
    description = Column(Text)
    price       = Column(Float, nullable=False)
    category    = Column(String)
    product_type = Column(String)
    color       = Column(String)
    image_url   = Column(String)        # primary / default image
    images      = Column(Text, default="[]")   # JSON: [url1, url2, ...]  extra angles
    colors      = Column(Text, default="[]")   # JSON: [{name,hex,imageUrl,images:[]}]
    brand       = Column(String)
    material    = Column(String)
    fabric      = Column(String)
    gender      = Column(String)
    pattern     = Column(String)
    fit         = Column(String)
    occasion    = Column(String)
    sleeve_type = Column(String)
    length      = Column(String)
    tags        = Column(Text, default="[]")   # JSON: ["tag1","tag2"]
    processed_image_url = Column(String)
    visual_embedding    = Column(Text)
    visual_embedding_model = Column(String, default="fallback-histogram-v1")
    image_ai_meta       = Column(Text, default="{}")
    stock       = Column(Integer, default=10)
    sizes       = Column(Text, default="[]")
    has_sizes   = Column(Boolean, default=False)
    is_active   = Column(Boolean, default=True)
    is_veg      = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=utc_now)
    shop    = relationship("Shop", back_populates="products")
    reviews = relationship("Review", back_populates="product")

class Order(Base):
    __tablename__ = "orders"
    id               = Column(Integer, primary_key=True, index=True)
    order_code       = Column(String, unique=True, nullable=False)
    customer_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    shop_id          = Column(Integer, ForeignKey("shops.id"), nullable=False)
    rider_id         = Column(Integer, ForeignKey("users.id"), nullable=True)
    delivery_address = Column(Text, nullable=False)
    delivery_lat     = Column(Float)
    delivery_lng     = Column(Float)
    status           = Column(Enum(OrderStatusEnum), default=OrderStatusEnum.PENDING)
    payment_method   = Column(String, default="cod")
    subtotal         = Column(Float, default=0.0)
    delivery_fee     = Column(Float, default=0.0)   # distance-based
    delivery_km      = Column(Float, default=0.0)   # km recorded at order time
    base_delivery_fee = Column(Float, default=20.0)
    distance_fee     = Column(Float, default=0.0)
    surge_fee        = Column(Float, default=0.0)
    platform_fee     = Column(Float, default=10.0)
    gst_rate         = Column(Float, default=0.05)
    gst_amount       = Column(Float, default=0.0)
    free_delivery_discount = Column(Float, default=0.0)
    discount         = Column(Float, default=0.0)
    total            = Column(Float, default=0.0)
    rider_earning    = Column(Float, default=0.0)   # distance-based rider pay
    promo_code       = Column(String)
    notes            = Column(Text)
    pricing_meta     = Column(Text, default="{}")
    try_and_return_eligible = Column(Boolean, default=False)
    return_window_hours = Column(Integer, default=48)
    refund_amount    = Column(Float, default=0.0)
    refund_status    = Column(String, default="NOT_APPLICABLE")
    order_start_time = Column(DateTime)
    delivery_deadline = Column(DateTime)
    delivered_time   = Column(DateTime)
    is_delayed       = Column(Boolean, default=False)
    cod_due_amount   = Column(Float, default=0.0)
    cod_collected    = Column(Boolean, default=False)
    countdown_alert_level = Column(String, default="NONE")
    rider_bonus      = Column(Float, default=0.0)
    rider_penalty    = Column(Float, default=0.0)
    pickup_otp       = Column(String)
    pickup_otp_used  = Column(Boolean, default=False)
    pickup_otp_generated_at = Column(DateTime)
    pickup_otp_verified_at = Column(DateTime)
    placed_at        = Column(DateTime, default=utc_now)
    confirmed_at     = Column(DateTime)
    delivered_at     = Column(DateTime)
    is_reviewed      = Column(Boolean, default=False)
    customer       = relationship("User", foreign_keys=[customer_id])
    shop           = relationship("Shop")
    rider          = relationship("User", foreign_keys=[rider_id])
    items          = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    return_request = relationship("ReturnRequest", back_populates="order", uselist=False)

class OrderItem(Base):
    __tablename__ = "order_items"
    id         = Column(Integer, primary_key=True, index=True)
    order_id   = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer)
    name       = Column(String, nullable=False)
    price      = Column(Float, nullable=False)
    qty        = Column(Integer, nullable=False)
    size       = Column(String, nullable=True)
    image_url  = Column(String)
    order      = relationship("Order", back_populates="items")

class Review(Base):
    __tablename__ = "reviews"
    id          = Column(Integer, primary_key=True, index=True)
    product_id  = Column(Integer, ForeignKey("products.id"), nullable=False)
    shop_id     = Column(Integer, ForeignKey("shops.id"), nullable=False)
    order_id    = Column(Integer, ForeignKey("orders.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating      = Column(Integer, nullable=False)
    comment     = Column(Text)
    images      = Column(Text, default="[]")
    created_at  = Column(DateTime, default=utc_now)
    product  = relationship("Product", back_populates="reviews")
    customer = relationship("User", foreign_keys=[customer_id])

class ReturnRequest(Base):
    __tablename__ = "return_requests"
    id          = Column(Integer, primary_key=True, index=True)
    order_id    = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shop_id     = Column(Integer, ForeignKey("shops.id"), nullable=False)
    reason      = Column(Text, nullable=False)
    reason_code = Column(String, default="OTHER")
    request_type = Column(String, default="refund")
    evidence_image_url = Column(String)
    policy_decision = Column(String, default="UNDER_REVIEW")
    return_fee  = Column(Float, default=0.0)
    refund_amount = Column(Float, default=0.0)
    exchange_allowed = Column(Boolean, default=False)
    pickup_status = Column(String, default="PENDING")
    pickup_eta   = Column(String)
    pickup_rider_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    pickup_completed_at = Column(DateTime)
    processed_at = Column(DateTime)
    status      = Column(Enum(ReturnStatusEnum), default=ReturnStatusEnum.REQUESTED)
    vendor_note = Column(Text)
    created_at  = Column(DateTime, default=utc_now)
    updated_at  = Column(DateTime, default=utc_now)
    order    = relationship("Order", back_populates="return_request")
    customer = relationship("User", foreign_keys=[customer_id])
    shop     = relationship("Shop")
    pickup_rider = relationship("User", foreign_keys=[pickup_rider_id])

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token      = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    user       = relationship("User")

class Wishlist(Base):
    __tablename__ = "wishlists"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    created_at = Column(DateTime, default=utc_now)
    user    = relationship("User")
    product = relationship("Product")

class Referral(Base):
    __tablename__ = "referrals"
    id            = Column(Integer, primary_key=True, index=True)
    referrer_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    referred_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    code          = Column(String, unique=True, nullable=False, index=True)
    is_used       = Column(Boolean, default=False)
    reward_points = Column(Integer, default=0)
    created_at    = Column(DateTime, default=utc_now)
    referrer  = relationship("User", foreign_keys=[referrer_id])
    referred  = relationship("User", foreign_keys=[referred_id])

class UserPoints(Base):
    __tablename__ = "user_points"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    points     = Column(Integer, default=0)
    total_earned = Column(Integer, default=0)
    user       = relationship("User")

class VerifiedSeller(Base):
    __tablename__ = "verified_sellers"
    id         = Column(Integer, primary_key=True, index=True)
    shop_id    = Column(Integer, ForeignKey("shops.id"), nullable=False, unique=True)
    verified_at = Column(DateTime, default=utc_now)
    badge_type  = Column(String, default="verified")  # verified / top_seller / trusted
    shop        = relationship("Shop")

class ShopLocationChangeRequest(Base):
    __tablename__ = "shop_location_change_requests"
    id          = Column(Integer, primary_key=True, index=True)
    shop_id     = Column(Integer, ForeignKey("shops.id"), nullable=False, index=True)
    owner_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    old_lat     = Column(Float)
    old_lng     = Column(Float)
    new_lat     = Column(Float, nullable=False)
    new_lng     = Column(Float, nullable=False)
    old_address = Column(Text)
    new_address = Column(Text)
    old_city    = Column(String)
    new_city    = Column(String)
    status      = Column(String, default="PENDING", index=True)
    admin_note  = Column(Text, default="")
    created_at  = Column(DateTime, default=utc_now)
    reviewed_at = Column(DateTime)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    shop        = relationship("Shop", foreign_keys=[shop_id])
    owner       = relationship("User", foreign_keys=[owner_id])
    reviewer    = relationship("User", foreign_keys=[reviewed_by])

class PromoCode(Base):
    __tablename__ = "promo_codes"
    id          = Column(Integer, primary_key=True, index=True)
    code        = Column(String, unique=True, nullable=False, index=True)
    discount_type = Column(String, default="percent")   # "percent" or "flat"
    discount_value = Column(Float, nullable=False)      # 10 = 10% or ₹10
    min_order   = Column(Float, default=0.0)
    max_uses    = Column(Integer, default=100)
    used_count  = Column(Integer, default=0)
    is_active   = Column(Boolean, default=True)
    expires_at  = Column(DateTime, nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, default=utc_now)
    creator     = relationship("User")

class SavedAddress(Base):
    __tablename__ = "saved_addresses"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    label      = Column(String, default="Home")   # Home / Work / Other
    address    = Column(Text, nullable=False)
    lat        = Column(Float)
    lng        = Column(Float)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    user       = relationship("User")

class DeliveryOTP(Base):
    __tablename__ = "delivery_otps"
    id         = Column(Integer, primary_key=True, index=True)
    order_id   = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    otp        = Column(String, nullable=False)
    is_used    = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    order      = relationship("Order")

class RiderRating(Base):
    __tablename__ = "rider_ratings"
    id         = Column(Integer, primary_key=True, index=True)
    order_id   = Column(Integer, ForeignKey("orders.id"), nullable=False)
    rider_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id= Column(Integer, ForeignKey("users.id"), nullable=False)
    rating     = Column(Integer, nullable=False)    # 1-5
    created_at = Column(DateTime, default=utc_now)
    rider      = relationship("User", foreign_keys=[rider_id])
    customer   = relationship("User", foreign_keys=[customer_id])

class SettlementInvoice(Base):
    __tablename__ = "settlement_invoices"
    id                = Column(Integer, primary_key=True, index=True)
    entity_type       = Column(String, nullable=False, index=True)   # vendor / rider
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    shop_id           = Column(Integer, ForeignKey("shops.id"), nullable=True, index=True)
    period_start      = Column(DateTime, nullable=False, index=True)
    period_end        = Column(DateTime, nullable=False, index=True)
    cycle_key         = Column(String, nullable=False, index=True)
    total_orders      = Column(Integer, default=0)
    total_sales       = Column(Float, default=0.0)
    product_value     = Column(Float, default=0.0)
    delivery_collected = Column(Float, default=0.0)
    rider_earning_amount = Column(Float, default=0.0)
    commission_pct    = Column(Float, default=0.0)
    commission_amount = Column(Float, default=0.0)
    gross_earnings    = Column(Float, default=0.0)
    net_payable       = Column(Float, default=0.0)
    paid_amount       = Column(Float, default=0.0)
    pending_amount    = Column(Float, default=0.0)
    status            = Column(String, default="PENDING")  # PENDING / PARTIAL / PAID
    order_ids_json    = Column(Text, default="[]")
    payout_locked_at  = Column(DateTime, nullable=True)
    created_at        = Column(DateTime, default=utc_now)
    updated_at        = Column(DateTime, default=utc_now)
    user              = relationship("User", foreign_keys=[user_id])
    shop              = relationship("Shop", foreign_keys=[shop_id])

class SettlementPayment(Base):
    __tablename__ = "settlement_payments"
    id                = Column(Integer, primary_key=True, index=True)
    invoice_id        = Column(Integer, ForeignKey("settlement_invoices.id"), nullable=True, index=True)
    entity_type       = Column(String, nullable=False, index=True)   # vendor / rider
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    shop_id           = Column(Integer, ForeignKey("shops.id"), nullable=True, index=True)
    amount            = Column(Float, default=0.0)
    payment_status    = Column(String, default="PAID")
    payment_method    = Column(String, default="UPI")
    payment_reference = Column(String, default="")
    payment_date      = Column(DateTime, default=utc_now, index=True)
    period_start      = Column(DateTime, nullable=True)
    period_end        = Column(DateTime, nullable=True)
    notes             = Column(Text, default="")
    invoice           = relationship("SettlementInvoice", foreign_keys=[invoice_id])
    user              = relationship("User", foreign_keys=[user_id])
    shop              = relationship("Shop", foreign_keys=[shop_id])

class Notification(Base):
    __tablename__ = "notifications"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    role       = Column(String, nullable=True, index=True)
    title      = Column(String, nullable=False)
    body       = Column(Text, nullable=False)
    category   = Column(String, default="general", index=True)
    data_json  = Column(Text, default="{}")
    is_read    = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    user       = relationship("User", foreign_keys=[user_id])
