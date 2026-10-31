import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { config } from "../config";
import { getStore, type Membership, type User } from "../db/store";
import { ApiError } from "./http";

const encoder = new TextEncoder();

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}

export async function createAccessToken(userId: string, extra: Record<string, unknown> = {}) {
  return new SignJWT({ ...extra })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encoder.encode(config.secretKey));
}

export async function decodeAccessToken(token: string) {
  const { payload } = await jwtVerify(token, encoder.encode(config.secretKey));
  return payload as { sub?: string; tenant_id?: string; purpose?: string };
}

export async function requireUser(req: NextRequest): Promise<{
  user: User;
  membership: Membership;
  token: string;
}> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new ApiError(401, "Not authenticated");

  let payload: { sub?: string; tenant_id?: string };
  try {
    payload = await decodeAccessToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
  if (!payload.sub) throw new ApiError(401, "Invalid token");

  const store = getStore();
  const user = store.users.get(payload.sub);
  if (!user) throw new ApiError(401, "User not found");

  const membership =
    [...store.memberships.values()].find(
      (m) => m.user_id === user.id && m.status === "active" && (!payload.tenant_id || m.tenant_id === payload.tenant_id)
    ) || null;
  if (!membership) throw new ApiError(403, "No active workspace membership");

  return { user, membership, token };
}
