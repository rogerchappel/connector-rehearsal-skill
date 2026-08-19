import { execFileSync } from "node:child_process";

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8"
});
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));

const required = [
  "dist/src/cli.js",
  "dist/src/index.js",
  "fixtures/slack-action.json",
  "docs/PRD.md",
  "SKILL.md",
  "README.md",
  "LICENSE",
  "SECURITY.md"
];

const missing = required.filter((file) => !files.has(file));
if (missing.length) {
  console.error(`Package smoke failed; missing files:\n${missing.join("\n")}`);
  process.exit(1);
}

const packagedTests = [...files].filter((file) => file.startsWith("dist/test/"));
if (packagedTests.length) {
  console.error(`Package smoke failed; compiled test artifacts were included:\n${packagedTests.join("\n")}`);
  process.exit(1);
}

console.log(`package smoke ok: ${pack.filename} includes ${pack.files.length} files`);
