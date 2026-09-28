/*
 * Presentation helpers for the gear page. The numbers themselves come from the API (types/gear.ts).
 */

// The dataviz reference categorical palette, in its validated order. Colour follows the
// gear (the API ranks it once, by overall distance), never its position in a filtered view.
const GEAR_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
/** Past eight items there are no more distinct hues; the rest share a neutral grey. */
export const OVERFLOW_COLOR = "#8a949a";

export const gearColor = (rank: number): string => GEAR_PALETTE[rank] ?? OVERFLOW_COLOR;

/**
 * Running shoes are usually retired somewhere between 500 and 800 km; the upper end, so the
 * gauge warns rather than nags.
 */
export const SHOE_LIFESPAN_METRES = 800_000;
