import type { Festivo } from "../repositories/festivos.repository.js";

function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();

  return day === 0 || day === 6;
}

function buildHolidaySet(festivos: Festivo[]): Set<string> {
  return new Set(
    festivos
      .filter((festivo) => festivo.activo)
      .map((festivo) => festivo.fecha),
  );
}

export function isBusinessDay(date: Date, festivos: Festivo[]): boolean {
  const normalized = toDateOnly(date);

  if (isWeekend(normalized)) {
    return false;
  }

  const holidaySet = buildHolidaySet(festivos);

  return !holidaySet.has(formatDateOnly(normalized));
}

export function addBusinessDays(
  startDate: Date,
  businessDays: number,
  festivos: Festivo[],
): Date {
  if (businessDays < 0) {
    throw new Error("businessDays no puede ser negativo");
  }

  let current = toDateOnly(startDate);
  let added = 0;

  while (added < businessDays) {
    current = new Date(current.getTime() + 86_400_000);

    if (isBusinessDay(current, festivos)) {
      added += 1;
    }
  }

  return current;
}
