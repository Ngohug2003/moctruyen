# Shared utilities

Small helpers/domain exceptions/safe security and logging. No duplicate settings or database owner. Avoid generic JSONResponse wrappers bypassing response_model. Request logging records route template, status, time and request ID without headers/body/token responses, and disables local-variable diagnostics in production. Password formats and token purpose must be tested; do not blindly carry over the reference refresh logic.
