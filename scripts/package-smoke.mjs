import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const packDirectory = mkdtempSync(join(tmpdir(), "connector-rehearsal-pack-"));

rmSync(dist, { recursive: true, force: true });

try {
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
    throw new Error(`Package smoke failed; missing files:\n${missing.join("\n")}`);
  }

  const packagedTests = [...files].filter((file) => file.startsWith("dist/test/"));
  if (packagedTests.length) {
    throw new Error(`Package smoke failed; compiled test artifacts were included:\n${packagedTests.join("\n")}`);
  }

  rmSync(dist, { recursive: true, force: true });
  const packedOutput = execFileSync("npm", ["pack", "--json", "--pack-destination", packDirectory], {
    encoding: "utf8"
  });
  const [packed] = JSON.parse(packedOutput);
  const archive = join(packDirectory, packed.filename);
  execFileSync("tar", ["-xzf", archive, "-C", packDirectory]);

  const packageJson = JSON.parse(readFileSync(join(packDirectory, "package", "package.json"), "utf8"));
  const binTarget = packageJson.bin?.["connector-rehearsal"];
  if (typeof binTarget !== "string") {
    throw new Error("Package smoke failed; connector-rehearsal bin is not declared");
  }
  execFileSync("npm", ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: join(packDirectory, "package"),
    stdio: "pipe"
  });
  execFileSync(process.execPath, [join(packDirectory, "package", binTarget), "--help"], {
    stdio: "pipe"
  });

  console.log(`package smoke ok: ${pack.filename} includes ${pack.files.length} files and its bin prints help`);
} finally {
  rmSync(packDirectory, { recursive: true, force: true });
}
