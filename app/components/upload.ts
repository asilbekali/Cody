/**
 * Client-side media upload.
 *
 * With a blob store configured the file goes straight from the browser to Vercel
 * Blob using a short-lived token minted by /api/media — this is what allows video
 * past Vercel's 4.5 MB request body limit. Without one (local dev) the same
 * endpoint accepts the file directly and writes it to public/uploads.
 */
export async function uploadMedia(
  file: File,
  blobEnabled: boolean,
  onProgress?: (percentage: number) => void
): Promise<string> {
  if (blobEnabled) {
    const { upload } = await import("@vercel/blob/client");
    const result = await upload(`media/${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/media",
      // Large files upload in parallel parts and retry individually.
      multipart: file.size > 8 * 1024 * 1024,
      onUploadProgress: onProgress
        ? ({ percentage }) => onProgress(percentage)
        : undefined,
    });
    return result.url;
  }

  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/media", { method: "POST", body });
  const payload = (await response.json()) as { url?: string; error?: string };

  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Upload failed");
  }
  onProgress?.(100);
  return payload.url;
}

export function mediaKind(file: File): "image" | "video" {
  return file.type.startsWith("video/") ? "video" : "image";
}
