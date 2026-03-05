"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import QuestionForm, { type QuestionData } from "./QuestionForm";

export interface QuizData {
  id?: string;
  passingScore: number;
  durationMinutes: number;
  maxAttempts: number;
  questions: QuestionData[];
}

interface QuizBuilderProps {
  quiz: QuizData | null;
  onChange: (quiz: QuizData | null) => void;
}

const emptyQuiz: QuizData = {
  passingScore: 70,
  durationMinutes: 30,
  maxAttempts: 3,
  questions: [],
};

export default function QuizBuilder({ quiz, onChange }: QuizBuilderProps) {
  const [expanded, setExpanded] = useState(!!quiz);

  if (!quiz) {
    return (
      <button
        type="button"
        onClick={() => {
          onChange({ ...emptyQuiz });
          setExpanded(true);
        }}
        className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Quiz
      </button>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors"
      >
        <span className="text-sm font-medium text-foreground">
          Quiz — {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-foreground block mb-1">Passing Score (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={quiz.passingScore}
                onChange={(e) => onChange({ ...quiz, passingScore: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Duration (minutes)</label>
              <input
                type="number"
                min={1}
                value={quiz.durationMinutes}
                onChange={(e) => onChange({ ...quiz, durationMinutes: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1">Max Attempts</label>
              <input
                type="number"
                min={1}
                value={quiz.maxAttempts}
                onChange={(e) => onChange({ ...quiz, maxAttempts: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-3">
            {quiz.questions.map((q, i) => (
              <QuestionForm
                key={q.id ?? `new-${i}`}
                index={i}
                question={q}
                onChange={(updated) => {
                  const qs = [...quiz.questions];
                  qs[i] = updated;
                  onChange({ ...quiz, questions: qs });
                }}
                onRemove={() => {
                  const qs = quiz.questions.filter((_, j) => j !== i);
                  onChange({ ...quiz, questions: qs });
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...quiz,
                  questions: [
                    ...quiz.questions,
                    { questionText: "", options: ["", "", "", ""], correctAnswer: "", explanation: "" },
                  ],
                });
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="px-3 py-2 text-sm text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
            >
              Remove Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
