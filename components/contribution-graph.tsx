import type { Contributions } from "@/lib/social-providers";

/**
 * GitHub の草。
 *
 * **外部サービスの画像を貼らずに、取得したデータから自分で描く。** 画像を
 * 埋め込むと、このページを開いた人の IP が第三者に渡り、その相手が落ちれば
 * 表示も壊れる。データの取得とキャッシュは `lib/social.ts`。
 *
 * サーバコンポーネント。SVG を1枚返すだけで、クライアント側の JS は要らない。
 */

/** 段階ごとの濃さ。地の色に対する不透明度で表す。配色の切り替えに追従する。 */
const LEVEL_OPACITY = [0.08, 0.3, 0.5, 0.72, 1] as const;

const CELL = 11;
const GAP = 3;
const TOP = 16;
const LEFT = 26;

const WEEKDAY_LABELS = ["", "月", "", "水", "", "金", ""];

export function ContributionGraph({
  contributions,
  username,
}: {
  contributions: Contributions;
  username: string;
}) {
  const { weeks, total } = contributions;

  const width = LEFT + weeks.length * (CELL + GAP);
  const height = TOP + 7 * (CELL + GAP);

  // 月のラベルは、その月の最初の週の上に置く。
  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = "";
  weeks.forEach((week, index) => {
    const first = week[0];
    if (!first) return;
    const month = first.date.slice(0, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      monthLabels.push({
        x: LEFT + index * (CELL + GAP),
        label: `${Number(first.date.slice(5, 7))}月`,
      });
    }
  });

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${username} の直近1年のコントリビューション。合計 ${total} 件。`}
          className="text-foreground"
        >
          {monthLabels.map((month) => (
            <text
              key={`${month.label}-${month.x}`}
              x={month.x}
              y={10}
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {month.label}
            </text>
          ))}

          {WEEKDAY_LABELS.map((label, row) =>
            label ? (
              <text
                key={label}
                x={0}
                y={TOP + row * (CELL + GAP) + CELL - 1}
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {label}
              </text>
            ) : null,
          )}

          {weeks.map((week, column) =>
            week.map((day) => {
              // 週の中の位置は曜日で決める。年の境目で週が欠けることがあるため、
              // 配列の添字ではなく日付から出す。
              const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();

              return (
                <rect
                  key={day.date}
                  x={LEFT + column * (CELL + GAP)}
                  y={TOP + row * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill="currentColor"
                  fillOpacity={LEVEL_OPACITY[day.level]}
                >
                  <title>{`${day.date}: ${day.count} 件`}</title>
                </rect>
              );
            }),
          )}
        </svg>
      </div>

      <p className="text-muted-foreground text-xs">
        直近1年で {total} 件のコントリビューション
      </p>
    </div>
  );
}
