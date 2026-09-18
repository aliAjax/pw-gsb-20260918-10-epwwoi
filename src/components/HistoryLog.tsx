import type { AdjustLog } from "../types";
import { DEST_LABEL } from "../types";
import { formatTime } from "../store";

const KIND_TEXT = {
  create: "建批",
  assign: "调整去向",
  submit: "提交锁定",
  withdraw: "撤回",
} as const;

function describe(log: AdjustLog): string {
  switch (log.kind) {
    case "create":
      return log.note ?? "按尺寸筛选建批";
    case "submit":
      return "整批校验通过，已提交锁定";
    case "withdraw":
      return "已撤回，恢复分拣中状态（原去向与全部记录保留）";
    case "assign": {
      const from = log.from ? DEST_LABEL[log.from as keyof typeof DEST_LABEL] : "未定去向";
      const to = log.to ? DEST_LABEL[log.to as keyof typeof DEST_LABEL] : "未定去向";
      return `${log.gemId}：${from} → ${to}`;
    }
  }
}

export default function HistoryLog({ logs }: { logs: AdjustLog[] }) {
  const sorted = [...logs].sort((a, b) => b.at - a.at);
  return (
    <div className="history">
      {sorted.length === 0 && <p className="empty-hint">暂无调整记录。</p>}
      <ol>
        {sorted.map((log) => (
          <li key={log.id} className={`log-item log-${log.kind}`}>
            <span className="log-kind">{KIND_TEXT[log.kind]}</span>
            <span className="log-desc">{describe(log)}</span>
            <time>{formatTime(log.at)}</time>
          </li>
        ))}
      </ol>
    </div>
  );
}
