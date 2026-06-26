import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export type RiskLevel = "low" | "medium" | "high";

export interface ConnectorActionManifest {
  connector: string;
  action: string;
  target: string | string[];
  payload: Record<string, unknown>;
  approval_required?: boolean;
  risk_level?: RiskLevel;
  rollback_note?: string;
  evidence?: string[];
}

export interface RehearsalIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface RehearsalArtifact {
  connector: string;
  action: string;
  target: string[];
  payload_preview: Record<string, unknown>;
  approval_required: boolean;
  risk_level: RiskLevel;
  rollback_note: string;
  evidence: string[];
  issues: RehearsalIssue[];
  issue_summary: {
    error: number;
    warning: number;
  };
  ready_for_approval: boolean;
}

export async function loadManifest(path: string): Promise<ConnectorActionManifest> {
  const raw = await readFile(path, "utf8");
  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    return parseSimpleYaml(raw) as unknown as ConnectorActionManifest;
  }
  return JSON.parse(raw) as ConnectorActionManifest;
}

export function rehearse(manifest: ConnectorActionManifest): RehearsalArtifact {
  const target = normalizeTarget(manifest.target);
  const approvalRequired = manifest.approval_required ?? true;
  const riskLevel = manifest.risk_level ?? inferRisk(manifest, target);
  const rollbackNote = manifest.rollback_note ?? "";
  const evidence = manifest.evidence ?? [];
  const issues: RehearsalIssue[] = [];

  if (!manifest.connector) issues.push(error("missing_connector", "connector is required."));
  if (!manifest.action) issues.push(error("missing_action", "action is required."));
  if (target.length === 0) issues.push(error("missing_target", "target is required."));
  if (!approvalRequired) issues.push(warn("approval_not_required", "approval_required is false; confirm this is intentional."));
  if (!rollbackNote.trim()) issues.push(error("missing_rollback", "rollback_note is required before external writes."));
  if (evidence.length === 0) issues.push(warn("missing_evidence", "Add evidence links or local artifact paths for reviewers."));
  if (target.some(isBroadTarget)) issues.push(warn("broad_target", "Target looks broad; narrow it or require explicit approval."));

  for (const key of Object.keys(flatten(manifest.payload ?? {}))) {
    if (looksSecret(key)) {
      issues.push(error("secret_like_payload", `Payload key '${key}' looks secret-like and should not be rehearsed in plaintext.`));
    }
  }

  const hasErrors = issues.some((issue) => issue.level === "error");
  return {
    connector: manifest.connector,
    action: manifest.action,
    target,
    payload_preview: redactPayload(manifest.payload ?? {}),
    approval_required: approvalRequired,
    risk_level: riskLevel,
    rollback_note: rollbackNote,
    evidence,
    issues,
    issue_summary: summarizeIssues(issues),
    ready_for_approval: !hasErrors && approvalRequired
  };
}

export async function plan(manifestPath: string, outDir: string): Promise<RehearsalArtifact> {
  const manifest = await loadManifest(manifestPath);
  const artifact = rehearse(manifest);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "rehearsal.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await writeFile(join(outDir, "approval.md"), renderApproval(artifact), "utf8");
  return artifact;
}

export function renderApproval(artifact: RehearsalArtifact): string {
  const issueLines = artifact.issues.length === 0
    ? ["No issues detected."]
    : artifact.issues.map((issue) => `- ${issue.level.toUpperCase()} ${issue.code}: ${issue.message}`);
  return [
    `# Connector Approval Packet: ${artifact.connector}/${artifact.action}`,
    "",
    `Ready for approval: ${artifact.ready_for_approval ? "yes" : "no"}`,
    `Risk level: ${artifact.risk_level}`,
    `Approval required: ${artifact.approval_required ? "yes" : "no"}`,
    `Issue summary: ${artifact.issue_summary.error} error, ${artifact.issue_summary.warning} warning`,
    "",
    "## Targets",
    "",
    ...artifact.target.map((target) => `- ${target}`),
    "",
    "## Payload Preview",
    "",
    "```json",
    JSON.stringify(artifact.payload_preview, null, 2),
    "```",
    "",
    "## Rollback",
    "",
    artifact.rollback_note || "Missing rollback note.",
    "",
    "## Evidence",
    "",
    ...(artifact.evidence.length === 0 ? ["No evidence supplied."] : artifact.evidence.map((item) => `- ${item}`)),
    "",
    "## Issues",
    "",
    ...issueLines
  ].join("\n");
}

export function diffObjects(before: unknown, after: unknown): string[] {
  const beforeFlat = flatten(before);
  const afterFlat = flatten(after);
  const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).sort();
  const changes: string[] = [];
  for (const key of keys) {
    if (!(key in beforeFlat)) {
      changes.push(`added ${key}: ${JSON.stringify(afterFlat[key])}`);
    } else if (!(key in afterFlat)) {
      changes.push(`removed ${key}: ${JSON.stringify(beforeFlat[key])}`);
    } else if (JSON.stringify(beforeFlat[key]) !== JSON.stringify(afterFlat[key])) {
      changes.push(`changed ${key}: ${JSON.stringify(beforeFlat[key])} -> ${JSON.stringify(afterFlat[key])}`);
    }
  }
  return changes;
}

export async function diffFiles(beforePath: string, afterPath: string): Promise<string[]> {
  const before = JSON.parse(await readFile(beforePath, "utf8"));
  const after = JSON.parse(await readFile(afterPath, "utf8"));
  return diffObjects(before, after);
}

function normalizeTarget(target: string | string[] | undefined): string[] {
  if (!target) return [];
  return Array.isArray(target) ? target : [target];
}

function inferRisk(manifest: ConnectorActionManifest, target: string[]): RiskLevel {
  const action = manifest.action?.toLowerCase() ?? "";
  if (target.some(isBroadTarget) || /delete|remove|bulk|invite/.test(action)) return "high";
  if (/update|send|create|post/.test(action)) return "medium";
  return "low";
}

function isBroadTarget(target: string): boolean {
  return ["*", "all", "everyone", "workspace", "org", "organization"].some((term) => target.toLowerCase().includes(term));
}

function looksSecret(key: string): boolean {
  return /token|secret|password|api[_-]?key|credential/i.test(key);
}

function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (looksSecret(key)) {
      result[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactPayload(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function flatten(value: unknown, prefix = ""): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return prefix ? { [prefix]: value } : {};
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      Object.assign(result, flatten(child, path));
    } else {
      result[path] = child;
    }
  }
  return result;
}

function parseSimpleYaml(raw: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let currentKey: string | undefined;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentKey) {
      const current = root[currentKey];
      if (!Array.isArray(current)) root[currentKey] = [];
      (root[currentKey] as unknown[]).push(coerceScalar(listMatch[1]));
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    currentKey = pair[1];
    root[currentKey] = pair[2] ? coerceScalar(pair[2]) : [];
  }
  return root;
}

function coerceScalar(value: string): unknown {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}

function error(code: string, message: string): RehearsalIssue {
  return { level: "error", code, message };
}

function warn(code: string, message: string): RehearsalIssue {
  return { level: "warning", code, message };
}

function summarizeIssues(issues: RehearsalIssue[]): { error: number; warning: number } {
  return {
    error: issues.filter((issue) => issue.level === "error").length,
    warning: issues.filter((issue) => issue.level === "warning").length
  };
}
