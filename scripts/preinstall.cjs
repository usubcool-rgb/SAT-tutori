const fs = require("fs");
const agent = process.env.npm_config_user_agent || "";

for (const f of ["package-lock.json", "yarn.lock"]) {
  try { fs.rmSync(f); } catch {}
}

if (!agent.startsWith("pnpm/")) {
  process.stderr.write("Use pnpm instead of npm/yarn.\n");
  process.exit(1);
}
