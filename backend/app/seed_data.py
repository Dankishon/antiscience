from __future__ import annotations

from app.db.session import SessionLocal
from app.services.seed_service import ensure_seed_data


def main() -> None:
    with SessionLocal() as session:
        ensure_seed_data(session)


if __name__ == "__main__":
    main()
