// /functions/api/auth/whoami.ts
// Returns the authenticated user email from Cloudflare Access

export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    // Try different possible header names for Access user email
    const possibleHeaders = [
      'cf-access-authenticated-user-email',
      'Cf-Access-Authenticated-User-Email', 
      'CF-Access-Authenticated-User-Email',
      'x-forwarded-user'
    ];
    
    let userEmail = null;
    
    for (const headerName of possibleHeaders) {
      userEmail = request.headers.get(headerName);
      if (userEmail) {
        break;
      }
    }
    
    if (!userEmail) {
      return Response.json({
        authenticated: false,
        error: 'No authenticated user found',
        debug: {
          headers: Object.fromEntries(request.headers.entries())
        }
      }, { status: 401 });
    }
    
    return Response.json({
      authenticated: true,
      email: userEmail,
      timestamp: Date.now()
    });
    
  } catch (error) {
    return Response.json({
      authenticated: false,
      error: error.message
    }, { status: 500 });
  }
};