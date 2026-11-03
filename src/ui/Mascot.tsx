// Original chubby mascots for the Dinosaur and Frog themes, drawn as small SVGs.
export type MascotKind = 'dino' | 'frog';
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
    return <path d={`M${x} ${y + 4} c-5 -3.5 -6 -8 -3 -9.5 c1.6 -0.8 3 0.2 3 1.6 c0 -1.4 1.4 -2.4 3 -1.6 c3 1.5 2 6 -3 9.5z`} fill="#ff5c7a" stroke={INK} strokeWidth="1" />;
  if (pose === 'coin')
    return (
      <g>
        <circle cx={x} cy={y} r="5.2" fill="#f6c343" stroke="#c9961a" strokeWidth="1.3" />
        <text x={x} y={y + 2.6} fontSize="7" fontWeight="800" textAnchor="middle" fill="#9a6f00">฿</text>
      </g>
    );
  if (pose === 'sleep')
    return <text x={x} y={y} fontSize="8" fontWeight="800" fill="#7aa0c8">z</text>;
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
      {/* spikes */}
      <path d="M22 13 l3 -7 3 7z M30 10 l3 -7 3 7z M38 13 l3 -7 3 7z" fill={spike} stroke={dark} strokeWidth="1.2" strokeLinejoin="round" />
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

function Frog({ pose }: { pose: Pose }) {
  const body = '#8fd16a';
  const dark = '#5a9e3c';
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      {/* eye bumps */}
      <circle cx="21" cy="18" r="9" fill={body} stroke={dark} strokeWidth="1.8" />
      <circle cx="43" cy="18" r="9" fill={body} stroke={dark} strokeWidth="1.8" />
      {/* body */}
      <path d="M8 40 q0 -20 24 -20 q24 0 24 20 q0 16 -24 16 q-24 0 -24 -16z" fill={body} stroke={dark} strokeWidth="1.8" />
      <ellipse cx="32" cy="45" rx="13" ry="8" fill="#e9f8c9" />
      {/* big eyes */}
      <circle cx="21" cy="18" r="6" fill="#fff" />
      <circle cx="43" cy="18" r="6" fill="#fff" />
      {pose === 'sleep' ? (
        <>
          <path d="M17 19 q4 3 8 0" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M39 19 q4 3 8 0" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      ) : pose === 'wow' ? (
        <>
          <path d="M21 13 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z" fill="#f6c343" />
          <path d="M43 13 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z" fill="#f6c343" />
        </>
      ) : (
        <>
          <circle cx="22" cy="19" r="3.6" fill={INK} />
          <circle cx="44" cy="19" r="3.6" fill={INK} />
          <circle cx="23.3" cy="17.6" r="1.2" fill="#fff" />
          <circle cx="45.3" cy="17.6" r="1.2" fill="#fff" />
        </>
      )}
      {/* cheeks and mouth */}
      <ellipse cx="17" cy="33" rx="4" ry="2.4" fill="#ff9fb3" opacity="0.85" />
      <ellipse cx="47" cy="33" rx="4" ry="2.4" fill="#ff9fb3" opacity="0.85" />
      {pose === 'sleep' ? (
        <path d="M28 34 q4 2 8 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M25 32 q7 6 14 0" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      )}
      {/* hands */}
      {pose === 'happy' || pose === 'wow' ? (
        <>
          <path d="M10 38 q-6 -4 -5 -10" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M54 38 q6 -4 5 -10" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="24" cy="42" rx="4" ry="3" fill={body} stroke={dark} strokeWidth="1.4" />
          <ellipse cx="40" cy="42" rx="4" ry="3" fill={body} stroke={dark} strokeWidth="1.4" />
        </>
      )}
      <Prop pose={pose} x={pose === 'coin' ? 32 : 56} y={pose === 'coin' ? 42 : 8} />
    </svg>
  );
}

export function Mascot({ kind, pose = 'happy', size = 34 }: { kind: MascotKind; pose?: Pose; size?: number }) {
  return (
    <span style={{ display: 'inline-block', width: size, height: size, lineHeight: 0 }}>
      {kind === 'dino' ? <Dino pose={pose} /> : <Frog pose={pose} />}
    </span>
  );
}
