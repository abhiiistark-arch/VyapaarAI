import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function text(body: string, status = 200, headers?: Record<string, string>) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}

export function pdf(bytes: Uint8Array, filename: string, status = 200) {
  return new NextResponse(Buffer.from(bytes), {
    status,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) {
    return json({ detail: err.detail }, err.status);
  }
  console.error("[api]", err);
  return json({ detail: err instanceof Error ? err.message : "Internal error" }, 500);
}
