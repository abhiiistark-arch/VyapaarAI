import { GoogleGenAI } from "@google/genai";
import { config } from "../config";
import { Location } from "../db/store";
import { GeminiError, generateJson } from "./gemini";

const IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
  "gemini-3-pro-image-preview",
];

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

function buildPhotoPrompt(opts: {
  business: string;
  category: string;
  brief: string;
  style: string;
  imagePrompt?: string;
  lighting?: string;
  camera?: string;
  subject?: string;
}) {
  const scene =
    opts.imagePrompt ||
    `Photorealistic photograph of ${opts.brief} for ${opts.business}, a ${opts.category}.`;
  return `Create ONE photorealistic square (1:1) photograph for a Google Business Profile. Output an IMAGE only.

SCENE:
${scene}

Primary subject: ${opts.subject || opts.brief}
Style: ${opts.style}
Lighting: ${opts.lighting || "soft natural daylight from a nearby window"}
Camera: ${opts.camera || "50mm lens, f/2.8, shallow depth of field"}

HARD RULES:
- Real food / restaurant photography look — NOT illustration, poster, graphic design, cartoon, 3D render, or text layout
- NO watermarks, logos, UI, captions, typography, or readable text burned into the image
- Appetizing textures, natural plating, restaurant table context when relevant
- Clean professional local-business quality`;
}

async function tryGeminiImage(prompt: string): Promise<{ dataUrl: string; model: string } | null> {
  if (!config.geminiApiKey) return null;
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  for (const model of IMAGE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.7,
          responseModalities: ["TEXT", "IMAGE"] as ("TEXT" | "IMAGE")[],
        },
      });
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
        if (inline?.data) {
          const mime = inline.mimeType || "image/png";
          const dataUrl = inline.data.startsWith("data:")
            ? inline.data
            : `data:${mime};base64,${inline.data}`;
          return { dataUrl, model };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** Photorealistic fallback when Gemini image quota is busy (server-side fetch → data URL). */
async function tryPhotorealisticFallback(prompt: string): Promise<string | null> {
  const compact = prompt.replace(/\s+/g, " ").slice(0, 420);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(compact)}` +
    `?width=1024&height=1024&nologo=true&model=flux`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8_000) return null;
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function svgLastResort(opts: { title: string; subject: string; caption: string }) {
  const lines = wrapLines(opts.caption || opts.subject);
  const lineEls = lines
    .map(
      (line, i) =>
        `<text x="64" y="${520 + i * 34}" fill="#4A403A" font-family="system-ui,sans-serif" font-size="24">${escapeXml(line)}</text>`
    )
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF8F1"/>
      <stop offset="100%" stop-color="#F3E7D9"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <rect x="72" y="72" width="936" height="936" rx="36" fill="#fff" opacity="0.9"/>
  <text x="120" y="180" fill="#1F1A17" font-family="Georgia,serif" font-size="36">${escapeXml(opts.title)}</text>
  <text x="120" y="280" fill="#1F1A17" font-family="Georgia,serif" font-size="48">${escapeXml(opts.subject.slice(0, 48))}</text>
  ${lineEls}
  <text x="120" y="980" fill="#8A7B71" font-family="system-ui,sans-serif" font-size="18">Placeholder — photorealistic generation unavailable. Retry shortly.</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function generateMarketingImage(
  location: Location,
  opts: { brief?: string; category?: string; style?: string } = {}
) {
  const brief = (opts.brief || "").trim() || "Signature dish, appetizing plating on a restaurant table";
  const style = opts.style || "photorealistic food photography";
  const subjectGuess = brief.split(/[.\n]/)[0].slice(0, 80) || location.title;
  let caption = `${subjectGuess} at ${location.title}`;
  let plan: Record<string, unknown> = {
    primary_subject: subjectGuess,
    caption,
    image_prompt: "",
    lighting: "soft natural daylight",
    camera: "50mm lens, f/2.8",
  };

  try {
    plan = {
      ...plan,
      ...(await generateJson(
        `Plan ONE photorealistic marketing PHOTO (not a poster) for ${location.title} (${location.primary_category}).
User brief (follow closely): ${brief}
Style: ${style}
Address context: ${location.address || "India local restaurant"}
Return JSON:
primary_subject, caption, image_prompt (detailed photo scene, no text overlays), lighting, camera, mood, visual_elements[]`,
        '{"primary_subject":"","caption":"","image_prompt":"","lighting":"","camera":"","mood":"","visual_elements":[]}',
        false
      )),
    };
  } catch {
    /* keep fallback plan */
  }

  caption = String(plan.caption || caption);
  const primary = String(plan.primary_subject || subjectGuess);
  const renderPrompt = buildPhotoPrompt({
    business: location.title,
    category: location.primary_category,
    brief,
    style,
    imagePrompt: String(plan.image_prompt || ""),
    lighting: String(plan.lighting || ""),
    camera: String(plan.camera || ""),
    subject: primary,
  });

  const gemini = await tryGeminiImage(renderPrompt);
  if (gemini) {
    return {
      source_url: gemini.dataUrl,
      caption,
      category: opts.category || "ADDITIONAL",
      media_format: "PHOTO",
      generation_source: "gemini_image",
      primary_subject: primary,
      image_prompt: plan.image_prompt,
      note: "Photorealistic AI image generated.",
      _model_used: gemini.model,
    };
  }

  const photoFallback = await tryPhotorealisticFallback(
    `${brief}, ${primary}, ${location.primary_category}, photorealistic food photography, natural light, restaurant table, appetizing plating, no text, no watermark, 85mm lens`
  );
  if (photoFallback) {
    return {
      source_url: photoFallback,
      caption,
      category: opts.category || "ADDITIONAL",
      media_format: "PHOTO",
      generation_source: "photorealistic_fallback",
      primary_subject: primary,
      image_prompt: plan.image_prompt,
      note: "Photorealistic image ready (Gemini image quota busy — alternate photo engine used).",
    };
  }

  if (!config.geminiApiKey) {
    throw new GeminiError(
      "GEMINI_API_KEY is not set on the Next server. Add it in frontend/.env.local (or Vercel env) for AI photos."
    );
  }

  return {
    source_url: svgLastResort({ title: location.title, subject: primary, caption }),
    caption,
    category: opts.category || "ADDITIONAL",
    media_format: "PHOTO",
    generation_source: "svg_fallback",
    primary_subject: primary,
    image_prompt: plan.image_prompt,
    note: "Could not reach image models right now — placeholder shown. Try Generate again in a minute.",
  };
}
