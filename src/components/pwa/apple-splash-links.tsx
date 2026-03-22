// Server Component — pas de "use client"
// Injecte les balises <link rel="apple-touch-startup-image"> pour iOS PWA splash screens.
// Chaque entrée correspond exactement aux dimensions logiques + DPR d'un appareil Apple.

const SPLASH_SCREENS = [
  { width: 375, height: 667, dpr: 2, file: "apple-splash-750-1334.png" },
  { width: 375, height: 812, dpr: 3, file: "apple-splash-1125-2436.png" },
  { width: 390, height: 844, dpr: 3, file: "apple-splash-1170-2532.png" },
  { width: 393, height: 852, dpr: 3, file: "apple-splash-1179-2556.png" },
  { width: 428, height: 926, dpr: 3, file: "apple-splash-1284-2778.png" },
  { width: 430, height: 932, dpr: 3, file: "apple-splash-1290-2796.png" },
  { width: 744, height: 1133, dpr: 2, file: "apple-splash-1488-2266.png" },
  { width: 820, height: 1180, dpr: 2, file: "apple-splash-1640-2360.png" },
  { width: 834, height: 1194, dpr: 2, file: "apple-splash-1668-2388.png" },
  { width: 1024, height: 1366, dpr: 2, file: "apple-splash-2048-2732.png" },
] as const;

export function AppleSplashLinks() {
  return (
    <>
      {SPLASH_SCREENS.map((screen) => (
        <link
          key={screen.file}
          rel="apple-touch-startup-image"
          media={`screen and (device-width: ${screen.width}px) and (device-height: ${screen.height}px) and (-webkit-device-pixel-ratio: ${screen.dpr}) and (orientation: portrait)`}
          href={`/splash/${screen.file}`}
        />
      ))}
    </>
  );
}
