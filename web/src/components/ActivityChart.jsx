import { useMemo, useRef, useState } from "react";
import { AGENT_NAMES } from "../constants.js";
import { bucketize } from "../lib.js";
import { useSettings } from "../settings.jsx";

const W = 640;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };
const GAP = 2;

function niceMax(n) {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((v) => v >= n);
}

function fmtTime(t, span, hour12) {
  const d = new Date(t);
  return span > 36 * 3600e3
    ? d.toLocaleDateString([], { month: "short", day: "numeric" })
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12 });
}

// Stacked bars: events per time bucket, one segment per agent.
export default function ActivityChart({ events, window: [start, end], agents }) {
  const { settings } = useSettings();
  const h12 = settings.clock === "12h";
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const wrapRef = useRef(null);
  const buckets = useMemo(() => bucketize(events, start, end, agents), [events, start, end, agents]);

  const max = niceMax(Math.max(...buckets.map((b) => b.total), 0));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const bw = plotW / buckets.length;
  const y = (v) => (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const span = end - start;
  const xLabels = [0, Math.floor(buckets.length / 2), buckets.length - 1];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W - PAD.left;
    const i = Math.min(buckets.length - 1, Math.max(0, Math.floor(x / bw)));
    setHover({ i, left: ((PAD.left + (i + 0.5) * bw) / W) * 100 });
  };

  const hb = hover && buckets[hover.i];

  return (
    <section className="card chart-card">
      <div className="card-head">
        <h2>Activity over time</h2>
        <div className="legend">
          {agents.map((a) => (
            <span key={a}><span className={`swatch ${a}`} aria-hidden="true" />{AGENT_NAMES[a]}</span>
          ))}
          <button type="button" className="link" onClick={() => setShowTable((v) => !v)}>
            {showTable ? "Chart" : "Table"}
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>From</th>{agents.map((a) => <th key={a}>{AGENT_NAMES[a]}</th>)}<th>Total</th></tr>
            </thead>
            <tbody>
              {buckets.filter((b) => b.total).map((b) => (
                <tr key={b.start}>
                  <td>{fmtTime(b.start, span, h12)}</td>
                  {agents.map((a) => <td key={a}>{b[a]}</td>)}
                  <td>{b.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!buckets.some((b) => b.total) && <p className="muted pad">No events in this range.</p>}
        </div>
      ) : (
        <div className="chart-wrap" ref={wrapRef}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="chart"
            role="img"
            aria-label={`Events over time, ${events.length} total`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH - y(t)} y2={PAD.top + plotH - y(t)} />
                <text className="axis-label" x={PAD.left - 6} y={PAD.top + plotH - y(t) + 3} textAnchor="end">{t}</text>
              </g>
            ))}
            {hb && <rect className="hover-band" x={PAD.left + hover.i * bw} y={PAD.top} width={bw} height={plotH} />}
            {buckets.map((b, i) => {
              let acc = 0;
              const x = PAD.left + i * bw + GAP / 2;
              const w = Math.max(bw - GAP, 1);
              const segs = agents.filter((a) => b[a] > 0);
              return segs.map((a, j) => {
                const h = y(b[a]);
                const yTop = PAD.top + plotH - acc - h;
                acc += h;
                const isTop = j === segs.length - 1;
                const r = isTop ? Math.min(3, w / 2, h) : 0;
                // Top segment gets rounded data-end; a 2px gap separates stacked segments.
                const segH = Math.max(h - (isTop ? 0 : GAP), 0.5);
                const d = r
                  ? `M${x},${yTop + segH}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yTop + segH}Z`
                  : `M${x},${yTop + (isTop ? 0 : GAP)}h${w}v${segH}h${-w}Z`;
                return <path key={a} d={d} className={`bar ${a}`} />;
              });
            })}
            <line className="baseline" x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />
            {xLabels.map((i, k) => (
              <text
                key={k}
                className="axis-label"
                x={PAD.left + (k === 0 ? 0 : k === 2 ? plotW : (i + 0.5) * bw)}
                y={H - 6}
                textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
              >
                {k === 2 ? "now" : fmtTime(buckets[i].start, span, h12)}
              </text>
            ))}
          </svg>
          {hb && (
            <div className="tooltip" style={{ left: `${hover.left}%` }}>
              <div className="tt-title">{fmtTime(hb.start, span, h12)} – {fmtTime(hb.end, span, h12)}</div>
              {agents.map((a) => (
                <div key={a} className="tt-row">
                  <span className={`tt-key ${a}`} aria-hidden="true" />
                  <strong>{hb[a]}</strong>
                  <span className="muted">{AGENT_NAMES[a]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
