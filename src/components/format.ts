export function formatTime(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatScore(score: number): string {
  const v = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
  return String(v).padStart(6, '0');
}
