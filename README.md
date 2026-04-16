# HomeTap Cap Analysis

---

## TL;DR

HomeTap’s returns are driven by timing and home price appreciation—not static ownership.

→ Returns decay over time and collapse in low-appreciation markets  
→ Growth without geographic discipline can turn a high-return product into a low-return asset  

This is not just a lending product—it is a capital allocation system shaped by user behavior, market conditions, and product design.

→ Product decisions in systems like this require alignment across product, finance, and compliance—not just UX or growth.

---

## L1 — What this is

I reverse-engineered HomeTap’s product to understand how design decisions translate into capital allocation outcomes—and why one thing becomes clear:

→ Growth without geographic discipline can turn a high-return product into a low-return asset.

👉 **[View full analysis](https://joemcao.github.io/hometap/calculator-report.html)**

---

### Repository layout

| Path | Purpose |
|------|---------|
| [`scripts/`](./scripts/) | Extractors and report builder (`npm run extract`, `extract:all`, `report`, etc.) |
| [`data/`](./data/) | Snapshot `calculator-responses.json` and generated `calculator-table.csv` |
| [`calculator-report.html`](./calculator-report.html) | Generated HTML report (kept at repo root for GitHub Pages) |
| [`assets/`](./assets/) | Images referenced by this README |

---

## Product context

Below is the HomeTap calculator used as the basis for this analysis:

![HomeTap Calculator](./assets/hometap-calculator.png)

**Source:** HomeTap public calculator  
**URL:** https://www.hometap.com/how-it-works?home_value=500000#how-it-works-calculator  
**Data extracted:** February 21, 2026  
**Analysis published:** April 16, 2026

---

## L2 — Key insights

### 1. Returns are front-loaded and decay over time
IRR peaks early (~20% at year 1–2 across scenarios) and then declines steadily as time increases.

→ The product generates the highest returns on short holding periods, not long ones.

---

### 2. Downside scenarios collapse to near risk-free returns
In large and moderate decline scenarios, IRR drops to ~3–5% by year 10.

→ Returns in downside cases are barely above (or below) risk-free rates, despite taking equity risk.

---

### 3. Appreciation drives long-term viability
In appreciation scenarios, IRR remains meaningfully higher (~11–16% by year 10), while flat/declining markets converge toward low single digits.

→ The product is fundamentally a leveraged bet on home price appreciation.

---

### 4. Timing matters more than percentage share
Even when HomeTap’s share % stabilizes, IRR continues to decline over time.

→ Time decay dominates the economics, not just payout structure.

---

### 5. Product creates asymmetric outcomes across scenarios
- High appreciation → sustained double-digit returns  
- No change → mid-single digit returns  
- Decline → low single digit returns  

→ The same product behaves like different asset classes depending on market conditions.

---

### 6. Downside scenarios create strategic optionality for the homeowner
In declining price scenarios, the homeowner’s obligation is based on a reduced home value.

→ This creates a potential incentive to settle during downturns, depending on contract terms and future price expectations.

→ The product embeds a form of **market-timing optionality** for the homeowner.

---

### 7. The product behaves like a time-dependent contract on future value
HomeTap’s payoff depends on both **timing** and **price path**, not a fixed ownership stake.

- The homeowner exchanges future appreciation, not static equity  
- Outcomes vary significantly depending on when settlement occurs  
- The effective “share” is determined at exit, not at origination  

→ The product is better understood as a **contract on future value**, not traditional equity ownership.

---

## L3 — Product implications

> Product decisions must be grounded in a deep understanding of the underlying economic model — not just user growth or UX.

---

### 1. User behavior directly impacts returns
Investor outcomes vary significantly based on when the homeowner exits.

→ Product design (UX, messaging, incentives) directly shapes user behavior—and therefore realized returns.

→ Even small changes in how information is presented (e.g., amount owed vs. share of appreciation) can shift user decisions, turning UX into a financial lever.

→ This creates potential for adverse selection, where users with different expectations about future home prices may time exits in ways that impact portfolio returns.

---

### 2. Time and market conditions are primary drivers
Returns are highly sensitive to:
- Holding period (IRR decay over time)
- Home price appreciation

→ Product performance is driven as much by **where and when** capital is deployed as by user behavior.

→ Growth is not just acquiring users—it is allocating capital across markets with different return profiles.

→ In practice, this turns expansion into a **portfolio construction problem**, not just a distribution strategy.

→ Expanding into the wrong markets can collapse returns to near risk-free levels while still taking equity risk, fundamentally breaking the business model.

---

### 3. Misaligned intuition creates bad product decisions
Without understanding the economic engine, teams may:
- Optimize for engagement over outcomes  
- Build features that unintentionally reduce returns  
- Misinterpret performance signals  

→ Deep product understanding is required to avoid “shiny but harmful” improvements.

---

### 4. Early-stage products carry hidden uncertainty
HomeTap has limited long-term realized outcomes (products <10 years old).

→ Modeled returns may differ from realized performance as cohorts mature.

---

### 5. Communication and regulatory considerations
→ Product, growth, and compliance must be designed as a unified system.

→ Decisions around pricing, communication, and expansion carry both economic and regulatory consequences.

---

## L4 — Decision framework

Product decisions must operate across:

- **Capital allocation**
- **User behavior**
- **Product framing**

→ These cannot be separated without degrading outcomes.

---

### Takeaway

Financial products are defined by how product decisions shape capital allocation, user behavior, and long-term returns.

A PM optimizing growth without understanding IRR is effectively deploying capital blindly.

---

## What I did

- Extracted calculator outputs across 10-year horizons and 5 market scenarios  
- Modeled HomeTap’s share evolution  
- Estimated IRR across scenarios  

---

## Scope and limitations

This analysis is directional and based on public calculator outputs—not internal performance data.