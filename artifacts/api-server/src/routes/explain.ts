import { Router } from "express";
import Groq from "groq-sdk";
import { GetExplanationBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

router.post("/explain", async (req, res) => {
  const parseResult = GetExplanationBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { question, passage, options, correct, userAnswer, subject } = parseResult.data;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      text: "AI explanations are not available — GROQ_API_KEY is not configured. Please add it in the Secrets tab.",
    });
    return;
  }

  try {
    const groq = new Groq({ apiKey });

    const optionsList = options
      .map((opt, i) => `${["A", "B", "C", "D"][i]}) ${opt}`)
      .join("\n");

    const passageSection = passage
      ? `\nPassage:\n${passage}\n`
      : "";

    const prompt = `You are an expert SAT tutor. A student just answered a ${subject} question. Provide a concise, encouraging explanation (3–4 sentences max).
${passageSection}
Question: ${question}
Options:
${optionsList}
Correct answer: ${correct}
Student's answer: ${userAnswer}

${userAnswer === correct ? "The student got it right! Reinforce why this answer is correct." : "Explain clearly why the correct answer is right and gently address the student's mistake."}${subject === "math" ? " Use LaTeX notation where appropriate (e.g. $x^2 + 2x + 1$) for mathematical expressions." : ""}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 300,
    });

    const text = completion.choices[0]?.message?.content ?? "No explanation available.";
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "Groq API error");
    res.status(500).json({ text: "Could not generate explanation at this time." });
  }
});

export default router;
