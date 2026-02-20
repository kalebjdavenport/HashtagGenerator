/** Spinner + message HTML used by generation methods for status updates. */
export function spinnerStatus(message: string): string {
  return `<div class="flex items-center gap-2 text-sm text-buffer-muted">
    <svg class="spinner w-4 h-4 shrink-0 text-buffer-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="15" />
    </svg>
    <span>${message}</span>
  </div>`;
}
