/**
 * Format calculator-responses.json into a table and build charts.
 * Outputs: calculator-table.csv, calculator-report.html
 *
 * Charts: X = time period (years 1–10), Y = Hometap share ($ and %).
 * One line per appreciation scenario.
 *
 * Run: node format-calculator-report.js
 */

import { readFileSync, writeFileSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = join(__dirname, "calculator-responses.json");
const TABLE_CSV = join(__dirname, "calculator-table.csv");
const REPORT_HTML = join(__dirname, "calculator-report.html");

/** Public calculator this project mirrors (same home_value query as extractors). */
const HOMETAP_CALCULATOR_PAGE =
  "https://www.hometap.com/how-it-works?home_value=500000#how-it-works-calculator";

/** Calendar date when this analysis / write-up was published (update when you ship a new version). */
const ANALYSIS_PUBLISHED_DATE = "April 16, 2026";

function main() {
  const raw = readFileSync(INPUT_FILE, "utf8");
  const data = JSON.parse(raw);

  const firstScenario = data.responses?.[0]?.scenarios?.[0];
  const initialHomeValue = firstScenario?.starting_home_value ?? 500000;
  const investmentAmount = firstScenario?.investment_amount ?? 50000;
  const investmentPercent = initialHomeValue ? Math.round((investmentAmount / initialHomeValue) * 100) : 10;

  // Pivot: scenarioLabel -> year -> { dollars, percent }. Include year 0 (initial: 10% share, $50k).
  const byScenario = new Map();
  const years = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const year0Percent = initialHomeValue ? investmentAmount / initialHomeValue : 0.1;

  for (const r of data.responses || []) {
    const s = r.scenarios?.[0];
    if (!s) continue;
    const label = s.label;
    const year = s.effective_period?.length;
    const dollars = s.hometap_share?.dollars ?? 0;
    const percent = s.hometap_share?.percent ?? 0;
    const appreciatedHomeValue = s.appreciated_home_value ?? null;

    if (!byScenario.has(label)) {
      byScenario.set(label, new Map());
    }
    byScenario.get(label).set(year, { dollars, percent, appreciatedHomeValue });
  }

  // Year 0: same for all scenarios — initial investment = 10% of home value, $50k; house value = starting value
  for (const label of byScenario.keys()) {
    byScenario.get(label).set(0, {
      dollars: investmentAmount,
      percent: year0Percent,
      appreciatedHomeValue: initialHomeValue,
    });
  }

  const scenarioOrder = [
    "Large Decline",
    "Moderate Decline",
    "No Change",
    "Moderate appreciation",
    "High appreciation",
  ].filter((l) => byScenario.has(l));
  if (scenarioOrder.length === 0) {
    scenarioOrder.push(...byScenario.keys());
  }

  /** First occurrence of each scenario’s `appreciation_percent` from the snapshot (matches calculator dropdown). */
  const scenarioParamsByLabel = new Map();
  for (const r of data.responses || []) {
    const s = r.scenarios?.[0];
    if (!s?.label || scenarioParamsByLabel.has(s.label)) continue;
    scenarioParamsByLabel.set(s.label, s.appreciation_percent);
  }

  // --- Table: CSV (wide format: one row per scenario, columns per year $ and %) ---
  const csvHeaders = ["Scenario", ...years.flatMap((y) => [`Year ${y} ($)`, `Year ${y} (%)`])];
  const csvRows = [csvHeaders.join(",")];
  for (const label of scenarioOrder) {
    const byYear = byScenario.get(label);
    const cells = years.flatMap((y) => {
      const v = byYear?.get(y) ?? {};
      const d = v.dollars != null ? v.dollars : "";
      const p = v.percent != null ? (v.percent * 100).toFixed(2) : "";
      return [d, p];
    });
    csvRows.push([label, ...cells].map((c) => (typeof c === "string" && c.includes(",") ? `"${c}"` : c)).join(","));
  }
  writeFileSync(TABLE_CSV, csvRows.join("\n"), "utf8");
  console.log("Wrote", TABLE_CSV);

  const tableMtime = statSync(TABLE_CSV).mtime;
  const generatedLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(tableMtime);

  let extractedLabel = "unknown (no extractedAt in JSON)";
  let extractedDateCalendar = "—";
  if (data.extractedAt) {
    const d = new Date(data.extractedAt);
    extractedLabel = `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`;
    extractedDateCalendar = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  }

  // --- Chart data for HTML ---
  const chartDatasetsDollars = scenarioOrder.map((label, i) => {
    const byYear = byScenario.get(label);
    const values = years.map((y) => byYear?.get(y)?.dollars ?? null);
    return { label, values };
  });
  const chartDatasetsPercent = scenarioOrder.map((label) => {
    const byYear = byScenario.get(label);
    const values = years.map((y) => {
      const p = byYear?.get(y)?.percent;
      return p != null ? Math.round(p * 100 * 100) / 100 : null;
    });
    return { label, values };
  });

  // Projected house value under each scenario over time (from API appreciated_home_value; year 0 = initial).
  const chartDatasetsHouseValue = scenarioOrder.map((label) => {
    const byYear = byScenario.get(label);
    const values = years.map((y) => byYear?.get(y)?.appreciatedHomeValue ?? null);
    return { label, values };
  });

  // IRR for Hometap: single outflow at t=0 (investment), single inflow at year N (Hometap share).
  // Annualized IRR = (Hometap share / investment)^(1/N) - 1, as percentage. At year 0, IRR = 0%.
  const chartDatasetsIRR = scenarioOrder.map((label) => {
    const byYear = byScenario.get(label);
    const values = years.map((y) => {
      if (y === 0) return 0;
      const dollars = byYear?.get(y)?.dollars;
      if (dollars == null || investmentAmount <= 0) return null;
      const ratio = dollars / investmentAmount;
      if (ratio <= 0) return null;
      const irr = (Math.pow(ratio, 1 / y) - 1) * 100;
      return Math.round(irr * 100) / 100;
    });
    return { label, values };
  });

  // --- HTML report with table + Chart.js ---
  const tableRowsHtml = scenarioOrder
    .map((label) => {
      const byYear = byScenario.get(label);
      const cells = years.map(
        (y) => {
          const v = byYear?.get(y);
          const d = v?.dollars != null ? `$${Number(v.dollars).toLocaleString()}` : "—";
          const p = v?.percent != null ? `${(v.percent * 100).toFixed(2)}%` : "—";
          return `<td>${d}</td><td>${p}</td>`;
        }
      ).join("");
      return `<tr><td class="scenario">${escapeHtml(label)}</td>${cells}</tr>`;
    })
    .join("");

  const yearHeaders = years.map((y) => `<th colspan="2">Year ${y}</th>`).join("");
  const subHeaders = years.map(() => "<th>$</th><th>%</th>").join("");

  const scenarioDriverRows = scenarioOrder
    .map((label) => {
      const ap = scenarioParamsByLabel.get(label);
      const driver = formatAppreciationDriver(ap);
      return `<tr><td class="scenario">${escapeHtml(label)}</td><td class="scenario-move">${escapeHtml(driver)}</td></tr>`;
    })
    .join("");

  const colors = [
    "rgb(136, 78, 160)",
    "rgb(237, 100, 100)",
    "rgb(100, 160, 200)",
    "rgb(80, 180, 120)",
    "rgb(220, 140, 60)",
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>HomeTap Calculator Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 24px; background: #f8f9fa; }
    h1 { color: #1a1a2e; margin-bottom: 8px; }
    .report-source { font-size: 13px; color: #4a5568; line-height: 1.4; margin: 0 0 14px 0; padding: 10px 12px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-line; }
    .report-intro { color: #4a5568; font-size: 16px; line-height: 1.5; max-width: 52rem; margin: 0 0 20px 0; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    .meta code { font-size: 12px; background: #e2e8f0; padding: 1px 6px; border-radius: 4px; }
    .summary { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px; }
    .summary-card { background: #fff; border-radius: 12px; padding: 16px 20px; min-width: 200px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .summary-card .label { font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 4px; }
    .summary-card .value { font-size: 22px; font-weight: 600; color: #1a1a2e; }
    .assumption-note { font-size: 14px; color: #4a5568; line-height: 1.5; margin-bottom: 24px; padding: 14px 18px; background: #edf2f7; border-radius: 8px; border-left: 4px solid #4299e1; }
    .assumption-note strong { color: #2d3748; }
    .assumption-note a { color: #2b6cb0; word-break: break-all; }
    section { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    section h2 { margin-top: 0; color: #2d3748; font-size: 18px; }
    .how-calc { font-size: 14px; color: #4a5568; line-height: 1.5; margin-top: 8px; padding: 12px; background: #f7fafc; border-radius: 8px; }
    .how-calc code { background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .table-wrap { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right; }
    th { background: #edf2f7; font-weight: 600; }
    td.scenario { text-align: left; font-weight: 500; }
    td.scenario-move { text-align: left; color: #2d3748; }
    th.scenario { text-align: left; }
    .chart-container { position: relative; height: 340px; margin-bottom: 16px; }
    .chart-container:last-child { margin-bottom: 0; }
  </style>
</head>
<body>
  <h1>HomeTap Calculator Report</h1>
  <pre class="report-source">Source: HomeTap public calculator
Data extracted: ${extractedDateCalendar}
Analysis date: ${ANALYSIS_PUBLISHED_DATE}</pre>
  <p class="report-intro">Report generated using the data published by HomeTap about their home equity loan.</p>
  <p class="meta">Snapshot: <code>calculator-responses.json</code> · <code>extractedAt</code>: ${extractedLabel} · Report built: ${generatedLabel} · Time period: 1–10 years · 5 appreciation scenarios</p>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Initial house value</div>
      <div class="value">\$${Number(initialHomeValue).toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="label">Investment (loan) amount</div>
      <div class="value">\$${Number(investmentAmount).toLocaleString()} <span style="font-size:14px;font-weight:400;color:#718096">(${investmentPercent}% of house value)</span></div>
    </div>
  </div>

  <section>
    <h2>Calculator market scenarios</h2>
    <p class="how-calc" style="margin-top:0;margin-bottom:14px">These match the five options in the HomeTap calculator’s market dropdown. Decline paths use a one-time <strong>total</strong> change; appreciation paths use an <strong>annual</strong> rate (compounded each year). Labels and percentages below come from this snapshot’s API fields (<code>appreciation_percent</code>).</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th class="scenario">Scenario</th><th>Stated move</th></tr>
        </thead>
        <tbody>
          ${scenarioDriverRows}
        </tbody>
      </table>
    </div>
  </section>

  <p class="assumption-note"><strong>Scenarios:</strong> Price <strong>depreciation</strong> (e.g. Large Decline, Moderate Decline) is applied as a one-time hit in the first year. Price <strong>appreciation</strong> (e.g. Moderate appreciation, High appreciation) compounds every year. This reflects how those paths are calculated, as in <a href="${HOMETAP_CALCULATOR_PAGE}" target="_blank" rel="noopener noreferrer">${HOMETAP_CALCULATOR_PAGE}</a>.</p>

  <section>
    <h2>Table: HomeTap share by scenario and year</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th rowspan="2">Scenario</th>${yearHeaders}</tr>
          <tr>${subHeaders}</tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>HomeTap share (dollars) over time</h2>
    <div class="chart-container"><canvas id="chartDollars"></canvas></div>
  </section>

  <section>
    <h2>HomeTap share (percent) over time</h2>
    <div class="chart-container"><canvas id="chartPercent"></canvas></div>
  </section>

  <section>
    <h2>Projected house value by scenario over time</h2>
    <div class="chart-container"><canvas id="chartHouseValue"></canvas></div>
  </section>

  <section>
    <h2>HomeTap IRR by scenario over time</h2>
    <p class="how-calc"><strong>How IRR is calculated:</strong> HomeTap invests \$${Number(investmentAmount).toLocaleString()} at settlement (t = 0) and receives the HomeTap share in dollars when the homeowner settles at year <em>N</em>. The annualized internal rate of return is the rate <code>r</code> such that the present value of the payoff equals the initial investment: <code>Investment = HomeTap share / (1 + r)<sup>N</sup></code>, so <code>IRR = (HomeTap share ÷ Investment)<sup>1/N</sup> − 1</code>, shown here as a percentage. Each point is the IRR if settlement occurs at that year under that appreciation scenario.</p>
    <div class="chart-container"><canvas id="chartIRR"></canvas></div>
  </section>

  <script>
    const years = ${JSON.stringify(years)};
    const scenarioOrder = ${JSON.stringify(scenarioOrder)};
    const colors = ${JSON.stringify(colors)};
    const datasetsDollars = ${JSON.stringify(chartDatasetsDollars)};
    const datasetsPercent = ${JSON.stringify(chartDatasetsPercent)};
    const datasetsHouseValue = ${JSON.stringify(chartDatasetsHouseValue)};
    const datasetsIRR = ${JSON.stringify(chartDatasetsIRR)};

    const chartOpts = (title, yLabel) => ({
      type: 'line',
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: {
            title: { display: true, text: 'Time period (years)' },
            ticks: { stepSize: 1 }
          },
          y: {
            title: { display: true, text: yLabel },
            beginAtZero: true
          }
        }
      }
    });

    new Chart(document.getElementById('chartDollars'), {
      ...chartOpts(null, 'HomeTap share ($)'),
      data: {
        labels: years.map(y => y + ' yr'),
        datasets: scenarioOrder.map((label, i) => {
          const d = datasetsDollars.find(x => x.label === label);
          return {
            label,
            data: d ? d.values : [],
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length].replace(')', ', 0.1)').replace('rgb', 'rgba'),
            fill: false,
            tension: 0.2,
            spanGaps: true
          };
        })
      }
    });

    new Chart(document.getElementById('chartPercent'), {
      ...chartOpts(null, 'HomeTap share (%)'),
      data: {
        labels: years.map(y => y + ' yr'),
        datasets: scenarioOrder.map((label, i) => {
          const d = datasetsPercent.find(x => x.label === label);
          return {
            label,
            data: d ? d.values : [],
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length].replace(')', ', 0.1)').replace('rgb', 'rgba'),
            fill: false,
            tension: 0.2,
            spanGaps: true
          };
        })
      }
    });

    new Chart(document.getElementById('chartHouseValue'), {
      ...chartOpts(null, 'Projected house value ($)'),
      data: {
        labels: years.map(y => y + ' yr'),
        datasets: scenarioOrder.map((label, i) => {
          const d = datasetsHouseValue.find(x => x.label === label);
          return {
            label,
            data: d ? d.values : [],
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length].replace(')', ', 0.1)').replace('rgb', 'rgba'),
            fill: false,
            tension: 0.2,
            spanGaps: true
          };
        })
      }
    });

    new Chart(document.getElementById('chartIRR'), {
      type: 'line',
      data: {
        labels: years.map(y => y + ' yr'),
        datasets: scenarioOrder.map((label, i) => {
          const d = datasetsIRR.find(x => x.label === label);
          return {
            label,
            data: d ? d.values : [],
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length].replace(')', ', 0.1)').replace('rgb', 'rgba'),
            fill: false,
            tension: 0.2,
            spanGaps: true
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: {
            title: { display: true, text: 'Time period (years)' },
            ticks: { stepSize: 1 }
          },
          y: {
            title: { display: true, text: 'HomeTap IRR (%)' },
            beginAtZero: false
          }
        }
      }
    });
  </script>
</body>
</html>`;

  writeFileSync(REPORT_HTML, html, "utf8");
  console.log("Wrote", REPORT_HTML);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Human-readable line like the calculator dropdown: total vs annual. */
function formatAppreciationDriver(ap) {
  if (ap == null || typeof ap.value !== "number") return "—";
  const v = ap.value;
  if (v === 0) return "0%";
  const absPct = Math.abs(v * 100);
  if (ap.annualized) {
    const sign = v > 0 ? "+" : "−";
    const rounded = Math.round(absPct * 100) / 100;
    const pctStr = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
    return `${sign}${pctStr}% annual`;
  }
  const sign = v < 0 ? "−" : "+";
  return `${sign}${absPct}% total`;
}

main();
