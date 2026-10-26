# Router composition

Version/group aggregation only; explicit imports, no SQL or use cases. `/api` at app mounting and `/v1` at version router exactly once. Register controller groups public/auth/admin/reader with stable tags; endpoint implementation stays in controllers. Confirm registered paths via OpenAPI tests.
