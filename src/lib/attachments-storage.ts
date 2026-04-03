import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { logInfo } from "@/lib/logger";

let isConfigured = false;
const LOCAL_KEY_PREFIX = "local:";

function localAttachmentRoot(): string {
  const configured = process.env.ATTACHMENTS_LOCAL_ROOT?.trim();
  if (configured) return configured;
  // In serverless environments (e.g. AWS Lambda), /var/task is read-only but /tmp is writable.
  // Use a stable subfolder under /tmp for attachment persistence.
  return "/tmp/attachments";
}

function toPosixPath(input: string): string {
  return input.replace(/\\/g, "/");
}

export function classifyAttachmentStorageKey(key: string): "local" | "cloud" {
  return key.startsWith(LOCAL_KEY_PREFIX) ? "local" : "cloud";
}

function localRelativePath(userId: string, messageId: string, filename: string): string {
  const safe = sanitizeFilename(filename);
  const bucket = messageId.trim() || "message";
  return toPosixPath(`sendora/${userId}/${bucket}/${randomUUID()}-${safe}`);
}

function localAbsolutePathFromStorageKey(storageKey: string): string {
  const rel = storageKey.slice(LOCAL_KEY_PREFIX.length).replace(/^\/+/, "");
  return path.join(localAttachmentRoot(), rel);
}

async function saveLocalAttachmentFile(
  userId: string,
  messageId: string,
  filename: string,
  data: Buffer
): Promise<{ storageKey: string; sizeBytes: number }> {
  const relative = localRelativePath(userId, messageId, filename);
  const absolute = path.join(localAttachmentRoot(), relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  return { storageKey: `${LOCAL_KEY_PREFIX}${relative}`, sizeBytes: data.length };
}

function ensureCloudinaryConfig(): void {
  if (isConfigured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  isConfigured = true;
}

function inferResourceType(mimeType: string): "image" | "video" | "raw" {
  const lower = mimeType.toLowerCase();
  if (lower.startsWith("image/")) return "image";
  if (lower.startsWith("video/")) return "video";
  return "raw";
}

/** Cloudinary CDN URLs must use a real resource_type; `"auto"` becomes the invalid path segment `auto` and returns 400. */
function inferResourceTypeFromStorageKey(key: string): "image" | "video" | "raw" {
  const k = key.toLowerCase();
  if (
    /\.(jpe?g|png|gif|webp|bmp|svg|ico|avif|heic|heif)(\?|$)/i.test(k)
  ) {
    return "image";
  }
  if (/\.(mp4|webm|mov|mkv|m4v)(\?|$)/i.test(k)) {
    return "video";
  }
  return "raw";
}

function resourceTypeCandidates(
  storageKey: string,
  mimeHint?: string | null
): ("image" | "video" | "raw")[] {
  const hint = mimeHint?.trim();
  const primary =
    hint && hint !== "application/octet-stream"
      ? inferResourceType(hint)
      : inferResourceTypeFromStorageKey(storageKey);
  const all: ("image" | "video" | "raw")[] = ["image", "video", "raw"];
  return [primary, ...all.filter((r) => r !== primary)];
}

function baseFolder(userId: string, messageId: string): string {
  return `sendora/${userId}/${messageId}`;
}

export function sanitizeFilename(name: string): string {
  const base = name
    .replace(/[\\/]+/g, "")
    .replace(/[^\w.\- ]+/g, "_")
    .slice(0, 200);
  return base.length > 0 ? base : "file";
}

/**
 * Cloudinary image public_id must not include the file extension; format is stored separately.
 * @see https://cloudinary.com/documentation/image_upload_api_reference#upload
 */
function publicIdFileSuffix(
  safeFilename: string,
  resourceType: "image" | "video" | "raw"
): string {
  if (resourceType === "image") {
    const withoutExt = safeFilename.replace(
      /\.(jpe?g|png|gif|webp|bmp|svg|ico|avif|heic|heif)$/i,
      ""
    );
    return withoutExt.length > 0 ? withoutExt : "image";
  }
  return safeFilename;
}

/** Extension for `private_download_url` when the key has no file suffix (non-image raw). */
function formatFromRawMimeHint(
  mimeHint: string | null | undefined
): string | undefined {
  const m = mimeHint?.trim().toLowerCase() ?? "";
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
  };
  return map[m];
}

/**
 * `private_download_url` expects `public_id` without the final extension and `format` separately.
 */
function splitPublicIdAndFormatForRawDownload(
  storageKey: string,
  mimeHint?: string | null
): { publicId: string; format: string } {
  const trimmed = storageKey.trim();
  const match = trimmed.match(/^(.*)\.([a-zA-Z0-9]+)$/);
  if (match && match[1].length > 0) {
    return { publicId: match[1], format: match[2] };
  }
  const fromMime = formatFromRawMimeHint(mimeHint);
  return { publicId: trimmed, format: fromMime ?? "" };
}

function formatFromMimeHint(
  mimeHint: string | null | undefined
): string | undefined {
  const m = mimeHint?.trim().toLowerCase() ?? "";
  if (!m.startsWith("image/")) return undefined;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "image/avif": "avif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return map[m];
}

type CloudinaryUploadResult = {
  public_id?: string;
  version?: number;
  resource_type?: string;
  type?: string;
  format?: string;
};

export async function saveAttachmentFile(
  userId: string,
  messageId: string,
  filename: string,
  data: Buffer,
  mimeType?: string
): Promise<{ storageKey: string; sizeBytes: number }> {
  const localSaved = await saveLocalAttachmentFile(userId, messageId, filename, data);
  const keyType = classifyAttachmentStorageKey(localSaved.storageKey);

  logInfo("attachment_saved_local_primary", {
    storageKey: localSaved.storageKey,
    keyType,
    filename: filename.slice(0, 120),
    mimeType: mimeType ?? "",
    sizeBytes: localSaved.sizeBytes,
    userId,
    messageId,
  });

  try {
    ensureCloudinaryConfig();
    const safe = sanitizeFilename(filename);
    const resourceType = inferResourceType(mimeType || "");
    const uploadType = "authenticated" as const;
    const suffix = publicIdFileSuffix(safe, resourceType);
    const publicIdRequested = `${baseFolder(userId, messageId)}/${randomUUID()}-${suffix}`;

    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicIdRequested,
          resource_type: resourceType,
          type: uploadType,
          overwrite: false,
          use_filename: false,
          unique_filename: false,
        },
        (error, uploadResult) => {
          if (error) {
            reject(error);
            return;
          }
          resolve((uploadResult ?? {}) as CloudinaryUploadResult);
        }
      );
      stream.end(data);
    });

    const canonical = result.public_id?.trim();
    logInfo("attachment_backup_cloudinary_result", {
      localStorageKey: localSaved.storageKey,
      backupPublicId: canonical ?? "",
      publicIdRequested,
      resultFormat: result.format ?? "",
      resultVersion: result.version ?? 0,
      uploadResourceType: resourceType,
      uploadType,
      resultResourceType: result.resource_type ?? "",
      resultDeliveryType: result.type ?? "",
    });
  } catch (error) {
    logInfo("attachment_backup_cloudinary_failed_non_blocking", {
      localStorageKey: localSaved.storageKey,
      filename: filename.slice(0, 120),
      mimeType: mimeType ?? "",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return localSaved;
}

export async function readAttachmentBuffer(
  storageKey: string,
  mimeHint?: string | null
): Promise<Buffer> {
  if (classifyAttachmentStorageKey(storageKey) === "local") {
    const fullPath = localAbsolutePathFromStorageKey(storageKey);
    const data = await readFile(fullPath);
    logInfo("attachment_read_local_ok", {
      storageKey,
      keyType: "local",
      mimeHint: mimeHint ?? "",
      sizeBytes: data.length,
    });
    return data;
  }

  ensureCloudinaryConfig();

  const deliveries: ("authenticated" | "upload")[] = ["authenticated", "upload"];
  const rts = resourceTypeCandidates(storageKey, mimeHint);
  let lastStatus = 0;
  let lastUrl = "";

  for (const resourceType of rts) {
    /**
     * For all resource types (including "raw"/PDFs), try the CDN signed URL first.
     * Assets are uploaded as `type: "authenticated"`, so a signed CDN URL is the
     * correct delivery mechanism — the same path that already works for images.
     * `private_download_url` is designed for `type: "private"` assets and is kept
     * only as a secondary fallback for raw.
     */
    for (const type of deliveries) {
      /**
       * Default `force_version` is true; with folder `public_id` the SDK injects `v1`.
       * Cloudinary assigns a real version per upload (often not 1), so `v1/...` 404s.
       * Omit version so the CDN resolves the latest asset.
       *
       * Image public_ids omit the extension; pass `format` from MIME so delivery URLs resolve.
       */
      const formatOpt =
        resourceType === "image" ? formatFromMimeHint(mimeHint) : undefined;
      const url = cloudinary.url(storageKey, {
        secure: true,
        resource_type: resourceType,
        sign_url: true,
        type,
        force_version: false,
        urlAnalytics: false,
        ...(formatOpt ? { format: formatOpt } : {}),
      });
      lastUrl = url;
      const res = await fetch(url);
      lastStatus = res.status;

      if (res.ok) {
        logInfo("cloudinary_read_ok", {
          storageKey,
          mimeHint: mimeHint ?? "",
          readResourceType: resourceType,
          readType: type,
          readMode: "cdn_signed_url",
          formatOpt: formatOpt ?? "",
          forceVersion: false,
          deliveryUrlFull: url,
        });
        return Buffer.from(await res.arrayBuffer());
      }

      logInfo("cloudinary_read_attempt_failed", {
        storageKey,
        mimeHint: mimeHint ?? "",
        readResourceType: resourceType,
        readType: type,
        readMode: "cdn_signed_url",
        formatOpt: formatOpt ?? "",
        forceVersion: false,
        fetchStatus: res.status,
        deliveryUrlFull: url,
      });
    }

    // Secondary fallback for raw assets: Cloudinary Admin API download endpoint.
    // This handles edge cases where the CDN signed URL path fails.
    if (resourceType === "raw") {
      const { publicId, format } = splitPublicIdAndFormatForRawDownload(
        storageKey,
        mimeHint
      );
      if (format.length > 0) {
        for (const type of deliveries) {
          const url = cloudinary.utils.private_download_url(publicId, format, {
            resource_type: "raw",
            type,
          });
          lastUrl = url;
          const res = await fetch(url);
          lastStatus = res.status;

          if (res.ok) {
            logInfo("cloudinary_read_ok", {
              storageKey,
              mimeHint: mimeHint ?? "",
              readResourceType: resourceType,
              readType: type,
              readMode: "private_download",
              formatOpt: format,
              forceVersion: false,
              deliveryUrlFull: url,
            });
            return Buffer.from(await res.arrayBuffer());
          }

          logInfo("cloudinary_read_attempt_failed", {
            storageKey,
            mimeHint: mimeHint ?? "",
            readResourceType: resourceType,
            readType: type,
            readMode: "private_download",
            formatOpt: format,
            forceVersion: false,
            fetchStatus: res.status,
            deliveryUrlFull: url,
          });
        }
      }
    }
  }

  logInfo("cloudinary_read_exhausted", {
    storageKey,
    mimeHint: mimeHint ?? "",
    lastStatus,
    lastDeliveryUrlFull: lastUrl,
  });

  throw new Error(
    `Cloudinary fetch failed (${lastStatus}) — could not read asset (try re-uploading the attachment)`
  );
}

export async function readAttachmentBufferLocalOnly(
  storageKey: string
): Promise<Buffer> {
  if (classifyAttachmentStorageKey(storageKey) !== "local") {
    throw new Error("Attachment storage key is not local");
  }
  const fullPath = localAbsolutePathFromStorageKey(storageKey);
  return readFile(fullPath);
}

/**
 * Outbound mail must not fetch attachment bytes from Cloudinary at send-time.
 * This helper enforces that send paths only ever read from local storage.
 */
export async function readOutboundAttachmentBuffer(
  storageKey: string,
  filenameForError?: string | null
): Promise<Buffer> {
  if (classifyAttachmentStorageKey(storageKey) !== "local") {
    const label = filenameForError?.trim() ? ` "${filenameForError.trim()}"` : "";
    throw new Error(`Outbound attachment${label} must be re-uploaded before send`);
  }
  return readAttachmentBufferLocalOnly(storageKey);
}

export function getAttachmentUrl(
  storageKey: string,
  mimeHint?: string | null
): string {
  ensureCloudinaryConfig();
  const resourceType = resourceTypeCandidates(storageKey, mimeHint)[0];
  const formatOpt =
    resourceType === "image" ? formatFromMimeHint(mimeHint) : undefined;
  return cloudinary.url(storageKey, {
    secure: true,
    resource_type: resourceType,
    sign_url: true,
    type: "authenticated",
    force_version: false,
    urlAnalytics: false,
    ...(formatOpt ? { format: formatOpt } : {}),
  });
}

export async function deleteAttachmentFile(storageKey: string): Promise<void> {
  if (classifyAttachmentStorageKey(storageKey) === "local") {
    const fullPath = localAbsolutePathFromStorageKey(storageKey);
    try {
      await unlink(fullPath);
      logInfo("attachment_delete_local_ok", { storageKey, keyType: "local" });
      return;
    } catch (error) {
      logInfo("attachment_delete_local_ignored", {
        storageKey,
        keyType: "local",
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  ensureCloudinaryConfig();
  try {
    await cloudinary.uploader.destroy(storageKey, {
      resource_type: "image",
      type: "authenticated",
      invalidate: true,
    });
    return;
  } catch {
    // try fallback
  }
  try {
    await cloudinary.uploader.destroy(storageKey, {
      resource_type: "video",
      type: "authenticated",
      invalidate: true,
    });
    return;
  } catch {
    // try fallback
  }
  await cloudinary.uploader.destroy(storageKey, {
    resource_type: "raw",
    type: "authenticated",
    invalidate: true,
  });
}
