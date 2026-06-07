/**
 * Minimal OpenAI helpers over the REST API (no SDK dependency).
 * Server-only — the API key never reaches the client.
 */

import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export const hasOpenAI = !!env.OPENAI_API_KEY;

const BASE = "https://api.openai.com/v1";

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${env.OPENAI_API_KEY}` };
}

/** Chat completion constrained to a JSON object response. */
export async function openaiChatJSON(opts: {
  system: string;
  user: string;
  model?: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AppError(
      "OPENAI_ERROR",
      `OpenAI request failed (${res.status}).`,
      502,
      detail ? { detail: detail.slice(0, 300) } : undefined,
    );
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new AppError("OPENAI_ERROR", "Empty AI response.", 502);
  }
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new AppError("OPENAI_ERROR", "AI returned malformed JSON.", 502);
  }
}

/**
 * Generate an image from a reference image + prompt (gpt-image-1 edit).
 * Returns a PNG buffer. Requires an OpenAI org with gpt-image-1 access.
 */
export async function openaiImageEdit(opts: {
  image: Buffer;
  contentType: string;
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
}): Promise<Buffer> {
  const ext = opts.contentType.includes("png")
    ? "png"
    : opts.contentType.includes("webp")
      ? "webp"
      : "jpg";
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", opts.prompt);
  form.append("size", opts.size ?? "1024x1024");
  form.append(
    "image",
    new Blob([new Uint8Array(opts.image)], { type: opts.contentType }),
    `source.${ext}`,
  );

  const res = await fetch(`${BASE}/images/edits`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AppError(
      "OPENAI_ERROR",
      `Image generation failed (${res.status}).`,
      502,
      detail ? { detail: detail.slice(0, 300) } : undefined,
    );
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (typeof b64 !== "string") {
    throw new AppError("OPENAI_ERROR", "No image returned.", 502);
  }
  return Buffer.from(b64, "base64");
}
