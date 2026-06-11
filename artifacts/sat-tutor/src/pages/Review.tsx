import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle, XCircle, BookOpen, Calculator, Trash2 } from "lucide-react";
import {
  useGetProgress,
  getGetProgressQueryKey,
  useResetProgress,
} from "@workspace/api-client-react";
import { MathText } from "@/components/MathText";
import { useQueryClient } from "@tanstack/react-query";

type Subject = "english" | "math";

export default function Review() {
  const [, setLocation] = useLocation();
  const [subject, setSubject] = useState<Subject>("math");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: progress = [], isLoading } = useGetProgress({ subject });
  const resetMutation = useResetProgress();

  const handleReset = () => {
    if (!confirm(`Reset all ${subject} progress? This cannot be undone.`)) return;
    resetMutation.mutate(
      { params: { subject } } as Parameters<typeof resetMutation.mutate>[0],
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey({ subject }) });
          setSelectedIdx(null);
        },
      }
    );
  };

  const selected = selectedIdx !== null ? progress[selectedIdx] : null;
  const isMath = subject === "math";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground px-6 py-4 flex items-center gap-4">
        <button data-testid="back-to-home" onClick={() => setLocation("/")} className="hover:opacity-70 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">Review history</span>
      </header>

      <div className="max-w-5xl mx-auto w-full px-6 py-6 flex-1">
        {/* Subject tabs */}
        <div className="flex gap-3 mb-6">
          {(["math", "english"] as Subject[]).map((s) => (
            <button
              key={s}
              data-testid={`tab-${s}`}
              onClick={() => { setSubject(s); setSelectedIdx(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${subject === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"}`}
            >
              {s === "math" ? <Calculator className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              {s === "english" ? "English R&W" : "Math"}
            </button>
          ))}
          {progress.length > 0 && (
            <button
              data-testid="reset-progress-btn"
              onClick={handleReset}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/5 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading…</div>
        ) : progress.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="font-medium">No history yet for {subject}</p>
            <p className="text-sm mt-1">Start a session to see your answers here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Left: list */}
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
              {[...progress].reverse().map((entry, i) => {
                const realIdx = progress.length - 1 - i;
                return (
                  <button
                    key={entry.id}
                    data-testid={`review-item-${realIdx}`}
                    onClick={() => setSelectedIdx(realIdx)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selectedIdx === realIdx ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}
                  >
                    {entry.isCorrect ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">{entry.topic}</p>
                      <p className="text-sm text-foreground truncate mt-0.5">
                        {entry.snapshot?.question ?? `Question ${realIdx + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: detail */}
            <div className="bg-card border border-card-border rounded-xl p-5 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              {!selected ? (
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-sm">Select a question to see details</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {selected.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    <span className="font-semibold text-sm">{selected.topic}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(selected.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {selected.snapshot?.passage && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Passage</p>
                      {isMath ? (
                        <MathText text={selected.snapshot.passage} className="passage-text text-sm leading-relaxed" block />
                      ) : (
                        <p className="passage-text text-sm leading-relaxed">{selected.snapshot.passage}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Question</p>
                    <div className="text-sm font-medium text-foreground leading-relaxed">
                      {isMath ? (
                        <MathText text={selected.snapshot?.question ?? ""} />
                      ) : (
                        selected.snapshot?.question
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(selected.snapshot?.options ?? []).map((opt, i) => {
                      const letter = ["A","B","C","D"][i];
                      const isCorrect = letter === selected.correct;
                      const isUser = letter === selected.userAnswer;
                      return (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${isCorrect ? "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800" : isUser && !isCorrect ? "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800" : "bg-muted/30"}`}>
                          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${isCorrect ? "border-green-500 bg-green-500 text-white" : isUser ? "border-destructive bg-destructive text-white" : "border-border"}`}>
                            {letter}
                          </span>
                          <span className="flex-1 leading-relaxed">
                            {isMath ? <MathText text={opt} /> : opt}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {selected.snapshot?.explanation && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Explanation</p>
                      <div className="text-sm text-foreground leading-relaxed">
                        {isMath ? (
                          <MathText text={selected.snapshot.explanation} block />
                        ) : (
                          selected.snapshot.explanation
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
