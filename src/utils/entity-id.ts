import crypto from "node:crypto";

function shortId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

export function processId(): string {
  return `PYS-${shortId()}`;
}

export function areaProcessId(): string {
  return `AREA-${shortId()}`;
}

export function taskId(): string {
  return `TASK-${shortId()}`;
}

export function eventId(): string {
  return `EVT-${shortId()}`;
}

export function evidenceId(): string {
  return `EVD-${shortId()}`;
}
