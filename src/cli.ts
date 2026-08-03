#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { diffFiles, loadManifest, plan, rehearse, renderApproval } from "./index.js";

interface Options {
  out?: string;
  format?: "json" | "markdown";
}

type Command = "plan" | "rehearse" | "render-approval" | "diff";

interface CommandSpec {
  positionals: number;
  options: ReadonlySet<keyof Options>;
}

const commandSpecs: Record<Command, CommandSpec> = {
  plan: { positionals: 1, options: new Set(["out"]) },
  rehearse: { positionals: 1, options: new Set(["out", "format"]) },
  "render-approval": { positionals: 1, options: new Set(["out"]) },
  diff: { positionals: 2, options: new Set(["out"]) }
};

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help") {
    printHelp();
    return 0;
  }
  if (!(command in commandSpecs)) throw new Error(`Unknown command '${command}'.`);

  const typedCommand = command as Command;
  const { positionals, options } = parseArgs(typedCommand, rest);

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
    const artifact = rehearse(manifest);
    const errorCount = artifact.issue_summary.error;
    await writeOrPrint(renderApproval(artifact), options.out, errorCount === 0);
    if (options.out && errorCount > 0) {
      console.error(`Wrote ${options.out}; approval blocked by ${errorCount} ${errorCount === 1 ? "error" : "errors"}.`);
    }
    return errorCount > 0 ? 1 : 0;
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

function parseArgs(command: Command, args: string[]): { positionals: string[]; options: Options } {
  const positionals: string[] = [];
  const options: Options = {};
  const seen = new Set<keyof Options>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out" || arg === "--format") {
      const option = arg.slice(2) as keyof Options;
      if (!commandSpecs[command].options.has(option)) {
        throw new Error(`${arg} is not supported by '${command}'.`);
      }
      if (seen.has(option)) throw new Error(`${arg} may only be specified once.`);
      seen.add(option);
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      if (option === "out") {
        options.out = value;
        continue;
      }
      const format = value;
      if (format !== "json" && format !== "markdown") throw new Error("--format must be json or markdown.");
      options.format = format;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown option '${arg}' for '${command}'.`);
    positionals.push(arg);
  }
  const expected = commandSpecs[command].positionals;
  if (positionals.length > expected) {
    throw new Error(`'${command}' received ${positionals.length - expected} unexpected positional argument${positionals.length - expected === 1 ? "" : "s"}.`);
  }
  return { positionals, options };
}

async function writeOrPrint(output: string, out?: string, announce = true): Promise<void> {
  if (!out) {
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
    return;
  }
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, output.endsWith("\n") ? output : `${output}\n`, "utf8");
  if (announce) console.log(`Wrote ${out}`);
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function printHelp(): void {
  console.log(`connector-rehearsal

Usage:
  connector-rehearsal plan <manifest.json|yaml|yml> --out tmp/rehearsal
  connector-rehearsal rehearse <manifest.json|yaml|yml> --format markdown
  connector-rehearsal render-approval <manifest.json|yaml|yml> --out approval.md
  connector-rehearsal diff <before.json> <after.json>
`);
}

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
