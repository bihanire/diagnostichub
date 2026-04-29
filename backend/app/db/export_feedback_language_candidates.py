from __future__ import annotations

import argparse
from pathlib import Path

from app.core.database import SessionLocal
from app.services.feedback_service import export_feedback_language_candidates_csv


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export live branch search phrases from feedback into a CSV review pack."
    )
    parser.add_argument("--days", type=int, default=30, help="How many days of feedback to review.")
    parser.add_argument("--limit", type=int, default=50, help="Maximum number of phrases to export.")
    parser.add_argument("--path", required=True, help="Destination CSV path.")
    args = parser.parse_args()

    destination = Path(args.path)
    destination.parent.mkdir(parents=True, exist_ok=True)

    with SessionLocal() as db:
        csv_content = export_feedback_language_candidates_csv(db, days=args.days, limit=args.limit)

    destination.write_text(csv_content, encoding="utf-8", newline="")
    row_count = max(len(csv_content.splitlines()) - 1, 0)
    print(f"Exported {row_count} language candidates to {destination}")


if __name__ == "__main__":
    main()
