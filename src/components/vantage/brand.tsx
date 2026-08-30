import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/next-steps";

export const VANTAGE_LOGO_URL = "/vantage-logo.png";

export function VantageLogo({ className = "h-10 w-auto" }: { className?: string }) {
  return <img src={VANTAGE_LOGO_URL} alt="Vantage Financial" className={className} />;
}

export function AuroraBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black">
      <div
        className="absolute -left-[12vw] -top-[16vw] h-[62vw] w-[62vw] rounded-full blur-[30px]"
        style={{
          background: "radial-gradient(circle,rgba(201,168,76,0.18),transparent 62%)",
          animation: "vantage-aurora-a 24s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-[16vw] top-[34vh] h-[54vw] w-[54vw] rounded-full blur-[30px]"
        style={{
          background: "radial-gradient(circle,rgba(201,168,76,0.11),transparent 62%)",
          animation: "vantage-aurora-b 30s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-[22vw] left-[22vw] h-[50vw] w-[50vw] rounded-full blur-[30px]"
        style={{
          background: "radial-gradient(circle,rgba(150,118,44,0.13),transparent 62%)",
          animation: "vantage-aurora-a 28s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}

export function PublicNav() {
  return (
    <div
      className="sticky top-0 z-50 border-b border-white/[0.07] backdrop-blur-xl"
      style={{ background: "rgba(7,7,7,0.55)" }}
    >
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-6 px-6 md:px-8">
        <Link to="/" className="flex items-center">
          <VantageLogo className="h-[42px] w-auto" />
        </Link>
        <nav className="flex items-center gap-4 md:gap-6">
          <a
            href="/#about"
            className="hidden text-[13.5px] font-semibold text-vantage-dim transition hover:text-vantage-ivory md:inline"
          >
            About
          </a>
          <a
            href="/#overview"
            className="hidden text-[13.5px] font-semibold text-vantage-dim transition hover:text-vantage-ivory md:inline"
          >
            The Overview
          </a>
          <a
            href="/#faq"
            className="hidden text-[13.5px] font-semibold text-vantage-dim transition hover:text-vantage-ivory md:inline"
          >
            FAQ
          </a>
          <Link
            to="/login"
            className="text-[13.5px] font-semibold text-vantage-dim transition hover:text-vantage-ivory"
          >
            Agent Login
          </Link>
          <Link to="/apply" className="vantage-btn-primary px-5 py-[11px] text-[14px]">
            Apply Now <span>→</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function PublicFooter() {
  return (
    <div className="mx-auto mt-[72px] max-w-[1240px] px-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] py-8">
        <VantageLogo className="h-[34px] w-auto opacity-85" />
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-vantage-faint">
          <span>© 2026 Vantage Financial</span>
          <span className="text-white/10">•</span>
          <Link to="/apply" className="text-vantage-dim transition hover:text-vantage-gold">
            Apply
          </Link>
          <span className="text-white/10">•</span>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-vantage-dim transition hover:text-vantage-gold"
          >
            Follow {INSTAGRAM_HANDLE}
          </a>
          <span className="text-white/10">•</span>
          <span>Equal Opportunity</span>
        </div>
      </div>
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-vantage-ivory">
      <AuroraBackdrop />
      <div className="relative z-10">
        <PublicNav />
        {children}
        <PublicFooter />
      </div>
    </div>
  );
}
