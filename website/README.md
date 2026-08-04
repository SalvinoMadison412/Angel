# Angel Marketing Site

The public marketing website for **Angel** and its flagship product, **AGL v1** — a crash detection device. Built with Next.js 14 (App Router), Tailwind CSS, and Framer Motion, styled in Angel's brand language (dark, technical, CMF by Nothing–influenced).

## Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS + CSS variables mirrored from the Angel app's design system (`src/theme/` in the repo root)
- **Animation:** Framer Motion (scroll reveals, hero transitions, animated stat counters)
- **Icons:** Lucide React
- **Fonts:** Space Mono (headings), JetBrains Mono (technical labels), Inter (body) — via `next/font/google`

No backend or database is required; this is a fully static site. The contact form opens the visitor's email client via a `mailto:` link rather than posting to a server.

## Pages

| Route       | Description                                    |
| ----------- | ----------------------------------------------- |
| `/`         | Home — hero, how it works, features, stats, testimonials, investor trust, CTA |
| `/product`  | AGL v1 product page — hero, feature deep-dives, specs, in-the-box, FAQ, buy CTA |
| `/about`    | Mission, team, milestones, investor section     |
| `/contact`  | Contact form, investor inquiry toggle, company info |
| `/privacy`  | Privacy policy                                  |
| `/terms`    | Terms of service                                |

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
  app/                  # Routes (App Router)
    page.tsx            # Home
    product/page.tsx
    about/page.tsx
    contact/page.tsx
    privacy/page.tsx
    terms/page.tsx
    layout.tsx           # Root layout: fonts, navbar, footer
    globals.css          # Tailwind base + brand utilities (dot-grid, brackets, gradients)
  components/
    home/                # Home page sections
    product/             # Product page sections
    about/                # About page sections
    Navbar.tsx, Footer.tsx, Button.tsx, Logo.tsx, DeviceRender.tsx, ...
  public/                 # Static assets
```

## Deploying

This app has no server-side dependencies and deploys cleanly to Vercel, Netlify, or any static/Node host that supports Next.js. On Vercel: connect the repo, set the project root to `website/`, and deploy — no environment variables are required.
