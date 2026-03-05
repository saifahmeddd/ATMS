"use client";

import { X } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  itemName?: string;
  loading?: boolean;
}

export default function DeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  loading = false,
}: DeleteDialogProps) {
  if (!open) return null;

  async function handleConfirmClick() {
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error handled by parent
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            {description}
            {itemName && (
              <span className="block mt-2 font-medium text-foreground">
                {itemName}
              </span>
            )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium rounded-lg border bg-card hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
