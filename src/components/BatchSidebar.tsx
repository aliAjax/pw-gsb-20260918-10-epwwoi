import { useState } from "react";
import type { Batch, SizeRange } from "../types";
import { formatTime } from "../store";

interface Props {
  batches: Batch[];
  poolCount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (orderNo: string, range: SizeRange) => string | null;
}

const PRESETS: { label: string; range: SizeRange }[] = [
  { label: "围石料 2.1–3.5mm", range: { min: 2.1, max: 3.5 } },
  { label: "主石料 ≥4mm", range: { min: 4, max: null } },
  { label: "配石料 ≤2.0mm", range: { min: null, max: 2.0 } },
  { label: "全部尺寸", range: { min: null, max: null } },
];

export default function BatchSidebar({ batches, poolCount, selectedId, onSelect, onCreate }: Props) {
  const [orderNo, setOrderNo] = useState("");
  const [preset, setPreset] = useState(0);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const range: SizeRange = {
      min: min.trim() === "" ? PRESETS[preset].range.min : Number(min),
      max: max.trim() === "" ? PRESETS[preset].range.max : Number(max),
    };
    if (range.min !== null && Number.isNaN(range.min)) return setError("最小尺寸需为数字");
    if (range.max !== null && Number.isNaN(range.max)) return setError("最大尺寸需为数字");
    if (range.min !== null && range.max !== null && range.min > range.max)
      return setError("最小尺寸不能大于最大尺寸");
    const id = onCreate(orderNo.trim() || `ORD-${Date.now().toString(36).toUpperCase()}`, range);
    if (!id) {
      setError("料盘中没有符合该尺寸范围的宝石，请调整筛选条件");
      return;
    }
    setError(null);
    setOrderNo("");
    setMin("");
    setMax("");
  }

  return (
    <aside className="panel sidebar">
      <h2>分拣批次</h2>

      <div className="create-box">
        <p className="box-title">新建批次（先按尺寸筛选）</p>
        <label className="form-line">
          <span>订单号</span>
          <input
            value={orderNo}
            placeholder="如 ORD-2026-018"
            onChange={(e) => setOrderNo(e.target.value)}
          />
        </label>

        <div className="preset-grid">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              className={preset === i ? "preset active" : "preset"}
              onClick={() => {
                setPreset(i);
                setMin("");
                setMax("");
              }}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="range-row">
          <label className="form-line">
            <span>最小 mm</span>
            <input value={min} placeholder="不限" inputMode="decimal" onChange={(e) => setMin(e.target.value)} />
          </label>
          <span className="range-dash">–</span>
          <label className="form-line">
            <span>最大 mm</span>
            <input value={max} placeholder="不限" inputMode="decimal" onChange={(e) => setMax(e.target.value)} />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="primary block" onClick={submit} type="button">
          按尺寸建批
        </button>
        <p className="pool-hint">料盘待入批：{poolCount} 颗</p>
      </div>

      <div className="batch-list">
        {batches.length === 0 && <p className="empty-hint">还没有批次，先在上方新建。</p>}
        {[...batches]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((b) => {
            const assigned = Object.keys(b.assignments).length;
            return (
              <button
                key={b.id}
                className={`batch-item ${selectedId === b.id ? "active" : ""}`}
                onClick={() => onSelect(b.id)}
                type="button"
              >
                <span className="batch-top">
                  <b>{b.orderNo}</b>
                  <em className={b.status === "locked" ? "status-locked" : "status-editing"}>
                    {b.status === "locked" ? "已锁定" : "分拣中"}
                  </em>
                </span>
                <span className="batch-meta">
                  {b.gems.length} 颗 · 已归 {assigned} · {formatTime(b.createdAt)}
                </span>
                <span className="batch-meta">
                  尺寸 {b.sizeFilter.min ?? "∅"}–{b.sizeFilter.max ?? "∅"} mm
                </span>
              </button>
            );
          })}
      </div>
    </aside>
  );
}
