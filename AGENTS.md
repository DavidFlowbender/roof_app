# RoofCalc Pro — Workspace Rules (Sijitek Solutions)

## Deployment & Git Safety
- **Never commit or push to `origin/main` without explicit user permission.** Pushing to `main` auto-deploys live to `https://roofcalc.sijiteksolutions.com` via Vercel; always let the user verify on the local dev server (`localhost:5173`) first.
- Never stage or commit `.env.local` or echo secret API keys (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`).

## Branding & Legal
- Brand exclusively as **RoofCalc Pro** by **Sijitek Solutions** with the **`S`** logo mark.
- Never display third-party CAD trademarks, logos, or names (such as Revit) in user-facing UI, PDFs, or copy summaries.

## Product & Geometry Invariants
- **Clean Start on Login/Load:** Start both desktop and mobile on a blank 2D/3D canvas ready for a new drawing; keep sample/default floor plans inside the **Examples** dropdown.
- **Admin-Only Laptop Mobile Toggle:** Keep the laptop header's `Mobile` preview toggle visible strictly for the admin account (`sijiteksub@gmail.com`) only.
- **Stage-Specific Base Dimensions:**
  - **Foundation Level:** Automatically add editable parapet/eaves allowance (`0.5m` default per side) to drawn/scanned wall dimensions to account for the parapet that will be installed later.
  - **Parapet Level:** Keep drawn/scanned base dimensions exact (`+0m` extra overhang) — covers both parapet-level and woodwork-level site measurements (no separate Woodwork level option).
- **Pro Gating:** Keep AI Sketch Auto-Dimension, Woodwork & Timber BOQ, Water Collector (WC) BOQ, Company Info / PDF Logo Branding, and Custom Material Prices gated behind `isPremium`.
- **Single Admin Account:** Only `sijiteksub@gmail.com` is the admin account — it automatically receives full access to all Pro features (including unlimited AI sketch scans) and exclusive access to the **Sijitek Admin Dashboard** (both client- and server-side).
