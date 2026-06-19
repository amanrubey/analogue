import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatTime(h: number, m: number, s: number) {
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function getClockAngles(date: Date) {
  const ms = date.getMilliseconds();
  const s = date.getSeconds() + ms / 1000;
  const m = date.getMinutes() + s / 60;
  const h = (date.getHours() % 12) + m / 60;

  return {
    hour: h * 30,
    minute: m * 6,
    second: s * 6,
    h: date.getHours(),
    m: date.getMinutes(),
    s: date.getSeconds(),
  };
}

export function getTimerAngles(remainingMs: number) {
  const totalSec = remainingMs / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return {
    hour: ((h % 12) + m / 60) * 30,
    minute: (m + s / 60) * 6,
    second: s * 6,
    h,
    m,
    s: Math.floor(s),
  };
}

export function msFromParts(h: number, m: number, s: number) {
  return (h * 3600 + m * 60 + s) * 1000;
}

export function partsFromMs(ms: number) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

export const partsFromMsFloor = partsFromMs;
