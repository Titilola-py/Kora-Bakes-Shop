/**
 * Kora Bakes brand mark.
 *
 * The mark is a boutique seal: a fine ink ring holding a custom cobalt "K"
 * whose two arms are croissant folds - they leave the stem on the diagonal and
 * curl back at the tips. The stem, waist and curl tips sit on a plain
 * geometric grid, so one drawing survives a 16px favicon, the website header,
 * a single-colour stamp and a pastry box.
 *
 * One geometry, three lockups:
 *   variant="seal"  (default) - ring plus monogram, used by the site header,
 *                               footer and sign-in card.
 *   variant="glyph"           - monogram only, tuned for favicon/mobile use.
 *   mono                      - every stroke follows currentColor, for
 *                               packaging, stickers and single-colour stamps.
 *
 * Colours come from the site tokens through CSS custom properties and fall back
 * to the palette literals so the mark still renders outside the stylesheet.
 */
const KORA_SEAL = { cx: 24, cy: 24, r: 20.6 };
const KORA_FOLDS = [
  "M15 11.2V36.8",
  "M15 24C21.2 19 34.2 15.9 33.2 11.6",
  "M15 24C21.2 29 34.2 32.1 33.2 36.4",
];

export default function BrandMark({ className = "", title = "Kora Bakes", variant = "seal", mono = false }) {
  const ring = mono ? "currentColor" : "var(--kora-mark-ring, #17243B)";
  const form = mono ? "currentColor" : "var(--kora-mark-form, #2457D6)";
  return (
    <svg
      className={`kora-mark ${className}`.trim()}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {variant === "seal" && (
        <circle
          cx={KORA_SEAL.cx}
          cy={KORA_SEAL.cy}
          r={KORA_SEAL.r}
          fill="none"
          strokeWidth="2.2"
          style={{ stroke: ring }}
        />
      )}
      <g fill="none" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: form }}>
        {KORA_FOLDS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
