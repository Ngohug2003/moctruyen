# Configuration and sessions

Create one typed Settings owner in config.py and one Base/engine/session factory in database.py. API, security and Alembic must use them. Do not recreate app/utils/configs.py from the reference. Required production secrets fail validation; no real credentials/default signing key in tracked code. Construct URLs safely for special-character passwords. A request session rolls back on error; the agreed service/request transaction policy controls commit, avoiding nested begin after auth queries.
