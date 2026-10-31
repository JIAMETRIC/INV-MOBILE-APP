// Kit chart (C17): a pie seen from above at an angle, so it reads as a 3D disc.
// The top is an ellipse cut into slices; the front half has a side wall `depth`
// tall in each slice's colour under `chartShade`. Flat colours only (no
// gradients); slices are split by 1px lightColor lines.
import React from 'react';
import { View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { chartShade, white } from './tokens';

export type PieSlice = { value: number; color: string };

const TAU = Math.PI * 2;

// width: the disc's width. tilt: height of the top / width (1 = flat from above).
// emptyColor: the disc when every value is 0.
export function PieChart3D({ slices, width, tilt = 0.55, depth = 16, emptyColor, label }: {
  slices: PieSlice[]; width: number; tilt?: number; depth?: number; emptyColor: string; label: string;
}) {
  const rx = width / 2;
  const ry = rx * tilt;
  const cx = rx;
  const cy = ry + 1;
  const height = ry * 2 + depth + 2;
  // θ = 0 at the back (12 o'clock), growing clockwise on screen.
  const at = (t: number, dy = 0) => `${(cx + rx * Math.sin(t)).toFixed(2)} ${(cy - ry * Math.cos(t) + dy).toFixed(2)}`;

  const total = slices.reduce((s, p) => s + Math.max(0, p.value), 0);
  const parts: Array<{ a: number; b: number; color: string }> = [];
  if (total > 0) {
    let a = 0;
    for (const p of slices) {
      const sweep = (Math.max(0, p.value) / total) * TAU;
      if (sweep > 0) parts.push({ a, b: a + sweep, color: p.color });
      a += sweep;
    }
  } else {
    parts.push({ a: 0, b: TAU, color: emptyColor });
  }

  // The visible wall is the front half, θ in [π/2, 3π/2].
  const wall = (a: number, b: number) => {
    const s = Math.max(a, Math.PI / 2);
    const e = Math.min(b, (3 * Math.PI) / 2);
    if (e <= s) return null;
    return `M ${at(s)} A ${rx} ${ry} 0 0 1 ${at(e)} L ${at(e, depth)} A ${rx} ${ry} 0 0 0 ${at(s, depth)} Z`;
  };
  const top = (a: number, b: number) =>
    `M ${cx} ${cy} L ${at(a)} A ${rx} ${ry} 0 ${b - a > Math.PI ? 1 : 0} 1 ${at(b)} Z`;
  const whole = parts.length === 1 ? parts[0] : null;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width, height }}>
      <Svg width={width} height={height}>
        {parts.map((p, i) => {
          const d = wall(p.a, p.b);
          return d ? (
            <G key={`w${i}`}>
              <Path d={d} fill={p.color} />
              <Path d={d} fill={chartShade} />
            </G>
          ) : null;
        })}
        {whole
          ? <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={whole.color} />
          : parts.map((p, i) => <Path key={`t${i}`} d={top(p.a, p.b)} fill={p.color} stroke={white} strokeWidth={1} strokeLinejoin="round" />)}
      </Svg>
    </View>
  );
}
