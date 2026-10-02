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

const MARGIN_X = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BODY_TOP = 686;
const MARGIN_BOTTOM = 92;

const HEADER_TOP = 812;
const HEADER_BOTTOM = 716;

const REPORT_LOGO_JPEG_WIDTH = 240;
const REPORT_LOGO_JPEG_HEIGHT = 134;
const REPORT_LOGO_JPEG = Buffer.from("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", "base64");

function normalizePdfText(value: string): string {
  return value
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
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

function bullet(text: string): string {
  // 0x95 corresponde al bullet de WinAnsiEncoding.
  return `\x95  ${text}`;
}

class SimplePdf {
  private pages: string[][] = [[]];
  private y = BODY_TOP;

  constructor() {
    this.drawPageHeader();
  }

  private currentPage(): string[] {
    return this.pages[this.pages.length - 1]!;
  }

  private addTextAt(
    text: string,
    x: number,
    y: number,
    size: number,
    bold = false,
    color: [number, number, number] = [0, 0, 0],
  ): void {
    const font = bold ? "F2" : "F1";
    const [r, g, b] = color;

    this.currentPage().push(
      `BT /${font} ${size} Tf ${r} ${g} ${b} rg ${x.toFixed(
        2,
      )} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`,
    );
  }

  private addCenteredText(
    text: string,
    left: number,
    right: number,
    y: number,
    size: number,
    bold = false,
    color: [number, number, number] = [0, 0, 0],
  ): void {
    const estimatedWidth = normalizePdfText(text).length * size * 0.52;
    const x = left + Math.max(0, (right - left - estimatedWidth) / 2);

    this.addTextAt(text, x, y, size, bold, color);
  }

  private drawPageHeader(): void {
    const left = MARGIN_X;
    const right = PAGE_WIDTH - MARGIN_X;
    const width = right - left;

    const upperBottom = 752;
    const upperMiddle = 782;
    const lowerMiddle = 734;
    const logoRight = 157;
    const titleRight = 462;
    const lowerMiddleX = left + width / 2;

    this.currentPage().push(
      "0 G 0.7 w",
      `${left} ${HEADER_BOTTOM} ${width} ${HEADER_TOP - HEADER_BOTTOM} re S`,
      `${left} ${upperBottom} m ${right} ${upperBottom} l S`,
      `${logoRight} ${upperBottom} m ${logoRight} ${HEADER_TOP} l S`,
      `${titleRight} ${upperBottom} m ${titleRight} ${HEADER_TOP} l S`,
      `${logoRight} ${upperMiddle} m ${right} ${upperMiddle} l S`,
      `${left} ${lowerMiddle} m ${right} ${lowerMiddle} l S`,
      `${lowerMiddleX.toFixed(2)} ${HEADER_BOTTOM} m ${lowerMiddleX.toFixed(
        2,
      )} ${upperBottom} l S`,
    );

    const logoWidth = 92;
    const logoHeight =
      logoWidth * (REPORT_LOGO_JPEG_HEIGHT / REPORT_LOGO_JPEG_WIDTH);
    const logoX = left + (logoRight - left - logoWidth) / 2;
    const logoY = upperBottom + (HEADER_TOP - upperBottom - logoHeight) / 2;

    this.currentPage().push(
      `q ${logoWidth.toFixed(2)} 0 0 ${logoHeight.toFixed(2)} ${logoX.toFixed(
        2,
      )} ${logoY.toFixed(2)} cm /Logo Do Q`,
    );

    this.addCenteredText("Formato", logoRight, titleRight, 796, 10, true);
    this.addCenteredText("Paz y Salvo", logoRight, titleRight, 764, 11);

    this.addCenteredText(
      "Macroproceso",
      left,
      lowerMiddleX,
      740,
      9,
      true,
    );
    this.addCenteredText(
      "Proceso",
      lowerMiddleX,
      right,
      740,
      9,
      true,
    );

    this.addCenteredText(
      "Talento Humano",
      left,
      lowerMiddleX,
      722,
      9,
    );
    this.addCenteredText("Nómina", lowerMiddleX, right, 722, 9);
  }

  private newPage(): void {
    this.pages.push([]);
    this.y = BODY_TOP;
    this.drawPageHeader();
  }

  addLine(line: PdfLine): void {
    const size = line.size ?? 10;
    const indent = line.indent ?? 0;
    const lineHeight = size * 1.3;
    const gapAfter = line.gapAfter ?? 3;
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

  private footerCommands(pageNumber: number, totalPages: number): string[] {
    const disclaimer =
      "Este documento consolida el estado final del proceso y su trazabilidad operativa y funcional. " +
      "Los intentos de rechazo previos no se incluyen en este reporte; permanecen disponibles en la auditoría del sistema.";

    const disclaimerLines = wrapText(disclaimer, 8, CONTENT_WIDTH);
    const commands: string[] = [];
    let y = 54;

    for (const line of disclaimerLines.slice(0, 3)) {
      commands.push(
        `BT /F1 8 Tf 0 g ${MARGIN_X.toFixed(2)} ${y.toFixed(
          2,
        )} Td (${escapePdfText(line)}) Tj ET`,
      );
      y -= 9;
    }

    commands.push(
      `BT /F1 8 Tf 0.35 g ${MARGIN_X.toFixed(2)} 20 Td (Documento generado por TH_PYS - Página ${pageNumber} de ${totalPages}) Tj ET`,
    );

    return commands;
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
    const logoId = addObject(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${REPORT_LOGO_JPEG_WIDTH} /Height ${REPORT_LOGO_JPEG_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${REPORT_LOGO_JPEG.length} >>\nstream\n`,
          "latin1",
        ),
        REPORT_LOGO_JPEG,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );

    const pageIds: number[] = [];

    for (let index = 0; index < this.pages.length; index += 1) {
      const pageNumber = index + 1;
      const footer = this.footerCommands(pageNumber, this.pages.length);
      const streamText = [...this.pages[index]!, ...footer].join("\n");
      const streamBuffer = Buffer.from(streamText, "latin1");
      const contentId = addObject(
        Buffer.concat([
          Buffer.from(
            `<< /Length ${streamBuffer.length} >>\nstream\n`,
            "latin1",
          ),
          streamBuffer,
          Buffer.from("\nendstream", "latin1"),
        ]),
      );

      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
          `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> /XObject << /Logo ${logoId} 0 R >> >> ` +
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

    const chunks: Buffer[] = [
      Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1"),
    ];
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
    text: "Información general",
    size: 14,
    bold: true,
    gapAfter: 12,
  });

  pdf.addLine({ text: bullet(`Empleado: ${userName(proceso.empleadoId)}`) });
  pdf.addLine({ text: bullet(`Proceso: ${proceso.procesoId}`) });
  pdf.addLine({
    text: bullet(`Tipo de solicitud: ${proceso.tipoSolicitudId}`),
  });
  pdf.addLine({ text: bullet(`Estado final: ${proceso.estado}`) });
  pdf.addLine({
    text: bullet(`Creado por: ${userName(proceso.creadoPorId)}`),
  });
  pdf.addLine({
    text: bullet(`Fecha de creación: ${formatDate(proceso.fechaInicio)}`),
  });
  pdf.addLine({
    text: bullet(`Fecha de salida: ${formatDate(proceso.fechaSalida)}`),
  });
  pdf.addLine({
    text: bullet(`Fecha límite: ${formatDate(proceso.fechaLimite)}`),
  });
  pdf.addLine({
    text: bullet(`Cierre: ${formatBogotaDateTime(proceso.closedAtUtc)}`),
  });
  pdf.addLine({
    text: bullet(`Cerrado por: ${userName(proceso.cerradoPorId)}`),
  });

  if (proceso.comentarioTH?.trim()) {
    pdf.addLine({
      text: bullet(
        `Comentario de Talento Humano: ${proceso.comentarioTH.trim()}`,
      ),
      gapAfter: 10,
    });
  } else {
    pdf.addSpacer(7);
  }

  pdf.addLine({
    text: "Gestión por áreas y tareas",
    size: 14,
    bold: true,
    gapAfter: 14,
  });

  dataset.areas.forEach((area, areaIndex) => {
    pdf.addLine({
      text: `${areaIndex + 1}.  ${area.areaNombre}`,
      size: 11,
      bold: true,
      gapAfter: 8,
    });

    pdf.addLine({
      text: bullet(
        `Responsable funcional: ${userName(area.responsableFuncionalId)}`,
      ),
      indent: 0,
    });
    pdf.addLine({
      text: bullet(
        `Área completada: ${formatBogotaDateTime(area.completadaEnUtc)}`,
      ),
      indent: 0,
    });
    pdf.addLine({
      text: bullet(`Completada por: ${userName(area.completadaPorId)}`),
      indent: 0,
      gapAfter: 8,
    });

    area.tareas.forEach((task, taskIndex) => {
      pdf.addLine({
        text: `${areaIndex + 1}.${taskIndex + 1}  ${task.tarea}`,
        bold: true,
        indent: 24,
        gapAfter: 6,
      });
      pdf.addLine({
        text: bullet(`Estado: ${task.estado}`),
        indent: 0,
      });
      pdf.addLine({
        text: bullet(
          `Responsable operativo: ${userName(task.responsableOperativoId)}`,
        ),
        indent: 0,
      });
      pdf.addLine({
        text: bullet(
          `Gestión: ${formatBogotaDateTime(task.gestionadoEnUtc)}` +
            (task.gestionadoPorId
              ? ` - por ${userName(task.gestionadoPorId)}`
              : ""),
        ),
        indent: 0,
      });
      pdf.addLine({
        text: bullet(
          `Aprobación: ${formatBogotaDateTime(task.aprobadoEnUtc)}` +
            (task.aprobadoPorId
              ? ` - por ${userName(task.aprobadoPorId)}`
              : ""),
        ),
        indent: 0,
      });

      if (task.comentario?.trim()) {
        pdf.addLine({
          text: bullet(`Comentario: ${task.comentario.trim()}`),
          indent: 0,
          gapAfter: 8,
        });
      } else {
        pdf.addSpacer(6);
      }
    });

    pdf.addSpacer(8);
  });

  return pdf.toBuffer();
}
