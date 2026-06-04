import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refreshes the Supabase auth session on every request and forwards updated
 * cookies. Call this from the project root `middleware.ts`:
 *
 *   import { updateSession } from "@/lib/supabase/middleware"
 *   export async function middleware(request: NextRequest) {
 *     return updateSession(request)
 *   }
 *
 * IMPORTANT: do not run logic between createServerClient and getUser(), and
 * always return the `supabaseResponse` object as-is so cookies stay in sync.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Touch the session so it is refreshed and cookies are rewritten.
  await supabase.auth.getUser()

  return supabaseResponse
}
