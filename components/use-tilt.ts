"use client";

import { useCallback } from "react";

/**
 * ポインタの位置に応じて、要素をわずかに傾ける。
 *
 * **state を持たず DOM を直接触る。** ホバーのたびに再描画すると、項目の数だけ
 * 無駄な描画が走る。傾きは見た目だけの話なので、React の外で完結させてよい。
 *
 * **動きを減らす設定は必ず尊重する。** OS 側（`prefers-reduced-motion`）と
 * アプリ側（設定画面が付ける `.reduce-motion`）の両方を見る。globals.css の
 * `.reduce-motion` は transition を潰すが、こちらは transform そのものを
 * やめないと、指を動かすたびに傾き続けることになる。
 */

/** 最大の傾き。これ以上はふざけて見える。 */
const MAX_DEGREES = 6;

function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.classList.contains("reduce-motion")) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useTilt() {
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    // 指やペンでは「ポインタの位置」が押した場所そのものなので、傾けても
    // 意味が無く、押下のたびに跳ねて見える。マウスだけにする。
    if (event.pointerType !== "mouse" || !motionAllowed()) return;

    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();

    // 中心を 0 として -0.5〜0.5 に正規化する。
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    // 上に動かしたら手前が起きる向き（rotateX は符号が逆）。
    element.style.transform =
      `perspective(600px) rotateX(${(-y * MAX_DEGREES).toFixed(2)}deg)` +
      ` rotateY(${(x * MAX_DEGREES).toFixed(2)}deg)`;
  }, []);

  const onPointerLeave = useCallback((event: React.PointerEvent<HTMLElement>) => {
    // 空文字に戻す。none にすると、クラス側で transform を使えなくなる。
    event.currentTarget.style.transform = "";
  }, []);

  return { onPointerMove, onPointerLeave };
}
