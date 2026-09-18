import type { Gem } from "../types";
import { SLOT_LIMITS } from "../types";

interface Props {
  main: Gem[];
  surround: Gem[];
  locked: boolean;
}

const RING_RADIUS = 74;
const CENTER = 100;

function ringPoint(index: number) {
  // 从正上方开始顺时针均布 8 个围石位
  const angle = (-90 + (360 / 8) * index) * (Math.PI / 180);
  return {
    x: CENTER + RING_RADIUS * Math.cos(angle),
    y: CENTER + RING_RADIUS * Math.sin(angle),
  };
}

function shortLabel(gem: Gem) {
  return gem.id.replace(/^ST-/, "");
}

export default function SlotDiagram({ main, surround, locked }: Props) {
  const mainFilled = main.slice(0, SLOT_LIMITS.main);
  const surroundFilled = surround.slice(0, SLOT_LIMITS.surround);

  return (
    <svg className="slot-diagram" viewBox="0 0 200 200" role="img" aria-label="镶嵌位置示意图：中心主石位，外圈8个围石位">
      <circle cx={CENTER} cy={CENTER} r={94} className="slot-ring-outer" />
      <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} className="slot-ring-guide" />

      {Array.from({ length: 8 }, (_, i) => {
        const pos = ringPoint(i);
        const gem = surroundFilled[i];
        return (
          <g key={i}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={16}
              className={gem ? "slot-filled surround" : "slot-empty"}
            />
            {gem ? (
              <text x={pos.x} y={pos.y + 3.4} textAnchor="middle" className="slot-text">
                {shortLabel(gem)}
              </text>
            ) : (
              <text x={pos.x} y={pos.y + 3.4} textAnchor="middle" className="slot-index">
                {i + 1}
              </text>
            )}
          </g>
        );
      })}

      <circle
        cx={CENTER}
        cy={CENTER}
        r={30}
        className={mainFilled[0] ? "slot-filled main" : "slot-empty main"}
      />
      {mainFilled[0] ? (
        <text x={CENTER} y={CENTER + 4} textAnchor="middle" className="slot-text main-text">
          {shortLabel(mainFilled[0])}
        </text>
      ) : (
        <text x={CENTER} y={CENTER + 4} textAnchor="middle" className="slot-placeholder">
          主石
        </text>
      )}

      {locked && <circle cx={188} cy={14} r={9} className="lock-dot" />}
    </svg>
  );
}
