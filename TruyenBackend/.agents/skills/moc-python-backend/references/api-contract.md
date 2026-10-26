# API contracts for future Mộc endpoints

This is the selected Mộc contract. Upstream currently returns a different envelope than it declares in OpenAPI; do not describe this document as its existing API.

## Routes and response

Use `/api/v1/public` for public catalog/chapter reads, `/api/v1/auth` for authentication, `/api/v1/admin` for privileged writes and `/api/v1/reader` for authenticated personal records. Mount prefixes once. `GET /health` is a lightweight liveness check, not proof of database readiness; add readiness separately when storage exists.

Keep the base's `GenericResponse[T]` naming, with a coherent wire shape:

```json
{"success":true,"message":"Success","error_code":"SUCCESS","data":{"items":[],"total":0,"page":1,"page_size":50}}
```

```json
{"success":false,"message":"Không tìm thấy chương.","error_code":"CHAPTER_NOT_FOUND","data":null}
```

Return typed Pydantic objects/dictionaries through the declared `response_model`; do not return an ad-hoc `JSONResponse` that bypasses it. Exception handlers may use JSONResponse but must serialize the same envelope. Translate validation errors and HTTP errors consistently. Unexpected failures log a correlation ID and return a generic 500, without `str(exc)`, class names, SQL, tokens or secrets. Document status codes: 201 creation, 400 domain input, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflicts, 422 validation. Never return HTTP 200 for errors. If a no-body 204 is used, document it as an explicit exception to the envelope.

## Authorization and credentials

- Registration exposes no `is_admin`, role, owner ID or activation control; validate allowed fields. Admin endpoints require an admin dependency at router level plus relevant resource checks in the use case.
- Determine the current user from verified credentials; personal progress/bookmarks cannot trust a submitted `user_id`.
- Verify expiry, subject shape and the token's purpose. A malformed UUID subject must return 401 instead of 500. Fetch current account state when validating access so a locked/deleted account is refused.
- Do not implement refresh unless requested. If implemented, define separate access/refresh types, expiry, rotation/revocation and replay handling. Never accept an access token at refresh. Send refresh credentials in a body/cookie contract, not a URL query string.
- Required signing secrets come from environment/secret storage; fail startup on a missing/placeholder production secret. Hash with a maintained, tested password library. Migrate existing hash formats explicitly if real accounts exist; do not silently reinterpret SHA256+bcrypt as a different scheme.
- Log method, route template, status, duration, request ID; exclude Authorization, Cookie, passwords, token responses, arbitrary query strings and chapter/import bodies. Production log backtraces must not capture local variable values. Do not copy upstream log files.
- CORS uses explicit frontend origins (local web is port 5178), with credential mode chosen to match auth. A wildcard origin combined with credentials is not the deployment rule.

## Lists

Validate `page >= 1` and `1 <= page_size <= 100`, default 50 for chapter metadata. Convert to zero-based repository offset once. Queries always have deterministic `ORDER BY position, id` (or a documented stable order for other resources), count the same filters, and include no chapter body in list results. Search exact chapter numbers without dropping parts; accent folding follows the reader behavior. Cursor pagination can replace offset for large datasets only with a documented contract and frontend adapter change.
