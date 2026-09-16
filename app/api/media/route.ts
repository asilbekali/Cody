import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { put } from "@vercel/blob";
import path from "node:path";
import fs from "node:fs/promises";
import { getOwner } from "@/lib/session";
import {
  hasBlobStore,
  storageConfigured,
  storageUnavailable,
  blobCredentials,
  NO_BLOB_STORE_MESSAGE,
} from "@/lib/store";

export const runtime = "nodejs";

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB — comfortably covers short video

function extensionFor(name: string) {
  const ext = path.extname(name).toLowerCase();
  return /^\.[a-z0-9]{2,5}$/.test(ext) ? ext : "";
}

/**
 * Three upload paths, picked by what credentials the deployment actually has:
 *
 * - A read-write token: issues a short-lived client token so the browser uploads
 *   straight to Vercel Blob. This bypasses the 4.5 MB serverless request body
 *   limit, which matters for video.
 * - OIDC credentials only: a client token cannot be minted from those, so the file
 *   comes through this function and is written with `put`. Vercel's 4.5 MB request
 *   limit applies, so large video needs a read-write token.
 * - Local dev with no credentials: written to `public/uploads`, so the editor works
 *   with zero setup.
 *
 * All three require a signed-in owner.
 */
export async function POST(request: NextRequest) {
  const owner = await getOwner();
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Deployed with no Blob store: public/uploads is not writable, so say why.
  if (storageUnavailable()) {
    return NextResponse.json({ error: NO_BLOB_STORE_MESSAGE }, { status: 503 });
  }
  // No read-write token to mint a client token from, so take the file directly.
  if (!hasBlobStore()) {
    return storageConfigured() ? serverUpload(request) : devUpload(request);
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const credentials = blobCredentials();

    const result = await handleUpload({
      request,
      body,
      ...(credentials && "token" in credentials ? { token: credentials.token } : {}),
      onBeforeGenerateToken: async () => {
        // Re-checked here because this callback is what actually mints the token.
        if (!(await getOwner())) throw new Error("Unauthorized");
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          // Media is served to readers straight from the CDN, and cached hard.
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        };
      },
      onUploadCompleted: async () => {
        // Nothing to record: the editor stores the returned URL in the post body.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}

/** Pulls the file out of a direct (non-client-token) upload and validates it. */
async function readUploadedFile(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return { error: NextResponse.json({ error: "No file provided" }, { status: 400 }) };
  }
  if (!ALLOWED.includes(file.type)) {
    return {
      error: NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      ),
    };
  }
  return { file };
}

/** OIDC-credentialled deployments: the file passes through this function. */
async function serverUpload(request: NextRequest) {
  const { file, error } = await readUploadedFile(request);
  if (error) return error;

  const credentials = blobCredentials();
  if (!credentials) {
    return NextResponse.json({ error: NO_BLOB_STORE_MESSAGE }, { status: 503 });
  }

  try {
    const blob = await put(`media/${crypto.randomUUID()}${extensionFor(file.name)}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      ...credentials,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 }
    );
  }
}

async function devUpload(request: NextRequest) {
  const { file, error } = await readUploadedFile(request);
  if (error) return error;

  const filename = `${crypto.randomUUID()}${extensionFor(file.name)}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, filename),
    Buffer.from(await file.arrayBuffer())
  );

  return NextResponse.json({ url: `/uploads/${filename}` });
}
