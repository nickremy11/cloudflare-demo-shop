// ─────────────────────────────────────────────────────────────
//  Pillar definitions for the homepage.
//  Each solution .md file references one of these pillar slugs
//  in its frontmatter; the homepage groups cards by pillar
//  using the `order` field.
// ─────────────────────────────────────────────────────────────

export type PillarSlug = "sase" | "app-security" | "developer" | "network";

export interface Pillar {
  slug: PillarSlug;
  label: string;     // displayed as the section heading
  badge: string;     // shown on the card as a small chip
  blurb: string;     // one-line description under the heading
  order: number;     // homepage section ordering
}

export const PILLARS: Pillar[] = [
  {
    slug: "sase",
    label: "SASE / Workspace Security",
    badge: "SASE",
    blurb:
      "Zero Trust access, secure web gateway, browser isolation, CASB, and email security for the modern workforce.",
    order: 1,
  },
  {
    slug: "app-security",
    label: "App Security & Performance",
    badge: "App Sec",
    blurb:
      "Protect and accelerate every public-facing application — WAF, DDoS, bot management, CDN, DNS, and beyond.",
    order: 2,
  },
  {
    slug: "developer",
    label: "Developer Platform",
    badge: "Developer",
    blurb:
      "Build and deploy serverless apps, AI workloads, and global storage at the edge with Workers, R2, D1, and KV.",
    order: 3,
  },
  {
    slug: "network",
    label: "Network Security",
    badge: "Network",
    blurb:
      "Protect entire IP networks and modernize WAN connectivity — Magic Transit, Cloudflare WAN, Magic Firewall, and Spectrum.",
    order: 4,
  },
];

export function getPillar(slug: PillarSlug): Pillar {
  const p = PILLARS.find((p) => p.slug === slug);
  if (!p) throw new Error(`Unknown pillar: ${slug}`);
  return p;
}
