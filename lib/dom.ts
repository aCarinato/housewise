export function scrollIntoViewIfNeeded(element: HTMLElement | null, offset = 80) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const top = rect.top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
}
