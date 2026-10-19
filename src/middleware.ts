import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, JWTPayload } from 'jose';

// Convert your secret to Uint8Array
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default_secret_for_dev'
);

export async function middleware(req: NextRequest) {
  // Skip middleware for login page to avoid redirect loop
  if (req.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  const token = req.cookies.get('token')?.value;

  // If no token is found, redirect to the login page
  if (!token) {
    console.log("No token found");
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    // Verify the token using jose
    const { payload } = await jwtVerify<JWTPayload>(token, secret);

    // Clone request headers and append the user data
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-payload', JSON.stringify(payload));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    // If the token is invalid or expired, redirect to the login page
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('token');
    return response;
  }
}

export const config = {
  matcher: [
    // Public files are excluded: the image optimizer fetches them without the login cookie.
    '/((?!api|login|_next/static|_next/image|favicon.ico|reset-credentials|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|json)$).*)',
  ],
};
