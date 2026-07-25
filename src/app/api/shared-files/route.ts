import { NextResponse } from "next/server";
import crypto from "crypto";
import SharedFile from "@/models/SharedFile";
import connectToDatabase from "@/lib/dbConnect";

// Shared links stay alive for 7 days, then the TTL index drops the document.
const EXPIRY_DAYS = 7;
// Generous ceiling for a payment-table sheet (~10-50 KB) while staying far
// under MongoDB's 16 MB document limit.
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Behind Vercel's proxy `request.url` can carry the internal host/protocol, so
// prefer the forwarded headers when building the link we hand to WhatsApp.
function absoluteUrl(request: Request, path: string) {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) {
    return new URL(path, request.url).toString();
  }
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}${path}`;
}

// POST: Store an uploaded file and return a public, auth-free download link.
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Missing file in request" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File is too large to share" },
        { status: 413 }
      );
    }

    const data = Buffer.from(await file.arrayBuffer());
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Strip any path separators a client might smuggle into the name.
    const fileName =
      (formData.get("fileName") as string | null)?.split(/[\\/]/).pop() ||
      file.name ||
      "shared-file.xlsx";

    await SharedFile.create({
      token,
      fileName,
      contentType: file.type || XLSX_CONTENT_TYPE,
      data,
      size: data.length,
      expiresAt,
    });

    const downloadPath = `/api/shared-files/${token}`;

    return NextResponse.json(
      { token, fileName, downloadPath, downloadUrl: absoluteUrl(request, downloadPath), expiresAt },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error storing shared file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
