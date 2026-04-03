import { randomUUID } from "crypto";
import type { OutboundAttachment } from "./resend-mail";

function extensionForMime(mimeType: string): string {
  const t = mimeType.toLowerCase();
  if (t === "image/png") return "png";
  if (t === "image/jpeg") return "jpg";
  if (t === "image/jpg") return "jpg";
  if (t === "image/gif") return "gif";
  if (t === "image/webp") return "webp";
  if (t === "image/svg+xml") return "svg";
  // Best-effort fallback; filename is informational for the recipient.
  return "img";
}

export type InlineCidConversionResult = {
  html: string;
  inlineAttachments: OutboundAttachment[];
  convertedCount: number;
  remainingDraftAttachmentImgSrcCount: number;
};

/**
 * Some email clients do not render `data:image/*;base64,...` reliably.
 * For external delivery (Resend), convert those inline sources into `cid:...`
 * and return matching inline attachments.
 *
 * Internal delivery (our own web inbox) can keep the data URLs instead.
 */
export function convertInlineDataUrlsToCid(
  html: string
): InlineCidConversionResult {
  // Track draft placeholders before conversion as a safety net.
  const remainingDraftAttachmentImgSrcCount =
    (html.match(
      /<img[^>]*src=["'][^"']*\/api\/mail\/draft-attachments\//gi
    ) ?? []).length;

  let convertedCount = 0;
  let inlineIndex = 0;
  const inlineAttachments: OutboundAttachment[] = [];

  const dataUrlSrcRe =
    /src=(["'])(data:image\/([a-zA-Z0-9.+-]+);base64,([^"']+))\1/g;

  const outHtml = html.replace(
    dataUrlSrcRe,
    (
      _match: string,
      quote: string,
      _fullUrl: string,
      mimeType: string,
      base64: string
    ) => {
      const cleanBase64 = String(base64).replace(/\s+/g, "");

      const content = Buffer.from(cleanBase64, "base64");
      const contentId = `img-${randomUUID()}`;
      const ext = extensionForMime(`image/${mimeType}`);

      inlineIndex += 1;
      convertedCount += 1;

      inlineAttachments.push({
        filename: `inline-${inlineIndex}.${ext}`,
        content,
        contentType: `image/${mimeType}`,
        contentId,
      });

      // Replace the inline source so the recipient mail client can resolve it.
      return `src=${quote}cid:${contentId}${quote}`;
    }
  );

  return {
    html: outHtml,
    inlineAttachments,
    convertedCount,
    remainingDraftAttachmentImgSrcCount,
  };
}

