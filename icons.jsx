// Inline SVG icons — all stroke-based, currentColor
const Icon = ({ name, size = 16, ...rest }) => {
  const s = size;
  const common = {
    width: s, height: s, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor",
    strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
    ...rest,
  };
  switch (name) {
    case "car": return (<svg {...common}><path d="M5 14l1.5-4.5A2 2 0 0 1 8.4 8h7.2a2 2 0 0 1 1.9 1.5L19 14"/><path d="M5 14h14v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><circle cx="8" cy="16.5" r=".7" fill="currentColor"/><circle cx="16" cy="16.5" r=".7" fill="currentColor"/></svg>);
    case "lock": return (<svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>);
    case "unlock": return (<svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>);
    case "battery": return (<svg {...common}><rect x="3" y="8" width="16" height="8" rx="1.5"/><path d="M21 11v2"/><rect x="5" y="10" width="9" height="4" fill="currentColor" stroke="none"/></svg>);
    case "fuel": return (<svg {...common}><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h14"/><path d="M15 9h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2-2"/></svg>);
    case "thermo": return (<svg {...common}><path d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z"/></svg>);
    case "snow": return (<svg {...common}><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>);
    case "play": return (<svg {...common}><polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/></svg>);
    case "stop": return (<svg {...common}><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/></svg>);
    case "map-pin": return (<svg {...common}><path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>);
    case "bell": return (<svg {...common}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>);
    case "alert": return (<svg {...common}><path d="M12 3 2 20h20z"/><path d="M12 10v5"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/></svg>);
    case "check": return (<svg {...common}><path d="m4 12 5 5 11-12"/></svg>);
    case "x": return (<svg {...common}><path d="M5 5l14 14M19 5 5 19"/></svg>);
    case "chevron-right": return (<svg {...common}><path d="m9 6 6 6-6 6"/></svg>);
    case "chevron-left": return (<svg {...common}><path d="m15 6-6 6 6 6"/></svg>);
    case "chevron-down": return (<svg {...common}><path d="m6 9 6 6 6-6"/></svg>);
    case "search": return (<svg {...common}><circle cx="11" cy="11" r="6"/><path d="m20 20-4.3-4.3"/></svg>);
    case "filter": return (<svg {...common}><path d="M3 5h18M6 12h12M10 19h4"/></svg>);
    case "trending": return (<svg {...common}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>);
    case "trending-down": return (<svg {...common}><path d="m3 7 6 6 4-4 8 8"/><path d="M14 17h7v-7"/></svg>);
    case "gauge": return (<svg {...common}><path d="M5 18a8 8 0 1 1 14 0"/><path d="M12 14l4-4"/><circle cx="12" cy="14" r=".8" fill="currentColor"/></svg>);
    case "wrench": return (<svg {...common}><path d="M14.7 6.3a4 4 0 0 1 5 5L17 14l3 3-3 3-3-3-2.7 2.7a4 4 0 0 1-5-5L9 12 6 9 9 6l3 3 2.7-2.7z"/></svg>);
    case "list": return (<svg {...common}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>);
    case "grid": return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>);
    case "fleet": return (<svg {...common}><rect x="3" y="6" width="8" height="6" rx="1"/><rect x="13" y="10" width="8" height="6" rx="1"/><rect x="3" y="14" width="8" height="6" rx="1"/></svg>);
    case "user": return (<svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>);
    case "route": return (<svg {...common}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6h7a4 4 0 0 1 0 8h-7a4 4 0 0 0 0 8h2"/></svg>);
    case "shield": return (<svg {...common}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>);
    case "clock": return (<svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>);
    case "tire": return (<svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>);
    case "oil": return (<svg {...common}><path d="M12 3 6 12a6 6 0 1 0 12 0z"/></svg>);
    case "settings": return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
    case "wifi-off": return (<svg {...common}><path d="M2 8a16 16 0 0 1 5-3.4M22 8a16 16 0 0 0-7-3.7"/><path d="M5 12a10 10 0 0 1 4-2.4M19 12a10 10 0 0 0-3-2"/><path d="M8.5 15.5a5 5 0 0 1 4-1"/><circle cx="12" cy="19" r=".7" fill="currentColor"/><path d="M2 2l20 20"/></svg>);
    case "broadcast": return (<svg {...common}><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4"/><path d="M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5"/></svg>);
    case "speed": return (<svg {...common}><path d="M5 19a9 9 0 1 1 14 0"/><path d="M12 13l3.5-5"/></svg>);
    case "more": return (<svg {...common}><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>);
    case "plus": return (<svg {...common}><path d="M12 5v14M5 12h14"/></svg>);
    case "minus": return (<svg {...common}><path d="M5 12h14"/></svg>);
    case "download": return (<svg {...common}><path d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14"/></svg>);
    default: return null;
  }
};

window.Icon = Icon;
