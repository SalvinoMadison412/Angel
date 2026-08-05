# Angel Marketing Site

The investor-facing marketing website for **Angel** — a two-sided road safety network connecting drivers with emergency responders, tow fleets, hospitals, and insurers. **Atom**, the crash detection device, is the network's user acquisition channel. Built with Next.js 14 (App Router), Tailwind CSS, and Framer Motion, styled in Angel's brand language (dark, technical, CMF by Nothing–influenced).

## Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS + CSS variables mirrored from the Angel app's design system (`src/theme/` in the repo root)
- **Animation:** Framer Motion (scroll reveals, hero transitions, animated stat counters, the network diagram and flywheel)
- **Icons:** Lucide React
- **Fonts:** Space Mono (headings), JetBrains Mono (technical labels), Inter (body) — via `next/font/google`

No backend or database is required; this is a fully static site. The contact form opens the visitor's email client via a `mailto:` link, and the "Request Pitch Deck" modal (available from every page's navbar) collects Name / Company / Email client-side with no submission endpoint.

## Pages

| Route       | Description                                    |
| ----------- | ----------------------------------------------- |
| `/`         | Home — the investor pitch: hero, two-app platform, network-effect flywheel, crash-response timeline, market opportunity, partner ecosystem, traction stats, who Angel is for, revenue model, CTA |
| `/network`  | Platform architecture deep dive — live network diagram, how the network scales, technical infrastructure, partner onboarding |
| `/product`  | Atom product page — hero, product→network connection, specs, in-the-box, FAQ, buy CTA |
| `/about`    | Mission, two-app strategy, team, milestones, investor section |
| `/contact`  | Contact form with general/investor inquiry tabs, company info |
| `/privacy`  | Privacy policy                                  |
| `/terms`    | Terms of service                                |

### A note on stats

All figures on the site are sourced and cited inline (MoRTH 2024, NITI Aayog). Anything not yet benchmarked — detection latency, uptime, API response times — is labeled as in-progress rather than presented as a claim, per `components/product/DevelopmentNote.tsx`.

## Local Development

```bash
npm install
npm run dev
```

The site runs at `http://localhost:3000`.

## Build

```bash
npm run build
npm run start
```

## Project Structure

```
website/
  app/                   # Routes (App Router)
    page.tsx             # Home — investor pitch
    network/page.tsx
    product/page.tsx
    about/page.tsx
    contact/page.tsx
    privacy/page.tsx
    terms/page.tsx
    layout.tsx            # Root layout: fonts, navbar, footer, pitch deck modal provider
    globals.css           # Tailwind base + brand utilities (dot-grid, brackets, gradients)
  components/
    home/                 # Home page sections
    network/              # Network page sections
    product/              # Product page sections
    about/                # About page sections
    NetworkDiagram.tsx    # Animated two-sided network SVG (hero + full variants)
    Flywheel.tsx           # Animated network-effect diagram
    HowItWorks.tsx         # Crash-response timeline (shared, used on Home)
    PitchDeckModal.tsx     # Investor request modal
    StatsBand.tsx           # Reusable stat band with animated counters + source citations
    StatCounter.tsx         # Count-up number, supports Intl locale formatting (e.g. Indian digit grouping)
    Navbar.tsx, Footer.tsx, Button.tsx, Logo.tsx, DeviceRender.tsx, ...
  lib/
    PitchDeckModalContext.tsx  # Global modal state, used by every "Request Pitch Deck" trigger
    buttonStyles.ts             # Shared button class variants (Link and native <button> triggers)
  public/                 # Static assets
```

## Deploying

This app has no server-side dependencies and deploys cleanly to Vercel, Netlify, or any static/Node host that supports Next.js. On Vercel: connect the repo, set the project root to `website/`, and deploy — no environment variables are required.
