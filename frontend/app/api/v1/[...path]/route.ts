import { NextRequest } from "next/server";
import { handleError } from "@/server/core/http";
import { dispatch } from "@/server/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, ctx: { params: { path?: string[] } }) {
  try {
    const parts = ctx.params.path || [];
    return await dispatch(req, parts);
  } catch (err) {
    return handleError(err);
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
