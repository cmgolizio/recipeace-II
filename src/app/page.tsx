import Link from "next/link";

import { AuthMessage } from "../components/auth-message";
import { DomainSummaryCards } from "../components/domain-summary-cards";
import { HomeHero } from "../components/home-hero";
import { ContinueInDomain } from "../components/last-domain";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bar or Kitchen?
        </h1>
        <p className="text-muted">
          One pantry, both sides. Pick where you’re working — anything you add
          counts towards a drink and towards dinner.
        </p>
        <AuthMessage />
      </div>
      <HomeHero />
      <ContinueInDomain />
      <DomainSummaryCards />
      <p className="text-sm text-muted">
        <Link href="/pantry" className="underline hover:text-foreground">
          See everything in your pantry
        </Link>
      </p>
    </div>
  );
}