/**
 * Hometap Calculator Response Extractor
 *
 * Opens the how-it-works calculator, intercepts the calculator API responses,
 * and iterates through all combinations of investment length and appreciation
 * scenario, saving each response to a JSON file.
 *
 * Run: npm run extract
 * Run with visible browser: npm run extract:headed
 */

import puppeteer from "puppeteer";
import { writeFileSync } from "fs";

const CALCULATOR_URL =
  "https://www.hometap.com/how-it-works?home_value=500000#how-it-works-calculator";
const OUTPUT_FILE = "calculator-responses.json";
const HEADED = process.env.HEADED === "1";

/** Match response that looks like the calculator API (JSON with "scenarios" array) */
function isCalculatorResponse(url, body) {
  if (!body || typeof body !== "string") return false;
  try {
    const json = JSON.parse(body);
    return Array.isArray(json.scenarios) && json.scenarios.length > 0;
  } catch {
    return false;
  }
}

/** Collect options from a <select> or from buttons/divs that act as options */
async function getSelectOptions(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    if (el.tagName === "SELECT") {
      return Array.from(el.options).map((o) => ({
        value: o.value,
        label: o.textContent?.trim() || o.value,
      }));
    }
    return null;
  }, selector);
}

/** Click an option in a custom dropdown (e.g. by label text) */
async function selectByLabel(page, containerSelector, label) {
  return page.evaluate(
    ({ container, text }) => {
      const containerEl = document.querySelector(container);
      if (!containerEl) return false;
      const options = containerEl.querySelectorAll("[role=option], [data-value], button, li, [class*='option']");
      for (const opt of options) {
        if (opt.textContent?.trim().toLowerCase().includes(text.toLowerCase())) {
          opt.click();
          return true;
        }
      }
      return false;
    },
    { container: containerSelector, text: label }
  );
}

/** Select by value in a native <select> */
async function selectValue(page, selectSelector, value) {
  return page.select(selectSelector, value);
}

async function main() {
  const collected = [];
  let lastResponseId = 0;

  const browser = await puppeteer.launch({
    headless: !HEADED,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Capture calculator API responses (any XHR/fetch that returns JSON with "scenarios")
  const captureResponse = async (response) => {
    const request = response.request();
    const url = response.url();
    try {
      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("json")) return;
      const body = await response.text();
      if (!isCalculatorResponse(url, body)) return;
      const json = JSON.parse(body);
      lastResponseId += 1;
      const method = request.method();
      const postData = request.postData();
      collected.push({
        _id: lastResponseId,
        _url: url,
        _method: method,
        _postData: postData || undefined,
        _timestamp: new Date().toISOString(),
        ...json,
      });
    } catch (e) {
      // ignore
    }
  };

  await page.setRequestInterception(true);
  page.on("request", (req) => req.continue().catch(() => {}));
  page.on("response", (response) => captureResponse(response).catch(() => {}));

  console.log("Loading calculator page...");
  await page.goto(CALCULATOR_URL, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  // Scroll to calculator so any lazy UI is rendered
  await page.evaluate(() => {
    const el = document.querySelector("#how-it-works-calculator") || document.querySelector("[id*='calculator']");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Possible selectors for investment length and appreciation (adjust if DOM differs)
  const selectors = {
    lengthSelect: "select[name*='period'], select[name*='term'], select[name*='year'], select[id*='period'], select[id*='term']",
    appreciationSelect: "select[name*='appreciation'], select[name*='scenario'], select[id*='appreciation'], select[id*='scenario']",
    lengthContainer: "[data-testid*='period'], [data-testid*='term'], [aria-label*='investment'], [class*='period'], [class*='term']",
    appreciationContainer: "[data-testid*='appreciation'], [data-testid*='scenario'], [aria-label*='appreciation'], [class*='appreciation'], [class*='scenario']",
  };

  const lengthOptions = await getSelectOptions(page, selectors.lengthSelect);
  const appreciationOptions = await getSelectOptions(page, selectors.appreciationSelect);

  let lengthLabels = [];
  let appreciationLabels = [];

  if (lengthOptions && lengthOptions.length > 0) {
    lengthLabels = lengthOptions.map((o) => o.label || o.value);
    console.log("Investment length options (select):", lengthLabels);
  } else {
    // Try to find clickable length options (e.g. "5 years", "7 years", "10 years")
    lengthLabels = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const yearMatches = text.match(/\d+\s*year[s]?/gi);
      return yearMatches ? [...new Set(yearMatches)].slice(0, 10) : [];
    });
    if (lengthLabels.length) console.log("Investment length options (from page):", lengthLabels);
  }

  if (appreciationOptions && appreciationOptions.length > 0) {
    appreciationLabels = appreciationOptions.map((o) => o.label || o.value);
    console.log("Appreciation scenario options (select):", appreciationLabels);
  } else {
    appreciationLabels = await page.evaluate(() => {
      const candidates = ["Low", "Moderate", "High", "Conservative", "Optimistic", "appreciation"];
      const found = [];
      document.querySelectorAll("button, [role=button], [class*='scenario'], [class*='appreciation']").forEach((el) => {
        const t = (el.textContent || "").trim();
        if (t && candidates.some((c) => t.toLowerCase().includes(c.toLowerCase()))) found.push(t);
      });
      return [...new Set(found)];
    });
    if (appreciationLabels.length) console.log("Appreciation scenario options (from page):", appreciationLabels);
  }

  const hasLengthControl = lengthOptions?.length > 0 || lengthLabels.length > 0;
  const hasAppreciationControl = appreciationOptions?.length > 0 || appreciationLabels.length > 0;

  if (hasLengthControl && hasAppreciationControl) {
    for (const lengthLabel of lengthLabels) {
      if (lengthOptions?.length) {
        const opt = lengthOptions.find((o) => (o.label || o.value) === lengthLabel);
        if (opt) await selectValue(page, selectors.lengthSelect, opt.value);
      } else {
        await selectByLabel(page, selectors.lengthContainer, lengthLabel);
      }
      await new Promise((r) => setTimeout(r, 500));

      for (const appreciationLabel of appreciationLabels) {
        if (appreciationOptions?.length) {
          const opt = appreciationOptions.find((o) => (o.label || o.value) === appreciationLabel);
          if (opt) await selectValue(page, selectors.appreciationSelect, opt.value);
        } else {
          await selectByLabel(page, selectors.appreciationContainer, appreciationLabel);
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  } else {
    console.log("Could not find both length and appreciation controls. Captured initial calculator response(s) only.");
  }

  // Ensure we have at least the initial load response
  if (collected.length === 0) {
    console.log("No calculator response captured yet. Waiting a bit for initial load...");
    await new Promise((r) => setTimeout(r, 3000));
  }

  await browser.close();

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
