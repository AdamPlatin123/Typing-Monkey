export function calculateProgressPercent(lastBlockIndex: number, totalBlocks: number) {
  if (totalBlocks <= 0) {
    return 0;
  }

  const normalized = Math.min(Math.max(lastBlockIndex, 0), totalBlocks - 1);
  return Number((((normalized + 1) / totalBlocks) * 100).toFixed(2));
}
