import type { Batch, Destination, Gem } from "../types";
import { DEST_LABEL } from "../types";

const DEST_ORDER: Destination[] = ["main", "surround", "accent", "pending"];

interface Props {
  batch: Batch;
  gems: Gem[]; // 已经过批次内尺寸筛选
  conflicts: Set<string>;
  onAssign: (gemId: string, dest: Destination) => void;
}

function badge(dest: Destination | undefined) {
  if (!dest) return <span className="dest-none">未定去向</span>;
  return <span className={`dest-badge dest-${dest}`}>{DEST_LABEL[dest]}</span>;
}

export default function GemTable({ batch, gems, conflicts, onAssign }: Props) {
  const locked = batch.status === "locked";

  if (gems.length === 0) {
    return <p className="empty-hint">当前尺寸筛选下没有宝石。</p>;
  }

  return (
    <div className="gem-table-wrap">
      <table className="gem-table">
        <thead>
          <tr>
            <th>宝石编号</th>
            <th>种类 / 形状</th>
            <th>尺寸(mm)</th>
            <th>克拉</th>
            <th>净度 / 颜色 / 切工</th>
            <th>缺陷备注</th>
            <th>去向</th>
            <th>调整</th>
          </tr>
        </thead>
        <tbody>
          {gems.map((gem) => {
            const dest = batch.assignments[gem.id];
            const conflict = conflicts.has(gem.id);
            return (
              <tr key={gem.id} className={conflict ? "conflict-row" : undefined}>
                <td className="gem-id">
                  {gem.id}
                  {conflict && <span className="conflict-tag">冲突</span>}
                </td>
                <td>
                  {gem.kind} · {gem.shape}
                </td>
                <td>{gem.sizeMm.toFixed(1)}</td>
                <td>{gem.carat.toFixed(2)}</td>
                <td className="muted-cell">
                  {gem.clarity} / {gem.color} / {gem.cut}
                </td>
                <td className="defect-cell">{gem.defect || "—"}</td>
                <td>{badge(dest)}</td>
                <td>
                  <div className="seg">
                    {DEST_ORDER.map((d) => (
                      <button
                        key={d}
                        className={`seg-btn dest-${d} ${dest === d ? "active" : ""}`}
                        disabled={locked}
                        title={DEST_LABEL[d]}
                        onClick={() => onAssign(gem.id, d)}
                      >
                        {DEST_LABEL[d]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
