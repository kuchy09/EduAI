import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  corsHeadersFor,
  extractBearerToken,
  parseAllowedOrigins,
} from "./cors.ts";

Deno.test("extractBearerToken parses valid Bearer header and rejects missing/malformed headers", () => {
  assertEquals(extractBearerToken(null), null);
  assertEquals(extractBearerToken(""), null);
  assertEquals(extractBearerToken("Basic abc123"), null);
  assertEquals(extractBearerToken("Bearer "), null);
  assertEquals(extractBearerToken("Bearer my-jwt-token"), "my-jwt-token");
  assertEquals(extractBearerToken("bearer   trimmed-jwt  "), "trimmed-jwt");
});

Deno.test("corsHeadersFor only reflects explicitly allowed origins", () => {
  const allowed = parseAllowedOrigins("https://eduai.ke, http://localhost:3000");
  assertEquals(allowed, ["https://eduai.ke", "http://localhost:3000"]);

  const matched = corsHeadersFor("https://eduai.ke", allowed);
  assertEquals(matched["Access-Control-Allow-Origin"], "https://eduai.ke");

  const blocked = corsHeadersFor("https://evil.example", allowed);
  assertEquals(blocked["Access-Control-Allow-Origin"], undefined);

  const mobileOnly = corsHeadersFor("https://eduai.ke", []);
  assertEquals(mobileOnly["Access-Control-Allow-Origin"], undefined);
});
