import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffObjects, loadManifest, rehearse, renderApproval, type ConnectorActionManifest } from "../src/index.js";

const run = promisify(execFile);

const manifest: ConnectorActionManifest = {
  connector: "slack",
  action: "post_message",
  target: "#launch-review",
  payload: {
    text: "Release candidate is ready."
  },
  approval_required: true,
  rollback_note: "Delete the drafted message if approval is denied.",
  evidence: ["docs/RELEASE_CANDIDATE.md"]
};

test("rehearses a ready connector action", () => {
  const artifact = rehearse(manifest);
  assert.equal(artifact.ready_for_approval, true);
  assert.equal(artifact.risk_level, "medium");
  assert.equal(artifact.target[0], "#launch-review");
  assert.deepEqual(artifact.issue_summary, { error: 0, warning: 0 });
});

test("blocks secret-like payload keys", () => {
  const artifact = rehearse({
    ...manifest,
    payload: { api_key: "plain-secret" }
  });
  assert.equal(artifact.ready_for_approval, false);
  assert.equal(artifact.issues.some((issue) => issue.code === "secret_like_payload"), true);
  assert.equal(artifact.payload_preview.api_key, "[REDACTED]");
  assert.deepEqual(artifact.issue_summary, { error: 1, warning: 0 });
});

test("renders approval markdown", () => {
  const markdown = renderApproval(rehearse(manifest));
  assert.match(markdown, /Connector Approval Packet/);
  assert.match(markdown, /Ready for approval: yes/);
  assert.match(markdown, /Issue summary: 0 error, 0 warning/);
});

test("diffs before and after payloads", () => {
  const changes = diffObjects({ status: "draft", owner: "a" }, { status: "approved", owner: "a", evidence: true });
  assert.deepEqual(changes, ["added evidence: true", "changed status: \"draft\" -> \"approved\""]);
});

test("compiled CLI prints help", async () => {
  const { stdout, stderr } = await run("node", ["dist/src/cli.js", "--help"]);

  assert.match(stdout, /connector-rehearsal/);
  assert.match(stdout, /rehearse <manifest/);
  assert.equal(stderr, "");
});

test("render-approval writes ready packets and exits successfully", async () => {
  const directory = await mkdtemp(join(tmpdir(), "connector-approval-ready-"));
  const outPath = join(directory, "approval.md");
  const { stdout, stderr } = await run("node", [
    "dist/src/cli.js", "render-approval", "fixtures/slack-action.json", "--out", outPath
  ]);

  assert.equal(stdout, `Wrote ${outPath}\n`);
  assert.equal(stderr, "");
  assert.match(await readFile(outPath, "utf8"), /Ready for approval: yes/);
});

test("render-approval retains missing-rollback packets but exits unsuccessfully", async () => {
  const directory = await mkdtemp(join(tmpdir(), "connector-approval-rollback-"));
  const manifestPath = join(directory, "manifest.json");
  const outPath = join(directory, "approval.md");
  await writeFile(manifestPath, JSON.stringify({ ...manifest, rollback_note: "" }));

  await assert.rejects(
    run("node", ["dist/src/cli.js", "render-approval", manifestPath, "--out", outPath]),
    (error: Error & { code?: number; stdout?: string; stderr?: string }) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, "");
      assert.equal(error.stderr, `Wrote ${outPath}; approval blocked by 1 error.\n`);
      return true;
    }
  );
  const packet = await readFile(outPath, "utf8");
  assert.match(packet, /Ready for approval: no/);
  assert.match(packet, /Issue summary: 1 error/);
  assert.match(packet, /rollback_note is required/);
});

test("render-approval redacts secret-like payloads and exits unsuccessfully", async () => {
  const directory = await mkdtemp(join(tmpdir(), "connector-approval-secret-"));
  const manifestPath = join(directory, "manifest.json");
  const outPath = join(directory, "approval.md");
  await writeFile(manifestPath, JSON.stringify({ ...manifest, payload: { api_key: "do-not-render" } }));

  await assert.rejects(
    run("node", ["dist/src/cli.js", "render-approval", manifestPath, "--out", outPath]),
    (error: Error & { code?: number; stdout?: string; stderr?: string }) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, "");
      assert.equal(error.stderr, `Wrote ${outPath}; approval blocked by 1 error.\n`);
      return true;
    }
  );
  const packet = await readFile(outPath, "utf8");
  assert.match(packet, /\[REDACTED\]/);
  assert.doesNotMatch(packet, /do-not-render/);
  assert.match(packet, /secret-like/);
});

test("loads and rehearses valid JSON and YAML manifests", async () => {
  for (const fixture of ["fixtures/slack-action.json", "fixtures/crm-update.yaml"]) {
    const artifact = rehearse(await loadManifest(fixture));
    assert.equal(artifact.ready_for_approval, true, fixture);
    assert.notDeepEqual(artifact.payload_preview, {}, fixture);
  }
});

test("preserves nested YAML mappings, lists, objects, and quoted scalars", async () => {
  const directory = await mkdtemp(join(tmpdir(), "connector-rehearsal-yaml-"));
  const manifestPath = join(directory, "nested.yaml");
  await writeFile(manifestPath, `connector: slack
action: post_message
target: "#release-review"
payload:
  message:
    text: "hello: release team"
    attempts: 2
    urgent: false
    thread_id: null
    blocks:
      - type: section
        fields:
          - label: 'Status'
            value: ready
      - type: context
        elements:
          - text: "Review #42"
approval_required: true
rollback_note: "Delete the drafted message."
evidence:
  - "docs/release:notes.md"
`);

  const artifact = rehearse(await loadManifest(manifestPath));
  assert.deepEqual(artifact.payload_preview, {
    message: {
      text: "hello: release team",
      attempts: 2,
      urgent: false,
      thread_id: null,
      blocks: [
        { type: "section", fields: [{ label: "Status", value: "ready" }] },
        { type: "context", elements: [{ text: "Review #42" }] }
      ]
    }
  });
  assert.equal(artifact.ready_for_approval, true);
});

test("CLI rejects malformed YAML without producing a rewritten rehearsal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "connector-rehearsal-yaml-error-"));
  const manifestPath = join(directory, "malformed.yaml");
  await writeFile(manifestPath, `connector: slack
action: post_message
target: "#release-review"
payload:
  message:
    text: "unterminated
approval_required: true
rollback_note: "Delete the drafted message."
`);

  await assert.rejects(
    run("node", ["dist/src/cli.js", "rehearse", manifestPath]),
    (error: Error & { stderr?: string }) => {
      assert.match(error.stderr ?? "", /^Invalid YAML manifest:/);
      assert.doesNotMatch(error.stderr ?? "", /ready_for_approval/);
      return true;
    }
  );
});

test("rejects missing and invalid runtime manifest fields", () => {
  const invalidCases: Array<[string, unknown, RegExp]> = [
    ["connector", { ...manifest, connector: "" }, /connector must be a non-empty string/],
    ["action", { ...manifest, action: 4 }, /action must be a non-empty string/],
    ["target", { ...manifest, target: 123 }, /target must be a non-empty string or an array/],
    ["target item", { ...manifest, target: ["valid", ""] }, /target\[1\] must be a non-empty string/],
    ["payload", { ...manifest, payload: "not-an-object" }, /payload must be a non-array object/],
    ["empty payload", { ...manifest, payload: {} }, /payload must contain at least one field/],
    ["approval", { ...manifest, approval_required: "yes" }, /approval_required must be a boolean/],
    ["risk", { ...manifest, risk_level: "critical" }, /risk_level must be one of: low, medium, high/],
    ["evidence", { ...manifest, evidence: "proof" }, /evidence must be an array of strings/],
    ["evidence item", { ...manifest, evidence: ["proof", 2] }, /evidence\[1\] must be a string/]
  ];

  for (const [name, value, expected] of invalidCases) {
    assert.throws(() => rehearse(value as ConnectorActionManifest), expected, name);
  }
});

test("CLI reports actionable validation errors without writing approval artifacts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "connector-rehearsal-test-"));
  const manifestPath = join(directory, "invalid.json");
  const outDir = join(directory, "artifacts");
  await writeFile(manifestPath, JSON.stringify({
    connector: "crm",
    action: "update_contact",
    target: 123,
    payload: "not-an-object",
    rollback_note: "Restore the before snapshot."
  }));

  await assert.rejects(
    run("node", ["dist/src/cli.js", "rehearse", manifestPath]),
    (error: Error & { stderr?: string }) => {
      assert.match(error.stderr ?? "", /^Invalid manifest: target must be a non-empty string or an array of non-empty strings\.\n$/);
      assert.doesNotMatch(error.stderr ?? "", /TypeError|toLowerCase/);
      return true;
    }
  );
  await assert.rejects(
    run("node", ["dist/src/cli.js", "plan", manifestPath, "--out", outDir]),
    /Command failed/
  );
  await assert.rejects(
    import("node:fs/promises").then(({ access }) => access(join(outDir, "rehearsal.json")))
  );
});
