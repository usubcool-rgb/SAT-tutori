import path from "node:path";

export function resolveDataDir(): string {
  if (process.env["DATA_DIR"]) {
    return path.resolve(process.env["DATA_DIR"]);
  }
  const cwd = process.cwd();
  const workspaceRoot = cwd.endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(cwd, "../..")
    : cwd;
  return path.resolve(workspaceRoot, "artifacts/api-server/data");
}
