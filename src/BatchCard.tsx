import { useMemo, useState } from "react";
import type { Batch, DestinationId } from "./types";
import {
  DEST_META,
  DEST_ORDER,
  assignedCount,
  batchCarat,
  evaluateConflicts,
} from "./types";
import type { useWorkbench } from "./useWorkbench";
import SocketDiagram from "./SocketDiagram";
import { formatTime } from "./format";

interface BatchCardProps {
  batch: Batch;
  wb: ReturnType<typeof useWorkbench>;
}

const AUDIT_LABEL: Record<string, string> = {
  create: "建批",
  assign: "调整",
  submit: "提交",
  reject: "拒绝",
  withdraw: "撤回",
};

export default function BatchCard({ batch, wb }: BatchCardProps) {
  const locked = batch.status === "submitted";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{
    ok: boolean;
    reasons: string[];
    ids: string[];
  } | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const conflicts = useMemo(() => evaluateConflicts(batch), [batch]);
  const gems = useMemo(
    () =>
      batch.roster
        .map((id) => wb.gemMap.get(id))
        .filter((g): g is NonNullable<typeof g> => Boolean(g)),
    [batch.roster, wb.gemMap]
  );
  const totalCarat = useMemo(
    () => batchCarat(wb.state.gems, batch),
    [wb.state.gems, batch]
  );

  const destOf = (gemId: string): DestinationId | null =>
    batch.assignments.find((a) => a.gemId === gemId)?.dest ?? null;

  const selected = selectedId && wb.gemMap.get(selectedId);
  const activeDest = selectedId ? destOf(selectedId) : null;

  const pickDestForSelected = (dest: DestinationId) => {
    if (!selectedId || locked) return;
    wb.assign(batch.id, selectedId, dest);
  };

  const handleSubmit = () => {
    const res = wb.submit(batch.id);
    if (res.ok) {
      setFlash({ ok: true, reasons: ["提交成功，批次已锁定"], ids: [] });
    } else {
      setFlash({ ok: false, reasons: res.reasons, ids: res.conflictIds });
    }
  };

  const handleWithdraw = () => {
    wb.withdraw(batch.id);
    setFlash(null);
  };

  const handleDelete = () => {
    if (window.confirm(`确定删除批次 ${batch.label}（${batch.id}）吗？此操作不可撤销。`)) {
      wb.deleteBatch(batch.id);
    }
  };

  const isConflict = (gemId: string) =>
    conflicts.gemIds.includes(gemId) || flash?.ids.includes(gemId);

  const overflowFor = (dest: DestinationId) =>
    conflicts.overflow[dest] ?? [];

  return (
    <article className={`panel batch ${locked ? "locked" : ""}`}>
      <header className="batch-head">
        <div>
          <div className="batch-title-row">
            <h2>{batch.label}</h2>
            <span className={`badge ${locked ? "badge-locked" : "badge-editing"}`}>
              {locked ? "🔒 已锁定" : "✎ 分拣中"}
            </span>
          </div>
          <p className="batch-meta">
            {batch.id} · 订单 {batch.orderNo} · 尺寸筛选 {batch.minMm}–
            {batch.maxMm} mm · 建批 {formatTime(batch.createdAt)}
            {batch.submittedAt && ` · 锁定 ${formatTime(batch.submittedAt)}`}
          </p>
        </div>
        <div className="batch-actions">
          {!locked && (
            <>
              <button
                className={conflicts.gemIds.length === 0 ? "primary" : "danger"}
                onClick={handleSubmit}
              >
                提交批次
              </button>
              <button onClick={handleDelete}>删除</button>
            </>
          )}
          {locked && (
            <button className="warn" onClick={handleWithdraw}>
              撤回锁定
            </button>
          )}
          <button onClick={() => setShowAudit((v) => !v)}>
            {showAudit ? "收起记录" : `调整记录 ${batch.audit.length}`}
          </button>
        </div>
      </header>

      <div className="batch-stats">
        <span>
          清单 <b>{batch.roster.length}</b> 颗
        </span>
        <span>
          已定 <b>{assignedCount(batch)}</b>
        </span>
        <span className={conflicts.unassigned.length ? "stat-bad" : ""}>
          未定 <b>{conflicts.unassigned.length}</b>
        </span>
        <span>
          主石 <b className={overflowFor("main").length ? "stat-bad" : ""}>{destCount(batch, "main")}/1</b>
        </span>
        <span>
          围石 <b className={overflowFor("surround").length ? "stat-bad" : ""}>{destCount(batch, "surround")}/8</b>
        </span>
        <span>
          配石 <b>{destCount(batch, "accent")}</b>
        </span>
        <span>
          退回待定 <b>{destCount(batch, "return")}</b>
        </span>
        <span>
          合计 <b>{totalCarat.toFixed(2)} ct</b>
        </span>
      </div>

      {flash && (
        <div className={`flash ${flash.ok ? "flash-ok" : "flash-bad"}`}>
          <div>
            <b>{flash.ok ? "✔ 整批通过" : "✘ 整批拒绝"}</b>
            <ul>
              {flash.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          <button onClick={() => setFlash(null)}>知道了</button>
        </div>
      )}

      {!flash?.ok && conflicts.gemIds.length > 0 && !locked && (
        <div className="conflict-hint">
          ⚠ 当前不能提交：
          {conflicts.unassigned.length > 0 &&
            ` ${conflicts.unassigned.length} 颗未定去向；`}
          {DEST_ORDER.filter((d) => overflowFor(d).length).map((d) => (
            <span key={d}>
              {" "}
              {DEST_META[d].name}位超容（{overflowFor(d).join("、")}）；
            </span>
          ))}
          表中红色行为冲突宝石。
        </div>
      )}

      <div className="batch-body">
        <div className="roster-wrap">
          <table className="roster">
            <thead>
              <tr>
                <th>编号</th>
                <th>种类/形状</th>
                <th>尺寸/克拉</th>
                <th>净度/颜色</th>
                <th className="col-dest">去向</th>
              </tr>
            </thead>
            <tbody>
              {gems.map((g) => {
                const d = destOf(g.id);
                const conflict = isConflict(g.id);
                return (
                  <tr
                    key={g.id}
                    className={[
                      conflict ? "row-conflict" : "",
                      selectedId === g.id ? "row-selected" : "",
                      d ? `row-${d}` : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedId(g.id)}
                  >
                    <td>
                      <b>{g.id}</b>
                      {g.note && <small className="gem-note" title={g.note}>⚠ {g.note}</small>}
                    </td>
                    <td>
                      {g.species}
                      <small>{g.shape} · {g.cut}</small>
                    </td>
                    <td>
                      {g.sizeMm} mm
                      <small>{g.carat} ct</small>
                    </td>
                    <td>
                      {g.clarity}
                      <small>{g.color}</small>
                    </td>
                    <td className="col-dest">
                      {locked ? (
                        <span className={`dest-tag tag-${d ?? "none"}`}>
                          {d ? DEST_META[d].name : "未定"}
                        </span>
                      ) : (
                        <div
                          className="dest-btns"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {DEST_ORDER.map((dest) => (
                            <button
                              key={dest}
                              className={d === dest ? `pick picked-${dest}` : "pick"}
                              onClick={() => wb.assign(batch.id, g.id, dest)}
                              title={`归到${DEST_META[dest].name}`}
                            >
                              {DEST_META[dest].name}
                            </button>
                          ))}
                          {d && (
                            <button
                              className="pick pick-clear"
                              onClick={() => wb.clearAssignment(batch.id, g.id)}
                              title="撤回此颗的去向（回到未定）"
                            >
                              撤销
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="diagram-side">
          <p className="side-label">
            镶嵌位置示意图
            {!locked && (
              <span>
                选中表格行后点击座孔可快速归位
                {selected && (
                  <>
                    {" "}· 当前：<b>{selected.id}</b>
                    {activeDest && <> → {DEST_META[activeDest].name}</>}
                  </>
                )}
              </span>
            )}
          </p>
          <SocketDiagram
            batch={batch}
            activeDest={activeDest}
            readOnly={locked || !selectedId}
            onPick={pickDestForSelected}
          />
        </aside>
      </div>

      {showAudit && (
        <div className="audit">
          <h3>调整记录（撤回批次后原去向与每次调整均保留）</h3>
          <ol>
            {[...batch.audit].reverse().map((a) => (
              <li key={a.id} className={`audit-${a.type}`}>
                <span className="audit-type">{AUDIT_LABEL[a.type]}</span>
                <span className="audit-time">{formatTime(a.at)}</span>
                <span className="audit-detail">{a.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

function destCount(batch: Batch, dest: DestinationId): number {
  return batch.assignments.filter((a) => a.dest === dest).length;
}
