import { cookies } from "next/headers";
import { getStudent } from "@/lib/repo";
import type { Student } from "@/lib/types";

const UID_COOKIE = "tb_uid";
const TOKEN_COOKIE = "tb_token";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;

export async function getSessionUserId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(UID_COOKIE)?.value;
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function getCurrentStudent(): Promise<Student | null> {
  const gitlabUserId = await getSessionUserId();
  if (gitlabUserId === null) return null;
  return getStudent(gitlabUserId);
}

export async function setSession(gitlabUserId: number, accessToken?: string): Promise<void> {
  const jar = await cookies();
  jar.set(UID_COOKIE, String(gitlabUserId), COOKIE_OPTIONS);
  if (accessToken) jar.set(TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(UID_COOKIE);
  jar.delete(TOKEN_COOKIE);
}

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(TOKEN_COOKIE)?.value ?? null;
}

export async function requireCurrentStudent(): Promise<Student> {
  const student = await getCurrentStudent();
  if (!student) throw new Error("Not authenticated");
  return student;
}
