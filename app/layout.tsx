import { JetBrains_Mono, Orbitron, Space_Grotesk } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { Metadata } from "next"

const fontSans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const fontLogo = Orbitron({
  subsets: ["latin"],
  variable: "--font-logo",
})

export const metadata: Metadata = {
  title: {
    default: "GameVerse — Prompt it. Play it.",
    template: "%s · GameVerse",
  },
  description:
    "GameVerse turns a plain-English idea into a playable 3D browser game. An AI agent plans the design, writes three.js code in a cloud sandbox, and streams the result live.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        fontSans.variable,
        fontLogo.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
