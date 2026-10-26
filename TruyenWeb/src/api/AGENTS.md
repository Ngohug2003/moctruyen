# API adapter rules

Keep HTTP/envelope handling and session/queue state here, outside UI and pure domain code. API paths are under /api/v1. A failed request must not erase locally saved reading progress. Updates use expected_revision; surface conflicts and hydrate the server winner. Preserve account isolation, token expiry handling and the distinction between web ratios and native pixels. Review the corresponding adapter in the other client when changing the shared API contract; do not couple the clients' build runtimes.
