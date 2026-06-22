import test from "node:test";
import assert from "node:assert/strict";
import { diffObjects, rehearse, renderApproval, type ConnectorActionManifest } from "../src/index.js";

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
});

test("blocks secret-like payload keys", () => {
  const artifact = rehearse({
    ...manifest,
    payload: { api_key: "plain-secret" }
  });
  assert.equal(artifact.ready_for_approval, false);
  assert.equal(artifact.issues.some((issue) => issue.code === "secret_like_payload"), true);
  assert.equal(artifact.payload_preview.api_key, "[REDACTED]");
});

test("renders approval markdown", () => {
  const markdown = renderApproval(rehearse(manifest));
  assert.match(markdown, /Connector Approval Packet/);
  assert.match(markdown, /Ready for approval: yes/);
});

test("diffs before and after payloads", () => {
  const changes = diffObjects({ status: "draft", owner: "a" }, { status: "approved", owner: "a", evidence: true });
  assert.deepEqual(changes, ["added evidence: true", "changed status: \"draft\" -> \"approved\""]);
});
