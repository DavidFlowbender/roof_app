# RoofCalc Pro — Workspace Rules (Sijitek Solutions)

## Deployment & Git Safety
- **Never commit or push to `origin/main` without explicit user permission.** Pushing to `main` auto-deploys live to `https://roofcalc.sijiteksolutions.com` via Vercel; always let the user verify on the local dev server (`localhost:5173`) first.
- Never stage or commit `.env.local` or echo secret API keys (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`).

## Branding & Legal
- Brand exclusively as **RoofCalc Pro** by **Sijitek Solutions** with the **`S`** logo mark.
- Never display third-party CAD trademarks, logos, or names (such as Revit) in user-facing UI, PDFs, or copy summaries.

## Product & Geometry Invariants
- **Clean Start on Login/Load:** Start both desktop and mobile on a blank 2D/3D canvas ready for a new drawing; keep sample/default floor plans inside the **Examples** dropdown.
- **Developer-Only Laptop Mobile Toggle:** Keep the laptop header's `Mobile` preview toggle visible only in local `DEV` mode or for developer accounts (`davidakinbode19@gmail.com`, `sijiteksub@gmail.com`).
- **Stage-Specific Base Dimensions:**
  - **Foundation Level:** Automatically add editable eaves overhang (`0.5m` default per side) to drawn dimensions.
  - **Parapet & Woodwork Levels:** Keep drawn base dimensions exact (`+0m` extra overhang).
- **Pro Gating:** Keep AI Sketch Auto-Dimension, Woodwork & Timber BOQ, and Water Collector (WC) BOQ gated behind `isPremium`.
