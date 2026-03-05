"use client";

import { Trash2 } from "lucide-react";

export interface QuestionData {
  id?: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

interface QuestionFormProps {
  index: number;
  question: QuestionData;
  onChange: (q: QuestionData) => void;
  onRemove: () => void;
}

export default function QuestionForm({ index, question, onChange, onRemove }: QuestionFormProps) {
  return (
    <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Question {index + 1}</span>
        <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 transition-colors">
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <input
        type="text"
        placeholder="Question text"
        value={question.questionText}
        onChange={(e) => onChange({ ...question, questionText: e.target.value })}
        className="w-full px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {question.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question.id ?? index}`}
              checked={question.correctAnswer === opt && opt !== ""}
              onChange={() => onChange({ ...question, correctAnswer: opt })}
              className="accent-primary"
            />
            <input
              type="text"
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              value={opt}
              onChange={(e) => {
                const opts = [...question.options];
                const old = opts[i];
                opts[i] = e.target.value;
                const correct = question.correctAnswer === old ? e.target.value : question.correctAnswer;
                onChange({ ...question, options: opts, correctAnswer: correct });
              }}
              className="flex-1 px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ))}
      </div>
      <textarea
        placeholder="Explanation (optional, shown after quiz completion)"
        value={question.explanation ?? ""}
        onChange={(e) => onChange({ ...question, explanation: e.target.value || undefined })}
        rows={2}
        className="w-full px-3 py-2 text-sm bg-card border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-none"
      />
      {question.correctAnswer === "" && (
        <p className="text-xs text-warning">Select the correct answer</p>
      )}
    </div>
  );
}
