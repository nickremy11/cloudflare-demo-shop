export async function onRequest({ request, next }) {
  const response = await next();
  const bm = request.cf?.botManagement ?? {};
  
  const newHeaders = new Headers(response.headers);
  newHeaders.append('Set-Cookie', 
    `_cfbm=${bm.score ?? ''},${bm.verifiedBot ?? false}; Path=/; SameSite=Strict; Secure`
  );
  return new Response(response.body, { status: response.status, headers: newHeaders });
}