type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing"
>;

export function tabShortcutIndex(
  event: ShortcutEvent,
  isMac: boolean,
  activeIndex: number,
  count: number,
): number | undefined {
  if (!count || event.isComposing) return;
  const { key, ctrlKey, metaKey, altKey, shiftKey } = event;
  const numbered = isMac ? metaKey && !ctrlKey : ctrlKey && !metaKey;
  if (numbered && !altKey && !shiftKey && /^[1-9]$/.test(key)) {
    const index = key === "9" ? count - 1 : Number(key) - 1;
    return index < count ? index : undefined;
  }

  let direction: number | undefined;
  if (ctrlKey && !metaKey && !altKey && key === "Tab") {
    direction = shiftKey ? -1 : 1;
  } else if (!shiftKey) {
    if (isMac && metaKey && altKey && !ctrlKey) {
      if (key === "ArrowRight") direction = 1;
      if (key === "ArrowLeft") direction = -1;
    } else if (!isMac && ctrlKey && !metaKey && !altKey) {
      if (key === "PageDown") direction = 1;
      if (key === "PageUp") direction = -1;
    }
  }
  if (direction === undefined) return;
  if (activeIndex < 0) return direction === 1 ? 0 : count - 1;
  return (activeIndex + direction + count) % count;
}
