# HomeTap — Hometap calculator exploration

This repository documents a **personal research project**: I wanted to understand how **Hometap’s home equity investment calculator** behaves across **time horizons** (1–10 years) and **market scenarios** (from large decline to high appreciation), for a single worked example: a **$500,000** home and a **$50,000** advance (**10%** of value).

The technical pieces here **fetch calculator outputs**, **tabulate them**, and **visualize** Hometap’s share in dollars and percent, projected home value, and a simple **implied IRR** for the investor side of the structure (see report for the exact formula).

---

## What I was trying to do

- **Compare outcomes** under the five labeled paths the calculator exposes (Large Decline through High appreciation), not to predict housing markets.
- **See how “Hometap share” evolves** if you imagine settling at year 1, 2, … 10 — i.e. treat each API row as “what the calculator says if the effective period is that many years,” holding the same starting home value and advance.
- **Sanity-check the economics** in a transparent way: dollars, percentage of value, and a back-of-the-envelope IRR so the time value of the payoff is not lost in the table.

This is **not** financial, legal, or tax advice, and it is **not** affiliated with Hometap.

---

## Conclusions (high level)

These are **observations from the generated report** (`calculator-report.html`) for the baseline inputs above, **not** universal truths about every product or geography.

1. **Nominal Hometap share in dollars generally rises with time** in appreciation scenarios, because home value and/or the structured share both push the dollar amount up. In **decline** scenarios, the dollar amount can **plateau** after a few years once the **percentage share hits the cap** implied by the model (the report shows **15%** in those paths in the captured run).

2. **Percentage share is bounded in practice.** For this dataset, many series **approach or sit at ~15–20%** depending on scenario and year — consistent with a product design that **limits how much of the upside (and downside sharing)** is allocated in the calculator output.

3. **Early exit years show extreme headline IRRs** in the report’s IRR chart. That comes from the **definition used** (lump-sum payoff at year *N* on a fixed initial “investment” amount): a **one-year** horizon mechanically produces a **very high** annualized rate if the dollar payoff jumps in year one. The IRR series is useful for **relative** comparison across scenarios and years, not as a literal expected return forecast.

4. **Scenario labels matter more than a single number.** “Moderate appreciation” vs “High appreciation” **widens the gap** in both Hometap’s dollar share and projected home value by year 10; **decline** paths **compress** homeowner equity in the model while still showing **meaningful** investor-side outcomes in dollars because of how the share and caps interact.

5. **The calculator’s own assumptions drive everything.** Any conclusion here is **only as good as** Hometap’s internal pricing model, the posted appreciation/decline definitions, and the **fixed** `product_id` and inputs used in the extractor (see Unknowns).

---

## Unknowns and limitations

| Area | What is unclear or unverified |
|------|-------------------------------|
| **API stability** | The extractor calls `POST https://www.hometap.com/api/calculator`. There is **no public contract**; endpoints, payloads, or semantics may **change without notice**. |
| **Product / market fit** | The scripts hard-code **`product_id: "HEI-3T-10Y-2M"`** and a **$500k / $50k** example. Other regions, products, or tiers may **not** match this behavior. |
| **Economic interpretation** | The report notes that **decline** is modeled as a **one-time** shock in the first year while **appreciation** **compounds** annually — that matches the **commentary embedded in the HTML**, but real life and the **legal agreement** may differ. |
| **Fees and costs** | Calculator output may **exclude** closing costs, buyout mechanics, third-party fees, or nuances of **how** settlement is priced. |
| **Tax and legal** | No modeling of **tax**, **liens**, **refinance**, or **default**; not a substitute for professional advice. |
| **IRR definition** | The report uses a **single lump sum** at year *N* and a simple annualization. It does **not** model **partial** paydowns, dividends, or risk-adjusted discounting. |
| **Data freshness** | Checked-in `calculator-responses.json` is a **snapshot**. Re-run `npm run extract:all` to refresh; numbers may **drift** if the vendor updates the model. |

---

## What’s in this repo

| Artifact | Role |
|----------|------|
| `extract-all-combinations.js` | **Recommended:** 10 years × 5 scenarios → `calculator-responses.json` via the public calculator API (no browser). |
| `extract-calculator-responses.js` / `extract-calculator-manual.js` | Optional **Puppeteer** flows if the API or UI changes. |
| `format-calculator-report.js` | Builds `calculator-table.csv` and **`calculator-report.html`** (tables + Chart.js charts). |
| `calculator-responses.json` | Saved API responses (snapshot). |
| `calculator-report.html` | **Open in a browser** for the full visual summary. |

---

## Quick start

```bash
npm install
npm run extract:all   # refresh JSON from the API (optional if you trust the snapshot)
npm run report        # regenerate CSV + HTML from calculator-responses.json
```

Then open **`calculator-report.html`** locally.

---

## License

No license file is included unless you add one. If you publish this repo, consider adding a `LICENSE` that matches your intent.
