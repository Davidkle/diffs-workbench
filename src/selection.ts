/** Finder-style selection: normal click replaces, modifiers toggle or extend. */
export function selectRange(
  ordered: string[],
  selected: string[],
  target: string,
  anchor: string | undefined,
  range: boolean,
  additive: boolean,
): string[] {
  const start = anchor ? ordered.indexOf(anchor) : -1;
  const end = ordered.indexOf(target);
  if (end < 0) return selected;
  if (range && start >= 0) {
    const interval = ordered.slice(
      Math.min(start, end),
      Math.max(start, end) + 1,
    );
    return additive ? [...new Set([...selected, ...interval])] : interval;
  }
  return additive
    ? selected.includes(target)
      ? selected.filter((id) => id !== target)
      : [...selected, target]
    : [target];
}
