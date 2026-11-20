import { BoxIcon, CloudIcon, SparklesIcon, ZapIcon } from "lucide-react"
import Image from "next/image"

import { NewGameComposer } from "@/components/new-game-composer"

const steps = [
  {
    icon: SparklesIcon,
    label: "Describe",
    text: "Pitch your idea in plain words",
  },
  { icon: BoxIcon, label: "Brief", text: "Answer a few design questions" },
  {
    icon: CloudIcon,
    label: "Build",
    text: "AI writes code in a cloud sandbox",
  },
  { icon: ZapIcon, label: "Play", text: "Your game runs live in the browser" },
]

export default function Page() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-arcade-grid" />
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[520px] -translate-x-1/2 animate-float-slow rounded-full bg-[var(--neon-a)] opacity-20 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-120px] bottom-[-120px] size-[420px] animate-float-slow rounded-full bg-[var(--neon-b)] opacity-15 blur-[120px] [animation-delay:-4s]" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8 text-center">
        <div className="flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--neon-b)]" />
          AI game studio · three.js · live preview
        </div>

        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo.svg"
            alt="GameVerse"
            width={64}
            height={64}
            className="size-16 drop-shadow-[0_0_24px_var(--neon-a)]"
            priority
          />
          <h1 className="font-logo text-4xl font-black tracking-tight sm:text-6xl">
            <span className="text-neon-gradient">GAMEVERSE</span>
          </h1>
          <p className="max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
            Prompt it. Play it. Turn any idea into a playable 3D game — racers,
            shooters, platformers, whole worlds — in minutes.
          </p>
        </div>

        <div className="flex w-full flex-col gap-6">
          <NewGameComposer />
        </div>

        <ol className="grid w-full grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className="flex flex-col items-start gap-1 rounded-xl border bg-card/50 p-3 text-left backdrop-blur"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <step.icon className="size-3.5 text-primary" />0{index + 1} ·{" "}
                {step.label}
              </div>
              <p className="text-xs text-muted-foreground/80">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
