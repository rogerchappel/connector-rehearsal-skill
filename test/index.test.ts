import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { diffObjects, rehearse, renderApproval, type ConnectorActionManifest } from "../src/index.js";

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
