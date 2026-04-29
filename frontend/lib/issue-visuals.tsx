import { ReactNode } from "react";

type VisualCue = {
  id: string;
  title: string;
  hint: string;
  art: ReactNode;
};

export type VisualGuide = {
  title: string;
  items: VisualCue[];
};

export type RepairFamilyShortcut = {
  id: string;
  label: string;
  query: string;
  hint: string;
  art: ReactNode;
};

const svgProps = {
  viewBox: "0 0 180 132",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true
} as const;

function ScreenCrackArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#CBD9FF" />
      <path d="M86 24L80 47L95 57L74 75L93 90L83 108" stroke="#EA4F62" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M80 47L67 57M95 57L108 47M74 75L62 85M93 90L109 102" stroke="#EA4F62" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function BlackDisplayArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#121B2F" />
      <circle cx="90" cy="66" r="8" fill="#5E7CFF" />
      <path d="M40 53C33 58 33 74 40 79M140 53C147 58 147 74 140 79" stroke="#5E7CFF" strokeWidth="4" strokeLinecap="round" />
      <path d="M31 46C20 57 20 75 31 86M149 46C160 57 160 75 149 86" stroke="#7ADBCF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function GhostTouchArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#F7E68B" />
      <path d="M58 45H122" stroke="#B78400" strokeWidth="6" />
      <path d="M58 66H122" stroke="#B78400" strokeWidth="6" opacity="0.6" />
      <circle cx="102" cy="86" r="13" fill="#ffffff" fillOpacity="0.75" />
      <path d="M93 90L101 66L107 79L115 74" stroke="#0F1D36" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlockedPortArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#EDF3FF" />
      <rect x="79" y="112" width="22" height="6" rx="3" fill="#F28C3E" />
      <circle cx="84" cy="114.5" r="2" fill="#7F4A0D" />
      <circle cx="90" cy="115.5" r="2" fill="#7F4A0D" />
      <circle cx="96" cy="114.5" r="2" fill="#7F4A0D" />
      <path d="M28 97H60" stroke="#5E7CFF" strokeWidth="8" strokeLinecap="round" />
      <rect x="20" y="91" width="12" height="12" rx="4" fill="#5E7CFF" />
    </svg>
  );
}

function DeadButtonArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#EEF4FF" />
      <rect x="124" y="50" width="8" height="24" rx="4" fill="#F28C3E" />
      <path d="M31 62H43M36 57V67M142 46L151 37M142 79L151 88" stroke="#EA4F62" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function RestartLoopArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#E8EEFF" />
      <path d="M90 40C104 40 115 51 115 65" stroke="#5E7CFF" strokeWidth="5" strokeLinecap="round" />
      <path d="M115 65L105 61M115 65L110 55" stroke="#5E7CFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M90 90C76 90 65 79 65 65" stroke="#14B8A6" strokeWidth="5" strokeLinecap="round" />
      <path d="M65 65L75 69M65 65L70 75" stroke="#14B8A6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SwollenBatteryArt() {
  return (
    <svg {...svgProps}>
      <rect x="50" y="16" width="76" height="102" rx="16" fill="#0F1D36" />
      <rect x="56" y="24" width="64" height="86" rx="11" fill="#EEF3FF" />
      <path d="M124 27C132 31 137 39 137 51V84C137 96 132 104 124 108" stroke="#F28C3E" strokeWidth="5" strokeLinecap="round" />
      <rect x="76" y="45" width="28" height="38" rx="10" fill="#F9D36B" />
      <path d="M90 40V32M110 47L117 40M70 47L63 40" stroke="#EA4F62" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function BatteryDrainArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#EEF4FF" />
      <rect x="71" y="46" width="38" height="22" rx="6" fill="#E9EEF8" stroke="#4C5C7D" strokeWidth="3" />
      <rect x="109" y="53" width="5" height="8" rx="2" fill="#4C5C7D" />
      <rect x="76" y="51" width="10" height="12" rx="3" fill="#EA4F62" />
      <path d="M94 78L82 95H93L86 109" stroke="#F28C3E" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FrozenScreenArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#EEF3FF" />
      <rect x="68" y="34" width="18" height="18" rx="5" fill="#9BB2FF" />
      <rect x="94" y="34" width="18" height="18" rx="5" fill="#D6E0FF" />
      <rect x="68" y="60" width="44" height="8" rx="4" fill="#9BB2FF" />
      <path d="M72 86H108" stroke="#EA4F62" strokeWidth="6" strokeLinecap="round" />
      <path d="M79 79L101 101" stroke="#EA4F62" strokeWidth="4" strokeLinecap="round" />
      <path d="M101 79L79 101" stroke="#EA4F62" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function SimNetworkArt() {
  return (
    <svg {...svgProps}>
      <rect x="44" y="22" width="34" height="50" rx="8" fill="#FFF3CB" stroke="#F2B12A" strokeWidth="4" />
      <path d="M44 36L61 22H78" stroke="#F2B12A" strokeWidth="4" />
      <rect x="92" y="22" width="48" height="84" rx="14" fill="#0F1D36" />
      <rect x="98" y="30" width="36" height="68" rx="10" fill="#EEF4FF" />
      <path d="M109 81V91M117 72V91M125 62V91" stroke="#5E7CFF" strokeWidth="6" strokeLinecap="round" />
      <path d="M102 48L131 77" stroke="#EA4F62" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function AudioArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#EEF4FF" />
      <circle cx="90" cy="98" r="8" fill="#5E7CFF" />
      <path d="M66 97H78M102 97H114" stroke="#14B8A6" strokeWidth="5" strokeLinecap="round" />
      <path d="M25 60C25 48 35 39 48 39C61 39 71 48 71 60V74C71 80 66 85 60 85H36C30 85 25 80 25 74V60Z" fill="#0F1D36" />
      <path d="M82 50C89 44 98 44 105 50M80 61C89 55 98 55 107 61" stroke="#EA4F62" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function LockFrpArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#EEF4FF" />
      <circle cx="75" cy="48" r="5" fill="#5E7CFF" />
      <circle cx="90" cy="62" r="5" fill="#5E7CFF" />
      <circle cx="105" cy="48" r="5" fill="#5E7CFF" />
      <path d="M75 48L90 62L105 48" stroke="#5E7CFF" strokeWidth="3" strokeLinecap="round" />
      <rect x="72" y="80" width="36" height="24" rx="6" fill="#F2B12A" />
      <path d="M81 80V73C81 68 85 64 90 64C95 64 99 68 99 73V80" stroke="#A66E00" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function WaterDamageArt() {
  return (
    <svg {...svgProps}>
      <rect x="52" y="10" width="76" height="112" rx="16" fill="#0F1D36" />
      <rect x="58" y="18" width="64" height="96" rx="11" fill="#D9F5FF" />
      <path d="M75 34C82 43 85 47 85 53C85 60 80 65 73 65C66 65 61 60 61 53C61 47 66 41 75 34Z" fill="#39A8E8" />
      <path d="M105 48C113 57 117 62 117 69C117 77 111 83 103 83C95 83 89 77 89 69C89 62 94 55 105 48Z" fill="#39A8E8" opacity="0.82" />
      <path d="M67 95H111" stroke="#EA4F62" strokeWidth="6" strokeLinecap="round" />
      <path d="M76 88L102 114" stroke="#EA4F62" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const art = {
  cracked: <ScreenCrackArt />,
  blackDisplay: <BlackDisplayArt />,
  ghostTouch: <GhostTouchArt />,
  blockedPort: <BlockedPortArt />,
  deadButton: <DeadButtonArt />,
  restartLoop: <RestartLoopArt />,
  swollenBattery: <SwollenBatteryArt />,
  batteryDrain: <BatteryDrainArt />,
  frozenScreen: <FrozenScreenArt />,
  simNetwork: <SimNetworkArt />,
  audio: <AudioArt />,
  lockFrp: <LockFrpArt />,
  waterDamage: <WaterDamageArt />
} as const;

const guideMap: Array<{ match: RegExp; guide: VisualGuide }> = [
  {
    match: /screen|display|vision|crack|yellow|lines|touch/i,
    guide: {
      title: "Look for visible display damage",
      items: [
        { id: "cracked", title: "Cracked glass", hint: "Spider lines, impact marks, or dark ink patches.", art: art.cracked },
        { id: "black-display", title: "Black but alive", hint: "The phone rings or vibrates but the picture stays dark.", art: art.blackDisplay },
        { id: "ghost-touch", title: "Ghost touch or tint", hint: "False taps, yellow cast, blur, or half-screen picture.", art: art.ghostTouch }
      ]
    }
  },
  {
    match: /charg|port|cable|moisture/i,
    guide: {
      title: "Check the charging path first",
      items: [
        { id: "port", title: "Blocked port", hint: "Lint, dirt, bent contact, or cable not sitting flush.", art: art.blockedPort },
        { id: "dead-button", title: "Cable angle issue", hint: "Charging starts only when the cable is pressed or tilted.", art: art.deadButton },
        { id: "battery-drain", title: "Weak charge", hint: "Battery still drops or barely climbs while plugged in.", art: art.batteryDrain }
      ]
    }
  },
  {
    match: /power|vibrat|dead|boot|logo|coming on|turning on/i,
    guide: {
      title: "Separate no-power from display-only faults",
      items: [
        { id: "black-display", title: "Vibration with dark screen", hint: "That often points to display, not full no-power.", art: art.blackDisplay },
        { id: "dead-button-power", title: "Dead side key", hint: "Power key feels stuck, flat, or unresponsive.", art: art.deadButton },
        { id: "restart-loop", title: "Logo loop", hint: "Stuck at logo or restarting before full startup.", art: art.restartLoop }
      ]
    }
  },
  {
    match: /overheat|swollen|battery lifting|hot|heat/i,
    guide: {
      title: "Treat heat and battery swelling as priority risk",
      items: [
        { id: "swollen", title: "Lifted back cover", hint: "Back panel separating, warped, or pushing out.", art: art.swollenBattery },
        { id: "battery-drain-heat", title: "Fast drain with heat", hint: "Battery drops quickly and the phone stays hot.", art: art.batteryDrain },
        { id: "water-heat", title: "Burnt smell or warping", hint: "Heat plus smell or swelling means do not continue normal charging.", art: art.waterDamage }
      ]
    }
  },
  {
    match: /freez|hang|app|slow|restart|safe mode/i,
    guide: {
      title: "Check whether the issue is software behaviour",
      items: [
        { id: "frozen", title: "Frozen screen", hint: "Touch stops, apps hang, or the screen stops updating.", art: art.frozenScreen },
        { id: "restart", title: "Restart loop", hint: "Random reboots or safe mode returning after startup.", art: art.restartLoop },
        { id: "battery-drain-soft", title: "Drain with background load", hint: "Heat or fast drain while apps keep crashing or hanging.", art: art.batteryDrain }
      ]
    }
  },
  {
    match: /sim|network|wifi|data|mouthpiece|speaker|audio|microphone|caller/i,
    guide: {
      title: "Check ports, network, and audio signs",
      items: [
        { id: "sim", title: "SIM or network failure", hint: "No bars, no SIM, or still no service with another known-good SIM.", art: art.simNetwork },
        { id: "audio", title: "Mouthpiece or speaker issue", hint: "Low call audio, blocked grille, or one-way call hearing.", art: art.audio },
        { id: "port-dust", title: "Dust or tray damage", hint: "Blocked openings, snapped tray, or contact damage around the side.", art: art.blockedPort }
      ]
    }
  },
  {
    match: /pattern|password|frp|google lock|locked|shell managed/i,
    guide: {
      title: "Check the exact lock state",
      items: [
        { id: "lock", title: "Pattern or PIN lock", hint: "Customer knows the device but forgot the unlock path.", art: art.lockFrp },
        { id: "frp", title: "Google account after reset", hint: "Setup asks for the previous Google account after reset.", art: art.lockFrp },
        { id: "managed", title: "Managed or shell lock", hint: "Device shows restricted access or management control message.", art: art.blackDisplay }
      ]
    }
  },
  {
    match: /water|liquid|bent|burnt|broken|physical|frame|tray/i,
    guide: {
      title: "Check for obvious external damage",
      items: [
        { id: "liquid", title: "Liquid entry", hint: "Moisture, corrosion, droplets, or smell after water exposure.", art: art.waterDamage },
        { id: "crack-frame", title: "Broken body or glass", hint: "Bent frame, broken cover, snapped tray, or shattered outer parts.", art: art.cracked },
        { id: "swollen-risk", title: "Deformity or bulge", hint: "Warping, lifted panel, or pressure from inside the phone.", art: art.swollenBattery }
      ]
    }
  }
];

const fallbackGuide: VisualGuide = {
  title: "Use the clearest visible sign first",
  items: [
    { id: "screen", title: "Visible screen fault", hint: "Cracks, black display, lines, or ghost touch.", art: art.cracked },
    { id: "port", title: "Port or connector issue", hint: "Blocked charging port, snapped tray, or poor cable fit.", art: art.blockedPort },
    { id: "body", title: "Body or liquid damage", hint: "Water, bent frame, burnt smell, or lifted back cover.", art: art.waterDamage }
  ]
};

export const repairFamilyShortcuts: RepairFamilyShortcut[] = [
  {
    id: "display",
    label: "Display & vision",
    query: "screen cracked lines in display",
    hint: "Cracks, black picture, lines, blur, yellow tint.",
    art: art.cracked
  },
  {
    id: "power",
    label: "Power & thermal",
    query: "phone not powering on or not charging",
    hint: "No power, no charge, overheating, fast battery drain.",
    art: art.blockedPort
  },
  {
    id: "logic",
    label: "Logic & software",
    query: "phone freezing hanging restarting itself",
    hint: "Freezing, slow apps, restart loops, safe mode.",
    art: art.frozenScreen
  },
  {
    id: "security",
    label: "Security & access",
    query: "forgot pattern google lock shell managed",
    hint: "FRP, forgotten password, account lock, managed device.",
    art: art.lockFrp
  },
  {
    id: "connectivity",
    label: "Connectivity & I/O",
    query: "not reading sim no network mouthpiece not working",
    hint: "SIM, network, mouthpiece, speaker, audio path.",
    art: art.simNetwork
  },
  {
    id: "physical",
    label: "Physical & liquid",
    query: "fell in water bent phone broken frame",
    hint: "Liquid entry, bent body, broken tray, external damage.",
    art: art.waterDamage
  }
];

export function getRepairFamilyShortcut(familyId: string): RepairFamilyShortcut | undefined {
  return repairFamilyShortcuts.find((item) => item.id === familyId);
}

export function getIssueVisualGuide(
  procedureTitle: string,
  procedureCategory: string,
  question?: string | null
): VisualGuide {
  const combined = `${procedureTitle} ${procedureCategory} ${question || ""}`;
  return guideMap.find((entry) => entry.match.test(combined))?.guide || fallbackGuide;
}
