import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Build a simple multi-page A4-ish PDF from plain text lines. */
export async function buildReportPdf(opts: {
  title: string;
  lines: string[];
  footer?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 56;

  const drawWrapped = (text: string, size: number, useBold: boolean, gap: number) => {
    const f = useBold ? bold : font;
    const words = text.split(/\s+/).filter(Boolean);
    let row = "";
    const flush = () => {
      if (!row) return;
      if (y < 56) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 56;
      }
      page.drawText(row, {
        x: margin,
        y,
        size,
        font: f,
        color: rgb(0.12, 0.1, 0.09),
        maxWidth,
      });
      y -= gap;
      row = "";
    };
    for (const word of words) {
      const trial = row ? `${row} ${word}` : word;
      if (f.widthOfTextAtSize(trial, size) > maxWidth && row) {
        flush();
        row = word;
      } else {
        row = trial;
      }
    }
    flush();
  };

  drawWrapped(opts.title, 18, true, 26);
  for (const line of opts.lines) {
    if (!line.trim()) {
      y -= 10;
      continue;
    }
    const isSection = line.startsWith("==");
    const clean = line.replace(/^==\s*/, "").replace(/\s*==$/, "");
    if (isSection) {
      y -= 8;
      drawWrapped(clean, 13, true, 20);
    } else {
      drawWrapped(clean, 11, false, 16);
    }
  }

  if (opts.footer) {
    if (y < 72) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 56;
    }
    y -= 12;
    drawWrapped(opts.footer, 9, false, 14);
  }

  return doc.save();
}
