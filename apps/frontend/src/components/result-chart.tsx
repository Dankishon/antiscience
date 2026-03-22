'use client';

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { getDictionary } from '../lib/i18n';
import type { ResultChartMode, ResultViewModel } from '../lib/result-presenter';
import { Button } from './button';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function buildColors(length: number, highlightIndex: number) {
  return Array.from({ length }, (_, index) =>
    index === highlightIndex ? 'rgba(184, 94, 52, 0.92)' : 'rgba(244, 182, 137, 0.72)',
  );
}

export function ResultChart({ viewModel }: { viewModel: ResultViewModel }) {
  const copy = getDictionary().result;
  const [mode, setMode] = useState<ResultChartMode>('z');
  const values = mode === 'z' ? viewModel.chart.zValues : viewModel.chart.rawValues;
  const label = mode === 'z' ? copy.chartSeries.z : copy.chartSeries.raw;
  const colors = buildColors(values.length, viewModel.chart.highlightIndex);

  return (
    <div className="stack">
      <div className="actionRow">
        <Button onClick={() => setMode('z')} size="sm" variant={mode === 'z' ? 'primary' : 'ghost'}>
          {copy.chartModes.z}
        </Button>
        <Button onClick={() => setMode('raw')} size="sm" variant={mode === 'raw' ? 'primary' : 'ghost'}>
          {copy.chartModes.raw}
        </Button>
      </div>

      <div className="resultChartWrap">
        <Bar
          data={{
            labels: viewModel.chart.labels,
            datasets: [
              {
                label,
                data: values,
                backgroundColor: colors,
                borderRadius: 10,
                borderSkipped: false,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: {
                display: false,
              },
            },
            scales: {
              x: {
                min: mode === 'z' ? Math.min(-2, ...viewModel.chart.zValues) - 0.3 : 0,
                max: mode === 'z' ? Math.max(2, ...viewModel.chart.zValues) + 0.3 : 12,
                ticks: {
                  precision: mode === 'z' ? 2 : 0,
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
