/**
 * Manual capture: open the calculator, capture every calculator API response
 * while you change length and appreciation in the UI. Press Enter in the
 * terminal when done to save.
 *
 * Run: node extract-calculator-manual.js
 */

import puppeteer from "puppeteer";
import { writeFileSync } from "fs";
import { createInterface } from "readline";

const CALCULATOR_URL =
  "https://www.hometap.com/how-it-works?home_value=500000#how-it-works-calculator";
const OUTPUT_FILE = "calculator-responses.json";

function isCalculatorResponse(body) {
  if (!body || typeof body !== "string") return false;
  try {
    const json = JSON.parse(body);
    return Array.isArray(json.scenarios) && json.scenarios.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  const collected = [];
  let id = 0;

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  page.on("response", async (response) => {
    try {
      const ct = response.headers()["content-type"] || "";
      if (!ct.includes("json")) return;
      const body = await response.text();
      if (!isCalculatorResponse(body)) return;
      const json = JSON.parse(body);
      const request = response.request();
      id += 1;
      collected.push({
        _id: id,
        _url: response.url(),
        _method: request.method(),
        _postData: request.postData() || undefined,
        _timestamp: new Date().toISOString(),
        ...json,
      });
      console.log(`Captured response #${id} (${collected.length} total)`);
    } catch (e) {
      // ignore
    }
  });

  console.log("Opening calculator. Change 'length of investment' and 'appreciation scenario' in the browser.");
  console.log("When you have clicked through all combinations, press Enter here to save and exit.\n");

  await page.goto(CALCULATOR_URL, { waitUntil: "networkidle2", timeout: 30000 });

  await new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Press Enter to save and close... ", () => {
      rl.close();
      resolve();
    });
  });

  await browser.close();

  const output = {
    extractedAt: new Date().toISOString(),
    sourceUrl: CALCULATOR_URL,
    totalResponses: collected.length,
    responses: collected,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`\nSaved ${collected.length} response(s) to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
