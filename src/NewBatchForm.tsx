import { useMemo, useState } from "react";
import type { Gem } from "./types";
import { useWorkbench } from "./useWorkbench";

interface NewBatchFormProps {
  wb: ReturnType<typeof useWorkbench>;
  onCreated: (batchId: string) => void;
}

/** 新建批次：先按尺寸（mm，闭区间）筛选，预览入选宝石后建批 */
export default function NewBatchForm({ wb, onCreated }: NewBatchFormProps) {
  const [orderNo, setOrderNo] = useState("");
  const [label, setLabel] = useState("");
  const [minMm, setMinMm] = useState("2.0");
  const [maxMm, setMaxMm] = useState("9.0");
  const [error, setError] = useState<string | null>(null);

  const min = parseFloat(minMm);
  const max = parseFloat(maxMm);

  const preview: Gem[] = useMemo(() => {
    if (Number.isNaN(min) || Number.isNaN(max)) return [];
    return wb.previewSize(min, max);
  }, [wb, min, max]);

  const submit = () => {
    if (Number.isNaN(min) || Number.isNaN(max)) {
      setError("请输入合法的尺寸数值（毫米）");
      return;
    }
    if (min > max) {
      setError("尺寸下限不能大于上限");
      return;
    }
    if (preview.length === 0) {
      setError("该尺寸区间内没有宝石，无法建批");
      return;
    }
    setError(null);
    const id = wb.createBatch({ orderNo, label, minMm: min, maxMm: max });
    setLabel("");
    onCreated(id);
  };

  return (
    <section className="panel new-batch" id="new-batch">
      <div className="heading">
        <div>
          <p>第一步 · 按尺寸分批</p>
          <h2>新建分拣批次</h2>
        </div>
      </div>
      <div className="field-grid">
        <label>
          <span>订单号</span>
          <input
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="如 PO-2026-018（可留空）"
          />
        </label>
        <label>
          <span>批次名称</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="如 客户A戒指主批（可留空）"
          />
        </label>
        <label>
          <span>尺寸下限（mm，含）</span>
          <input
            type="number"
            step="0.1"
            value={minMm}
            onChange={(e) => setMinMm(e.target.value)}
          />
        </label>
        <label>
          <span>尺寸上限（mm，含）</span>
          <input
            type="number"
            step="0.1"
            value={maxMm}
            onChange={(e) => setMaxMm(e.target.value)}
          />
        </label>
      </div>

      <div className="preview-bar">
        <span>
          尺寸筛选结果：<b>{preview.length}</b> 颗入选
          {preview.length > 0 && (
            <>
              {" "}
              · {preview[0].sizeMm}–{preview[preview.length - 1].sizeMm} mm
            </>
          )}
        </span>
        <button className="primary" onClick={submit}>
          按筛选结果建批
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}

      {preview.length > 0 && (
        <div className="preview-list">
          {preview.map((g) => (
            <span key={g.id} className="preview-chip" title={g.note}>
              {g.id} · {g.species} · {g.shape} · {g.sizeMm}mm · {g.carat}ct
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
