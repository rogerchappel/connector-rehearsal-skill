import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(await readFile(new URL("../../schemas/connector-action-manifest.schema.json", import.meta.url), "utf8"));
const validate = new (Ajv2020 as unknown as typeof import("ajv").default)({ allErrors: true, strict: true }).compile(schema);

for (const [name, filename, expected] of [
  ["accepts a valid manifest fixture", "valid.json", true],
  ["rejects a manifest missing payload", "invalid-missing-payload.json", false],
  ["rejects an unsupported risk level", "invalid-risk.json", false]
] as const) {
  test(name, async () => {
    const fixture = JSON.parse(await readFile(new URL(`../../test/fixtures/manifests/${filename}`, import.meta.url), "utf8"));
    assert.equal(validate(fixture), expected, JSON.stringify(validate.errors));
  });
}
