// /functions/api/rate-limit-test.ts
// Simple endpoint for the rate limiting demo.
// No logic needed here — Cloudflare rate limiting rules (configured in the
// dashboard) block requests at the edge before this function executes,
// returning a 429 automatically once the threshold is exceeded.

export const onRequestGet: PagesFunction = async () => {
  return new Response(
    JSON.stringify({
      status: "allowed",
      message: "Request successful.",
      timestamp: Date.now(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
};
