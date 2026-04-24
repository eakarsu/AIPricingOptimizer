import React from 'react';

// Simple SVG-based charts (no external dependencies)

export const BarChart = ({ data, width = 400, height = 250, barColor = '#667eea' }) => {
  if (!data || data.length === 0) return <div className="no-chart-data">No data available</div>;

  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = (width - 60) / data.length - 10;
  const chartHeight = height - 60;

  return (
    <svg width={width} height={height} className="chart bar-chart">
      {/* Y-axis labels */}
      {[0, 25, 50, 75, 100].map((percent) => {
        const y = chartHeight - (chartHeight * percent / 100) + 20;
        const value = (maxValue * percent / 100).toFixed(0);
        return (
          <g key={percent}>
            <text x="5" y={y + 4} fontSize="10" fill="#888">{value}</text>
            <line x1="40" y1={y} x2={width - 10} y2={y} stroke="#333" strokeDasharray="2,2" />
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = (d.value / maxValue) * chartHeight;
        const x = 50 + i * (barWidth + 10);
        const y = chartHeight - barHeight + 20;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={d.color || barColor}
              rx="4"
              className="chart-bar"
            >
              <title>{d.label}: {d.value}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#888"
              transform={`rotate(-45, ${x + barWidth / 2}, ${height - 10})`}
            >
              {d.label.length > 10 ? d.label.substring(0, 10) + '...' : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const LineChart = ({ data, width = 400, height = 250, lineColor = '#667eea' }) => {
  if (!data || data.length === 0) return <div className="no-chart-data">No data available</div>;

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  const chartHeight = height - 60;
  const chartWidth = width - 60;

  const points = data.map((d, i) => {
    const x = 50 + (i / (data.length - 1 || 1)) * chartWidth;
    const y = chartHeight - ((d.value - minValue) / range) * chartHeight + 20;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width={width} height={height} className="chart line-chart">
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((percent) => {
        const y = chartHeight - (chartHeight * percent / 100) + 20;
        const value = (minValue + range * percent / 100).toFixed(2);
        return (
          <g key={percent}>
            <text x="5" y={y + 4} fontSize="10" fill="#888">${value}</text>
            <line x1="45" y1={y} x2={width - 10} y2={y} stroke="#333" strokeDasharray="2,2" />
          </g>
        );
      })}

      {/* Line */}
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" />

      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={lineColor} className="chart-point">
            <title>{p.label}: ${p.value}</title>
          </circle>
          {data.length <= 10 && (
            <text
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="9"
              fill="#888"
            >
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

export const PieChart = ({ data, width = 250, height = 250 }) => {
  if (!data || data.length === 0) return <div className="no-chart-data">No data available</div>;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const centerX = width / 2;
  const centerY = height / 2 - 20;
  const radius = Math.min(width, height) / 2 - 40;

  const colors = ['#667eea', '#764ba2', '#00c853', '#ff9800', '#ff6b6b', '#9c27b0', '#03a9f4', '#4caf50'];

  let currentAngle = -Math.PI / 2;

  const slices = data.map((d, i) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const pathD = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      path: pathD,
      color: d.color || colors[i % colors.length],
      label: d.label,
      value: d.value,
      percentage: ((d.value / total) * 100).toFixed(1),
    };
  });

  return (
    <svg width={width} height={height} className="chart pie-chart">
      {slices.map((slice, i) => (
        <path
          key={i}
          d={slice.path}
          fill={slice.color}
          stroke="#1a1a2e"
          strokeWidth="2"
          className="chart-slice"
        >
          <title>{slice.label}: {slice.value} ({slice.percentage}%)</title>
        </path>
      ))}

      {/* Legend */}
      {slices.map((slice, i) => (
        <g key={`legend-${i}`} transform={`translate(10, ${height - 30 + (i * 0)})`}>
        </g>
      ))}
    </svg>
  );
};

export const DonutChart = ({ data, width = 250, height = 250, innerRadius = 60 }) => {
  if (!data || data.length === 0) return <div className="no-chart-data">No data available</div>;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(width, height) / 2 - 20;

  const colors = ['#667eea', '#764ba2', '#00c853', '#ff9800', '#ff6b6b', '#9c27b0'];

  let currentAngle = -Math.PI / 2;

  return (
    <svg width={width} height={height} className="chart donut-chart">
      {data.map((d, i) => {
        const sliceAngle = (d.value / total) * 2 * Math.PI;
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;
        currentAngle = endAngle;

        const x1 = centerX + outerRadius * Math.cos(startAngle);
        const y1 = centerY + outerRadius * Math.sin(startAngle);
        const x2 = centerX + outerRadius * Math.cos(endAngle);
        const y2 = centerY + outerRadius * Math.sin(endAngle);
        const x3 = centerX + innerRadius * Math.cos(endAngle);
        const y3 = centerY + innerRadius * Math.sin(endAngle);
        const x4 = centerX + innerRadius * Math.cos(startAngle);
        const y4 = centerY + innerRadius * Math.sin(startAngle);

        const largeArc = sliceAngle > Math.PI ? 1 : 0;

        const pathD = `
          M ${x1} ${y1}
          A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
          L ${x3} ${y3}
          A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
          Z
        `;

        return (
          <path
            key={i}
            d={pathD}
            fill={d.color || colors[i % colors.length]}
            stroke="#1a1a2e"
            strokeWidth="2"
            className="chart-slice"
          >
            <title>{d.label}: {d.value} ({((d.value / total) * 100).toFixed(1)}%)</title>
          </path>
        );
      })}

      {/* Center text */}
      <text x={centerX} y={centerY - 5} textAnchor="middle" fontSize="20" fill="#fff" fontWeight="bold">
        {total}
      </text>
      <text x={centerX} y={centerY + 15} textAnchor="middle" fontSize="12" fill="#888">
        Total
      </text>
    </svg>
  );
};

export const ChartLegend = ({ data, colors }) => {
  const defaultColors = ['#667eea', '#764ba2', '#00c853', '#ff9800', '#ff6b6b', '#9c27b0'];

  return (
    <div className="chart-legend">
      {data.map((d, i) => (
        <div key={i} className="legend-item">
          <span
            className="legend-color"
            style={{ backgroundColor: d.color || colors?.[i] || defaultColors[i % defaultColors.length] }}
          />
          <span className="legend-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
};
