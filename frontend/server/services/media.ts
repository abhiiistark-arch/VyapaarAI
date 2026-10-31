import { Location } from "../db/store";
import { GeminiError, generateJson } from "./gemini";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLines(text: string, width = 36) {
  const words = (text || "").split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = `${current} ${word}`.trim();
    if (trial.length <= width) current = trial;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4).length ? lines.slice(0, 4) : ["Fresh from the kitchen"];
}

function svgPoster(opts: {
  title: string;
  subject: string;
  caption: string;
  accent?: string;
}) {
  const lines = wrapLines(opts.caption || opts.subject);
  const accent = opts.accent || "#c2410c";
  const lineEls = lines
    .map(
      (line, i) =>
        `<text x="48" y="${320 + i * 36}" fill="#fff7ed" font-family="Georgia, serif" font-size="28">${escapeXml(line)}</text>`
    )
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c2d12"/>
      <stop offset="55%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#431407"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <circle cx="860" cy="180" r="160" fill="#fbbf24" opacity="0.18"/>
  <circle cx="200" cy="900" r="220" fill="#fb923c" opacity="0.12"/>
  <text x="48" y="96" fill="#ffedd5" font-family="system-ui,sans-serif" font-size="22" letter-spacing="4">${escapeXml(opts.title.toUpperCase())}</text>
  <text x="48" y="240" fill="#fff7ed" font-family="Georgia, serif" font-size="54" font-weight="700">${escapeXml(opts.subject.slice(0, 42))}</text>
  ${lineEls}
  <text x="48" y="1020" fill="#fed7aa" font-family="system-ui,sans-serif" font-size="20">VyapaarAI · Google Business ready</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function generateMarketingImage(
  location: Location,
  opts: { brief?: string; category?: string; style?: string } = {}
) {
  const brief = (opts.brief || "").trim() || "Signature dish, appetizing plating";
  const subject = brief.split(/[.\n]/)[0].slice(0, 60) || location.title;
  let caption = `${subject} at ${location.title}`;
  let generationSource = "svg_fallback";

  try {
    const plan = await generateJson(
      `Plan a marketing photo for ${location.title} (${location.primary_category}).
Brief: ${brief}
Style: ${opts.style || "photorealistic food photography"}
Return JSON with: primary_subject, caption, image_prompt, mood, accent_hex`,
      '{"primary_subject":"","caption":"","image_prompt":"","mood":"","accent_hex":"#c2410c"}',
      false
    );
    caption = String(plan.caption || caption);
    const accent = String(plan.accent_hex || "#c2410c");
    const primary = String(plan.primary_subject || subject);
    // Free-tier image models often unavailable — SVG always works on Vercel.
    const source_url = svgPoster({
      title: location.title,
      subject: primary,
      caption,
      accent: /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : "#c2410c",
    });
    return {
      source_url,
      caption,
      category: opts.category || "ADDITIONAL",
      media_format: "PHOTO",
      generation_source: generationSource,
      primary_subject: primary,
      image_prompt: plan.image_prompt,
    };
  } catch (err) {
    if (!(err instanceof GeminiError)) throw err;
    const source_url = svgPoster({
      title: location.title,
      subject,
      caption,
    });
    return {
      source_url,
      caption,
      category: opts.category || "ADDITIONAL",
      media_format: "PHOTO",
      generation_source: "svg_fallback",
      gemini_error: err.message.slice(0, 240),
    };
  }
}
