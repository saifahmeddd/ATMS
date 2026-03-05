"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Clock, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  Award, ArrowLeft, AlertTriangle, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Question {
  id: string;
  questionText: string;
  options: string[];
}

interface QuizData {
  id: string;
  moduleTitle: string;
  passingScore: number;
  durationMinutes: number;
  maxAttempts: number;
  attemptsTaken: number;
  attemptsRemaining: number;
  alreadyPassed: boolean;
  questions: Question[];
}

interface QuestionResult {
  questionId: string;
  questionText: string;
  options: string[];
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string | null;
}

interface SubmitResult {
  score: number;
  passed: boolean;
  passingScore: number;
  correctCount: number;
  totalQuestions: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  questionResults: QuestionResult[];
}

export default function QuizPage() {
  const { enrollmentId, quizId } = useParams<{ enrollmentId: string; quizId: string }>();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/employee/quiz/${quizId}?enrollmentId=${enrollmentId}`)
      .then((r) => r.json())
      .then((data) => {
        setQuiz(data);
        setTimeLeft(data.durationMinutes * 60);
        setLoading(false);
      });
  }, [quizId, enrollmentId]);

  useEffect(() => {
    if (submitted || loading) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, loading]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/employee/quiz/${quizId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId, answers }),
    });
    const data = await res.json();
    setResult(data);
    setSubmitted(true);
    setSubmitting(false);
  };

  const handleRetry = () => {
    setSubmitted(false);
    setResult(null);
    setAnswers({});
    setCurrentQ(0);
    setTimeLeft((quiz?.durationMinutes ?? 15) * 60);
  };

  if (loading || !quiz) {
    return <div className="space-y-6 max-w-3xl mx-auto"><div className="bg-card rounded-lg border h-96 animate-pulse" /></div>;
  }

  if (quiz.alreadyPassed && !submitted) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Link href={`/employee/my-courses/${enrollmentId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Course</Button>
        </Link>
        <div className="bg-card rounded-xl border p-8 text-center border-success/30">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 bg-success/15">
            <Award className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Quiz Already Passed</h2>
          <p className="text-muted-foreground">You have already passed this quiz. Continue with the next module.</p>
          <Link href={`/employee/my-courses/${enrollmentId}`}>
            <Button className="mt-6">Back to Course</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (quiz.attemptsRemaining <= 0 && !submitted) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Link href={`/employee/my-courses/${enrollmentId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Course</Button>
        </Link>
        <div className="bg-card rounded-xl border p-8 text-center border-destructive/30">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 bg-destructive/15">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">No Attempts Remaining</h2>
          <p className="text-muted-foreground">You have used all {quiz.maxAttempts} attempts for this quiz.</p>
        </div>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Link href={`/employee/my-courses/${enrollmentId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Course</Button>
        </Link>

        <div className={`bg-card rounded-xl border p-8 text-center ${result.passed ? "border-success/30" : "border-destructive/30"}`}>
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 ${result.passed ? "bg-success/15" : "bg-destructive/15"}`}>
            {result.passed ? <Award className="w-10 h-10 text-success" /> : <AlertTriangle className="w-10 h-10 text-destructive" />}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">{result.passed ? "Congratulations!" : "Not Quite There"}</h2>
          <p className="text-muted-foreground mb-4">
            {result.passed ? "You passed the assessment." : `You need ${result.passingScore}% to pass. Review the material and try again.`}
          </p>
          <div className="text-5xl font-bold text-foreground mb-2">{result.score}%</div>
          <p className="text-sm text-muted-foreground">{result.correctCount} out of {result.totalQuestions} correct</p>
          {!result.passed && result.attemptsRemaining > 0 && (
            <Button className="mt-6" onClick={handleRetry}>
              <RotateCcw className="w-4 h-4 mr-1" /> Retry Quiz ({result.attemptsRemaining} left)
            </Button>
          )}
        </div>

        <div className="bg-card rounded-lg border divide-y">
          <div className="p-4">
            <h3 className="font-semibold text-foreground">Review Answers</h3>
          </div>
          {result.questionResults.map((q, idx) => (
            <div key={q.questionId} className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  q.isCorrect ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                }`}>
                  {q.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                </span>
                <p className="text-sm font-medium text-foreground">{idx + 1}. {q.questionText}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-9">
                {q.options.map((opt, oi) => (
                  <div key={oi} className={`text-xs px-3 py-2 rounded-lg border ${
                    opt === q.correctAnswer ? "bg-success/10 border-success/30 text-success" :
                    opt === q.userAnswer && opt !== q.correctAnswer ? "bg-destructive/10 border-destructive/30 text-destructive" :
                    "bg-secondary/50 text-muted-foreground"
                  }`}>
                    {opt}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <div className="ml-9 mt-2 p-3 rounded-lg bg-info/10 border border-info/20 text-sm text-foreground">
                  <span className="font-medium text-info">Explanation: </span>
                  {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const q = quiz.questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{quiz.moduleTitle}</h1>
          <p className="text-xs text-muted-foreground">Attempt {quiz.attemptsTaken + 1} of {quiz.maxAttempts}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold ${
          timeLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"
        }`}>
          <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Progress value={(answeredCount / quiz.questions.length) * 100} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground">{answeredCount}/{quiz.questions.length} answered</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {quiz.questions.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentQ(idx)}
            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
              currentQ === idx ? "bg-primary text-primary-foreground" :
              answers[quiz.questions[idx].id] !== undefined ? "bg-success/15 text-success" :
              "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-lg border p-6">
        <p className="text-xs text-muted-foreground mb-2">Question {currentQ + 1} of {quiz.questions.length}</p>
        <h2 className="text-base font-semibold text-foreground mb-5">{q.questionText}</h2>
        <div className="space-y-3">
          {(q.options as string[]).map((opt, oi) => (
            <button
              key={oi}
              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                answers[q.id] === opt
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "bg-card hover:bg-secondary/50 text-foreground"
              }`}
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs font-semibold mr-3">
                {String.fromCharCode(65 + oi)}
              </span>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ((p) => p - 1)}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <div className="flex gap-2">
          {currentQ < quiz.questions.length - 1 ? (
            <Button onClick={() => setCurrentQ((p) => p + 1)}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={answeredCount < quiz.questions.length || submitting}>
              {submitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
