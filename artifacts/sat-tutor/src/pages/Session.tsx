import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, CheckCircle, XCircle, Loader2, BookOpen, Calculator } from "lucide-react";
import {
  useGetQuestions,
  getGetQuestionsQueryKey,
  useGetExplanation,
  useSaveProgress,
  getGetProgressQueryKey,
} from "@workspace/api-client-react";
import type { Question, ProgressInput } from "@workspace/api-client-react";
import { MathText } from "@/components/MathText";
import { useQueryClient } from "@tanstack/react-query";

interface Config {
  subject: "english" | "math";
  difficulty: "Easy" | "Medium" | "Hard";
  questionCount: number;
  targetDate: string;
}

function loadConfig(): Config {
  try {
    return {
      subject: "math",
      difficulty: "Medium",
      questionCount: 10,
      targetDate: "2026-08-01",
      ...JSON.parse(localStorage.getItem("sat_config") ?? "{}"),
    };
  } catch {
    return { subject: "math", difficulty: "Medium", questionCount: 10, targetDate: "2026-08-01" };
  }
}

function loadMasteredIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("sat_mastered_ids") ?? "[]");
  } catch {
    return [];
  }
}

function addMasteredId(id: string) {
  const ids = loadMasteredIds();
  if (!ids.includes(id)) {
    localStorage.setItem("sat_mastered_ids", JSON.stringify([...ids, id]));
  }
}

const LETTERS = ["A", "B", "C", "D"];

export default function Session() {
  const [, setLocation] = useLocation();
  const config = loadConfig();
  const queryClient = useQueryClient();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sessionResults, setSessionResults] = useState<Array<{ correct: boolean; topic: string }>>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const masteredIds = loadMasteredIds().join(",");
  const params = {
    subject: config.subject,
    difficulty: config.difficulty,
    count: config.questionCount,
    masteredIds: masteredIds || undefined,
  };

  const { refetch: fetchQuestions, isFetching } = useGetQuestions(params, {
    query: {
      enabled: false,
      queryKey: getGetQuestionsQueryKey(params),
    },
  });

  const explainMutation = useGetExplanation();
  const saveProgress = useSaveProgress();

  useEffect(() => {
    fetchQuestions().then((result) => {
      if (result.data) setQuestions(result.data as Question[]);
    });
  }, [fetchQuestions]);

  const currentQ = questions[currentIdx];
  const isMath = config.subject === "math";

  const TextComponent = useCallback(
    ({ text, className }: { text: string; className?: string }) =>
      isMath ? <MathText text={text} className={className} /> : <span className={className}>{text}</span>,
    [isMath]
  );

  const handleSubmit = async () => {
    if (selectedIdx === null || !currentQ) return;
    setSubmitted(true);

    const userLetter = LETTERS[selectedIdx];
    const correctLetter = currentQ.correct.toUpperCase();
    const isCorrect = userLetter === correctLetter;

    if (isCorrect) addMasteredId(currentQ.id);

    const snapshot: ProgressInput["snapshot"] = {
      question: currentQ.question,
      passage: currentQ.passage ?? null,
      options: currentQ.options,
      explanation: currentQ.explanation ?? null,
    };

    const progressData: ProgressInput = {
      questionId: currentQ.id,
      topic: currentQ.topic ?? "Unknown",
      userAnswer: userLetter,
      correct: correctLetter,
      isCorrect,
      subject: config.subject,
      snapshot,
    };

    saveProgress.mutate({ data: progressData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey({ subject: config.subject }) });
      },
    });

    setSessionResults((prev) => [...prev, { correct: isCorrect, topic: currentQ.topic ?? "Unknown" }]);

    // Get AI explanation
    explainMutation.mutate(
      {
        data: {
          question: currentQ.question,
          passage: currentQ.passage ?? null,
          options: currentQ.options,
          correct: correctLetter,
          userAnswer: userLetter,
          subject: config.subject,
        },
      },
      { onSuccess: (data) => setExplanation(data.text) }
    );
  };

  const handleNext = () => {
    setSelectedIdx(null);
    setSubmitted(false);
    setExplanation(null);
    if (currentIdx + 1 >= questions.length) {
      setSessionDone(true);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  if (isFetching || (questions.length === 0 && !sessionDone)) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SessionHeader config={config} onBack={() => setLocation("/")} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground font-medium">Loading questions…</p>
          </div>
        </div>
      </div>
    );
  }

  if (sessionDone || (questions.length > 0 && currentIdx >= questions.length)) {
    const total = sessionResults.length;
    const correct = sessionResults.filter((r) => r.correct).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SessionHeader config={config} onBack={() => setLocation("/")} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="bg-card border border-card-border rounded-2xl p-8 max-w-md w-full text-center shadow-lg space-y-6">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${pct >= 70 ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
              {pct >= 70 ? <CheckCircle className="w-8 h-8" /> : <BookOpen className="w-8 h-8" />}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Session complete</h2>
              <p className="text-muted-foreground mt-1">
                {pct >= 80 ? "Outstanding work!" : pct >= 60 ? "Good effort — keep practicing!" : "Keep going, you're improving!"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-3xl font-bold text-primary">{correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-accent">{pct}%</p>
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
            </div>
            {/* Per-topic breakdown */}
            {sessionResults.length > 0 && (
              <div className="text-left space-y-2 max-h-40 overflow-y-auto">
                {Object.entries(
                  sessionResults.reduce<Record<string, { correct: number; total: number }>>(
                    (acc, r) => {
                      if (!acc[r.topic]) acc[r.topic] = { correct: 0, total: 0 };
                      acc[r.topic].total++;
                      if (r.correct) acc[r.topic].correct++;
                      return acc;
                    },
                    {}
                  )
                ).map(([topic, data]) => (
                  <div key={topic} className="flex justify-between items-center text-sm">
                    <span className="text-foreground">{topic}</span>
                    <span className={`font-medium ${data.correct === data.total ? "text-green-600" : data.correct === 0 ? "text-destructive" : "text-amber-500"}`}>
                      {data.correct}/{data.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="session-review-btn"
                onClick={() => setLocation("/review")}
                className="py-2.5 px-4 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all"
              >
                Review answers
              </button>
              <button
                data-testid="session-restart-btn"
                onClick={() => setLocation("/")}
                className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
              >
                New session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userLetter = selectedIdx !== null ? LETTERS[selectedIdx] : null;
  const correctLetter = currentQ?.correct?.toUpperCase();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SessionHeader config={config} onBack={() => setLocation("/")} />

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIdx) / questions.length) * 100}%` }}
        />
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-6 space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Question <span className="font-semibold text-foreground">{currentIdx + 1}</span> of {questions.length}</span>
          <span className="font-medium text-foreground capitalize">{currentQ?.topic ?? ""}</span>
        </div>

        {/* Passage */}
        {currentQ?.passage && (
          <div className="bg-card border border-card-border rounded-xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Passage</p>
            {isMath ? (
              <MathText text={currentQ.passage} className="passage-text text-sm leading-relaxed text-foreground" block />
            ) : (
              <p className="passage-text text-sm leading-relaxed text-foreground">{currentQ.passage}</p>
            )}
          </div>
        )}

        {/* Question */}
        <div className="space-y-4">
          <div className="text-base font-medium text-foreground leading-relaxed">
            <TextComponent text={currentQ?.question ?? ""} />
          </div>

          {/* Answer choices */}
          <div className="space-y-2.5" data-testid="answer-choices">
            {currentQ?.options.map((opt, i) => {
              const letter = LETTERS[i];
              const isSelected = selectedIdx === i;
              const isCorrectChoice = submitted && letter === correctLetter;
              const isWrongChoice = submitted && isSelected && letter !== correctLetter;

              return (
                <button
                  key={i}
                  data-testid={`answer-choice-${letter}`}
                  disabled={submitted}
                  onClick={() => setSelectedIdx(i)}
                  className={`answer-choice w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    isCorrectChoice
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : isWrongChoice
                      ? "border-destructive bg-destructive/5"
                      : isSelected
                      ? "border-primary bg-primary/8"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    isCorrectChoice
                      ? "border-green-500 bg-green-500 text-white"
                      : isWrongChoice
                      ? "border-destructive bg-destructive text-white"
                      : isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}>
                    {letter}
                  </span>
                  <span className="text-sm text-foreground leading-relaxed flex-1">
                    <TextComponent text={opt} />
                  </span>
                  {isCorrectChoice && <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />}
                  {isWrongChoice && <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit / Next */}
        {!submitted ? (
          <button
            data-testid="submit-answer-btn"
            disabled={selectedIdx === null}
            onClick={handleSubmit}
            className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all"
          >
            Submit answer
          </button>
        ) : (
          <div className="space-y-4">
            {/* Result banner */}
            <div className={`flex items-center gap-3 p-4 rounded-xl ${userLetter === correctLetter ? "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800"}`}>
              {userLetter === correctLetter ? (
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {userLetter === correctLetter ? "Correct!" : `Incorrect — the answer is ${correctLetter}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  You chose {userLetter}, correct answer is {correctLetter}
                </p>
              </div>
            </div>

            {/* AI Explanation */}
            <div className="bg-card border border-card-border rounded-xl p-4 explanation-enter">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Explanation</p>
              {explainMutation.isPending ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Getting explanation…</span>
                </div>
              ) : explanation ? (
                <div className="text-sm text-foreground leading-relaxed">
                  {isMath ? <MathText text={explanation} block /> : <p>{explanation}</p>}
                </div>
              ) : currentQ?.explanation ? (
                <div className="text-sm text-foreground leading-relaxed">
                  {isMath ? <MathText text={currentQ.explanation} block /> : <p>{currentQ.explanation}</p>}
                </div>
              ) : null}
            </div>

            <button
              data-testid="next-question-btn"
              onClick={handleNext}
              className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              {currentIdx + 1 >= questions.length ? "See results" : "Next question"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function SessionHeader({ config, onBack }: { config: Config; onBack: () => void }) {
  return (
    <header className="border-b border-border bg-sidebar text-sidebar-foreground px-6 py-4 flex items-center gap-4">
      <button data-testid="back-btn" onClick={onBack} className="hover:opacity-70 transition-opacity">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        {config.subject === "english" ? (
          <BookOpen className="w-4 h-4 text-accent" />
        ) : (
          <Calculator className="w-4 h-4 text-accent" />
        )}
        <span className="font-semibold capitalize">
          {config.subject === "english" ? "English R&W" : "Math"} · {config.difficulty}
        </span>
      </div>
    </header>
  );
}
