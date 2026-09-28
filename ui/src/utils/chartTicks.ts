/** A handful of evenly spaced, round tick values spanning `[min, max]` (D3's "nice ticks" idea). */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) return [min];

  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;

  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks.length > 0 ? ticks : [min, max];
}
