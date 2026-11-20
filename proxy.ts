import { NextResponse, type NextRequest } from "next/server"

export default function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD

  if (!password) {
    return NextResponse.next()
  }

  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(
    " "
  )

  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded)
    const supplied = decoded.slice(decoded.indexOf(":") + 1)

    if (supplied === password) {
      return NextResponse.next()
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GameVerse"' },
  })
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
}
