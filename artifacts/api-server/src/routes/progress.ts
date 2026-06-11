import { Router } from "express";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { GetProgressQueryParams, SaveProgressBody, ResetProgressQueryParams } from "@workspace/api-zod";
import { resolveDataDir } from "../lib/data-dir";

const router = Router();

function getDataDir() {
  return resolveDataDir();
}

function getProgressFile(subject: string): string {
  return path.join(getDataDir(), `sat_${subject}_progress.json`);
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
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
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

  const entry = { ...parseResult.data, id: randomUUID(), timestamp: new Date().toISOString() };
  const existing = loadProgress(entry.subject) as unknown[];
  existing.push(entry);
  saveProgressFile(entry.subject, existing);
  res.status(201).json(entry);
});

router.delete("/progress", (req, res) => {
  const parseResult = ResetProgressQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }
  saveProgressFile(parseResult.data.subject, []);
  res.json({ ok: true });
});

export default router;
