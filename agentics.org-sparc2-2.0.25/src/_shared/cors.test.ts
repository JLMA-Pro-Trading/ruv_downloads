/**
 * Tests for the CORS module
 */

import { assertEquals, assertNotEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import {
  applyCorsHeaders,
  corsHeaders,
  createCorsPreflightResponse,
  handleCorsPreflightRequest,
  isCorsPreflightRequest,
} from "./cors.ts";

Deno.test("corsHeaders should contain expected headers", () => {
  assertEquals(typeof corsHeaders, "object", "corsHeaders should be an object");
  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "*", "Should allow any origin");
  assertEquals(
    corsHeaders["Access-Control-Allow-Methods"],
    "GET, POST, PUT, DELETE, OPTIONS",
    "Should allow common HTTP methods",
  );
  assertEquals(
    corsHeaders["Access-Control-Allow-Headers"],
    "Content-Type, Authorization, X-Requested-With",
    "Should allow common headers",
  );
});

Deno.test("applyCorsHeaders should add CORS headers to a response", () => {
  // Create a response without CORS headers
  const originalResponse = new Response("Test body", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });

  // Apply CORS headers
  const corsResponse = applyCorsHeaders(originalResponse);

  // Check that the original headers are preserved
  assertEquals(
    corsResponse.headers.get("Content-Type"),
    "text/plain",
    "Original headers should be preserved",
  );

  // Check that CORS headers were added
  assertEquals(
    corsResponse.headers.get("Access-Control-Allow-Origin"),
    "*",
    "CORS headers should be added",
  );

  // Check that the status is preserved
  assertEquals(corsResponse.status, 200, "Status should be preserved");
});

Deno.test("createCorsPreflightResponse should create a proper preflight response", () => {
  const response = createCorsPreflightResponse();

  // Check status code (204 No Content is standard for preflight)
  assertEquals(response.status, 204, "Preflight response should have 204 status");

  // Check CORS headers
  assertEquals(
    response.headers.get("Access-Control-Allow-Origin"),
    "*",
    "Preflight response should have CORS headers",
  );
});

Deno.test("isCorsPreflightRequest should correctly identify preflight requests", () => {
  // Create a preflight request
  const preflightRequest = new Request("https://example.com/api", {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Origin": "https://app.example.com",
    },
  });

  // Create a regular OPTIONS request (not preflight)
  const regularOptionsRequest = new Request("https://example.com/api", {
    method: "OPTIONS",
  });

  // Create a regular GET request
  const getRequest = new Request("https://example.com/api", {
    method: "GET",
  });

  // Test identification
  assertEquals(
    isCorsPreflightRequest(preflightRequest),
    true,
    "Should identify preflight request",
  );
  assertEquals(
    isCorsPreflightRequest(regularOptionsRequest),
    false,
    "Should not identify regular OPTIONS as preflight",
  );
  assertEquals(
    isCorsPreflightRequest(getRequest),
    false,
    "Should not identify GET as preflight",
  );
});

Deno.test("handleCorsPreflightRequest should handle preflight requests", () => {
  // Create a preflight request
  const preflightRequest = new Request("https://example.com/api", {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Origin": "https://app.example.com",
    },
  });

  // Create a regular request
  const regularRequest = new Request("https://example.com/api", {
    method: "GET",
  });

  // Test handling
  const preflightResponse = handleCorsPreflightRequest(preflightRequest);
  assertEquals(
    preflightResponse.status,
    204,
    "Should return preflight response for preflight request",
  );

  const regularResponse = handleCorsPreflightRequest(regularRequest);
  assertEquals(
    regularResponse,
    null as unknown as Response,
    "Should return null for non-preflight request",
  );
});
