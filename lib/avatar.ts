import sharp from "sharp";

import { AVATAR_SIZE, MAX_UPLOAD_BYTES } from "@/lib/avatar-constants";

export { AVATAR_SIZE, MAX_UPLOAD_BYTES, avatarUrl } from "@/lib/avatar-constants";

export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export type ProcessedAvatar = {
  /**
   * Prisma 7 の Bytes は `Uint8Array<ArrayBuffer>` を要求する。sharp が返す
   * `Buffer` は `ArrayBufferLike` 由来で型が合わないため、ここで詰め替える。
   */
  data: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  mimeType: "image/webp";
};

/**
 * アップロードされた画像を安全な形に作り直す。
 *
 * **クライアントが切り抜いた結果をそのまま保存しないこと。** ブラウザを
 * 通さずにエンドポイントを直接叩けば任意のバイト列を送れるため、画像の
 * 皮をかぶった別物や、展開すると巨大になる細工画像を保存されうる。
 * ここで必ずデコードし直し、WebP として書き出す。
 *
 * 併せて EXIF などのメタデータも落ちる。撮影場所が入ったままの写真を
 * アイコンにされると、本人が意図しない位置情報の公開になる。
 */
export async function processAvatar(input: ArrayBuffer): Promise<ProcessedAvatar> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("画像が大きすぎます。");
  }

  const pipeline = sharp(Buffer.from(input), {
    // 展開すると巨大になる画像（圧縮爆弾）でメモリを食い潰さないための上限。
    limitInputPixels: 64_000_000,
    // アニメーション GIF / WebP は1コマ目だけを使う。
    animated: false,
  });

  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("画像として読み取れませんでした。");
  }

  const encoded = await pipeline
    // EXIF の向き情報を実際の画素に反映してから、メタデータは捨てる。
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toBuffer();

  // ArrayBuffer 実体を新しく確保して詰め替える。sharp の Buffer は
  // ArrayBufferLike（SharedArrayBuffer を含みうる）なので、そのままでは
  // Prisma の Bytes に渡せない。
  const data = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  data.set(encoded);

  return {
    data,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    mimeType: "image/webp",
  };
}
