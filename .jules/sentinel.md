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
