// Allure 3 report settings. History is kept in reports/allure-history.jsonl (committed by the
// nightly run), so the report shows pass-rate and duration trends across runs.
import { defineConfig } from "allure";

export default defineConfig({
  name: "Arya Bank NetBanking — UI tests",
  output: "./allure-report",
  historyPath: "./reports/allure-history.jsonl",
  historyLimit: 30,
  plugins: {
    awesome: {
      options: {
        reportLanguage: "en",
        groupBy: ["epic", "feature", "story"],
      },
    },
  },
});
