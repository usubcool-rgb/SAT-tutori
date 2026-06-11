import { Router } from "express";
import path from "path";
import fs from "fs";
import { GetQuestionsQueryParams } from "@workspace/api-zod";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");
const dbFilePath = path.join(dataDir, "sat_database.json");

interface Question {
  id?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  passage?: string;
  question: string;
  options: string[];
  correct: string;
  explanation?: string;
}

function loadDatabase(): Question[] {
  try {
    if (!fs.existsSync(dbFilePath)) return [];
    const raw = fs.readFileSync(dbFilePath, "utf-8");
    return JSON.parse(raw) as Question[];
  } catch {
    return [];
  }
}

router.get("/questions", (req, res) => {
  const parseResult = GetQuestionsQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { subject, difficulty, count = 10, masteredIds } = parseResult.data;
  const masteredSet = new Set(
    masteredIds ? masteredIds.split(",").filter(Boolean) : []
  );

  const db = loadDatabase();
  let candidates = db.filter(
    (q) => q.subject?.toLowerCase() === subject.toLowerCase()
  );

  if (difficulty) {
    const byDifficulty = candidates.filter(
      (q) =>
        q.difficulty?.toLowerCase() === difficulty.toLowerCase()
    );
    if (byDifficulty.length >= count) {
      candidates = byDifficulty;
    }
  }

  // Prefer non-mastered
  let available = candidates.filter((q) => !masteredSet.has(q.id ?? ""));
  if (available.length < count) {
    const mastered = candidates.filter((q) => masteredSet.has(q.id ?? ""));
    available = [...available, ...mastered];
  }

  // Shuffle and take count
  const shuffled = available.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  res.json(selected);
});

router.get("/db-status", (_req, res) => {
  const db = loadDatabase();
  const loaded = db.length > 0;
  const englishCount = db.filter(
    (q) => q.subject?.toLowerCase() === "english"
  ).length;
  const mathCount = db.filter(
    (q) => q.subject?.toLowerCase() === "math"
  ).length;

  res.json({
    loaded,
    englishCount,
    mathCount,
    message: loaded
      ? null
      : `Database not found. Place sat_database.json in: ${dataDir}`,
  });
});

export default router;
