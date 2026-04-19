from database import SessionLocal


def seed_db():
    db = SessionLocal()
    try:
        # Production-safe: do not insert demo data.
        print("Seeding is disabled for production. No demo data will be created.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()
