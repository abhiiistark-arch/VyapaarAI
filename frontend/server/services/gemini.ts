import { GoogleGenAI } from "@google/genai";
import { config } from "../config";

const FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
];

export class GeminiError extends Error {}

const GUARDRAILS_FAST =
  "You are VyapaarAI, a Google Business Profile assistant for Indian local businesses. Be concise, practical, and brand-safe. Never invent Google policy violations.";

function modelChain(fast = true) {
  const preferred = fast ? config.geminiFastModel : config.geminiModel;
  const chain = [preferred, config.geminiModel, ...FALLBACK_MODELS];
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const m of chain) {
    if (m && !seen.has(m)) {
      seen.add(m);
      ordered.push(m);
    }
  }
  return ordered;
}

function client() {
  if (!config.geminiApiKey) throw new GeminiError("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

export async function generateJson(prompt: string, schemaHint = "", fast = true) {
  const ai = client();
  const full = `${GUARDRAILS_FAST}\n\n${schemaHint}\n\n${prompt}\nReturn valid JSON only.`;
  const errors: string[] = [];
  for (const model of modelChain(fast)) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: full,
        config: {
          temperature: fast ? 0.3 : 0.45,
          maxOutputTokens: fast ? 512 : 1200,
          responseMimeType: "application/json",
        },
      });
      const text = response.text || "{}";
      const data = JSON.parse(text) as Record<string, unknown>;
      data._model_used = model;
      return data;
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new GeminiError(
    "Gemini timed out or failed (free tier can be slow/busy). Try again. " + errors.slice(0, 2).join(" | ")
  );
}

export async function generateText(prompt: string, fast = true) {
  const ai = client();
  const errors: string[] = [];
  for (const model of modelChain(fast)) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `${GUARDRAILS_FAST}\n\n${prompt}`,
        config: { temperature: 0.3, maxOutputTokens: 700 },
      });
      return (response.text || "").trim();
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new GeminiError(
    "Gemini timed out or failed (free tier can be slow/busy). Try again. " + errors.slice(0, 2).join(" | ")
  );
}
