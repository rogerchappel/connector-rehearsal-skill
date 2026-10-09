import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function checkRange(range) {
  const source = `const range = ${JSON.stringify(range)};\nconst minimum = typeof range === 'string' ? range.match(/^>=\\s*(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?$/) : null;\nconst current = process.versions.node.split('.').map(Number);\nconst target = minimum?.slice(1).map((part) => Number(part ?? 0));\nconst meetsMinimum = target && (current[0] > target[0] || (current[0] === target[0] && (current[1] > target[1] || (current[1] === target[1] && current[2] >= target[2]))));\nif (!target || !meetsMinimum) process.exitCode = 1;`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8' });
}

test('engine check accepts the declared minimum and later compatible releases', () => {
  assert.equal(checkRange('>=20').status, 0);
  assert.equal(checkRange('>=20.5.1').status, 0);
});

test('engine check rejects unsupported syntax and higher minimums', () => {
  assert.equal(checkRange('>=27').status, 1);
  assert.equal(checkRange('^20').status, 1);
});
