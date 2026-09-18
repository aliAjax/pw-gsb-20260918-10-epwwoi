import type { Batch, DestinationId } from "./types";
import { DEST_META } from "./types";

interface SocketDiagramProps {
  batch: Batch;
  activeDest: DestinationId | null;
  readOnly: boolean;
  onPick: (dest: DestinationId) => void;
}

/** 镶嵌位置示意图：中心主石位 ×1，外围围石位 ×8，下方配石/退回待定为暂存槽 */
export default function SocketDiagram({
  batch,
  activeDest,
  readOnly,
  onPick,
}: SocketDiagramProps) {
  const mainGems = batch.assignments.filter((a) => a.dest === "main");
  const surround = batch.assignments
    .filter((a) => a.dest === "surround")
    .sort((a, b) => a.at - b.at);
  const accentGems = batch.assignments.filter((a) => a.dest === "accent");
  const returnGems = batch.assignments.filter((a) => a.dest === "return");

  const countOf = (d: DestinationId) =>
    batch.assignments.filter((a) => a.dest === d).length;

  const seatClass = (dest: DestinationId, extra = "") =>
    [
      "socket",
      `socket-${dest}`,
      activeDest === dest ? "active" : "",
      readOnly ? "readonly" : "",
      extra,
    ]
      .filter(Boolean)
      .join(" ");

  const capLabel = (dest: DestinationId) => {
    const cap = DEST_META[dest].cap;
    return cap === null ? "不限" : `限 ${cap}`;
  };

  return (
    <div className="diagram">
      <div className="diagram-board">
        <svg viewBox="0 0 260 260" className="ring-svg" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const cx = 130 + Math.cos(angle) * 92;
            const cy = 130 + Math.sin(angle) * 92;
            const taken = i < surround.length;
            return (
              <g key={i}>
                <line
                  x1="130"
                  y1="130"
                  x2={cx}
                  y2={cy}
                  stroke="#d9e2ef"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="17"
                  className={taken ? "ring-seat filled" : "ring-seat"}
                />
                <text
                  x={cx}
                  y={cy + 3.5}
                  textAnchor="middle"
                  className="ring-num"
                >
                  {taken ? surround[i].gemId.replace("ST-", "") : i + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 中心主石位 */}
        <button
          type="button"
          className={seatClass("main", mainGems.length > 1 ? "overflow" : "")}
          disabled={readOnly}
          onClick={() => !readOnly && onPick("main")}
          title={`主石位 · ${capLabel("main")} · 已入座 ${countOf("main")}`}
        >
          <span className="socket-cap">主石位 · {capLabel("main")}</span>
          <span className="socket-gem">
            {mainGems.length ? mainGems.map((a) => a.gemId).join(" / ") : "空位"}
          </span>
          <span className="socket-count">{countOf("main")}/1</span>
        </button>

        {/* 围石孔位（8 个，与 SVG 重合，放在可点击层） */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 35.4; // 百分比定位
          const y = 50 + Math.sin(angle) * 35.4;
          const taken = i < surround.length;
          return (
            <button
              type="button"
              key={`seat-${i}`}
              className={seatClass(
                "surround",
                taken ? "" : "empty-seat"
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
              disabled={readOnly}
              onClick={() => !readOnly && onPick("surround")}
              title={`围石位 ${i + 1} · 共限 8 颗 · ${taken ? surround[i].gemId : "空位"}`}
            >
              <small>{i + 1}</small>
              <span>{taken ? surround[i].gemId.replace("ST-", "") : "—"}</span>
            </button>
          );
        })}

        {/* 超出 8 颗的围石堆在盘边 */}
        {surround.length > 8 && (
          <div className="overflow-tray socket-surround">
            超容：{surround.slice(8).map((a) => a.gemId).join("、")}
          </div>
        )}
      </div>

      <div className="diagram-trays">
        <button
          type="button"
          className={seatClass("accent")}
          disabled={readOnly}
          onClick={() => !readOnly && onPick("accent")}
        >
          <span className="socket-cap">配石 · {capLabel("accent")}</span>
          <span className="socket-gem">
            {accentGems.length
              ? `${accentGems.length} 颗：` +
                accentGems.slice(0, 4).map((a) => a.gemId).join("、") +
                (accentGems.length > 4 ? " 等" : "")
              : "暂存槽为空"}
          </span>
          <span className="socket-count">{countOf("accent")}</span>
        </button>
        <button
          type="button"
          className={seatClass("return")}
          disabled={readOnly}
          onClick={() => !readOnly && onPick("return")}
        >
          <span className="socket-cap">退回待定 · {capLabel("return")}</span>
          <span className="socket-gem">
            {returnGems.length
              ? `${returnGems.length} 颗：` +
                returnGems.slice(0, 4).map((a) => a.gemId).join("、") +
                (returnGems.length > 4 ? " 等" : "")
              : "无待定"}
          </span>
          <span className="socket-count">{countOf("return")}</span>
        </button>
      </div>
    </div>
  );
}
