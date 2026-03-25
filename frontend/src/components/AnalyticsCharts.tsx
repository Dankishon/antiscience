import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AnalyticsBarChartProps<T extends object> {
  data: T[];
  categoryKey: keyof T & string;
  valueKey: keyof T & string;
  horizontal?: boolean;
  height?: number;
  widthPerItem?: number;
  color?: string;
  valueDomain?: [number | 'auto', number | 'auto'];
  xTickFormatter?: (value: string | number) => string;
  tooltipContent?: (datum: T) => ReactNode;
}

interface AnalyticsRadarChartProps<T extends object> {
  data: T[];
  labelKey: keyof T & string;
  valueKey: keyof T & string;
  height?: number;
  width?: number;
  tooltipContent?: (datum: T) => ReactNode;
}

function ChartTooltip({ children }: { children: ReactNode }) {
  if (!children) {
    return null;
  }

  return <div className="chart-tooltip">{children}</div>;
}

export function AnalyticsBarChart<T extends object>({
  data,
  categoryKey,
  valueKey,
  horizontal = false,
  height = 320,
  widthPerItem = 64,
  color = '#344239',
  valueDomain,
  xTickFormatter,
  tooltipContent,
}: AnalyticsBarChartProps<T>) {
  const chartWidth = horizontal ? 720 : Math.max(360, data.length * widthPerItem);
  const chartHeight = horizontal ? Math.max(280, data.length * 56) : height;

  return (
    <div className="chart-scroll">
      <BarChart
        barCategoryGap={horizontal ? 12 : 18}
        data={data}
        height={chartHeight}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 24, bottom: horizontal ? 8 : 24, left: horizontal ? 16 : 8 }}
        width={chartWidth}
      >
        <CartesianGrid stroke="rgba(31, 36, 33, 0.08)" strokeDasharray="4 4" vertical={!horizontal} />
        {horizontal ? (
          <>
            <XAxis
              axisLine={false}
              dataKey={valueKey}
              domain={valueDomain ?? [0, 'auto']}
              tickLine={false}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey={categoryKey}
              tickLine={false}
              type="category"
              width={170}
            />
          </>
        ) : (
          <>
            <XAxis
              axisLine={false}
              dataKey={categoryKey}
              interval={0}
              tickFormatter={xTickFormatter}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              allowDecimals
              axisLine={false}
              domain={valueDomain ?? ['auto', 'auto']}
              tickLine={false}
            />
          </>
        )}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) {
              return null;
            }

            const datum = payload[0]?.payload as T;
            return (
              <ChartTooltip>
                {tooltipContent ? (
                  tooltipContent(datum)
                ) : (
                  <>
                    <strong>{String(datum[categoryKey] ?? '')}</strong>
                    <p>{String(datum[valueKey] ?? '')}</p>
                  </>
                )}
              </ChartTooltip>
            );
          }}
          cursor={{ fill: 'rgba(45, 58, 51, 0.05)' }}
        />
        <Bar dataKey={valueKey} fill={color} radius={horizontal ? [0, 10, 10, 0] : [10, 10, 0, 0]} />
      </BarChart>
    </div>
  );
}

export function AnalyticsRadarChart<T extends object>({
  data,
  labelKey,
  valueKey,
  height = 360,
  width = 480,
  tooltipContent,
}: AnalyticsRadarChartProps<T>) {
  const values = data.reduce<number[]>((accumulator, item) => {
    const value = item[valueKey];
    if (typeof value === 'number') {
      accumulator.push(value);
    }
    return accumulator;
  }, []);
  const minValue = values.length > 0 ? Math.min(...values, 0) : 0;
  const maxValue = values.length > 0 ? Math.max(...values, 0) : 1;

  return (
    <div className="chart-scroll chart-scroll--centered">
      <RadarChart cx="50%" cy="50%" data={data} height={height} outerRadius="72%" width={width}>
        <PolarGrid stroke="rgba(31, 36, 33, 0.12)" />
        <PolarAngleAxis dataKey={labelKey} tick={{ fill: '#5c645e', fontSize: 12 }} />
        <PolarRadiusAxis
          angle={90}
          axisLine={false}
          domain={[Math.floor(minValue), Math.ceil(maxValue || 1)]}
          tick={{ fill: '#7e877f', fontSize: 11 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) {
              return null;
            }

            const datum = payload[0]?.payload as T;
            return (
              <ChartTooltip>
                {tooltipContent ? (
                  tooltipContent(datum)
                ) : (
                  <>
                    <strong>{String(datum[labelKey] ?? '')}</strong>
                    <p>{String(datum[valueKey] ?? '')}</p>
                  </>
                )}
              </ChartTooltip>
            );
          }}
        />
        <Radar
          dataKey={valueKey}
          fill="rgba(52, 66, 57, 0.26)"
          fillOpacity={1}
          name="Профиль"
          stroke="#344239"
          strokeWidth={2}
        />
      </RadarChart>
    </div>
  );
}
