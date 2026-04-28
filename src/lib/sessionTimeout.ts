/**
 * Session timeout manager.
 *
 * - SESSION_DURATION_MS: total session length (60 min)
 * - WARNING_BEFORE_MS:   how early to show the warning (2 min before expiry)
 *
 * Activity events (mouse, keyboard, touch, scroll) reset the timer.
 * When the warning fires, a callback is invoked so the UI can show a modal.
 * If the user doesn't respond within WARNING_BEFORE_MS, the logout callback fires.
 */

export const SESSION_DURATION_MS = 60 * 60 * 1000;  // 60 minutes
export const WARNING_BEFORE_MS   =  2 * 60 * 1000;  //  2 minutes warning

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
];

type Callbacks = {
  onWarning: (secondsLeft: number) => void;
  onLogout: () => void;
};

let warningTimer: ReturnType<typeof setTimeout> | null = null;
let logoutTimer:  ReturnType<typeof setTimeout> | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let callbacks: Callbacks | null = null;
let active = false;

function clearTimers() {
  if (warningTimer)       { clearTimeout(warningTimer);   warningTimer = null; }
  if (logoutTimer)        { clearTimeout(logoutTimer);    logoutTimer  = null; }
  if (countdownInterval)  { clearInterval(countdownInterval); countdownInterval = null; }
}

function scheduleTimers() {
  clearTimers();
  if (!callbacks) return;

  const { onWarning, onLogout } = callbacks;

  // Fire warning 2 min before session expires
  warningTimer = setTimeout(() => {
    let secondsLeft = Math.floor(WARNING_BEFORE_MS / 1000);
    onWarning(secondsLeft);

    countdownInterval = setInterval(() => {
      secondsLeft -= 1;
      onWarning(secondsLeft);
      if (secondsLeft <= 0) {
        clearTimers();
      }
    }, 1000);

    // Auto-logout after the warning period
    logoutTimer = setTimeout(() => {
      clearTimers();
      onLogout();
    }, WARNING_BEFORE_MS);
  }, SESSION_DURATION_MS - WARNING_BEFORE_MS);
}

function onActivity() {
  // Only reset if no warning is currently showing (i.e. warningTimer is still pending)
  if (warningTimer) {
    scheduleTimers();
  }
}

/** Start tracking session activity. Call after login. */
export function startSessionTimeout(cbs: Callbacks) {
  if (active) stopSessionTimeout();
  callbacks = cbs;
  active = true;
  scheduleTimers();
  ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
}

/** Extend the session (user clicked "Stay"). Resets all timers. */
export function extendSession() {
  if (!active || !callbacks) return;
  scheduleTimers();
}

/** Stop tracking and clear all timers. Call on logout. */
export function stopSessionTimeout() {
  clearTimers();
  ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
  callbacks = null;
  active = false;
}
