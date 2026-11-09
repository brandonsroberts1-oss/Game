import {
  Axe,
  Backpack,
  Fish,
  Footprints,
  Hammer,
  House,
  Network,
  ShipWheel,
  Snowflake,
  Store,
  Users,
} from "lucide-react";
import type { Resource, UpgradeId } from "./game/model";

export function CashArt({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 52" aria-hidden="true">
      <path
        d="m3 16 39-7 19 7-39 8Z"
        fill="#bcf364"
        stroke="#28512c"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M3 16v23l19 9V24Z"
        fill="#5bac39"
        stroke="#28512c"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="m22 24 39-8v23l-39 9Z"
        fill="#87d84b"
        stroke="#28512c"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="m17 13 13-2 16 8v23l-13 3V21Z"
        fill="#fff5be"
        stroke="#658843"
        strokeWidth="1.4"
      />
      <path
        d="m10 20 6 3m-6 4 6 3m-6 4 6 3m25-11 12-3m-12 9 12-3m-12 9 12-3"
        stroke="#dbf295"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ResourceArt({
  type,
  size = 38,
}: {
  type: Resource | "coin" | "gem";
  size?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    "aria-hidden": true as const,
  };
  if (type === "wood" || type === "plank")
    return (
      <svg {...props}>
        {type === "plank" ? (
          <>
            <path
              d="m5 22 37-12 17 7-37 13Z"
              fill="#e8b77b"
              stroke="#6d442b"
              strokeWidth="2"
            />
            <path
              d="M5 22v10l17 8V30l37-13v10L22 40 5 32"
              fill="#a87243"
              stroke="#6d442b"
              strokeWidth="2"
            />
            <path
              d="m7 37 37-12 15 8-37 13Z"
              fill="#f2c997"
              stroke="#6d442b"
              strokeWidth="2"
            />
            <path
              d="M7 37v9l15 8V46l37-13v9L22 54 7 46"
              fill="#be8b56"
              stroke="#6d442b"
              strokeWidth="2"
            />
            <path
              d="m27 24 23-8m-23 25 22-7"
              stroke="#b37a46"
              strokeWidth="2"
            />
          </>
        ) : (
          <>
            <path
              d="m12 21 29-10 16 10v24L28 56 11 46Z"
              fill="#aa6c35"
              stroke="#68452d"
              strokeWidth="2.5"
            />
            <path
              d="m12 21 16 11 29-11-16-10Z"
              fill="#d69650"
              stroke="#68452d"
              strokeWidth="2"
            />
            <path
              d="M28 32v24l29-11V21Z"
              fill="#a86d35"
              stroke="#68452d"
              strokeWidth="2"
            />
            <ellipse
              cx="19"
              cy="38"
              rx="12"
              ry="16"
              fill="#f4cb8b"
              stroke="#865732"
              strokeWidth="2.5"
              transform="rotate(-19 19 38)"
            />
            <ellipse
              cx="19"
              cy="38"
              rx="6.5"
              ry="10"
              fill="none"
              stroke="#bd894a"
              strokeWidth="2"
              transform="rotate(-19 19 38)"
            />
            <path
              d="m36 32 15-6m-15 14 15-6m-15 14 15-6"
              stroke="#794923"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    );
  if (type === "steak" || type === "smoked")
    return (
      <svg {...props}>
        <defs>
          <linearGradient id={`steak-${type}`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={type === "steak" ? "#ff8c83" : "#efbb6d"} />
            <stop
              offset="1"
              stopColor={type === "steak" ? "#d63e52" : "#a75532"}
            />
          </linearGradient>
        </defs>
        <path
          d="M10 28v13c0 14 43 16 45 0V28Z"
          fill={type === "steak" ? "#b9364d" : "#8a492d"}
          stroke="#75442f"
          strokeWidth="2"
        />
        <ellipse
          cx="32"
          cy="29"
          rx="23"
          ry="19"
          fill="#f7e5b9"
          stroke="#714c32"
          strokeWidth="2.5"
        />
        <ellipse cx="32" cy="29" rx="18" ry="14" fill={`url(#steak-${type})`} />
        <path
          d="M32 16v27m-16-17 29 9m-26 4 25-20"
          stroke={type === "steak" ? "#ffb8a0" : "#e9b37a"}
          strokeWidth="1.5"
        />
        <ellipse cx="32" cy="29" rx="6.5" ry="5" fill="#fff5dc" />
        <ellipse cx="32" cy="29" rx="2.8" ry="2" fill="#e5c7ac" />
        {type === "smoked" && (
          <path
            d="M21 12c-6-6 4-7 0-12m11 10c-5-5 4-7 1-11m11 13c-5-5 4-6 1-10"
            stroke="#b5c6c5"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  if (type === "fish" || type === "salmon")
    return (
      <svg {...props}>
        <g transform="rotate(-24 32 32)">
          <path
            d="m15 32-12-12v25Z"
            fill={type === "fish" ? "#3773a3" : "#c76a59"}
            stroke="#28445b"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M12 32C23 8 47 9 61 32 46 55 23 56 12 32Z"
            fill={type === "fish" ? "#85bfe1" : "#e9a18d"}
            stroke="#28445b"
            strokeWidth="2.3"
          />
          <path
            d="M13 32C26 11 47 13 60 32Z"
            fill={type === "fish" ? "#2d65a4" : "#ba6f77"}
          />
          <path d="M19 36c14 11 28 7 36-1-14 6-24 7-36 1Z" fill="#edf2dd" />
          <path
            d="m31 16 8-12 8 15m-20 25 10 13 8-12"
            fill={type === "fish" ? "#386c9a" : "#b46a6b"}
            stroke="#28445b"
            strokeWidth="1.5"
          />
          <path
            d="M47 23c-5 5-5 13 0 18"
            stroke="#407f9f"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="52" cy="29" r="4.3" fill="#fff9e7" />
          <circle cx="53" cy="29" r="2.2" fill="#1d304a" />
          <circle cx="53.5" cy="28" r=".8" fill="white" />
        </g>
      </svg>
    );
  if (type === "gem")
    return (
      <svg {...props}>
        <path
          d="m16 13 30 2 13 19-27 26L4 33Z"
          fill="#77c9dc"
          stroke="#305d84"
          strokeWidth="3"
        />
        <path d="m16 13 12 20 18-18-14 45-4-27L4 33" fill="#c1f0ef" />
      </svg>
    );
  return (
    <svg {...props}>
      <ellipse
        cx="35"
        cy="34"
        rx="25"
        ry="28"
        fill="#b17c1f"
        stroke="#77521f"
        strokeWidth="2"
      />
      <ellipse
        cx="30"
        cy="30"
        rx="25"
        ry="28"
        fill="#f3c74d"
        stroke="#77521f"
        strokeWidth="2.5"
      />
      <ellipse
        cx="30"
        cy="30"
        rx="18"
        ry="21"
        fill="none"
        stroke="#ffe99b"
        strokeWidth="3"
      />
      <path d="m30 14 4 10 10 4-10 5-4 13-3-13-10-5 10-4Z" fill="#fff0a9" />
    </svg>
  );
}

export function UpgradeArt({
  type,
  level = 0,
}: {
  type: UpgradeId;
  level?: number;
}) {
  if (type === "cutter")
    return (
      <svg width="70" height="70" viewBox="0 0 80 80" aria-hidden="true">
        <path
          d="m7 53 34-11 32 9-35 14Z"
          fill="#79a0a4"
          stroke="#3b4c58"
          strokeWidth="2.5"
        />
        <path
          d="M8 53v12l30 10V65l35-14v12L38 75"
          fill="#476e7a"
          stroke="#3b4c58"
          strokeWidth="2.5"
        />
        <path
          d="M17 51V21h43v29"
          stroke="#6f5727"
          strokeWidth="11"
          fill="none"
        />
        <path
          d="M17 51V21h43v29"
          stroke="#efc75a"
          strokeWidth="7"
          fill="none"
        />
        <circle
          cx="40"
          cy="38"
          r="14"
          fill="#dbe6e4"
          stroke="#5f7484"
          strokeWidth="3"
          strokeDasharray="5 2"
        />
        <circle cx="40" cy="38" r="4" fill="#6b8c9b" />
        <path
          d="m31 57 8-3 9 3-9 4Z"
          fill="#e88b86"
          stroke="#fbe0b3"
          strokeWidth="3"
        />
        <rect
          x="54"
          y="44"
          width="13"
          height="14"
          rx="3"
          fill="#d58136"
          stroke="#6f5727"
          strokeWidth="2"
        />
      </svg>
    );
  if (type === "sawmill")
    return (
      <svg width="70" height="70" viewBox="0 0 80 80" aria-hidden="true">
        <path d="M12 53v18m51-19v17" stroke="#72502f" strokeWidth="8" />
        <path
          d="m7 48 33-9 33 11-33 12Z"
          fill="#ddb072"
          stroke="#714b2a"
          strokeWidth="3"
        />
        <circle
          cx="45"
          cy="36"
          r="22"
          fill="#d2dfe5"
          stroke="#536778"
          strokeWidth="3"
          strokeDasharray="5 3"
        />
        <circle cx="45" cy="36" r="5" fill="#637b89" />
        <path
          d="m9 43 26-7 10 9-27 7Z"
          fill="#ac733c"
          stroke="#704a2b"
          strokeWidth="2"
        />
        <ellipse
          cx="14"
          cy="47"
          rx="7"
          ry="10"
          fill="#f1ca8b"
          stroke="#815931"
          strokeWidth="2"
          transform="rotate(-21 14 47)"
        />
      </svg>
    );
  const Icon =
    (
      {
        axe: Axe,
        rod: Fish,
        backpack: Backpack,
        market: Store,
        dock: ShipWheel,
        crew: Users,
        smokehouse: House,
        freezer: Snowflake,
        boots: Footprints,
        nets: Network,
      } as const
    )[type as Exclude<UpgradeId, "cutter" | "sawmill">] || Hammer;
  return (
    <span className={`illustrated-upgrade icon-${type} tier-${level}`}>
      <Icon size={43} strokeWidth={2.6} />
      {level > 0 && <i>★</i>}
    </span>
  );
}
