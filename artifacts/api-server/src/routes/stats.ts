import { Router } from "express";
import path from "path";
import fs from "fs";
import { GetStatsQueryParams } from "@workspace/api-zod";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");

interface ProgressEntry {
  topic?: string;
  isCorrect?: boolean;
}

function loadProgress(subject: string): ProgressEntry[] {
  try {
    const filePath = path.join(dataDir, `sat_${subject}_progress.json`);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ProgressEntry[];
  } catch {
    return [];
  }
}

router.get("/stats", (req, res) => {
  const parseResult = GetStatsQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const progress = loadProgress(parseResult.data.subject);

  const topicMap: Record<string, { correct: number; incorrect: number }> = {};

  for (const entry of progress) {
    const topic = entry.topic ?? "Unknown";
    if (!topicMap[topic]) {
      topicMap[topic] = { correct: 0, incorrect: 0 };
    }
    if (entry.isCorrect) {
      topicMap[topic].correct++;
    } else {
      topicMap[topic].incorrect++;
    }
  }

  const stats = Object.entries(topicMap).map(([topic, data]) => ({
    topic,
    correct: data.correct,
    incorrect: data.incorrect,
    total: data.correct + data.incorrect,
    accuracy:
      data.correct + data.incorrect > 0
        ? Math.round((data.correct / (data.correct + data.incorrect)) * 100) / 100
        : 0,
  }));

  stats.sort((a, b) => a.accuracy - b.accuracy);

  res.json(stats);
});

export default router;
