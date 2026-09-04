'use client';

import React, { useMemo } from 'react';
import { Transaction } from '@/lib/types';
import { formatShortDate } from '@/lib/formatters';
import { convertToUSD } from '@/lib/currencies';

interface TrendChartProps {
  transactions: Transaction[];
}

interface DayPoint {
  date: string;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
}

export default function TrendChart({ transactions }: TrendChartProps) {
  const points = useMemo<DayPoint[]>(() => {
    if (transactions.length === 0) return [];

    // Group by date, converting to USD for consistency
    const map = new Map<string, { buy: number; sell: number }>();
    transactions.forEach(tx => {
      const date = tx.dateTime.slice(0, 10); // YYYY-MM-DD
      const usdValue = convertToUSD(tx.totalValue, tx.currency);
      const existing = map.get(date) ?? { buy: 0, sell: 0 };
      if (tx.type === 'buy') existing.buy += usdValue;
      else existing.sell += usdValue;
      map.set(date, existing);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { buy, sell }]) => ({
        date,
        buyVolume: buy,
        sellVolume: sell,
        netFlow: buy - sell,
      }));
  }, [transactions]);

  if (points.length === 0) {
    return (
      <div className="chart-empty">
        <div style={{ fontSize: 40 }}>📊</div>
        <div>No data to display yet</div>
      </div>
    );
  }

  const W = 800, H = 220;
  const PAD = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...points.map(p => Math.max(p.buyVolume, p.sellVolume)), 1);

  const scaleY = (val: number) => PAD.top + chartH - (val / maxVal) * chartH;
  const scaleX = (i: number) =>
    PAD.left + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);

  const buyPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p.buyVolume)}`)
    .join(' ');

  const sellPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p.sellVolume)}`)
    .join(' ');

  // Area fill for buy
  const buyArea = `${buyPath} L ${scaleX(points.length - 1)} ${PAD.top + chartH} L ${scaleX(0)} ${PAD.top + chartH} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    val: maxVal * t,
    y: scaleY(maxVal * t),
  }));

  const fmtK = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` :
    v >= 1000 ? `$${(v / 1000).toFixed(0)}K` :
    `$${v.toFixed(0)}`;

  // Determine which ticks to show on X-axis (at most 7)
  const step = Math.ceil(points.length / 7);
  const xTickIndices = points.map((_, i) => i).filter(i => i % step === 0 || i === points.length - 1);

  return (
    <div className="chart-container">
      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, paddingLeft: PAD.left }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div style={{ width: 24, height: 3, background: '#4ade80', borderRadius: 2 }} />
          Buy Volume (USD)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div style={{ width: 24, height: 3, background: '#f87171', borderRadius: 2 }} />
          Sell Volume (USD)
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        style={{ height: H }}
      >
        <defs>
          <linearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4ade80" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sellGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f87171" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map(({ y, val }) => (
          <g key={val}>
            <line
              x1={PAD.left} y1={y}
              x2={W - PAD.right} y2={y}
              stroke="rgba(0,0,0,0.06)"
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 8} y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--text-muted)"
            >
              {fmtK(val)}
            </text>
          </g>
        ))}

        {/* Buy area fill */}
        <path d={buyArea} fill="url(#buyGrad)" />

        {/* Buy line */}
        <path
          d={buyPath}
          fill="none"
          stroke="#4ade80"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Sell line */}
        <path
          d={sellPath}
          fill="none"
          stroke="#f87171"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={scaleX(i)} cy={scaleY(p.buyVolume)}  r="4" fill="#4ade80" />
            <circle cx={scaleX(i)} cy={scaleY(p.sellVolume)} r="4" fill="#f87171" />
          </g>
        ))}

        {/* X-axis labels */}
        {xTickIndices.map(i => (
          <text
            key={i}
            x={scaleX(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="11"
            fill="var(--text-muted)"
          >
            {formatShortDate(points[i].date + 'T00:00:00')}
          </text>
        ))}

        <line
          x1={PAD.left} y1={PAD.top + chartH}
          x2={W - PAD.right} y2={PAD.top + chartH}
          stroke="rgba(0,0,0,0.12)"
        />
      </svg>
    </div>
  );
}
