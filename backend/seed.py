import json
import os

from auth import hash_password
from database import Product, RoleEnum, SessionLocal, Shop, User


def seed_db():
    db = SessionLocal()
    try:
        seed_demo = os.getenv("DOTT_SEED_DEMO", "1").strip().lower() not in {"0", "false", "no"}
        if not seed_demo:
            print("Demo seeding is disabled.")
            return
        if db.query(Product).first():
            return

        owner = db.query(User).filter(User.email == "demo.vendor@dott.local").first()
        if not owner:
            owner = User(
                name="DOTT Demo Vendor",
                email="demo.vendor@dott.local",
                phone="9000000000",
                password=hash_password("demo1234"),
                role=RoleEnum.OWNER,
                is_verified=True,
            )
            db.add(owner)
            db.flush()

        shop = db.query(Shop).filter(Shop.owner_id == owner.id).first()
        if not shop:
            shop = Shop(
                owner_id=owner.id,
                name="DOTT Style Studio",
                description="Curated fashion picks for quick local delivery.",
                category="Fashion",
                address="Banjara Hills, Hyderabad",
                city="Hyderabad",
                pincode="500034",
                phone="9000000000",
                lat=17.4138,
                lng=78.4396,
                image_url="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
                is_open=True,
                is_active=True,
                is_suspended=False,
                accepts_returns=True,
                return_days=7,
                return_policy_note="Returns accepted within 7 days for unused items.",
            )
            db.add(shop)
            db.flush()

        products = [
            {
                "name": "Classic Cotton T-Shirt",
                "price": 499,
                "category": "T-Shirts",
                "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
                "brand": "DOTT Basics",
                "color": "White",
                "tags": ["tshirt", "cotton", "casual"],
                "sizes": [{"size": "S", "stock": 8}, {"size": "M", "stock": 12}, {"size": "L", "stock": 10}],
            },
            {
                "name": "Floral Summer Dress",
                "price": 1299,
                "category": "Dresses",
                "image_url": "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=900&q=80",
                "brand": "DOTT Studio",
                "color": "Blue",
                "tags": ["dress", "floral", "summer"],
                "sizes": [{"size": "S", "stock": 5}, {"size": "M", "stock": 7}, {"size": "L", "stock": 4}],
            },
            {
                "name": "Slim Fit Denim Jeans",
                "price": 1599,
                "category": "Jeans",
                "image_url": "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80",
                "brand": "DOTT Denim",
                "color": "Indigo",
                "tags": ["jeans", "denim", "casual"],
                "sizes": [{"size": "30", "stock": 6}, {"size": "32", "stock": 8}, {"size": "34", "stock": 6}],
            },
            {
                "name": "Everyday Sneakers",
                "price": 1899,
                "category": "Footwear",
                "image_url": "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=900&q=80",
                "brand": "DOTT Walk",
                "color": "White",
                "tags": ["sneakers", "shoes", "footwear"],
                "sizes": [{"size": "7", "stock": 5}, {"size": "8", "stock": 9}, {"size": "9", "stock": 7}],
            },
            {
                "name": "Embroidered Kurti",
                "price": 999,
                "category": "Ethnic Wear",
                "image_url": "https://images.unsplash.com/photo-1583391733956-6c78276477e2?auto=format&fit=crop&w=900&q=80",
                "brand": "DOTT Ethnic",
                "color": "Pink",
                "tags": ["kurti", "ethnic", "traditional"],
                "sizes": [{"size": "S", "stock": 6}, {"size": "M", "stock": 8}, {"size": "L", "stock": 5}],
            },
            {
                "name": "Leather Crossbody Bag",
                "price": 1199,
                "category": "Accessories",
                "image_url": "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80",
                "brand": "DOTT Carry",
                "color": "Tan",
                "tags": ["bag", "accessory", "leather"],
                "sizes": [],
            },
        ]

        for item in products:
            db.add(Product(
                shop_id=shop.id,
                name=item["name"],
                title=item["name"],
                description=f"{item['name']} from {shop.name}.",
                price=item["price"],
                category=item["category"],
                image_url=item["image_url"],
                brand=item["brand"],
                color=item["color"],
                tags=json.dumps(item["tags"]),
                sizes=json.dumps(item["sizes"]),
                has_sizes=bool(item["sizes"]),
                stock=20,
                is_active=True,
            ))

        db.commit()
        print(f"Seeded {len(products)} demo products.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()
