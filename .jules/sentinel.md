## Sentinel Journal

## 2024-05-22 - [Enhancement] Rate Limiting on Sensitive Endpoints
**Vulnerability:** Lack of rate limiting on registration and invite endpoints allowed potential brute-force attacks on invite tokens and resource exhaustion (DoS).
**Learning:** Custom in-memory rate limiting is flexible but must be explicitly applied to all sensitive entry points, not just login.
**Prevention:** Audit all public POST endpoints and apply appropriate rate limits.
