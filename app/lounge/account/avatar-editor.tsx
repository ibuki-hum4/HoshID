"use client";

import { ImageUp, Trash2, ZoomIn } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MAX_UPLOAD_BYTES } from "@/lib/avatar-constants";

import { removeAvatar, uploadAvatar } from "./actions";

/** 送信前に切り抜くだけ。最終的な寸法と形式はサーバ側で決め直される。 */
const CROP_OUTPUT_SIZE = 512;

export function AvatarEditor({
  displayName,
  image,
}: {
  displayName: string;
  image: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickFile(file: File | undefined) {
    setError(null);
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError("画像が大きすぎます。8MB 以内にしてください。");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選んでください。");
      return;
    }

    setSource(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  function close() {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
    setArea(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function apply() {
    if (!source || !area) return;

    startTransition(async () => {
      try {
        const blob = await cropToBlob(source, area);
        const formData = new FormData();
        formData.append("file", blob, "avatar.png");

        const result = await uploadAvatar(formData);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        close();
      } catch {
        setError("画像を処理できませんでした。");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">アイコン</CardTitle>
        <CardDescription>
          正方形に切り抜かれ、256px の WebP として保存されます。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback className="text-2xl">
              {displayName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />

            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <ImageUp className="size-4" aria-hidden />
              画像を選ぶ
            </Button>

            {image ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeAvatar();
                    if (!result.ok) setError(result.message);
                  })
                }
              >
                <Trash2 className="size-4" aria-hidden />
                削除
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>

      <Dialog open={source !== null} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>切り抜き</DialogTitle>
            <DialogDescription>
              ドラッグで位置を、スライダーで拡大率を調整できます。
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted relative h-72 w-full overflow-hidden rounded-lg">
            {source ? (
              <Cropper
                image={source}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setArea(pixels)}
              />
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <ZoomIn className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <Label htmlFor="avatar-zoom" className="sr-only">
              拡大率
            </Label>
            <input
              id="avatar-zoom"
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost"  onClick={close}>
              やめる
            </Button>
            <Button
              disabled={pending || !area}
              onClick={apply}
            >
              {pending ? "適用しています…" : "適用する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** 選択範囲を canvas で切り出して PNG にする。 */
async function cropToBlob(source: string, area: Area): Promise<Blob> {
  const image = await loadImage(source);

  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas is unavailable");

  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    CROP_OUTPUT_SIZE,
    CROP_OUTPUT_SIZE,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("image load failed")));
    image.src = src;
  });
}
