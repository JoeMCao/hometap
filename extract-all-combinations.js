/**
 * Extract all 50 calculator responses: 10 years (1–10) × 5 appreciation scenarios.
 *
 * Uses the known 5 appreciation scenarios and the calculator API request payload
 * format. Calls POST /api/calculator for each (year, scenario) combination.
 *
 * Run: node extract-all-combinations.js
 */

import { writeFileSync } from "fs";

const CALCULATOR_URL =
  "https://www.hometap.com/how-it-works?home_value=500000#how-it-works-calculator";
const API_URL = "https://www.hometap.com/api/calculator";
const OUTPUT_FILE = "calculator-responses.json";

const YEARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The 5 appreciation scenarios from the Hometap calculator dropdown. */
const APPRECIATION_SCENARIOS = [
  { label: "Large Decline", appreciation_percent: { annualized: false, value: -0.08 } },       // -8% total
  { label: "Moderate Decline", appreciation_percent: { annualized: false, value: -0.04 } },   // -4% total
  { label: "No Change", appreciation_percent: { annualized: false, value: 0 } },              // 0%
  { label: "Moderate appreciation", appreciation_percent: { annualized: true, value: 0.0391 } },  // +3.91% annual
  { label: "High appreciation", appreciation_percent: { annualized: true, value: 0.08 } },    // +8% annual
];

/** Base scenario for the request payload (matches the API format from the calculator). */
const BASE_SCENARIO = {
  idx: 1,
  investment_amount: 50000,
  product_id: "HEI-3T-10Y-2M",
  starting_home_value: 500000,
  effective_period: { unit: "years", length: 10 },
};

/** Build one scenario for the API: appreciation scenario + effective_period.length = year */
function buildScenario(appreciationScenario, year) {
  return {
    ...BASE_SCENARIO,
    label: appreciationScenario.label,
    appreciation_percent: appreciationScenario.appreciation_percent,
    effective_period: { ...BASE_SCENARIO.effective_period, length: year },
  };
}

async function main() {
  console.log("Appreciation scenarios:", APPRECIATION_SCENARIOS.map((s) => s.label).join(", "));
  console.log(`\nCalling API for ${YEARS.length} years × ${APPRECIATION_SCENARIOS.length} scenarios = ${YEARS.length * APPRECIATION_SCENARIOS.length} requests...`);

  const collected = [];
  let id = 0;

  for (const year of YEARS) {
    for (const appreciationScenario of APPRECIATION_SCENARIOS) {
      const scenario = buildScenario(appreciationScenario, year);
      const body = { scenarios: [scenario] };
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.scenarios && data.scenarios.length > 0) {
          id += 1;
          collected.push({
            _id: id,
            _url: API_URL,
            _method: "POST",
            _requestBody: body,
            _timestamp: new Date().toISOString(),
            ...data,
          });
        }
      } catch (e) {
        console.warn(`Failed year=${year} scenario=${appreciationScenario.label}:`, e.message);
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  const output = {
    extractedAt: new Date().toISOString(),
    sourceUrl: CALCULATOR_URL,
    totalResponses: collected.length,
    responses: collected,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`\nWrote ${collected.length} response(s) to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
