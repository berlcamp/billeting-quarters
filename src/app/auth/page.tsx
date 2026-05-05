import Image from "next/image";
import { redirect } from "next/navigation";
import { Bricolage_Grotesque, Fraunces } from "next/font/google";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { checkAccess } from "@/lib/auth/access-check";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  // If the visitor is already signed in and authorized, send them onward.
  const access = await checkAccess();
  if (access.status === "authorized") redirect("/dashboard");
  if (access.status === "suspended") redirect("/auth/suspended");

  const params = await searchParams;
  const errorMessage =
    params.reason ||
    (params.error ? "Sign-in failed. Please try again." : null);

  return (
    <div
      className={`${fraunces.variable} ${bricolage.variable} relative flex flex-1 flex-col lg:grid lg:grid-cols-[1.15fr_1fr]`}
    >
      {/* ─────────────────── LEFT · COMMAND DECK ─────────────────── */}
      <section className="relative isolate flex flex-col overflow-hidden bg-[#0a1740] px-6 pt-8 pb-10 text-white sm:px-10 lg:px-14 lg:pt-12 lg:pb-14">
        {/* grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at 30% 30%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 30% 30%, black 30%, transparent 75%)",
          }}
        />
        {/* warm gold haze */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(245,197,38,0.22), transparent 70%)",
          }}
        />
        {/* indigo bloom */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[460px] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(82,113,255,0.22), transparent 70%)",
          }}
        />
        {/* gold left rule */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] bg-[#f5c526]"
        />

        {/* ── header chrome ── */}
        <header className="relative z-10 flex items-start justify-between font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.24em] text-white/55">
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-md border border-white/15 bg-white/[0.04] font-[var(--font-fraunces)] text-[18px] font-medium normal-case tracking-normal text-[#f5c526]"
              aria-hidden
            >
              P
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-white/85">Palaro Bayugan Command · Deck</span>
              <span className="text-white/40">Operations · build 4.7.1</span>
            </div>
          </div>
          <div className="hidden flex-col items-end gap-0.5 md:flex">
            <span className="inline-flex items-center gap-2 text-white/80">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative size-1.5 rounded-full bg-emerald-400" />
              </span>
              Network · online
            </span>
            <span className="text-white/40">Agusan del Sur · Region XIII</span>
          </div>
        </header>

        {/* ── hero · banner-as-poster ── */}
        <div className="relative z-10 mt-14 flex flex-1 items-center justify-center lg:mt-6">
          <div className="relative">
            {/* faint outline year */}
            <span
              aria-hidden
              className="absolute -top-24 -left-12 select-none font-[var(--font-fraunces)] text-[200px] font-extralight italic leading-none text-white/[0.05] sm:-top-28 sm:-left-20 sm:text-[280px]"
            >
              26
            </span>
            {/* corner ticks */}
            <span
              aria-hidden
              className="absolute -top-3 -left-3 size-6 border-t-2 border-l-2 border-[#f5c526]"
            />
            <span
              aria-hidden
              className="absolute -top-3 -right-3 size-6 border-t-2 border-r-2 border-[#f5c526]"
            />
            <span
              aria-hidden
              className="absolute -bottom-3 -left-3 size-6 border-b-2 border-l-2 border-[#f5c526]"
            />
            <span
              aria-hidden
              className="absolute -bottom-3 -right-3 size-6 border-b-2 border-r-2 border-[#f5c526]"
            />
            <div className="relative rounded-2xl bg-white/95 p-3 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-sm">
              <Image
                src="/banner.png"
                alt="2026 Palaro tu Gsur — Unlocking the Future Through Sports"
                width={460}
                height={345}
                priority
                className="block h-auto w-[min(78vw,440px)] rounded-lg"
              />
            </div>
            {/* press stamp */}
            <div className="absolute -bottom-5 right-4 rotate-[-1.5deg] rounded border border-[#f5c526]/40 bg-[#0a1740] px-2.5 py-1 font-[var(--font-geist-mono)] text-[9.5px] uppercase tracking-[0.24em] text-[#f5c526] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)]">
              Issue 26 · host Agusan del Sur
            </div>
          </div>
        </div>

        {/* ── brand ── */}
        <div className="relative z-10 mt-14 max-w-xl font-[var(--font-bricolage)] lg:mt-10">
          <h2 className="font-[var(--font-fraunces)] text-[44px] leading-[0.98] font-light tracking-tight text-white sm:text-[58px] lg:text-[64px]">
            <span className="block">
              Palaro <span className="italic text-[#f5c526]">Bayugan</span>
            </span>
            <span className="block">Command</span>
          </h2>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/55">
            One platform for billeting, transport, venues, medical, and
            incident command — orchestrating the 2026 national games.
          </p>
        </div>

      </section>

      {/* ─────────────────── RIGHT · SIGN-IN ─────────────────── */}
      <section className="relative flex flex-1 flex-col overflow-hidden bg-[#faf7ed] px-6 py-10 text-[#0a1740] sm:px-10 lg:px-14 lg:py-12">
        {/* dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(rgba(10,23,64,0.10) 1px, transparent 1.4px)",
            backgroundSize: "18px 18px",
            maskImage:
              "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
          }}
        />
        {/* faint gold corner accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(245,197,38,0.16), transparent 70%)",
          }}
        />

        {/* top index strip */}
        <div className="relative z-10 flex items-center justify-between font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.24em] text-[#0a1740]/55">
          <span>
            <span className="text-[#0a1740]/90">01</span>
            <span className="mx-2 text-[#0a1740]/30">/</span>
            Authentication
          </span>
          <span className="hidden sm:inline">Secure · OAuth 2.0</span>
        </div>

        {/* main column */}
        <div className="relative z-10 mx-auto my-auto w-full max-w-md py-12 lg:py-0">
          <p className="font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.24em] text-[#a98300]">
            For officials &amp; operations staff
          </p>
          <h1 className="mt-3 font-[var(--font-fraunces)] text-[clamp(2.4rem,5vw,3.4rem)] leading-[1.02] font-light tracking-tight text-[#0a1740]">
            <span className="block">Sign in to the</span>
            <span className="block italic">command deck.</span>
          </h1>
          <p className="mt-4 max-w-sm font-[var(--font-bricolage)] text-[15px] leading-relaxed text-[#0a1740]/65">
            Real-time orchestration for the 2026 Palarong Pambansa. Access is
            reserved for accredited officials, venue captains, and command-room
            operators.
          </p>

          <div className="mt-8 space-y-4">
            {errorMessage ? (
              <Alert
                variant="destructive"
                className="rounded-xl border-destructive/25 bg-destructive/[0.06]"
              >
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <GoogleSignInButton />

            <div className="flex items-center gap-3 pt-1 font-[var(--font-geist-mono)] text-[9.5px] uppercase tracking-[0.24em] text-[#0a1740]/40">
              <span aria-hidden className="h-px flex-1 bg-[#0a1740]/15" />
              <span>encrypted · region XIII</span>
              <span aria-hidden className="h-px flex-1 bg-[#0a1740]/15" />
            </div>
          </div>

          <p className="mt-10 max-w-sm font-[var(--font-bricolage)] text-[13.5px] leading-relaxed text-[#0a1740]/60">
            Access is invitation-only. If you need an account, contact your
            command-center administrator or the host LGU billeting officer.
          </p>
        </div>

        {/* footer chrome */}
        <footer className="relative z-10 flex flex-col gap-2 font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.22em] text-[#0a1740]/50 sm:flex-row sm:items-end sm:justify-between">
          <span>© Palaro Bayugan Command · DepEd</span>
          <span className="text-[#0a1740]/65">
            Developed and Powered by{" "}
            <span className="text-[#0a1740]">Keri Tech</span>
          </span>
          <span className="hidden sm:inline">v4.7 · 2026 edition</span>
        </footer>
      </section>
    </div>
  );
}
