import pytest

from app.db.seed import create_schema, seed_data


@pytest.fixture(scope="session", autouse=True)
def ensure_db_schema():
    """Create any missing tables and seed reference data before running tests."""
    create_schema()
    seed_data()
