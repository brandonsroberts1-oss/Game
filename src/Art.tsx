import type { CSSProperties } from "react";

export function ResourceArt({
  type,
  size = 32,
}: {
  type: "wood" | "fish" | "salmon" | "coin" | "gem";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    "aria-hidden": true as const,
  };
  if (type === "wood")
    return (
      <svg {...common}>
        <path d="m8 18 21-9 12 7v18l-23 8L7 34Z" fill="#9b633b" />
        <path d="m8 18 11 7 22-9-12-7Z" fill="#c38a4d" />
        <path d="M19 25v17l22-8V16Z" fill="#a77342" />
        <ellipse
          cx="13"
          cy="29"
          rx="8"
          ry="11"
          fill="#e5b77a"
          transform="rotate(-18 13 29)"
        />
        <ellipse
          cx="13"
          cy="29"
          rx="4.5"
          ry="7"
          fill="none"
          stroke="#ba8a53"
          strokeWidth="1.7"
        />
        <path
          d="m25 24 11-5m-12 12 13-6m-12 10 11-4"
          stroke="#865531"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  if (type === "fish" || type === "salmon")
    return (
      <svg {...common}>
        <g transform="rotate(-22 24 24)">
          <path
            d="m10 24-9-9v18Z"
            fill={type === "fish" ? "#648d9e" : "#be8979"}
          />
          <path
            d="M9 24C17 7 35 7 46 24 35 41 17 41 9 24Z"
            fill={type === "fish" ? "#8eb7c7" : "#e5aa93"}
          />
          <path
            d="M10 24C20 10 36 10 46 24Z"
            fill={type === "fish" ? "#4e7b91" : "#bf877d"}
          />
          <path
            d="M14 27c10 9 22 7 28-1-13 5-19 5-28 1Z"
            fill={type === "fish" ? "#cfe2de" : "#f5d6b7"}
          />
          <path
            d="m23 12 5-7 5 9m-13 19 7 7 3-6"
            fill={type === "fish" ? "#5d8e9e" : "#bd8578"}
          />
          <path
            d="M35 18c-3 4-3 8 0 12"
            fill="none"
            stroke={type === "fish" ? "#5d8a99" : "#ca9885"}
            strokeWidth="1.5"
          />
          <circle cx="39" cy="22" r="2.3" fill="#fffdf3" />
          <circle cx="39.6" cy="22" r="1.2" fill="#294654" />
          <path
            d="m17 20 3-2m3 4 3-2m-6 6 3-2"
            stroke={type === "fish" ? "#aacbd0" : "#f0c3ab"}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  if (type === "gem")
    return (
      <svg {...common}>
        <path d="m13 9 23 2 9 14-21 20L3 24Z" fill="#7badb3" />
        <path d="M13 9 3 24l18-2Z" fill="#a2d0cc" />
        <path d="m13 9 8 13 15-11Z" fill="#ddf0df" />
        <path d="m21 22 3 23 21-20Z" fill="#6c99a0" />
        <path d="m21 22 15-11 9 14Z" fill="#b7d9d0" />
      </svg>
    );
  return (
    <svg {...common}>
      <ellipse cx="25" cy="25" rx="18" ry="20" fill="#bc842d" />
      <ellipse cx="22" cy="23" rx="18" ry="20" fill="#e8b948" />
      <ellipse
        cx="22"
        cy="23"
        rx="13"
        ry="15"
        fill="none"
        stroke="#fbe198"
        strokeWidth="2"
      />
      <path d="m23 12 1 8 7 3-7 3-2 8-2-8-6-3 7-3Z" fill="#fff0bc" />
    </svg>
  );
}

export function BackpackArt({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 160"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="112" cy="137" rx="64" ry="10" fill="#bed1ad" opacity=".36" />
      <path d="M169 131c-9-19-8-39 4-48 10 19 6 35-4 48Z" fill="#9cb783" />
      <path d="M173 113c9-16 21-18 27-13-1 13-13 17-27 13Z" fill="#bed0a1" />
      <path d="M48 136c2-20-6-28-18-27 1 13 7 24 18 27Z" fill="#9db681" />
      <path
        d="M83 55V38c0-18 43-18 43 0v17"
        stroke="#b48349"
        strokeWidth="10"
      />
      <path
        d="M68 64c0-14 11-24 25-24h35c16 0 28 12 28 29v58c0 10-8 17-18 17H83c-10 0-17-7-17-17Z"
        fill="#3d6c53"
      />
      <path d="M70 59c-11 1-17 17-17 35v31c0 7 5 10 11 10h8Z" fill="#628466" />
      <path d="M147 69c15 2 18 16 18 29v25c0 9-5 13-12 13h-9Z" fill="#294e3d" />
      <path
        d="M67 68c0-16 12-26 27-26h31c17 0 30 11 30 26v8c0 15-12 23-44 23-31 0-44-9-44-23Z"
        fill="#789667"
      />
      <path d="M75 67c16-6 48-6 69 0" stroke="#96ae80" strokeWidth="2" />
      <path d="M88 89v24m45-24v24" stroke="#cdab70" strokeWidth="8" />
      <rect x="80" y="108" width="64" height="29" rx="8" fill="#54774f" />
      <rect x="100" y="89" width="24" height="19" rx="4" fill="#d6ae63" />
      <rect x="106" y="94" width="12" height="9" rx="2" fill="#709063" />
      <path d="m71 47 4-13-7-8-12 3-1 12Z" fill="#b9cfa1" />
      <path d="m60 37 9 7" stroke="#7a9b69" strokeWidth="2" />
      <path
        d="m158 47 5-8m6 17 8-1m-18-17-2-5"
        stroke="#d6bd73"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IslandArt({
  color = "#8fae76",
  style,
}: {
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 240 140" style={style} aria-hidden="true">
      <ellipse cx="120" cy="108" rx="102" ry="20" fill="#d2e5df" />
      <path
        d="M30 85c-5-21 21-38 57-44 30-28 95-11 112 13 34 18 14 48-28 54-45 18-131 1-141-23Z"
        fill="#c7b78a"
      />
      <path
        d="M31 77c-5-21 21-38 57-44 30-28 95-11 112 13 34 18 14 48-28 54-45 18-131 1-141-23Z"
        fill="#e9d6a7"
      />
      <path
        d="M40 68c1-18 33-27 50-28 34-29 89-4 100 10 38 24-8 43-40 44-51 4-104-6-110-26Z"
        fill="#e9f1f2"
      />
      <path
        d="m68 64 68-16 35 27"
        stroke="#82b7c8"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M63 69V38m0 18L47 58l16-31 16 31Z"
        fill="#b8cfd8"
        stroke="#698e9b"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M166 61V28m0 19-16 2 16-32 16 32Z"
        fill="#dcebf0"
        stroke="#769baa"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M99 66V48l23-10 20 11v20Z" fill={color} />
      <path d="m94 50 26-20 27 20Z" fill="#f5f6ef" />
      <path d="M116 69V54h10v15" fill="#4e7b8d" />
      <ellipse cx="81" cy="79" rx="8" ry="5" fill="#8ea8b1" />
      <ellipse cx="173" cy="79" rx="11" ry="7" fill="#ccdce1" />
    </svg>
  );
}
