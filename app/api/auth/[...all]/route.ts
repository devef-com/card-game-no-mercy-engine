import { getAuth } from "@/src/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getHandler() {
  const auth = getAuth();
  return toNextJsHandler(auth);
}

export async function GET(req: Request) {
  return getHandler().GET(req);
}

export async function POST(req: Request) {
  return getHandler().POST(req);
}

// (opcional, por si Better Auth los usa)
export async function PUT(req: Request) {
  return getHandler().PUT(req);
}

export async function PATCH(req: Request) {
  return getHandler().PATCH(req);
}

export async function DELETE(req: Request) {
  return getHandler().DELETE(req);
}
