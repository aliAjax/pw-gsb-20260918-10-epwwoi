import { useMemo } from "react";
import type { Batch, DestinationId } from "./types";
import { DEST_META } from "./types";
import type { useWorkbench } from "./useWorkbench";

interface OrderViewProps {
  wb: ReturnType<typeof useWorkbench>;
}

/** 按订单查看：订单 → 批次 → 宝石清单（含去向与批次状态） */
export default function OrderView({ wb }: OrderViewProps) {
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { batches: Batch[]; gems: { gemId: string; dest: DestinationId | null; batch: Batch }[] }
    >();
    for (const batch of wb.state.batches) {
      const key = batch.orderNo;
      if (!map.has(key)) map.set(key, { batches: [], gems: [] });
      const g = map.get(key)!;
      g.batches.push(batch);
      for (const gemId of batch.roster) {
        const dest =
          batch.assignments.find((a) => a.gemId === gemId)?.dest ?? null;
        g.gems.push({ gemId, dest, batch });
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [wb.state.batches]);

  if (groups.length === 0) return null;

  return (
    <section className="panel order-view">
      <div className="heading">
        <div>
          <p>按订单查看</p>
          <h2>订单宝石清单</h2>
        </div>
      </div>
      <div className="order-groups">
        {groups.map(([order, data]) => {
          const lockedGems = data.gems.filter(
            (x) => x.batch.status === "submitted"
          );
          return (
            <div key={order} className="order-group">
              <h3>
                订单 {order}
                <small>
                  {data.batches.length} 个批次 · {data.gems.length} 颗 · 已锁定{" "}
                  {lockedGems.length} 颗
                </small>
              </h3>
              <div className="order-batch-lines">
                {data.batches.map((b) => (
                  <div key={b.id} className="order-line">
                    <span className="order-line-head">
                      {b.id} · {b.label}
                      <em className={b.status === "submitted" ? "ok" : "pending"}>
                        {b.status === "submitted" ? "已锁定" : "分拣中"}
                      </em>
                    </span>
                    <span className="order-gem-tags">
                      {b.roster.map((id) => {
                        const gem = wb.gemMap.get(id);
                        const dest =
                          b.assignments.find((a) => a.gemId === id)?.dest ??
                          null;
                        return (
                          <span
                            key={id}
                            className={`mini-tag tag-${dest ?? "none"}`}
                            title={
                              gem
                                ? `${gem.species} · ${gem.shape} · ${gem.sizeMm}mm · ${gem.carat}ct${
                                    gem.note ? ` · ${gem.note}` : ""
                                  }`
                                : id
                            }
                          >
                            {id}
                            {dest ? ` ${DEST_META[dest].name}` : " 未定"}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
