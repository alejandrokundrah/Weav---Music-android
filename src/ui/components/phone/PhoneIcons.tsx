import { useId, type SVGProps } from "react";

/**
 * Icons for the phone Home, traced from the design file rather than taken from the Solar set:
 * the nav glyphs carry a vertical white gradient when active, and the glass play triangle
 * is filled with one — neither is something `currentColor` can express.
 *
 * Every path below is the design's own geometry, in the design's own coordinates; each icon's
 * `viewBox` is the 24px box that geometry was drawn in, so the SVG scales without any
 * transform maths.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children"> & { size?: number };

/** `useId` yields ":r1:", and a colon in a `url(#…)` reference is not safe everywhere. */
function useSafeId(): string {
  return useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

const INACTIVE = "#525252";

function NavGlyph({
  box,
  active,
  size = 24,
  children,
  ...rest
}: IconProps & {
  box: readonly [number, number];
  active: boolean;
  children: (stroke: string, round: Record<string, string>) => React.ReactNode;
}) {
  const id = useSafeId();
  const [x, y] = box;
  const stroke = active ? `url(#${id})` : INACTIVE;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${x} ${y} 24 24`}
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      {active && (
        <defs>
          <linearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            x1={x + 12}
            y1={y + 2}
            x2={x + 12}
            y2={y + 22}
          >
            <stop stopColor="white" />
            <stop offset="1" stopColor="#E7E7E7" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      )}
      {children(stroke, { strokeLinecap: "round", strokeLinejoin: "round" })}
    </svg>
  );
}

export function NavHomeIcon({ active = false, ...props }: IconProps & { active?: boolean }) {
  return (
    <NavGlyph box={[44, 756]} active={active} {...props}>
      {(stroke, round) => (
        <>
          <path d="M53.75 772.25H58.25" strokeWidth="1.5" stroke={stroke} strokeLinecap="round" />
          <path d="M46 769.713C46 764.082 46.6405 764.475 50.0883 761.41C51.5967 760.246 53.9439 758 55.9708 758C57.9967 758 60.3908 760.235 61.9128 761.41C65.3605 764.475 66 764.082 66 769.713C66 778 63.9564 778 56 778C48.0436 778 46 778 46 769.713Z" strokeWidth="1.5" stroke={stroke} {...round} />
        </>
      )}
    </NavGlyph>
  );
}

export function NavExploreIcon({ active = false, ...props }: IconProps & { active?: boolean }) {
  return (
    <NavGlyph box={[133, 756]} active={active} {...props}>
      {(stroke) => (
        <>
          <path d="M145 758.75C150.109 758.75 154.25 762.891 154.25 768C154.25 773.109 150.109 777.25 145 777.25C139.891 777.25 135.75 773.109 135.75 768C135.75 762.891 139.891 758.75 145 758.75Z" strokeWidth="1.5" stroke={stroke} />
          <path d="M143.771 766.129L146.496 765.244C147.273 764.991 148.008 765.727 147.756 766.504L146.871 769.229C146.772 769.534 146.533 769.772 146.229 769.871L143.503 770.756C142.726 771.009 141.991 770.273 142.243 769.496L143.128 766.771C143.227 766.466 143.466 766.228 143.771 766.129Z" strokeWidth="1.5" stroke={stroke} />
        </>
      )}
    </NavGlyph>
  );
}

export function NavPlayIcon({ active = false, ...props }: IconProps & { active?: boolean }) {
  return (
    <NavGlyph box={[222, 756]} active={active} {...props}>
      {(stroke, round) => (
        <path d="M228 769.861V766.516C228 763.21 228 761.557 229.06 760.993C230.121 760.428 231.492 761.352 234.234 763.199L236.836 764.951C239.161 766.517 240.324 767.3 240.3 768.392C240.277 769.484 239.081 770.216 236.69 771.68L234.089 773.272C231.393 774.923 230.045 775.748 229.022 775.175C228 774.602 228 773.022 228 769.861Z" strokeWidth="1.5" stroke={stroke} {...round} />
      )}
    </NavGlyph>
  );
}

export function NavUserIcon({ active = false, ...props }: IconProps & { active?: boolean }) {
  return (
    <NavGlyph box={[310, 756]} active={active} {...props}>
      {(stroke) => (
        <>
          <path d="M325.25 762C325.25 763.795 323.795 765.25 322 765.25C320.205 765.25 318.75 763.795 318.75 762C318.75 760.205 320.205 758.75 322 758.75C323.795 758.75 325.25 760.205 325.25 762Z" strokeWidth="1.5" stroke={stroke} />
          <path d="M328.25 773C328.25 774.076 327.641 775.12 326.514 775.925C325.388 776.729 323.795 777.25 322 777.25C320.205 777.25 318.612 776.729 317.486 775.925C316.359 775.12 315.75 774.076 315.75 773C315.75 771.924 316.359 770.88 317.486 770.075C318.612 769.271 320.205 768.75 322 768.75C323.795 768.75 325.388 769.271 326.514 770.075C327.641 770.88 328.25 771.924 328.25 773Z" strokeWidth="1.5" stroke={stroke} />
        </>
      )}
    </NavGlyph>
  );
}

/* ── Header ───────────────────────────────────────────────────────── */

export function PhoneSearchIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="282.5 60.5 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path d="M294 63.75C289.444 63.75 285.75 67.4437 285.75 72C285.75 76.5563 289.444 80.25 294 80.25C298.556 80.25 302.25 76.5563 302.25 72C302.25 67.4437 298.556 63.75 294 63.75Z" strokeWidth="1.5" stroke="currentColor" />
      <path d="M303 79.75C302.31 79.75 301.75 80.3096 301.75 81C301.75 81.6904 302.31 82.25 303 82.25C303.69 82.25 304.25 81.6904 304.25 81C304.25 80.3096 303.69 79.75 303 79.75Z" strokeWidth="1.5" stroke="currentColor" />
    </svg>
  );
}

export function PhoneBellIcon({ size = 24, ...props }: IconProps) {
  const id = useSafeId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="331 60 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M341.304 79.7641C340.779 79.7641 340.38 80.2534 340.655 80.7007C341.138 81.4886 342.008 82.0141 343 82.0141C343.992 82.0141 344.862 81.4886 345.345 80.7007C345.62 80.2534 345.221 79.7641 344.696 79.7641C344.362 79.7641 344.075 79.9841 343.824 80.2043C343.604 80.3972 343.316 80.5141 343 80.5141C342.684 80.5141 342.396 80.3972 342.176 80.2043C341.925 79.9841 341.638 79.7641 341.304 79.7641Z"
        fill="currentColor"
      />
      <mask id={id} style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="334" y="62" width="18" height="17">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M350.5 71.85C350.5 68.8617 349.017 66.0682 346.541 64.3943L345.241 63.5149C343.887 62.5998 342.113 62.5998 340.759 63.5149L339.459 64.3943C336.983 66.0682 335.5 68.8617 335.5 71.85V73.7639C334.886 74.3132 334.5 75.1115 334.5 76C334.5 77.6569 335.843 79 337.5 79H348.5C350.157 79 351.5 77.6569 351.5 76C351.5 75.1115 351.114 74.3132 350.5 73.7639V71.85Z"
          fill="white"
        />
      </mask>
      <g mask={`url(#${id})`}>
        <path d="M346.541 64.3943L345.701 65.6369L346.541 64.3943ZM350.5 71.85H352H350.5ZM345.241 63.5149L346.081 62.2723L345.241 63.5149ZM340.759 63.5149L339.919 62.2723L340.759 63.5149ZM339.459 64.3943L340.299 65.6369L339.459 64.3943ZM335.5 71.85H337H335.5ZM335.5 73.7639L336.5 74.8816L337 74.4344V73.7639H335.5ZM350.5 73.7639H349V74.4344L349.5 74.8816L350.5 73.7639ZM345.701 65.6369C347.764 67.0318 349 69.3597 349 71.85H352C352 68.3636 350.27 65.1045 347.381 63.1517L345.701 65.6369ZM344.4 64.7575L345.701 65.6369L347.381 63.1517L346.081 62.2723L344.4 64.7575ZM341.6 64.7575C342.446 64.1856 343.554 64.1856 344.4 64.7575L346.081 62.2723C344.22 61.014 341.78 61.014 339.919 62.2723L341.6 64.7575ZM340.299 65.6369L341.6 64.7575L339.919 62.2723L338.619 63.1517L340.299 65.6369ZM337 71.85C337 69.3597 338.236 67.0318 340.299 65.6369L338.619 63.1517C335.731 65.1045 334 68.3636 334 71.85H337ZM337 73.7639V71.85H334V73.7639H337ZM336 76C336 75.5559 336.191 75.1584 336.5 74.8816L334.5 72.6462C333.581 73.468 333 74.6671 333 76H336ZM337.5 77.5C336.672 77.5 336 76.8284 336 76H333C333 78.4853 335.015 80.5 337.5 80.5V77.5ZM348.5 77.5H337.5V80.5H348.5V77.5ZM350 76C350 76.8284 349.328 77.5 348.5 77.5V80.5C350.985 80.5 353 78.4853 353 76H350ZM349.5 74.8816C349.809 75.1584 350 75.5559 350 76H353C353 74.6671 352.419 73.468 351.5 72.6462L349.5 74.8816ZM349 71.85V73.7639H352V71.85H349Z" fill="currentColor" />
      </g>
    </svg>
  );
}

/* ── Glass play glyph ─────────────────────────────────────────────── */

/**
 * The play triangle inside the frosted button: filled and stroked with a gradient that fades
 * toward the bottom, which is what gives it the lit-from-above look. Drawn in the 41px box
 * the design's circle occupies, with the design's slight rightward nudge for optical centring.
 */
export function GlassPlayGlyph({ size = 41, ...props }: IconProps) {
  const id = useSafeId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="245 201 41 41"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id={`${id}f`} gradientUnits="userSpaceOnUse" x1="267.235" y1="213.486" x2="267.077" y2="242.051">
          <stop stopColor="white" />
          <stop offset="1" stopColor="#D9D9D9" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1="267.235" y1="213.486" x2="267.077" y2="238.372">
          <stop stopColor="#D8D8D8" />
          <stop offset="1" stopColor="#848484" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M260.769 222.982V219.466C260.769 215.99 260.769 214.252 261.884 213.659C262.999 213.066 264.44 214.037 267.323 215.978L270.058 217.82C272.503 219.466 273.725 220.289 273.7 221.437C273.675 222.586 272.418 223.355 269.905 224.894L267.17 226.568C264.336 228.303 262.919 229.171 261.844 228.569C260.769 227.967 260.769 226.305 260.769 222.982Z"
        fill={`url(#${id}f)`}
        strokeWidth="1.57692"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={`url(#${id}s)`}
      />
    </svg>
  );
}
