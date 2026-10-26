# Use cases and transactions

Services own business logic, ownership checks and atomic multi-repository writes. Repositories flush; service/request policy commits once and rolls back on failure. Do not open a second transaction blindly after an authentication lookup. Return DTO-ready data, not FastAPI JSONResponse. Model uniqueness in DB as well as optional prechecks; translate known conflicts after rollback. External IO/import work belongs to a bounded use case, not an HTTP handler.
