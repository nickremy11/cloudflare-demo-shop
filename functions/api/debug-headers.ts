// Debug endpoint to see all headers
export const onRequestGet: PagesFunction = async ({ request }) => {
  const headers: Record<string, string> = {};
  
  // Collect all headers
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }
  
  return Response.json({
    message: 'Debug headers endpoint',
    headers,
    accessHeaders: {
      'cf-access-authenticated-user-email': request.headers.get('cf-access-authenticated-user-email'),
      'Cf-Access-Authenticated-User-Email': request.headers.get('Cf-Access-Authenticated-User-Email'),
      'CF-Access-Authenticated-User-Email': request.headers.get('CF-Access-Authenticated-User-Email'),
      'x-forwarded-user': request.headers.get('x-forwarded-user'),
    },
    url: request.url,
    method: request.method
  });
};