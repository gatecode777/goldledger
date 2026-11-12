'use client';

import React, { useMemo, useState } from 'react';
import { Transaction } from '@/lib/types';
import { formatShortDate, formatCardCurrency } from '@/lib/formatters';
import { convertCurrency, getCurrencySymbol } from '@/lib/currencies';
import { IconBarChart } from '@/components/Icons';

interface TrendChartProps {
  transactions: Transaction[];
  currency?: string;
}

interface DayPoint {
  date: string;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
}

const TrendChart = React.memo(function TrendChart({ transactions, currency = 'USD' }: TrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo<DayPoint[]>(() => {
    if (transactions.length === 0) return [];

    const map = new Map<string, { buy: number; sell: number }>();
    transactions.forEach((tx) => {
      const date = tx.dateTime.slice(0, 10);
      const convertedValue = convertCurrency(tx.totalValue, tx.currency, currency);
      const existing = map.get(date) ?? { buy: 0, sell: 0 };
      if (tx.type === 'buy') existing.buy += convertedValue;
      else existing.sell += convertedValue;
      map.set(date, existing);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { buy, sell }]) => ({
        date,
        buyVolume: buy,
        sellVolume: sell,
        netFlow: sell - buy,
      }));
  }, [transactions, currency]);

  if (points.length === 0) {
    return (
      <div className="chart-empty">
        <div className="chart-empty-icon">
          <IconBarChart size={28} />
        </div>
        <div>No transaction history in this period yet</div>
      </div>
    );
  }

  const W = 800;
  const H = 230;
  const PAD = { top: 18, right: 20, bottom: 34, left: 66 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...points.map((p) => Math.max(p.buyVolume, p.sellVolume)), 1);

  const scaleY = (val: number) => PAD.top + chartH - (val / maxVal) * chartH;
  const scaleX = (i: number) =>
    PAD.left + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);

  const buyPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p.buyVolume)}`)
    .join(' ');

  const sellPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p.sellVolume)}`)
    .join(' ');

  const buyArea = `${buyPath} L ${scaleX(points.length - 1)} ${PAD.top + chartH} L ${scaleX(0)} ${PAD.top + chartH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    val: maxVal * t,
    y: scaleY(maxVal * t),
  }));

  const currSymbol = getCurrencySymbol(currency);
  const fmtK = (v: number) =>
    v >= 1_000_000
      ? `${currSymbol}${(v / 1_000_000).toFixed(1)}M`
      : v >= 1000
      ? `${currSymbol}${(v / 1000).toFixed(0)}K`
      : `${currSymbol}${v.toFixed(0)}`;

  const step = Math.ceil(points.length / 7);
  const xTickIndices = points
    .map((_, i) => i)
    .filter((i) => i % step === 0 || i === points.length - 1);

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
  const bandWidth = points.length > 1 ? chartW / (points.length - 1) : chartW;

  return (
    <div className="chart-container" onMouseLeave={() => setHoverIndex(null)}>
      {/* Minimal Legend + Active Hover Readout */}
      <div className="chart-toolbar">
        <div className="chart-legend">
          <div className="chart-legend-item">
            <span className="chart-legend-line buy" />
            <span>Buy Volume ({currency})</span>
          </div>
          <div className="chart-legend-item">
            <span className="chart-legend-line sell" />
            <span>Sell Volume ({currency})</span>
          </div>
        </div>

        {activePoint ? (
          <div className="chart-hover-readout">
            <span className="chart-hover-date">
              {formatShortDate(activePoint.date + 'T00:00:00')}
            </span>
            <span className="chart-hover-sep">·</span>
            <span>
              Buy: <strong>{formatCardCurrency(activePoint.buyVolume, currency)}</strong>
            </span>
            <span className="chart-hover-sep">·</span>
            <span>
              Sell: <strong>{formatCardCurrency(activePoint.sellVolume, currency)}</strong>
            </span>
          </div>
        ) : (
          <div className="chart-hover-hint">Hover chart points for daily details</div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" style={{ height: H }}>
        <defs>
          <linearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle horizontal grid lines */}
        {yTicks.map(({ y, val }) => (
          <g key={val}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="#e7e5e4"
              strokeDasharray="3 3"
            />
            <text
              x={PAD.left - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fontWeight="500"
              fill="#78716c"
              style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtK(val)}
            </text>
          </g>
        ))}

        {/* Buy area fill */}
        {points.length > 1 && <path d={buyArea} fill="url(#buyGrad)" />}

        {/* Sell line (warm bronze dashed to contrast cleanly within golden theme) */}
        <path
          d={sellPath}
          fill="none"
          stroke="#92400e"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Buy line */}
        <path
          d={buyPath}
          fill="none"
          stroke="#d97706"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover vertical crosshair */}
        {hoverIndex !== null && (
          <line
            x1={scaleX(hoverIndex)}
            y1={PAD.top}
            x2={scaleX(hoverIndex)}
            y2={PAD.top + chartH}
            stroke="#d97706"
            strokeWidth="1"
            strokeOpacity="0.45"
          />
        )}

        {/* Data points */}
        {points.map((p, i) => {
          const isHovered = hoverIndex === i;
          return (
            <g key={p.date}>
              <circle
                cx={scaleX(i)}
                cy={scaleY(p.buyVolume)}
                r={isHovered ? 5.5 : 3.5}
                fill="#d97706"
                stroke="#ffffff"
                strokeWidth="1.75"
              />
              <circle
                cx={scaleX(i)}
                cy={scaleY(p.sellVolume)}
                r={isHovered ? 5 : 3.2}
                fill="#92400e"
                stroke="#ffffff"
                strokeWidth="1.75"
              />
            </g>
          );
        })}

        {/* Invisible wide hover hit columns for easy interaction */}
        {points.map((p, i) => {
          const cx = scaleX(i);
          const xStart = i === 0 ? PAD.left : cx - bandWidth / 2;
          const xEnd = i === points.length - 1 ? W - PAD.right : cx + bandWidth / 2;
          return (
            <rect
              key={`hit-${p.date}`}
              x={xStart}
              y={PAD.top}
              width={Math.max(xEnd - xStart, 12)}
              height={chartH}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}

        {/* X-axis labels */}
        {xTickIndices.map((i) => (
          <text
            key={i}
            x={scaleX(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill="#78716c"
            style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}
          >
            {formatShortDate(points[i].date + 'T00:00:00')}
          </text>
        ))}

        {/* Bottom baseline */}
        <line
          x1={PAD.left}
          y1={PAD.top + chartH}
          x2={W - PAD.right}
          y2={PAD.top + chartH}
          stroke="#d6d3d1"
        />
      </svg>
    </div>
  );
});

export default TrendChart;
