/**
 * Daily 2:00 AM Beijing time (18:00 UTC) auto-submit scheduler for the 报数 feature.
 *
 * Computes the ms until the next 18:00 UTC (= 02:00 Beijing UTC+8),
 * schedules a setTimeout, runs runAutoSubmitJob(), and reschedules.
 * Recovers from errors and reschedules regardless of job outcome so the chain never breaks.
 */
import { runAutoSubmitJob } from '../routes/count.js';

let scheduledTimer = null;
let lastRunAt = null;

function msUntilNext2amBeijing() {
  const now = new Date();
  // 2:00 AM Beijing = 18:00 UTC previous day
  const next = new Date(now);
  next.setUTCHours(18, 0, 0, 0);
  // If 18:00 UTC today has already passed, move to next day
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(18, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

async function tick() {
  scheduledTimer = null;
  lastRunAt = new Date();
  try {
    await runAutoSubmitJob();
  } catch (err) {
    console.error('[countScheduler] auto-submit job failed:', err);
  } finally {
    // Always reschedule, even on failure.
    schedule();
  }
}

export function schedule() {
  if (scheduledTimer) return; // Already scheduled
  const ms = msUntilNext2amBeijing();
  // Safety cap: if ms is unreasonable (e.g. > 25h), reschedule in 1 min.
  const delay = ms > 0 && ms < 25 * 60 * 60 * 1000 ? ms : 60 * 1000;
  console.log(`[countScheduler] next auto-submit (2:00 AM Beijing) in ${Math.round(delay / 1000)}s`);
  scheduledTimer = setTimeout(tick, delay);
}

export function cancel() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
}

export function getStatus() {
  return {
    scheduled: !!scheduledTimer,
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    nextRunInMs: scheduledTimer ? msUntilNext2amBeijing() : null,
  };
}
