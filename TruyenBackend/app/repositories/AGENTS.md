# Data access

Use injected AsyncSession, parameterized SQLAlchemy 2 statements and explicit bounded projections. No commit/rollback, HTTPException or response wrapping. Paginated queries have validated limits, identical count filters and stable ordering. TOC projections exclude content. Use position for order, not unique chapter number. Refresh/flush only as needed; avoid lazy queries during DTO serialization.
