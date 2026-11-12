// Original chubby mascots for the Dinosaur, Queen Bee, Wildlife and Space themes, drawn as small SVGs.
export type MascotKind = 'dino' | 'bee' | 'fox' | 'astronaut';
export type Pose = 'happy' | 'love' | 'coin' | 'sleep' | 'wow';

const INK = '#2f3a33';

function Face({ pose, eyeY, cx = 32, gap = 9 }: { pose: Pose; eyeY: number; cx?: number; gap?: number }) {
  const l = cx - gap;
  const r = cx + gap;
  return (
    <g>
      {pose === 'sleep' ? (
        <>
          <path d={`M${l - 3} ${eyeY} q3 2.5 6 0`} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d={`M${r - 3} ${eyeY} q3 2.5 6 0`} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      ) : pose === 'wow' ? (
        <>
          <path d={`M${l} ${eyeY - 3.5} l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1z`} fill="#f6c343" />
          <path d={`M${r} ${eyeY - 3.5} l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1z`} fill="#f6c343" />
        </>
      ) : (
        <>
          <circle cx={l} cy={eyeY} r="2.3" fill={INK} />
          <circle cx={r} cy={eyeY} r="2.3" fill={INK} />
          <circle cx={l + 0.8} cy={eyeY - 0.8} r="0.7" fill="#fff" />
          <circle cx={r + 0.8} cy={eyeY - 0.8} r="0.7" fill="#fff" />
        </>
      )}
      <ellipse cx={l - 3.5} cy={eyeY + 4.5} rx="3" ry="1.8" fill="#ff9fb3" opacity="0.75" />
      <ellipse cx={r + 3.5} cy={eyeY + 4.5} rx="3" ry="1.8" fill="#ff9fb3" opacity="0.75" />
      {pose === 'sleep' ? (
        <path d={`M${cx - 2} ${eyeY + 6} q2 1.5 4 0`} stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d={`M${cx - 4} ${eyeY + 4.5} q4 5.5 8 0z`} fill="#e85d75" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      )}
    </g>
  );
}

function Prop({ pose, x, y }: { pose: Pose; x: number; y: number }) {
  if (pose === 'love')
    return (
      <path
        d={`M${x} ${y + 4} c-5 -3.5 -6 -8 -3 -9.5 c1.6 -0.8 3 0.2 3 1.6 c0 -1.4 1.4 -2.4 3 -1.6 c3 1.5 2 6 -3 9.5z`}
        fill="#ff5c7a"
        stroke={INK}
        strokeWidth="1"
      />
    );
  if (pose === 'coin')
    return (
      <g>
        <circle cx={x} cy={y} r="5.2" fill="#f6c343" stroke="#c9961a" strokeWidth="1.3" />
        <text x={x} y={y + 2.6} fontSize="7" fontWeight="800" textAnchor="middle" fill="#9a6f00">
          ฿
        </text>
      </g>
    );
  if (pose === 'sleep')
    return (
      <text x={x} y={y} fontSize="8" fontWeight="800" fill="#7aa0c8">
        z
      </text>
    );
  if (pose === 'happy')
    return <path d={`M${x} ${y - 3} l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2z`} fill="#f6c343" />;
  return null;
}

function Dino({ pose }: { pose: Pose }) {
  const body = '#5fbf93';
  const dark = '#3f9a70';
  const spike = '#9fe0bf';
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      {/* tail */}
      <path d="M48 46 q12 2 12 -8 q-4 6 -12 2z" fill={body} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />
      {/* one spike on top of the head */}
      <path d="M27.5 12.5 q4.5 -12 9 0z" fill={spike} stroke={dark} strokeWidth="1.3" strokeLinejoin="round" />
      {/* body */}
      <path d="M12 40 q-2 -28 20 -29 q22 1 20 29 q1 16 -20 16 q-21 0 -20 -16z" fill={body} stroke={dark} strokeWidth="1.8" />
      {/* tummy */}
      <ellipse cx="32" cy="44" rx="12" ry="9.5" fill="#fff1c4" />
      {/* arms */}
      {pose === 'happy' || pose === 'wow' ? (
        <>
          <path d="M13 34 q-6 -5 -4 -10" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M51 34 q6 -5 4 -10" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M16 38 q6 3 9 0" stroke={dark} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M48 38 q-6 3 -9 0" stroke={dark} strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      )}
      {/* feet */}
      <ellipse cx="23" cy="56" rx="5" ry="2.6" fill={dark} />
      <ellipse cx="41" cy="56" rx="5" ry="2.6" fill={dark} />
      <Face pose={pose} eyeY={25} />
      <Prop pose={pose} x={pose === 'coin' ? 32 : 54} y={pose === 'coin' ? 39 : 12} />
    </svg>
  );
}

function Arms({ pose, dark, y = 38 }: { pose: Pose; dark: string; y?: number }) {
  return pose === 'happy' || pose === 'wow' ? (
    <>
      <path d={`M13 ${y} q-6 -5 -4 -10`} stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d={`M51 ${y} q6 -5 4 -10`} stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </>
  ) : (
    <>
      <path d={`M16 ${y + 2} q6 3 9 0`} stroke={dark} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d={`M48 ${y + 2} q-6 3 -9 0`} stroke={dark} strokeWidth="4" strokeLinecap="round" fill="none" />
    </>
  );
}

/** Queen Bee: a round bee with a little gold crown. */
function Bee({ pose }: { pose: Pose }) {
  const body = '#ffd25e';
  const dark = '#4a1838';
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      {/* wings */}
      <ellipse
        cx="16"
        cy="20"
        rx="10"
        ry="7"
        fill="#ffffff"
        stroke={dark}
        strokeWidth="1.5"
        opacity="0.92"
        transform="rotate(-25 16 20)"
      />
      <ellipse
        cx="48"
        cy="20"
        rx="10"
        ry="7"
        fill="#ffffff"
        stroke={dark}
        strokeWidth="1.5"
        opacity="0.92"
        transform="rotate(25 48 20)"
      />
      {/* body with stripes */}
      <path d="M12 40 q-2 -26 20 -27 q22 1 20 27 q1 16 -20 16 q-21 0 -20 -16z" fill={body} stroke={dark} strokeWidth="1.8" />
      <path d="M13 44 q19 6 38 0 M16 51 q16 5 32 0" stroke={dark} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {/* crown */}
      <path d="M23 13 l-1 -9 5 4 5 -6 5 6 5 -4 -1 9z" fill="#ffd25e" stroke="#9a6a00" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="32" cy="9" r="1.6" fill="#e3368a" />
      <Arms pose={pose} dark={dark} y={34} />
      <Face pose={pose} eyeY={27} />
      <Prop pose={pose} x={pose === 'coin' ? 32 : 56} y={pose === 'coin' ? 40 : 10} />
    </svg>
  );
}

/** Wildlife: a young fox. */
function Fox({ pose }: { pose: Pose }) {
  const body = '#e07b39';
  const dark = '#9a4a1c';
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      {/* tail */}
      <path d="M48 50 q16 -2 12 -18 q-4 8 -12 8z" fill={body} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M58 36 q-2 4 -6 5" stroke="#fff6ea" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* ears */}
      <path d="M14 22 l2 -16 12 10z" fill={body} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M50 22 l-2 -16 -12 10z" fill={body} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />
      {/* body */}
      <path d="M12 40 q-2 -26 20 -27 q22 1 20 27 q1 16 -20 16 q-21 0 -20 -16z" fill={body} stroke={dark} strokeWidth="1.8" />
      {/* white muzzle and tummy */}
      <path d="M20 30 q12 14 24 0 q-2 12 -12 12 q-10 0 -12 -12z" fill="#fff6ea" />
      <ellipse cx="32" cy="48" rx="9" ry="6" fill="#fff6ea" />
      <Arms pose={pose} dark={dark} />
      <ellipse cx="23" cy="56" rx="5" ry="2.6" fill={dark} />
      <ellipse cx="41" cy="56" rx="5" ry="2.6" fill={dark} />
      <Face pose={pose} eyeY={26} />
      <Prop pose={pose} x={pose === 'coin' ? 32 : 56} y={pose === 'coin' ? 46 : 10} />
    </svg>
  );
}

/** Space: a small round astronaut. */
function Astronaut({ pose }: { pose: Pose }) {
  const suit = '#f4f3ff';
  const dark = '#2b1f7a';
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      {/* antenna */}
      <path d="M32 9 v-5" stroke={dark} strokeWidth="1.6" />
      <circle cx="32" cy="4" r="2.4" fill="#ff6b6b" />
      {/* suit */}
      <path d="M12 40 q-2 -26 20 -27 q22 1 20 27 q1 16 -20 16 q-21 0 -20 -16z" fill={suit} stroke={dark} strokeWidth="1.8" />
      {/* visor */}
      <rect x="15" y="17" width="34" height="22" rx="11" fill="#2fd3e8" stroke={dark} strokeWidth="1.6" />
      <rect x="17.5" y="19.5" width="29" height="17" rx="8.5" fill="#ffd9b5" />
      {/* chest panel */}
      <rect x="27" y="44" width="10" height="6" rx="1.5" fill="#5b4bff" />
      <Arms pose={pose} dark="#625c91" y={40} />
      <ellipse cx="23" cy="56" rx="5" ry="2.6" fill="#625c91" />
      <ellipse cx="41" cy="56" rx="5" ry="2.6" fill="#625c91" />
      <Face pose={pose} eyeY={26} gap={7} />
      <Prop pose={pose} x={pose === 'coin' ? 32 : 56} y={pose === 'coin' ? 47 : 10} />
    </svg>
  );
}

export function Mascot({ kind, pose = 'happy', size = 34 }: { kind: MascotKind; pose?: Pose; size?: number }) {
  return (
    <span style={{ display: 'inline-block', width: size, height: size, lineHeight: 0 }}>
      {kind === 'dino' ? (
        <Dino pose={pose} />
      ) : kind === 'bee' ? (
        <Bee pose={pose} />
      ) : kind === 'fox' ? (
        <Fox pose={pose} />
      ) : (
        <Astronaut pose={pose} />
      )}
    </span>
  );
}
