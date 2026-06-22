#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { diffFiles, loadManifest, plan, rehearse, renderApproval } from "./index.js";

interface Options {
  out?: string;
  format?: "json" | "markdown";
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { positionals, options } = parseArgs(rest);
  if (!command || command === "help" || command === "--help") {
    printHelp();
    return 0;
  }

  if (command === "plan") {
    const manifest = required(positionals[0], "plan requires a manifest path.");
    const out = options.out ?? "tmp/rehearsal";
    const artifact = await plan(manifest, out);
    console.log(`Wrote rehearsal artifacts to ${out}. Ready: ${artifact.ready_for_approval ? "yes" : "no"}`);
    return artifact.issues.some((issue) => issue.level === "error") ? 1 : 0;
  }

  if (command === "rehearse") {
    const manifest = await loadManifest(required(positionals[0], "rehearse requires a manifest path."));
    const artifact = rehearse(manifest);
    const output = (options.format ?? "json") === "markdown"
      ? renderApproval(artifact)
      : `${JSON.stringify(artifact, null, 2)}\n`;
    await writeOrPrint(output, options.out);
    return artifact.issues.some((issue) => issue.level === "error") ? 1 : 0;
  }

  if (command === "render-approval") {
    const manifest = await loadManifest(required(positionals[0], "render-approval requires a manifest path."));
    await writeOrPrint(renderApproval(rehearse(manifest)), options.out);
    return 0;
  }

  if (command === "diff") {
    const before = required(positionals[0], "diff requires before and after JSON files.");
    const after = required(positionals[1], "diff requires before and after JSON files.");
    const changes = await diffFiles(before, after);
    const output = changes.length === 0 ? "No changes.\n" : `${changes.join("\n")}\n`;
    await writeOrPrint(output, options.out);
    return 0;
  }

  throw new Error(`Unknown command '${command}'.`);
}

function parseArgs(args: string[]): { positionals: string[]; options: Options } {
  const positionals: string[] = [];
  const options: Options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out") {
      options.out = required(args[++i], "--out requires a path.");
    } else if (arg === "--format") {
      const format = required(args[++i], "--format requires json or markdown.");
      if (format !== "json" && format !== "markdown") throw new Error("--format must be json or markdown.");
      options.format = format;
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

async function writeOrPrint(output: string, out?: string): Promise<void> {
  if (!out) {
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
    return;
  }
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, output.endsWith("\n") ? output : `${output}\n`, "utf8");
  console.log(`Wrote ${out}`);
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function printHelp(): void {
  console.log(`connector-rehearsal

Usage:
  connector-rehearsal plan <manifest.json|yaml> --out tmp/rehearsal
  connector-rehearsal rehearse <manifest.json|yaml> --format markdown
  connector-rehearsal render-approval <manifest.json|yaml> --out approval.md
  connector-rehearsal diff <before.json> <after.json>
`);
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
