import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, BookOpen, Calculator } from "lucide-react";
import { useGetStats, useGetProgress } from "@workspace/api-client-react";

type Subject = "english" | "math";

function AccuracyBar({ accuracy }: { accuracy: number }) {
  const pct = Math.round(accuracy * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : pct >= 40 ? "bg-orange-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-semibold w-10 text-right ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-600" : "text-destructive"}`}>
        {pct}%
      </span>
    </div>
  );
}

export default function Stats() {
  const [, setLocation] = useLocation();
  const [subject, setSubject] = useState<Subject>("math");

  const { data: stats = [], isLoading } = useGetStats({ subject });
  const { data: progress = [] } = useGetProgress({ subject });

  const totalAnswered = progress.length;
  const totalCorrect = progress.filter((e) => e.isCorrect).length;
  const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
  const recentProgress = [...progress].slice(-20);
  const recentCorrect = recentProgress.filter((e) => e.isCorrect).length;
  const recentAccuracy = recentProgress.length > 0 ? recentCorrect / recentProgress.length : 0;
  const trending = recentAccuracy >= accuracy ? "up" : "down";

  const masteredCount = stats.filter((s) => s.accuracy >= 0.8 && s.total >= 3).length;
  const weakTopics = stats.filter((s) => s.accuracy < 0.5 && s.total >= 2);
  const strongTopics = stats.filter((s) => s.accuracy >= 0.8 && s.total >= 2);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground px-6 py-4 flex items-center gap-4">
        <button data-testid="back-to-home" onClick={() => setLocation("/")} className="hover:opacity-70 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">Performance analytics</span>
      </header>

      <main className="max-w-4xl mx-auto w-full px-6 py-6 space-y-6">
        {/* Subject tabs */}
        <div className="flex gap-3">
          {(["math", "english"] as Subject[]).map((s) => (
            <button
              key={s}
              data-testid={`stats-tab-${s}`}
              onClick={() => setSubject(s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${subject === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"}`}
            >
              {s === "math" ? <Calculator className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              {s === "english" ? "English R&W" : "Math"}
            </button>
          ))}
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-card-border rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-primary">{totalAnswered}</p>
            <p className="text-xs text-muted-foreground mt-1">Questions answered</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{Math.round(accuracy * 100)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Overall accuracy</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{masteredCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Topics mastered</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className="text-3xl font-bold" style={{ color: trending === "up" ? "rgb(22 163 74)" : "rgb(220 38 38)" }}>
                {Math.round(recentAccuracy * 100)}%
              </p>
              {trending === "up" ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-destructive" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Recent accuracy</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading…</div>
        ) : stats.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 bg-card border border-card-border rounded-xl">
            <p className="font-medium">No data yet</p>
            <p className="text-sm mt-1">Complete some sessions to see your topic breakdown</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* All topics */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-4">All topics</h3>
              <div className="space-y-3">
                {[...stats].sort((a, b) => b.total - a.total).map((s) => (
                  <div key={s.topic} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground">{s.topic}</span>
                      <span className="text-muted-foreground">{s.correct}/{s.total}</span>
                    </div>
                    <AccuracyBar accuracy={s.accuracy} />
                  </div>
                ))}
              </div>
            </div>

            {/* Weak and strong topics */}
            <div className="space-y-4">
              {weakTopics.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-5">
                  <h3 className="font-semibold text-sm text-destructive mb-3 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Needs work
                  </h3>
                  <div className="space-y-2">
                    {weakTopics.map((s) => (
                      <div key={s.topic} className="flex justify-between items-center">
                        <span className="text-sm">{s.topic}</span>
                        <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                          {Math.round(s.accuracy * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {strongTopics.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl p-5">
                  <h3 className="font-semibold text-sm text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Strong areas
                  </h3>
                  <div className="space-y-2">
                    {strongTopics.map((s) => (
                      <div key={s.topic} className="flex justify-between items-center">
                        <span className="text-sm">{s.topic}</span>
                        <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                          {Math.round(s.accuracy * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent history chart (sparkline) */}
              {recentProgress.length >= 5 && (
                <div className="bg-card border border-card-border rounded-xl p-5">
                  <h3 className="font-semibold text-sm mb-3">Recent attempts</h3>
                  <div className="flex items-end gap-1 h-12">
                    {recentProgress.map((entry, i) => (
                      <div
                        key={i}
                        data-testid={`sparkline-${i}`}
                        className={`flex-1 rounded-sm min-h-2 transition-all ${entry.isCorrect ? "bg-green-400" : "bg-red-300"}`}
                        style={{ height: entry.isCorrect ? "100%" : "40%" }}
                        title={`${entry.topic}: ${entry.isCorrect ? "Correct" : "Incorrect"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Last {recentProgress.length} attempts</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
