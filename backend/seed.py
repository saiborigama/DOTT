import json
from database import SessionLocal, User, Shop, Product, RoleEnum
from auth import hash_password

def seed_db():
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Already seeded"); return
        print("Seeding DOTT Hyderabad...")
        pw = hash_password("password123")
        pin = hash_password("1234")   # demo customers use PIN 1234

        admin = User(is_verified=True, name="Admin DOTT",     email="admin@dott.in",      phone="9000000000", password=pw, role=RoleEnum.ADMIN,    lat=17.3850, lng=78.4867)
        v1    = User(is_verified=True, name="Suresh Reddy",   email="suresh@dott.in",     phone="9876501001", password=pw, role=RoleEnum.OWNER,    lat=17.4120, lng=78.4483)
        v2    = User(is_verified=True, name="Kavitha Rao",    email="kavitha@dott.in",    phone="9876501002", password=pw, role=RoleEnum.OWNER,    lat=17.4239, lng=78.4138)
        v3    = User(is_verified=True, name="Mahesh Gupta",   email="mahesh@dott.in",     phone="9876501003", password=pw, role=RoleEnum.OWNER,    lat=17.4486, lng=78.3908)
        c1    = User(is_verified=True, name="Arjun Kumar",    email="ph_9876543210@dott.in",  phone="9876543210", password=pin, role=RoleEnum.CUSTOMER, lat=17.4400, lng=78.4483)
        c2    = User(is_verified=True, name="Divya Sharma",   email="ph_9876543211@dott.in",  phone="9876543211", password=pin, role=RoleEnum.CUSTOMER, lat=17.4239, lng=78.4738)
        r1    = User(is_verified=True, name="Ramesh Rider",   email="ramesh@dott.in",     phone="9876543230", password=pw, role=RoleEnum.RIDER,    lat=17.4300, lng=78.4600)
        r2    = User(is_verified=True, name="Venkat Rider",   email="venkat@dott.in",     phone="9876543231", password=pw, role=RoleEnum.RIDER,    lat=17.4100, lng=78.4700)

        db.add_all([admin, v1, v2, v3, c1, c2, r1, r2]); db.flush()

        # ── FASHION SHOPS ────────────────────────────────────────────
        s1 = Shop(
            owner_id=v1.id, name="FabIndia Banjara Hills",
            description="India's finest ethnic and fusion wear. Handcrafted kurtas, sarees, dupattas and home décor made by artisans across India. Delivered fresh to your door.",
            category="Fashion", address="Road No. 12, Banjara Hills, Hyderabad",
            city="Hyderabad", pincode="500034", phone="9876501001",
            lat=17.4120, lng=78.4483,
            image_url="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80",
            delivery_time=40, min_order=499.0, is_open=True, is_active=True,
            rating=4.6, rating_count=284,
            accepts_returns=True, return_days=7,
            return_policy_note="Unused items with original tags only. No alterations."
        )
        s2 = Shop(
            owner_id=v2.id, name="Westside Jubilee Hills",
            description="Trendy western wear for men, women and kids. Latest season styles — tops, jeans, dresses, formals and accessories. Your one-stop fashion destination.",
            category="Fashion", address="Road No. 36, Jubilee Hills, Hyderabad",
            city="Hyderabad", pincode="500033", phone="9876501002",
            lat=17.4239, lng=78.4138,
            image_url="https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80",
            delivery_time=45, min_order=399.0, is_open=True, is_active=True,
            rating=4.4, rating_count=196,
            accepts_returns=True, return_days=10,
            return_policy_note="Items must be unworn, unwashed with original tags intact."
        )
        s3 = Shop(
            owner_id=v3.id, name="Zudio Madhapur",
            description="Affordable and stylish fashion for the whole family. On-trend outfits, casualwear and party wear at prices that don't break the bank.",
            category="Fashion", address="Hitech City Main Rd, Madhapur, Hyderabad",
            city="Hyderabad", pincode="500081", phone="9876501003",
            lat=17.4486, lng=78.3908,
            image_url="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
            delivery_time=35, min_order=299.0, is_open=True, is_active=True,
            rating=4.3, rating_count=421,
            accepts_returns=True, return_days=5,
            return_policy_note="Items must be in original condition with all tags."
        )

        db.add_all([s1, s2, s3]); db.flush()

        # ── PRODUCTS — FabIndia ──────────────────────────────────────
        CS=[{"size": "XS", "stock": 3}, {"size": "S", "stock": 5}, {"size": "M", "stock": 6}, {"size": "L", "stock": 5}, {"size": "XL", "stock": 4}, {"size": "XXL", "stock": 2}]; BS=[{"size": "28", "stock": 4}, {"size": "30", "stock": 6}, {"size": "32", "stock": 6}, {"size": "34", "stock": 4}, {"size": "36", "stock": 2}]; KS=[{"size": "4Y", "stock": 4}, {"size": "6Y", "stock": 5}, {"size": "8Y", "stock": 5}, {"size": "10Y", "stock": 3}]; SS=[{"size": "5", "stock": 2}, {"size": "6", "stock": 3}, {"size": "7", "stock": 4}, {"size": "8", "stock": 4}, {"size": "9", "stock": 3}, {"size": "10", "stock": 2}]
        fabindia = [
            ("Printed Cotton Kurta (Men)", "Hand block-printed cotton kurta. Relaxed fit, side slits.", 1299, "Kurtas", "https://images.unsplash.com/photo-1594938298603-c8148c4b4357?w=400&q=80", 25, True, True, CS),
            ("Embroidered Anarkali Kurta", "Floral embroidery on soft cotton. Festive and casual wear.", 1799, "Kurtas", "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80", 23, True, True, CS),
            ("Handloom Cotton Saree", "Pure handloom cotton with traditional zari border. South Indian weave.", 2499, "Sarees", "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=400&q=80", 8, True, False, []),
            ("Chanderi Dupatta", "Light Chanderi silk dupatta with golden border. Perfect for suits.", 899, "Dupattas", "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&q=80", 20, True, False, []),
            ("Straight Fit Kurti (Women)", "Simple cotton kurti with kantha stitch detailing. Daily wear.", 999, "Kurtis", "https://images.unsplash.com/photo-1613327703749-dc95b54dd855?w=400&q=80", 23, True, True, CS),
            ("Cotton Pyjama Set (Men)", "Soft cotton pyjama with elastic waistband. Printed pattern.", 799, "Innerwear", "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80", 25, True, True, CS),
            ("Kids Embroidered Kurta", "Festive kurta for boys 4–12 years. Thread embroidery on chest.", 699, "Kids", "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&q=80", 17, True, True, KS),
            ("Kolhapuri Leather Sandals", "Handcrafted genuine leather chappals. Unisex design.", 1199, "Footwear", "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400&q=80", 20, True, True, SS),
        ]
        for name,desc,price,cat,img,stock,veg,has_sz,sz in fabindia:
            db.add(Product(shop_id=s1.id, name=name, description=desc, price=price, category=cat, image_url=img, stock=stock, is_veg=veg, is_active=True, has_sizes=has_sz, sizes=json.dumps(sz)))

        # ── PRODUCTS — Westside ──────────────────────────────────────
        westside = [
            ("Slim Fit Denim Jeans (Men)", "Mid-rise slim fit with stretch. Classic blue wash.", 1499, "Jeans", "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80", 22, True, True, BS),
            ("Floral Wrap Dress (Women)", "Lightweight rayon wrap dress with floral print. V-neck.", 1299, "Dresses", "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&q=80", 23, True, True, CS),
            ("Polo T-Shirt (Men)", "Cotton-blend polo with contrast tipping. 5 colours available.", 799, "T-Shirts", "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400&q=80", 30, True, True, CS),
            ("High-Rise Mom Jeans (Women)", "Vintage-style high-rise with frayed hem.", 1699, "Jeans", "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=400&q=80", 20, True, True, BS),
            ("Oxford Button Shirt (Men)", "100% cotton poplin formal/casual shirt. 6 colours.", 1199, "Shirts", "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80", 18, True, True, CS),
            ("Crop Top (Women)", "Ribbed cotton crop top. Trendy and versatile.", 599, "Tops", "https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?w=400&q=80", 25, True, True, CS),
            ("Formal Trousers (Men)", "Slim-fit formal pants in neutral tones. Wrinkle-resistant.", 1399, "Trousers", "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&q=80", 20, True, True, BS),
            ("Sneakers White (Unisex)", "Classic all-white canvas sneakers.", 1799, "Footwear", "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80", 20, True, True, SS),
        ]
        for name,desc,price,cat,img,stock,veg,has_sz,sz in westside:
            db.add(Product(shop_id=s2.id, name=name, description=desc, price=price, category=cat, image_url=img, stock=stock, is_veg=veg, is_active=True, has_sizes=has_sz, sizes=json.dumps(sz)))

        # ── PRODUCTS — Zudio ─────────────────────────────────────────
        zudio = [
            ("Casual Graphic Tee (Men)", "Oversized graphic tee with bold print. 100% cotton.", 399, "T-Shirts", "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&q=80", 40, True, True, CS),
            ("Cargo Pants (Men)", "Multi-pocket cargo in olive/black/khaki. Relaxed fit.", 899, "Trousers", "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&q=80", 22, True, True, BS),
            ("Mini Skirt (Women)", "Pleated mini skirt. Casual and party-ready. 4 colours.", 599, "Skirts", "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&q=80", 18, True, True, CS),
            ("Hooded Sweatshirt", "Fleece-lined hoodie. Kangaroo pocket. Unisex.", 999, "Sweatshirts", "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&q=80", 22, True, True, CS),
            ("Jogger Pants (Women)", "Elasticated joggers in soft jersey. Perfect for gym or loungewear.", 699, "Activewear", "https://images.unsplash.com/photo-1591403613559-12e34b4d5eb2?w=400&q=80", 25, True, True, CS),
            ("Denim Jacket (Unisex)", "Classic washed denim jacket. Slim fit.", 1299, "Jackets", "https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=400&q=80", 23, True, True, CS),
            ("Party Dress (Women)", "Sequin mini dress for evenings out. 3 colours.", 1199, "Dresses", "https://images.unsplash.com/photo-1566479179-cb4e2b16e65b?w=400&q=80", 16, True, True, CS),
            ("Kids Printed T-Shirt", "Fun printed tee for kids 3–12 years. Soft cotton.", 299, "Kids", "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&q=80", 17, True, True, KS),
        ]
        for name,desc,price,cat,img,stock,veg,has_sz,sz in zudio:
            db.add(Product(shop_id=s3.id, name=name, description=desc, price=price, category=cat, image_url=img, stock=stock, is_veg=veg, is_active=True, has_sizes=has_sz, sizes=json.dumps(sz)))

        db.commit()
        print("Seeded: 8 users, 3 Fashion shops, 24 products")
        print("")
        print("=== CREDENTIALS (all password: password123) ===")
        print("Admin:     admin@dott.in")
        print("Demo Customers (Phone+PIN login):")
        print("  9876543210 / PIN: 1234  → Arjun Kumar")
        print("  9876543211 / PIN: 1234  → Divya Sharma")
        print("")
        print("FASHION Vendors (email login):")
        print("  suresh@dott.in   → FabIndia Banjara Hills")
        print("  kavitha@dott.in  → Westside Jubilee Hills")
        print("  mahesh@dott.in   → Zudio Madhapur")
        print("")
        print("Riders:    ramesh@dott.in | venkat@dott.in")
    except Exception as e:
        db.rollback(); print(f"Seed error: {e}"); raise
    finally:
        db.close()
