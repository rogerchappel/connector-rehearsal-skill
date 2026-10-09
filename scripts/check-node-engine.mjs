import { readFile } from 'node:fs/promises';

const { engines } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const range = engines?.node;
const minimum = typeof range === 'string' ? range.match(/^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/) : null;
const current = process.versions.node.split('.').map(Number);
const target = minimum?.slice(1).map((part) => Number(part ?? 0));
const meetsMinimum = target && (current[0] > target[0] || (current[0] === target[0] && (current[1] > target[1] || (current[1] === target[1] && current[2] >= target[2]))));
if (!target || !meetsMinimum) {
  console.error(`Node ${process.version} does not satisfy the supported minimum in package engines.node (${range ?? 'missing'}).`);
  process.exitCode = 1;
} else {
  console.log(`Node ${process.version} satisfies package engines.node minimum ${target.join('.')}.`);
}
