import { useCallback, useEffect, useRef, useState } from 'react';
import { BaseClock, LiveClock } from '@clock-ui/react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowUp, Pause, Play, RotateCcw } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatTime, msFromParts, partsFromMs, partsFromMsFloor } from '@/lib/utils';

type Mode = 'clock' | 'timer';
type TimerDirection = 'down' | 'up';

const RING = 2 * Math.PI * 228;

function TimerRing({ progress, urgent }: { progress: number; urgent: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute -inset-5 h-[calc(100%+40px)] w-[calc(100%+40px)] -rotate-90"
      viewBox="0 0 480 480"
      aria-hidden
    >
      <circle cx="240" cy="240" r="228" fill="none" stroke="currentColor" strokeWidth="2" className="text-black/5 dark:text-white/10" />
      <circle
        cx="240"
        cy="240"
        r="228"
        fill="none"
        stroke={urgent ? '#ef4444' : '#e0543a'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={RING}
        strokeDashoffset={RING * (1 - progress)}
      />
    </svg>
  );
}

function DurationInput({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-widest text-neutral-400">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
        className="h-12 w-full rounded-xl border border-black/8 bg-white/80 px-3 text-center text-xl font-light tabular-nums text-neutral-900 shadow-sm backdrop-blur-sm outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-white/10"
      />
    </label>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>('clock');
  const [timerDirection, setTimerDirection] = useState<TimerDirection>('down');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [totalMs, setTotalMs] = useState(msFromParts(0, 5, 0));
  const [remainingMs, setRemainingMs] = useState(msFromParts(0, 5, 0));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const endAtRef = useRef<number | null>(null);
  const startAtRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef(0);
  const pausedElapsedRef = useRef(0);
  const toastedRef = useRef(false);

  const durationMs = msFromParts(hours, minutes, seconds);
  const isCountDown = timerDirection === 'down';
  const displayMs = isCountDown ? remainingMs : elapsedMs;
  const timerParts = isCountDown ? partsFromMs(displayMs) : partsFromMsFloor(displayMs);
  const urgent = mode === 'timer' && isCountDown && running && remainingMs > 0 && remainingMs <= 10000;
  const progress = isCountDown && totalMs > 0 ? remainingMs / totalMs : 0;

  const syncDuration = useCallback(
    (h: number, m: number, s: number) => {
      const ms = msFromParts(h, m, s);
      setTotalMs(ms);
      if (!running && isCountDown) setRemainingMs(ms);
    },
    [running, isCountDown]
  );

  useEffect(() => {
    let id: number;
    const tick = () => {
      setNow(new Date());

      if (mode === 'timer' && running) {
        if (isCountDown && endAtRef.current !== null) {
          const left = Math.max(0, endAtRef.current - performance.now());
          setRemainingMs(left);

          if (left <= 0 && !toastedRef.current) {
            toastedRef.current = true;
            setRunning(false);
            endAtRef.current = null;
            toast('Timer finished', { description: 'Countdown complete.' });
          }
        } else if (!isCountDown && startAtRef.current !== null) {
          setElapsedMs(performance.now() - startAtRef.current);
        }
      }

      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [mode, running, isCountDown]);

  const digital =
    mode === 'clock'
      ? formatTime(now.getHours(), now.getMinutes(), now.getSeconds())
      : formatTime(timerParts.h, timerParts.m, timerParts.s);

  const subtitle =
    mode === 'clock'
      ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      : running
        ? isCountDown
          ? 'Counting down'
          : 'Counting up'
        : isCountDown
          ? 'Set duration'
          : 'Ready to count up';

  const startTimer = () => {
    toastedRef.current = false;

    if (isCountDown) {
      const ms = pausedRemainingRef.current || durationMs;
      if (ms <= 0) return;
      setTotalMs(ms);
      setRemainingMs(ms);
      endAtRef.current = performance.now() + ms;
      pausedRemainingRef.current = 0;
    } else {
      const ms = pausedElapsedRef.current;
      setElapsedMs(ms);
      startAtRef.current = performance.now() - ms;
      pausedElapsedRef.current = 0;
    }

    setRunning(true);
  };

  const pauseTimer = () => {
    if (!running) return;

    if (isCountDown && endAtRef.current !== null) {
      pausedRemainingRef.current = Math.max(0, endAtRef.current - performance.now());
      setRemainingMs(pausedRemainingRef.current);
      const p = partsFromMs(pausedRemainingRef.current);
      setHours(p.h);
      setMinutes(p.m);
      setSeconds(p.s);
      endAtRef.current = null;
    } else if (!isCountDown && startAtRef.current !== null) {
      pausedElapsedRef.current = performance.now() - startAtRef.current;
      setElapsedMs(pausedElapsedRef.current);
      startAtRef.current = null;
    }

    setRunning(false);
  };

  const resetTimer = () => {
    endAtRef.current = null;
    startAtRef.current = null;
    pausedRemainingRef.current = 0;
    pausedElapsedRef.current = 0;
    toastedRef.current = false;
    setRunning(false);

    if (isCountDown) {
      syncDuration(hours, minutes, seconds);
    } else {
      setElapsedMs(0);
    }
  };

  const switchMode = (next: Mode) => {
    if (running) pauseTimer();
    setMode(next);
  };

  const switchDirection = (next: TimerDirection) => {
    if (running) pauseTimer();
    setTimerDirection(next);
    if (next === 'down') {
      syncDuration(hours, minutes, seconds);
      setElapsedMs(0);
    } else {
      setElapsedMs(pausedElapsedRef.current);
      setRemainingMs(durationMs);
    }
  };

  return (
    <div className="bg-scene flex min-h-dvh flex-col">
      <Toaster position="top-center" richColors closeButton />

      <header className="flex items-center justify-between px-6 pt-6">
        <span className="text-sm font-medium tracking-tight text-neutral-500">Analogue</span>
        <div className="flex rounded-full border border-black/8 bg-white/60 p-1 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          {(['clock', 'timer'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                mode === m
                  ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-row">
        <AnimatePresence>
          {mode === 'timer' && (
            <motion.aside
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-44 shrink-0 flex-col justify-center border-r border-black/6 px-4 py-6 sm:w-64 sm:px-6 lg:w-72 dark:border-white/8"
            >
              <div className="w-full space-y-5 sm:space-y-6">
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-neutral-400">Direction</p>
                  <div className="flex rounded-xl border border-black/8 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => switchDirection('down')}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition disabled:opacity-40 ${
                        isCountDown
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'text-neutral-500'
                      }`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                      Down
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => switchDirection('up')}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition disabled:opacity-40 ${
                        !isCountDown
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'text-neutral-500'
                      }`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                      Up
                    </button>
                  </div>
                </div>

                {isCountDown && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-widest text-neutral-400">Duration</p>
                    <div className="grid grid-cols-3 gap-2">
                      <DurationInput label="Hr" value={hours} max={23} disabled={running} onChange={(v) => { setHours(v); syncDuration(v, minutes, seconds); }} />
                      <DurationInput label="Min" value={minutes} max={59} disabled={running} onChange={(v) => { setMinutes(v); syncDuration(hours, v, seconds); }} />
                      <DurationInput label="Sec" value={seconds} max={59} disabled={running} onChange={(v) => { setSeconds(v); syncDuration(hours, minutes, v); }} />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {running ? (
                    <Button variant="secondary" className="h-11 w-full rounded-xl" onClick={pauseTimer}>
                      <Pause className="mr-2 h-4 w-4" /> Pause
                    </Button>
                  ) : (
                    <Button
                      className="h-11 w-full rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
                      onClick={startTimer}
                      disabled={isCountDown && durationMs === 0}
                    >
                      <Play className="mr-2 h-4 w-4" /> Start
                    </Button>
                  )}
                  <Button variant="ghost" className="h-11 w-full rounded-xl" onClick={resetTimer}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-10">
          <div className="relative">
            <AnimatePresence>
              {mode === 'timer' && isCountDown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <TimerRing progress={progress} urgent={urgent} />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              layout
              className="clock-shell relative rounded-full shadow-2xl shadow-black/10 ring-1 ring-black/5 dark:shadow-black/40 dark:ring-white/10"
            >
              {mode === 'clock' ? (
                <LiveClock smoothSweep hideDate cardinalOnly />
              ) : (
                <BaseClock
                  hours={timerParts.h}
                  minutes={timerParts.m}
                  seconds={timerParts.s}
                  milliseconds={displayMs % 1000}
                  cardinalOnly
                />
              )}
            </motion.div>
          </div>

          <motion.div layout className="text-center">
            <p
              className={`text-6xl font-light tabular-nums tracking-tight sm:text-7xl ${
                urgent ? 'text-red-500' : 'text-neutral-900 dark:text-neutral-50'
              }`}
            >
              {digital}
            </p>
            <p className="mt-3 text-sm text-neutral-500">{subtitle}</p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
