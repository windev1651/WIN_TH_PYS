import type { WebClient } from "@slack/web-api";

import {
  formatBogotaDateTime,
  type HistoricalProcessDataset,
} from "./historical-process.service.js";

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  indent?: number;
  gapAfter?: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function normalizePdfText(value: string): string {
  return value
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\xFF]/g, "?");
}

function escapePdfText(value: string): string {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text: string, size: number, width: number): string[] {
  const normalized = normalizePdfText(text);
  const approximateCharWidth = size * 0.52;
  const maxChars = Math.max(18, Math.floor(width / approximateCharWidth));
  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = words[0] ?? "";

  for (const word of words.slice(1)) {
    if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);

  return lines.flatMap((line) => {
    if (line.length <= maxChars) {
      return [line];
    }

    const chunks: string[] = [];

    for (let i = 0; i < line.length; i += maxChars) {
      chunks.push(line.slice(i, i + maxChars));
    }

    return chunks;
  });
}

class SimplePdf {
  private pages: string[][] = [[]];
  private y = PAGE_HEIGHT - MARGIN_TOP;

  private currentPage(): string[] {
    return this.pages[this.pages.length - 1]!;
  }

  private newPage(): void {
    this.pages.push([]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  addRule(gapAfter = 10): void {
    if (this.y < MARGIN_BOTTOM + 24) {
      this.newPage();
    }

    this.currentPage().push(
      `0.78 G 0.6 w ${MARGIN_X} ${this.y.toFixed(2)} m ${(
        PAGE_WIDTH - MARGIN_X
      ).toFixed(2)} ${this.y.toFixed(2)} l S`,
    );

    this.y -= gapAfter;
  }

  addLine(line: PdfLine): void {
    const size = line.size ?? 10;
    const indent = line.indent ?? 0;
    const lineHeight = size * 1.35;
    const gapAfter = line.gapAfter ?? 4;
    const x = MARGIN_X + indent;
    const availableWidth = CONTENT_WIDTH - indent;
    const wrapped = wrapText(line.text, size, availableWidth);

    for (const part of wrapped) {
      if (this.y - lineHeight < MARGIN_BOTTOM) {
        this.newPage();
      }

      const font = line.bold ? "F2" : "F1";

      this.currentPage().push(
        `BT /${font} ${size} Tf 0 g ${x.toFixed(2)} ${this.y.toFixed(
          2,
        )} Td (${escapePdfText(part)}) Tj ET`,
      );

      this.y -= lineHeight;
    }

    this.y -= gapAfter;
  }

  addSpacer(points: number): void {
    if (this.y - points < MARGIN_BOTTOM) {
      this.newPage();
      return;
    }

    this.y -= points;
  }

  toBuffer(): Buffer {
    const objects: Buffer[] = [];

    const addObject = (content: string | Buffer): number => {
      objects.push(
        Buffer.isBuffer(content) ? content : Buffer.from(content, "latin1"),
      );
      return objects.length;
    };

    const catalogId = addObject("");
    const pagesId = addObject("");
    const fontRegularId = addObject(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    );
    const fontBoldId = addObject(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    );

    const pageIds: number[] = [];

    for (let index = 0; index < this.pages.length; index += 1) {
      const pageNumber = index + 1;
      const footer =
        `BT /F1 8 Tf 0.4 g ${MARGIN_X.toFixed(2)} 28 Td ` +
        `(Documento generado por TH_PYS - Pagina ${pageNumber} de ${this.pages.length}) Tj ET`;

      const streamText = [...this.pages[index]!, footer].join("\n");
      const streamBuffer = Buffer.from(streamText, "latin1");
      const contentId = addObject(
        Buffer.concat([
          Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, "latin1"),
          streamBuffer,
          Buffer.from("\nendstream", "latin1"),
        ]),
      );

      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
          `/Contents ${contentId} 0 R >>`,
      );

      pageIds.push(pageId);
    }

    objects[catalogId - 1] = Buffer.from(
      `<< /Type /Catalog /Pages ${pagesId} 0 R >>`,
      "latin1",
    );

    objects[pagesId - 1] = Buffer.from(
      `<< /Type /Pages /Kids [${pageIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] /Count ${pageIds.length} >>`,
      "latin1",
    );

    const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
    const offsets: number[] = [0];
    let length = chunks[0]!.length;

    objects.forEach((object, index) => {
      offsets.push(length);

      const prefix = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
      const suffix = Buffer.from("\nendobj\n", "latin1");

      chunks.push(prefix, object, suffix);
      length += prefix.length + object.length + suffix.length;
    });

    const xrefOffset = length;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

    for (let index = 1; index <= objects.length; index += 1) {
      xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }

    const trailer =
      xref +
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`;

    chunks.push(Buffer.from(trailer, "latin1"));

    return Buffer.concat(chunks);
  }
}

async function resolveUserNames(
  client: WebClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const names = new Map<string, string>();

  await Promise.all(
    uniqueIds.map(async (userId) => {
      try {
        const response = await client.users.info({ user: userId });
        const user = response.user;
        const profile = user?.profile;

        const name =
          profile?.display_name_normalized?.trim() ||
          profile?.real_name_normalized?.trim() ||
          profile?.display_name?.trim() ||
          profile?.real_name?.trim() ||
          user?.real_name?.trim() ||
          user?.name?.trim() ||
          userId;

        names.set(userId, name);
      } catch {
        names.set(userId, userId);
      }
    }),
  );

  return names;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "No disponible";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export async function generateHistoricalProcessPdf(
  client: WebClient,
  dataset: HistoricalProcessDataset,
): Promise<Buffer> {
  const userIds = [
    dataset.proceso.empleadoId,
    dataset.proceso.creadoPorId,
    dataset.proceso.cerradoPorId ?? "",
    ...dataset.areas.flatMap((area) => [
      area.responsableFuncionalId,
      area.completadaPorId ?? "",
      ...area.tareas.flatMap((task) => [
        task.responsableOperativoId,
        task.gestionadoPorId ?? "",
        task.aprobadoPorId ?? "",
      ]),
    ]),
  ];

  const names = await resolveUserNames(client, userIds);
  const userName = (userId: string | null): string =>
    userId ? names.get(userId) ?? userId : "No disponible";

  const pdf = new SimplePdf();
  const proceso = dataset.proceso;

  pdf.addLine({
    text: "PAZ Y SALVO - REGISTRO DE GESTION",
    size: 17,
    bold: true,
    gapAfter: 4,
  });
  pdf.addLine({
    text: `Proceso: ${proceso.procesoId}`,
    size: 11,
    bold: true,
    gapAfter: 12,
  });

  pdf.addLine({ text: "Informacion general", size: 12, bold: true, gapAfter: 6 });
  pdf.addLine({ text: `Empleado: ${userName(proceso.empleadoId)}` });
  pdf.addLine({ text: `Tipo de solicitud: ${proceso.tipoSolicitudId}` });
  pdf.addLine({ text: `Estado final: ${proceso.estado}` });
  pdf.addLine({ text: `Creado por: ${userName(proceso.creadoPorId)}` });
  pdf.addLine({ text: `Fecha de creacion: ${formatDate(proceso.fechaInicio)}` });
  pdf.addLine({ text: `Fecha de salida: ${formatDate(proceso.fechaSalida)}` });
  pdf.addLine({ text: `Fecha limite: ${formatDate(proceso.fechaLimite)}` });
  pdf.addLine({
    text: `Cierre: ${formatBogotaDateTime(proceso.closedAtUtc)}`,
  });
  pdf.addLine({
    text: `Cerrado por: ${userName(proceso.cerradoPorId)}`,
    gapAfter: 8,
  });

  if (proceso.cierreExcepcion) {
    pdf.addLine({
      text: "Cierre con excepcion",
      size: 11,
      bold: true,
      gapAfter: 4,
    });
    pdf.addLine({
      text: `Motivo: ${proceso.comentarioTH?.trim() || "No registrado"}`,
      gapAfter: 8,
    });
  } else if (proceso.comentarioTH?.trim()) {
    pdf.addLine({
      text: `Comentario de Talento Humano: ${proceso.comentarioTH.trim()}`,
      gapAfter: 8,
    });
  }

  pdf.addRule(12);
  pdf.addLine({
    text: "Gestion por areas y tareas",
    size: 12,
    bold: true,
    gapAfter: 10,
  });

  for (const area of dataset.areas) {
    pdf.addLine({
      text: area.areaNombre,
      size: 11,
      bold: true,
      gapAfter: 4,
    });
    pdf.addLine({
      text: `Responsable funcional: ${userName(area.responsableFuncionalId)}`,
      indent: 8,
    });
    pdf.addLine({
      text: `Area completada: ${formatBogotaDateTime(area.completadaEnUtc)}`,
      indent: 8,
    });
    pdf.addLine({
      text: `Completada por: ${userName(area.completadaPorId)}`,
      indent: 8,
      gapAfter: 6,
    });

    for (const task of area.tareas) {
      pdf.addLine({
        text: `- ${task.tarea}`,
        bold: true,
        indent: 16,
        gapAfter: 2,
      });
      pdf.addLine({
        text: `Estado: ${task.estado}`,
        indent: 28,
        gapAfter: 2,
      });
      pdf.addLine({
        text: `Responsable operativo: ${userName(task.responsableOperativoId)}`,
        indent: 28,
        gapAfter: 2,
      });
      pdf.addLine({
        text:
          `Gestion: ${formatBogotaDateTime(task.gestionadoEnUtc)}` +
          (task.gestionadoPorId
            ? ` - por ${userName(task.gestionadoPorId)}`
            : ""),
        indent: 28,
        gapAfter: 2,
      });
      pdf.addLine({
        text:
          `Aprobacion: ${formatBogotaDateTime(task.aprobadoEnUtc)}` +
          (task.aprobadoPorId
            ? ` - por ${userName(task.aprobadoPorId)}`
            : ""),
        indent: 28,
        gapAfter: 2,
      });

      if (task.comentario?.trim()) {
        pdf.addLine({
          text: `Comentario: ${task.comentario.trim()}`,
          indent: 28,
          gapAfter: 4,
        });
      } else {
        pdf.addSpacer(3);
      }
    }

    pdf.addRule(10);
  }

  pdf.addLine({
    text:
      "Este documento consolida el estado final del proceso y su trazabilidad operativa y funcional. " +
      "Los intentos de rechazo previos no se incluyen en este reporte; permanecen disponibles en la auditoria del sistema.",
    size: 8,
    gapAfter: 0,
  });

  return pdf.toBuffer();
}
