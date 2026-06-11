import { NextResponse, type NextRequest } from "next/server";

// LANDING=1 switches on the public marketing page: anonymous visitors to "/" are
// rewritten to it, while signed-in users (session cookie present) go straight to the
// dashboard as always. When LANDING is absent (the default) or anything other than
// "1", the proxy does nothing and "/" behaves exactly as before. The off state is
// the absence of the variable; never set LANDING=0 explicitly.
export function proxy(req: NextRequest) {
  if (process.env.LANDING === "1" && !req.cookies.has("dmarc_session")) {
    return NextResponse.rewrite(new URL("/landing", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
