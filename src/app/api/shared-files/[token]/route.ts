import { NextResponse } from "next/server";
import SharedFile from "@/models/SharedFile";
import connectToDatabase from "@/lib/dbConnect";


// GET: Public download. No auth — middleware already skips /api, and the
// unguessable token is what protects the file.
export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    await connectToDatabase();
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    // Deliberately not .lean(): a lean read hands back a raw BSON Binary, and
    // Buffer.from(Binary) silently yields zero bytes. The hydrated doc gives a
    // real Buffer.
    const shared = await SharedFile.findOne({ token });

    if (!shared) {
      return NextResponse.json(
        { error: "This link has expired or is no longer available" },
        { status: 404 }
      );
    }

    // The TTL monitor only sweeps once a minute, so enforce expiry here too.
    if (shared.expiresAt && shared.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 410 });
    }

    const body = new Uint8Array(shared.data);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": shared.contentType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `attachment; filename="${shared.fileName.replace(
          /"/g,
          ""
        )}"; filename*=UTF-8''${encodeURIComponent(shared.fileName)}`,
        // Links are one-per-share and short lived; don't let proxies hold them.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error fetching shared file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
