// The conversation has its own viewport; never scroll a bubble behind the composer.
export function scrollAuraToLatest(smooth = true) {
  const viewport = document.querySelector<HTMLElement>('.chatpage .chatbody');
  if (!viewport || document.querySelector('.sheet')) return;
  viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
}
