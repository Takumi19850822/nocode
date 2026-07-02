const MAIN_SCROLL_SELECTOR = "main.overflow-y-auto";

/** ダッシュボード main のスクロール位置を維持したまま state を更新 */
export function preserveDashboardScroll(update: () => void): void {
  const container = document.querySelector<HTMLElement>(MAIN_SCROLL_SELECTOR);
  const scrollTop = container?.scrollTop ?? window.scrollY;

  update();

  requestAnimationFrame(() => {
    if (container) {
      container.scrollTop = scrollTop;
    } else {
      window.scrollTo(0, scrollTop);
    }
  });
}
