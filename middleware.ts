import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

/**
 * Root middleware — refreshes the Supabase auth session on every matched
 * request so Server Components always see a valid user. Delegates to
 * `updateSession` (see lib/supabase/middleware.ts) per the @supabase/ssr docs.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except the ones that never need a session
     * refresh: Next.js internals and static asset files. Add public routes
     * here later if they should skip auth entirely.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
