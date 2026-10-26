# ORM declarations

All models inherit the single Base in constants/database.py; optional BaseDbModel is abstract over that Base. Register model imports for Alembic metadata. Models declare columns/constraints/indexes/relationships; no active-record CRUD helpers or private SQLAlchemy APIs copied from the reference. Preserve existing 16-character content IDs through explicit legacy IDs/mapping if adopting UUIDs. Foreign keys and actor IDs use consistent types; timestamps are timezone aware.
