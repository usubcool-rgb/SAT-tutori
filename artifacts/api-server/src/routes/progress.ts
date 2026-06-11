import { Router } from "express";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { GetProgressQueryParams, SaveProgressBody, ResetProgressQueryParams } from "@workspace/api-zod";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");

function getProgressFile(subject: string): string {
  return path.join(dataDir, `sat_${subject}_progress.json`);
}

function loadProgress(subject: string): unknown[] {
  try {
    const filePath = getProgressFile(subject);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

function saveProgressFile(subject: string, data: unknown[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(getProgressFile(subject), JSON.stringify(data, null, 2));
}

router.get("/progress", (req, res) => {
  const parseResult = GetProgressQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }
  const progress = loadProgress(parseResult.data.subject);
  res.json(progress);
});

router.post("/progress", (req, res) => {
  const parseResult = SaveProgressBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const entry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...parseResult.data,
  };

  const progress = loadProgress(parseResult.data.subject);
  progress.push(entry);
  saveProgressFile(parseResult.data.subject, progress);

  res.status(201).json(entry);
});

router.delete("/progress", (req, res) => {
  const parseResult = ResetProgressQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }
  saveProgressFile(parseResult.data.subject, []);
  res.json({ status: "ok" });
});

export default router;
