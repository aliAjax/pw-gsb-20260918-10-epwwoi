import { useMemo, useState } from "react";
import type { Batch, Destination } from "../types";
import { SLOT_LIMITS } from "../types";
import { conflictGemIds, groupGems, inSizeRange } from "../store";
import SlotDiagram from "./SlotDiagram";
import GemTable from "./GemTable";
import HistoryLog from "./HistoryLog";

interface Props {
  batch: Batch;
  onAssign: (gemId: string, dest: Destination) => void;
  onSubmit: () => void;
  onWithdraw: () => void;
}

const QUICK_RANGES: { label: string; min: number | null; max: number | null }[] = [
  { label: "全部", min: null, max: null },
  { label: "≤2.0mm（配石）", min: null, max: 2.0 },
  { label: "2.1–3.5mm（围石）", min: 2.1, max: 3.5 },
  { label: "≥4mm（主石）", min: 4, max: null },
];

function rangeText(min: number | null, max: number | null) {
  if (min === null && max === null) return "全部尺寸";
  return `${min ?? "不限"} – ${max ?? "不限"} mm`;
}

export default function BatchWorkspace({ batch, onAssign, onSubmit, onWithdraw }: Props) {
  const [quick, setQuick] = useState(0);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [onlyConflict, setOnlyConflict] = useState(false);

  const locked = batch.status === "locked";
  const grouped = useMemo(() => groupGems(batch), [batch]);
  const rejection = batch.lastRejection ?? null;
  const conflicts = useMemo(() => conflictGemIds(rejection), [rejection]);

  const filter = {
    min: min.trim() === "" ? QUICK_RANGES[quick].min : Number(min),
    max: max.trim() === "" ? QUICK_RANGES[quick].max : Number(max),
  };

  const visibleGems = useMemo(() => {
    let list = batch.gems.filter((g) => inSizeRange(g.sizeMm, filter));
    if (onlyConflict) list = list.filter((g) => conflicts.has(g.id));
    return [...list].sort((a, b) => a.sizeMm - b.sizeMm);
  }, [batch.gems, filter.min, filter.max, onlyConflict, conflicts]);

  const mainOver = grouped.main.length - SLOT_LIMITS.main;
  const surroundOver = grouped.surround.length - SLOT_LIMITS.surround;
  const totalCarat = batch.gems.reduce((sum, g) => sum + g.carat, 0);

  return (
    <section className="panel workspace-main">
      <div className="heading">
        <div>
          <p>订单 {batch.orderNo}</p>
          <h2>
            批次 {batch.id}
            <em className={locked ? "status-locked big" : "status-editing big"}>
              {locked ? "已提交锁定" : "分拣中"}
            </em>
          </h2>
        </div>
        <div className="heading-actions">
          {!locked ? (
            <button className="primary" type="button" onClick={onSubmit}>
              提交批次
            </button>
          ) : (
            <button type="button" className="warn" onClick={onWithdraw}>
              撤回批次
            </button>
          )}
        </div>
      </div>

      {/* 整批拒绝提示：标出冲突宝石 */}
      {rejection && !locked && (
        <div className="reject-banner">
          <b>整批拒绝 · 存在以下冲突，提交未生效：</b>
          <ul>
            {rejection.unassigned.length > 0 && (
              <li>
                未定去向（{rejection.unassigned.length} 颗）：{rejection.unassigned.join("、")}
              </li>
            )}
            {rejection.overflowMain.length > 0 && (
              <li>
                主石位限 {SLOT_LIMITS.main} 颗，超容（{rejection.overflowMain.length} 颗）：
                {rejection.overflowMain.join("、")}
              </li>
            )}
            {rejection.overflowSurround.length > 0 && (
              <li>
                围石位限 {SLOT_LIMITS.surround} 颗，超容（{rejection.overflowSurround.length} 颗）：
                {rejection.overflowSurround.join("、")}
              </li>
            )}
          </ul>
          <span>表中已用红色「冲突」标出相关宝石，处理后可重新提交。</span>
        </div>
      )}

      {locked && (
        <div className="locked-banner">
          🔒 批次已于 {new Date(batch.submittedAt!).toLocaleString("zh-CN")} 提交锁定，去向不可再调整；
          如需修改请先撤回，撤回后原去向与每次调整记录都会保留。
        </div>
      )}

      <div className="overview-grid">
        <article className="cap-card">
          <small>主石位</small>
          <strong className={mainOver > 0 ? "over" : ""}>
            {grouped.main.length}
            <span>/{SLOT_LIMITS.main}</span>
          </strong>
          {mainOver > 0 && <em className="over-text">超容 {mainOver} 颗</em>}
        </article>
        <article className="cap-card">
          <small>围石位</small>
          <strong className={surroundOver > 0 ? "over" : ""}>
            {grouped.surround.length}
            <span>/{SLOT_LIMITS.surround}</span>
          </strong>
          {surroundOver > 0 && <em className="over-text">超容 {surroundOver} 颗</em>}
        </article>
        <article className="cap-card">
          <small>配石</small>
          <strong>{grouped.accent.length}</strong>
          <em>不限数量</em>
        </article>
        <article className="cap-card">
          <small>退回待定</small>
          <strong>{grouped.pending.length}</strong>
          <em>暂不镶嵌</em>
        </article>
        <article className="cap-card">
          <small>未定去向</small>
          <strong className={grouped.unassigned.length > 0 ? "over" : ""}>
            {grouped.unassigned.length}
          </strong>
          <em>{grouped.unassigned.length > 0 ? "提交前必须归类" : "已全部归类"}</em>
        </article>
        <article className="cap-card">
          <small>批次总克拉</small>
          <strong>{totalCarat.toFixed(2)}</strong>
          <em>{batch.gems.length} 颗</em>
        </article>
      </div>

      <div className="diagram-row">
        <div className="diagram-box">
          <SlotDiagram main={grouped.main} surround={grouped.surround} locked={locked} />
        </div>
        <div className="diagram-side">
          <h3>镶嵌位置示意</h3>
          <p>中心为主石位（限 1 颗），外圈 8 个为围石位。配石与退回待定不占镶口。</p>
          <ul className="dot-legend">
            <li className="dest-main">主石 {grouped.main.map((g) => g.id).join("、") || "—"}</li>
            <li className="dest-surround">围石（{grouped.surround.length}/{SLOT_LIMITS.surround}）</li>
            <li className="dest-accent">配石 {grouped.accent.length} 颗</li>
            <li className="dest-pending">退回待定 {grouped.pending.length} 颗</li>
          </ul>
        </div>
      </div>

      <div className="filter-bar">
        <div className="quick-chips">
          {QUICK_RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              disabled={min !== "" || max !== ""}
              className={quick === i && min === "" && max === "" ? "active" : ""}
              onClick={() => setQuick(i)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="range-inputs">
          <input
            value={min}
            placeholder="最小 mm"
            inputMode="decimal"
            onChange={(e) => setMin(e.target.value)}
          />
          <span>–</span>
          <input
            value={max}
            placeholder="最大 mm"
            inputMode="decimal"
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
        <label className="conflict-toggle">
          <input type="checkbox" checked={onlyConflict} onChange={(e) => setOnlyConflict(e.target.checked)} />
          只看冲突（{conflicts.size}）
        </label>
        <span className="filter-result">
          筛选：{rangeText(filter.min, filter.max)} · 显示 {visibleGems.length}/{batch.gems.length} 颗
        </span>
      </div>

      <GemTable batch={batch} gems={visibleGems} conflicts={conflicts} onAssign={onAssign} />

      <div className="history-box">
        <h3>调整记录（撤回后仍保留）</h3>
        <HistoryLog logs={batch.logs} />
      </div>
    </section>
  );
}
