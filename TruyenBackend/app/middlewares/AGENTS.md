# Identity and permission dependencies

Validate bearer token signature/expiry/type and subject shape; bad UUID/missing/expired/revoked credentials return 401, forbidden authenticated actions 403. Load current account status and enforce admin plus personal-resource scope. If refresh is implemented, separate token purpose, rotate/revoke and reject access tokens at refresh. Inject session/identity without mutable global user state. No raw token logging.
