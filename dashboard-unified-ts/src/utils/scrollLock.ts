/**
 * Body scroll lock for modals. Uses position:fixed + top on mobile (iOS Safari)
 * and overflow hidden on desktop. See:
 * - https://stackoverflow.com/a/75300422 (CC BY-SA 4.0)
 * - https://stackoverflow.com/a/44699347 (CC BY-SA 3.0)
 */

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(max-width: 1024px)").matches
  );
}

export function setBodyScrollLock(modalOpen: boolean): void {
  const body = document.body;

  if (modalOpen) {
    // Use overflow hidden only so the modal's .modal-body can scroll.
    // position:fixed on body breaks modal inner scroll on iOS and some desktop browsers.
    body.dataset.scrollY = String(window.scrollY);
    body.style.overflow = "hidden";
  } else {
    const scrollY = body.dataset.scrollY;
    delete body.dataset.scrollY;
    body.style.overflow = "";
    const y = scrollY != null ? parseInt(scrollY, 10) : NaN;
    if (!Number.isNaN(y)) requestAnimationFrame(() => window.scrollTo(0, y));
  }
}
