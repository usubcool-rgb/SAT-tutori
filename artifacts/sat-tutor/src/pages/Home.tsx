import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BookOpen, Calculator, Target, TrendingUp, Clock, ChevronRight, AlertCircle, Trophy } from "lucide-react";
import { useGetDbStatus, useGetStats, useGetProgress } from "@workspace/api-client-react";

interface Config {
  subject: "english" | "math";
  difficulty: "Easy" | "Medium" | "Hard";
  questionCount: number;
  targetDate: string;
}

const DEFAULT_CONFIG: Config = {
  subject: "math",
  difficulty: "Medium",
  questionCount: 10,
  targetDate: "2026-08-01",
};

function loadConfig(): Config {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem("sat_config") ?? "{}") };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: Config) {
  localStorage.setItem("sat_config", JSON.stringify(config));
}

function getDaysLeft(targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [config, setConfig] = useState<Config>(loadConfig);

  const { data: dbStatus } = useGetDbStatus();
  const { data: mathStats } = useGetStats({ subject: "math" });
  const { data: engStats } = useGetStats({ subject: "english" });
  const { data: mathProgress } = useGetProgress({ subject: "math" });
  const { data: engProgress } = useGetProgress({ subject: "english" });

  useEffect(() => { saveConfig(config); }, [config]);

  const daysLeft = getDaysLeft(config.targetDate);

  const totalAnswered = (mathProgress?.length ?? 0) + (engProgress?.length ?? 0);
  const totalCorrect = [
    ...(mathProgress ?? []),
    ...(engProgress ?? []),
  ].filter((e) => e.isCorrect).length;
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const allStats = [...(mathStats ?? []), ...(engStats ?? [])];
  const weakTopics = allStats.filter((s) => s.accuracy < 0.5 && s.total >= 3).slice(0, 3);

  const startSession = () => {
    saveConfig(config);
    setLocation("/session");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-accent-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">SAT Tutor</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
            <Clock className="w-4 h-4" />
            {daysLeft > 0 ? (
              <span><span className="font-semibold text-accent">{daysLeft}</span> days until exam</span>
            ) : (
              <span className="text-accent font-semibold">Exam day!</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* DB Status warning */}
        {dbStatus && !dbStatus.loaded && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Question database not found</p>
              <p className="text-sm mt-0.5 text-destructive/80">
                Place your <code className="font-mono bg-destructive/10 px-1 rounded">sat_database.json</code> file in:{" "}
                <code className="font-mono text-xs bg-destructive/10 px-1 rounded break-all">
                  artifacts/api-server/data/
                </code>
                {" "}A sample database with demo questions is included.
              </p>
            </div>
          </div>
        )}

        {/* Stats strip */}
        {totalAnswered > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-primary">{totalAnswered}</p>
              <p className="text-sm text-muted-foreground mt-1">Questions answered</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-primary">{overallAccuracy}%</p>
              <p className="text-sm text-muted-foreground mt-1">Overall accuracy</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-accent">{weakTopics.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Topics to review</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Session config */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Start practicing</h2>
              <p className="text-muted-foreground mt-1">Configure your session and begin</p>
            </div>

            {/* Subject selector */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Subject</label>
              <div className="grid grid-cols-2 gap-3">
                {(["english", "math"] as const).map((subj) => (
                  <button
                    key={subj}
                    data-testid={`subject-${subj}`}
                    onClick={() => setConfig((c) => ({ ...c, subject: subj }))}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      config.subject === subj
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    {subj === "english" ? (
                      <BookOpen className="w-5 h-5 shrink-0" />
                    ) : (
                      <Calculator className="w-5 h-5 shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold capitalize text-sm">
                        {subj === "english" ? "English R&W" : "Math"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {subj === "english" ? `${dbStatus?.englishCount ?? 0} questions` : `${dbStatus?.mathCount ?? 0} questions`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Difficulty</label>
              <div className="flex gap-2">
                {(["Easy", "Medium", "Hard"] as const).map((d) => (
                  <button
                    key={d}
                    data-testid={`difficulty-${d.toLowerCase()}`}
                    onClick={() => setConfig((c) => ({ ...c, difficulty: d }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      config.difficulty === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Question count */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Questions per session: <span className="text-primary">{config.questionCount}</span>
              </label>
              <input
                data-testid="question-count-slider"
                type="range"
                min={5}
                max={30}
                step={5}
                value={config.questionCount}
                onChange={(e) => setConfig((c) => ({ ...c, questionCount: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>5</span><span>30</span>
              </div>
            </div>

            {/* Target date */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Exam date</label>
              <input
                data-testid="target-date"
                type="date"
                value={config.targetDate}
                onChange={(e) => setConfig((c) => ({ ...c, targetDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              data-testid="start-session-btn"
              onClick={startSession}
              className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              Start session
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right side: progress + navigation */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Your progress</h2>

            {totalAnswered === 0 ? (
              <div className="bg-card border border-card-border rounded-xl p-6 text-center text-muted-foreground">
                <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No sessions yet</p>
                <p className="text-sm mt-1">Start your first session to see progress here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Per-subject accuracy */}
                {[
                  { label: "Math", subject: "math", stats: mathStats, progress: mathProgress },
                  { label: "English R&W", subject: "english", stats: engStats, progress: engProgress },
                ].map(({ label, progress }) => {
                  const answered = progress?.length ?? 0;
                  const correct = progress?.filter((e) => e.isCorrect).length ?? 0;
                  const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
                  return (
                    <div key={label} className="bg-card border border-card-border rounded-xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-sm">{label}</span>
                        <span className="text-sm text-muted-foreground">{correct}/{answered}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{pct}% accuracy</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Weak topics */}
            {weakTopics.length > 0 && (
              <div className="bg-card border border-card-border rounded-xl p-4">
                <p className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-destructive" />
                  Topics to focus on
                </p>
                <div className="space-y-2">
                  {weakTopics.map((t) => (
                    <div key={t.topic} className="flex justify-between items-center">
                      <span className="text-sm text-foreground">{t.topic}</span>
                      <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        {Math.round(t.accuracy * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="nav-review"
                onClick={() => setLocation("/review")}
                className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-primary/40 transition-all"
              >
                <Target className="w-5 h-5 text-primary mb-2" />
                <p className="font-semibold text-sm">Review history</p>
                <p className="text-xs text-muted-foreground mt-0.5">Past questions</p>
              </button>
              <button
                data-testid="nav-stats"
                onClick={() => setLocation("/stats")}
                className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-primary/40 transition-all"
              >
                <TrendingUp className="w-5 h-5 text-accent mb-2" />
                <p className="font-semibold text-sm">Analytics</p>
                <p className="text-xs text-muted-foreground mt-0.5">Topic breakdown</p>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
