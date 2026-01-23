## 2026-01-19 - Error Message Leakage in Screenshot Processing
**Vulnerability:** The `processBase64Image` function in the comment creation endpoint was exposing internal error messages (`e.message`) directly to clients at line 2069. This could leak buffer processing errors, file system path information, or other internal details.
**Learning:** Functions handling binary data (base64 decoding, buffer operations) can throw errors containing sensitive internal details (paths, memory issues, encoding problems). These should never be returned to clients.
**Prevention:** Always wrap uncertain operations (file I/O, buffer processing, image encoding) in try/catch and return static, generic error messages to clients while logging full details server-side.

## 2026-02-24 - IDOR in Client Comment Deletion
**Vulnerability:** Guest users could delete any comment by knowing its ID (`DELETE /api/client/projects/:token/comments/:commentId`), because the backend only checked if the user provided *a* valid project token, but not if the comment actually belonged to *that* project.
**Learning:** Checking that a user has access to "the system" (valid token) is not enough; you must always check if they have access to the specific *object* being manipulated (the comment's parent project).
**Prevention:** Always verify the relationship between the target resource (comment) and the authorized context (project) before performing sensitive actions.

## 2026-02-23 - Command Injection in FBX Converter
**Vulnerability:** The `convertFbxToGlb` function in `backend/utils/fbxConverter.js` was using `exec` to run external commands (`fbx2gltf` or `assimp`) by concatenating user-controlled filenames into the command string. This allowed command injection if a filename contained shell metacharacters.
**Learning:** Using `exec` with any user input is dangerous because escaping shell arguments correctly across platforms is difficult and error-prone.
**Prevention:** Always use `execFile` or `spawn` which accept arguments as an array and pass them directly to the process without invoking a shell, thus preventing shell injection by design. Ensure local binaries have execute permissions.

## 2026-01-19 - Error Message Information Leakage in Team Deletion
**Vulnerability:** The `DELETE /teams/:id` endpoint in `team.routes.js` was exposing internal error messages to clients by concatenating `error.message` to the response: `'Failed to delete team: ' + error.message`. This could leak sensitive internal details like database connection errors, file path structures, or system configurations.
**Learning:** Error handling on the server should never expose raw exception messages to clients. Internal errors are logged server-side for debugging, but clients should only receive generic error messages.
**Prevention:** Always return static, user-friendly error messages to clients. Keep detailed error information in server logs only.

## 2026-03-05 - Stored XSS in Comments
**Vulnerability:** The comment creation endpoints (`/api/client/projects/:token/comments` and `/api/projects/:id/comments`) accepted raw HTML content and stored it directly in the database. When retrieved and rendered by the frontend, this allowed for Stored Cross-Site Scripting (XSS) attacks.
**Learning:** Never trust user input, especially text fields that might be rendered as HTML. Frontend rendering context (like React's `dangerouslySetInnerHTML`) assumes sanitized input, but the backend must enforce this sanitization to be secure by default.
**Prevention:** Implement server-side sanitization using a library like `xss` for all user-submitted text content before storage. This ensures that even if the frontend fails to escape output, the stored data is safe.

## 2026-05-20 - Wildcard Injection and Excessive Scope in User Search
**Vulnerability:** The `GET /api/users/search` endpoint used user input directly in Prisma's `contains` filter without sanitization, allowing wildcard injection (`%`) to enumerate all users. Additionally, it lacked authorization scoping, allowing any user to search the entire user database.
**Learning:** Prisma's `contains` operator passes wildcard characters like `%` and `_` through to the database `LIKE` operator, which can be abused. Also, collaborative features must still respect tenant/team isolation.
**Prevention:** Sanitize or strip special characters from search inputs used with `contains`. Always scope queries to the user's authorized context (e.g., mutual teams).

## 2026-05-23 - Socket.IO Unauthorized Room Access
**Vulnerability:** Authenticated users could join any project's real-time room by emitting `join_project` with an arbitrary project ID, receiving sensitive updates (comments, versions) without team membership checks.
**Learning:** Socket.IO events like `join_room` are not protected by standard HTTP middleware; explicit authorization checks must be performed within the socket event handler.
**Prevention:** Always verify ownership/membership using shared auth utilities (e.g., `checkProjectAccess`) inside socket event handlers before joining sensitive rooms.

## 2026-05-25 - Overly Permissive CORS Configuration
**Vulnerability:** Both Express and Socket.IO were configured to allow Cross-Origin Resource Sharing (CORS) from any origin (`*`) by default. This exposes the API to unauthorized cross-origin requests and potential security risks in production environments where strict origin control is expected.
**Learning:** Relying on default CORS configurations often results in insecure "allow all" policies. Socket.IO requires its own separate CORS configuration, distinct from Express.
**Prevention:** Explicitly configure CORS to allow only trusted origins defined in environment variables (`CORS_ORIGIN`). Implement a secure-by-default approach where missing configuration defaults to a safe state or emits a clear warning.
