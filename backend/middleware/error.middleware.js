/**
 * Global Error Handler Middleware
 * 
 * Purpose:
 * 1. Standardize error responses to JSON
 * 2. Prevent stack trace leakage in response
 * 3. Log errors for debugging
 */
const errorHandler = (err, req, res, next) => {
    // Log the error for server-side debugging
    console.error(`[Global Error] ${req.method} ${req.url}:`, err);

    // Determine status code (default to 500)
    const statusCode = err.status || err.statusCode || 500;

    // Prepare response
    const response = {
        error: statusCode === 500 ? 'Internal Server Error' : (err.message || 'An error occurred'),
        // Add minimal error code if available for client handling, but avoid internals
        code: err.code || undefined
    };

    // In development, we can optionally attach stack, but for security we generally hide it by default
    // or rely on a specific env var. The USER rules say "don't leak details".
    // We will strictly hide stack traces in the response.

    res.status(statusCode).json(response);
};

module.exports = errorHandler;
