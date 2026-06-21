import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Props {
  data: number[];
  color?: string;
  height?: number;
  gradient?: boolean;
}

export function MiniSparkline({ data, color = '#6366f1', height = 40, gradient = true }: Props) {
  const chartData = data.map((v, i) => ({ v, i }));
  const id = `spark-${color.replace('#', '')}-${data.length}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        {gradient && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={gradient ? `url(#${id})` : 'none'}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
