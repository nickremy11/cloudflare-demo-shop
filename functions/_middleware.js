export async function onRequest({ request, next }) {
  // WebSocket upgrades return a status-101 response carrying a non-standard
  // `webSocket` property. Reconstructing it with `new Response()` (below)
  // both drops that property and is invalid for status 101 — which silently
  // breaks the handshake. Pass these straight through untouched.
  if (request.headers.get('Upgrade') === 'websocket') {
    return next();
  }

  const response = await next();
  const bm = request.cf?.botManagement ?? {};

  const newHeaders = new Headers(response.headers);
  newHeaders.append('Set-Cookie', 
    `_cfbm=${bm.score ?? ''},${bm.verifiedBot ?? false}; Path=/; SameSite=Strict; Secure`
  );
  return new Response(response.body, { status: response.status, headers: newHeaders });
}