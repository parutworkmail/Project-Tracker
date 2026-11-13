// Counts navigations started from code (router.push / replace / refresh) so one
// progress bar can show them all. Link clicks are picked up separately by the bar.
let busyCount = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const navigationBusy = {
  begin() {
    busyCount += 1;
    emit();
  },
  end() {
    busyCount = Math.max(0, busyCount - 1);
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot() {
    return busyCount > 0;
  },
  getServerSnapshot() {
    return false;
  },
};
