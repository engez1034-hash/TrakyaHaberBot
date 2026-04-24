import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const adminMatchers = ["/admin", "/api/v1/admin"];

function needsAuth(pathname: string) {
  return adminMatchers.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!needsAuth(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const role = (token.role as string | undefined) ?? "viewer";
  if (pathname.startsWith("/api/v1/admin")) {
    if (role === "viewer") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Yetkisiz", statusCode: 403 } },
        { status: 403 }
      );
    }
  }

  if (pathname.startsWith("/admin/articles") || pathname.startsWith("/api/v1/admin/articles")) {
    if (role === "viewer") {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/v1/admin/:path*"]
};
