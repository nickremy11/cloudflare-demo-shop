// /functions/api/waf-test.ts
// Simulates L7 attack responses for WAF demo.
// No actual vulnerabilities — pattern matching only, no DB or filesystem access.
// When Cloudflare WAF rules are enabled, requests are blocked at the edge
// and this function never executes (Cloudflare returns 403 directly).

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const attack = url.searchParams.get("attack");

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  switch (attack) {
    case "sqli":
      return new Response(
        JSON.stringify({
          attack: "sqli",
          status: "exploited",
          message: "Database query returned all rows. Credentials exposed.",
          data: {
            query_used: "SELECT * FROM users WHERE id='' OR '1'='1'",
            rows_returned: 3,
            users: [
              { username: "demo_user",   password: "fake_pass_123",    cc: "4532-0000-1111-2222" },
              { username: "test_admin",  password: "demo_password",    cc: "5105-0000-3333-4444" },
              { username: "john_sample", password: "sample_pass_456",  cc: "4916-0000-5555-6666" },
            ],
          },
        }),
        { status: 200, headers }
      );

    case "xss":
      return new Response(
        JSON.stringify({
          attack: "xss",
          status: "exploited",
          message: "Script executed in victim browser. Session data stolen.",
          data: {
            script_executed: "<script>alert('XSS')</script>",
            stolen: {
              session_id:  "demo_abc123xyz",
              user_token:  "fake_jwt_token_456def",
              auth_cookie: "auth=demo_cookie_789ghi",
            },
          },
        }),
        { status: 200, headers }
      );

    case "cmdi":
      return new Response(
        JSON.stringify({
          attack: "cmdi",
          status: "exploited",
          message: "OS command executed on origin server. System files exposed.",
          data: {
            command_run: "cat /etc/passwd",
            output: [
              "root:x:0:0:root:/root:/bin/bash",
              "www-data:x:33:33:www-data:/var/www:/bin/sh",
              "demo-user:x:1000:1000:Demo User:/home/demo:/bin/bash",
              "nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin",
            ],
          },
        }),
        { status: 200, headers }
      );

    case "header":
      return new Response(
        JSON.stringify({
          attack: "header",
          status: "exploited",
          message: "Malicious headers accepted. Cache poisoned for all visitors.",
          data: {
            injected_headers: {
              "X-Forwarded-For":  "127.0.0.1\r\nX-Injected: malicious-payload",
              "X-Override-Host":  "evil.demo-attacker.com",
              "X-Cache-Poison":   "true",
            },
            effect: "All cached responses now serve attacker-controlled content to every visitor.",
          },
        }),
        { status: 200, headers }
      );

    default:
      return new Response(
        JSON.stringify({ error: "Unknown attack type." }),
        { status: 400, headers }
      );
  }
};
