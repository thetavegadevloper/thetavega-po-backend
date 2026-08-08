const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function collectJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJs(full, out);
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const files = [...collectJs(path.resolve("src")), ...collectJs(path.resolve("test"))];
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    console.error(`[SYNTAX] FAIL ${path.relative(process.cwd(), file)}`);
    console.error(result.stderr || result.stdout);
  }
}

if (failed) process.exit(1);
console.log(`[SYNTAX] PASS - ${files.length} JavaScript files parsed successfully.`);
