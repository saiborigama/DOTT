from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine, func, inspect, select, text

from database import Base


ROOT = Path(__file__).resolve().parent


def normalize_postgres_url(value: str) -> str:
    raw = (value or "").strip()
    if raw.startswith("postgres://"):
        return "postgresql+psycopg://" + raw[len("postgres://"):]
    if raw.startswith("postgresql://"):
        return "postgresql+psycopg://" + raw[len("postgresql://"):]
    return raw


SQLITE_URL = os.getenv("SQLITE_URL", f"sqlite:///{(ROOT / 'dott.db').as_posix()}")
POSTGRES_URL = normalize_postgres_url(os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "")

if not POSTGRES_URL:
    raise SystemExit(
        "Set POSTGRES_URL or DATABASE_URL to your Render PostgreSQL external connection string."
    )


def reset_postgres_sequences(conn) -> None:
    for table in Base.metadata.sorted_tables:
        if "id" not in table.c:
            continue
        max_id = conn.execute(select(func.max(table.c.id))).scalar()
        if not max_id:
            continue
        seq_sql = text(
            "SELECT setval(pg_get_serial_sequence(:table_name, 'id'), :next_value, true)"
        )
        conn.execute(seq_sql, {"table_name": table.name, "next_value": int(max_id)})


def migrate() -> None:
    sqlite_engine = create_engine(SQLITE_URL)
    postgres_engine = create_engine(POSTGRES_URL, pool_pre_ping=True)

    Base.metadata.create_all(bind=postgres_engine)

    sqlite_inspector = inspect(sqlite_engine)
    sqlite_tables = set(sqlite_inspector.get_table_names())

    with sqlite_engine.connect() as source_conn, postgres_engine.begin() as target_conn:
        for table in reversed(Base.metadata.sorted_tables):
            target_conn.execute(table.delete())

        for table in Base.metadata.sorted_tables:
            if table.name not in sqlite_tables:
                continue

            rows = source_conn.execute(select(table)).mappings().all()
            if not rows:
                continue

            target_conn.execute(table.insert(), [dict(row) for row in rows])

        reset_postgres_sequences(target_conn)

    print("Migration completed successfully.")
    print(f"Source SQLite: {SQLITE_URL}")
    print(f"Target PostgreSQL: {POSTGRES_URL}")


if __name__ == "__main__":
    migrate()
