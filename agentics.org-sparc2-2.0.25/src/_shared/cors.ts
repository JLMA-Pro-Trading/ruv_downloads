/**
 * CORS module for SPARC 2.0
 * Provides CORS headers and utility functions for cross-origin requests
 */

/**
 * Default CORS headers for cross-origin requests
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

/**
 * Apply CORS headers to a Response object
 * @param response Response object to apply headers to
 * @returns Response with CORS headers
 */
export function applyCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);

  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // Create a new response with the updated headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Create a CORS preflight response
 * @returns Response for CORS preflight request
 */
export function createCorsPreflightResponse(): Response {
  return new Response("OK", {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Check if a request is a CORS preflight request
 * @param request Request to check
 * @returns True if the request is a CORS preflight request
 */
export function isCorsPreflightRequest(request: Request): boolean {
  return request.method === "OPTIONS" &&
    request.headers.has("Access-Control-Request-Method");
}

/**
 * Handle a CORS preflight request
 * @param request Request to handle
 * @returns Response for CORS preflight request
 */
export function handleCorsPreflightRequest(request: Request): Response {
  if (isCorsPreflightRequest(request)) {
    return createCorsPreflightResponse();
  }

  // If it's not a preflight request, return null
  return null as unknown as Response;
}
