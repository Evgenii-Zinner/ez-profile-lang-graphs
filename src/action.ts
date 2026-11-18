import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fetchUserLanguages } from "./github.js";
import { type LayoutName, type ThemeName, renderLanguageChartSvg } from "./render.js";
import { buildLanguageHierarchy } from "./taxonomy.js";

function getInput(name: string, fallback = ""): string {
  const key = `INPUT_${name.toUpperCase()}`;
  return (process.env[key] ?? "").trim() || fallback;
}

function parseLayout(raw: string): LayoutName {
  const val = raw.toLowerCase();
  if (val === "radar" || val === "spider") return "radar";
  if (val === "bubbles") return "bubbles";
  if (val === "treemap") return "treemap";
  return "sunburst";
}

function parseTheme(raw: string): ThemeName {
  return raw.toLowerCase() === "light" ? "light" : "dark";
}

async function main(): Promise<void> {
  const username = getInput(
    "username",
    process.env.GITHUB_USERNAME?.trim() || process.env.GITHUB_REPOSITORY_OWNER?.trim() || "",
  );
  const token = getInput("token", process.env.GITHUB_TOKEN?.trim() || "");
  const layout = parseLayout(getInput("layout", "sunburst"));
  const theme = parseTheme(getInput("theme", "dark"));
  const hideBorder = getInput("hide_border", "true").toLowerCase() !== "false";
  const includePrivate = getInput("include_private", "false").toLowerCase() === "true";
  const output = getInput("output", "top-langs.svg");

  if (!username) {
    throw new Error("Missing GitHub username (set `username` input or GITHUB_REPOSITORY_OWNER).");
  }
  if (!token) {
    throw new Error("Missing GitHub token (set `token` input or GITHUB_TOKEN env var).");
  }

  const stats = await fetchUserLanguages(username, token, includePrivate);
  const tree = buildLanguageHierarchy(stats);
  const svg = renderLanguageChartSvg(tree, stats, { theme, hideBorder, layout });

  const outPath = resolve(output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, svg, "utf8");

  console.log(
    `Generated ${outPath} (username=${username}, layout=${layout}, theme=${theme}, include_private=${includePrivate}, languages=${stats.length})`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
