// Original chubby mascots for the themes, drawn as small SVGs, all from the same round body.
import { useId, type ReactNode } from 'react';

export type MascotKind = 'dino' | 'bee' | 'fox' | 'astronaut' | 'fairy' | 'investor' | 'rocket' | 'tycoon';
export type Pose = 'happy' | 'love' | 'coin' | 'sleep' | 'wow';

const INK = '#2f3a33';

function Face({
  pose,
  eyeY,
  cx = 32,
  gap = 9,
  mouth = 'open',
}: {
  pose: Pose;
  eyeY: number;
  cx?: number;
  gap?: number;
  /** open smile (default) or a one-sided smirk */
  mouth?: 'open' | 'smirk';
}) {
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
      ) : mouth === 'smirk' ? (
        <path d={`M${cx - 4} ${eyeY + 6} q4.5 2.6 8.5 -1.2`} stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
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

// the round body every mascot shares
const BODY = 'M12 40 q-2 -26 20 -27 q22 1 20 27 q1 16 -20 16 q-21 0 -20 -16z';
const SKIN = '#ffdcc4';
const Feet = ({ fill }: { fill: string }) => (
  <>
    <ellipse cx="23" cy="56" rx="5" ry="2.6" fill={fill} />
    <ellipse cx="41" cy="56" rx="5" ry="2.6" fill={fill} />
  </>
);

/** Fantasy: a round little fairy with a petal dress, a hair bun with a flower, pointed ears, wings and a wand. */
function Fairy({ pose }: { pose: Pose }) {
  const clip = useId();
  const dark = '#7a4fc2';
  const hair = '#c2562e';
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      {/* wings: two see-through pairs */}
      <g fill="#dcefff" fillOpacity="0.85" stroke="#7fb2f0" strokeWidth="1.2">
        <ellipse cx="11" cy="22" rx="10" ry="6.5" transform="rotate(-30 11 22)" />
        <ellipse cx="53" cy="22" rx="10" ry="6.5" transform="rotate(30 53 22)" />
        <ellipse cx="10" cy="36" rx="7" ry="4.5" transform="rotate(20 10 36)" fill="#f2e4ff" stroke="#b896f0" />
        <ellipse cx="54" cy="36" rx="7" ry="4.5" transform="rotate(-20 54 36)" fill="#f2e4ff" stroke="#b896f0" />
      </g>
      {/* hair bun with a flower */}
      <circle cx="32" cy="11" r="5.5" fill={hair} />
      <g fill="#ffb8d9">
        <circle cx="37" cy="8" r="2" />
        <circle cx="39.5" cy="10" r="2" />
        <circle cx="37.5" cy="12.4" r="2" />
        <circle cx="35" cy="10.4" r="2" />
      </g>
      <circle cx="37.3" cy="10.2" r="1.3" fill="#ffd25e" />
      {/* pointed ears */}
      <path
        d="M13.5 27 l-6 -5 6.8 9z M50.5 27 l6 -5 -6.8 9z"
        fill={SKIN}
        stroke={dark}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <clipPath id={clip}>
        <path d={BODY} />
      </clipPath>
      <path d={BODY} fill={SKIN} />
      <g clipPath={`url(#${clip})`}>
        {/* hair cap with a side-swept fringe */}
        <path d="M8 26 q2 -16 24 -16 q22 0 24 16 q-6 -6 -12 -6 q-8 0 -14 5 q-4 -5 -9 -4 q-6 1 -13 5z" fill={hair} />
        {/* petal dress */}
        <path d="M6 39 q6 -3 9 0 q4 -3 8 0 q4.5 -3 9 0 q4.5 -3 9 0 q4 -3 8 0 q3 -3 9 0 V64 H6z" fill="#c9a6ff" />
        <path d="M14 52 q4 -4 8 0 q5 -4 10 0 q5 -4 10 0 q4 -4 8 0" stroke={dark} strokeWidth="1" fill="none" opacity="0.6" />
      </g>
      <path d={BODY} fill="none" stroke={dark} strokeWidth="1.8" />
      <Arms pose={pose} dark="#f3c3a4" y={36} />
      {/* wand in the right hand */}
      <path
        d={pose === 'happy' || pose === 'wow' ? 'M55 28 l4 -10' : 'M42 40 l8 -8'}
        stroke="#b58a3e"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d={
          pose === 'happy' || pose === 'wow'
            ? 'M59.5 13.5 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2z'
            : 'M51 27.5 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2z'
        }
        fill="#ffd25e"
        stroke="#c99a1a"
        strokeWidth="0.6"
      />
      <Feet fill={dark} />
      <Face pose={pose} eyeY={27} />
      <Prop pose={pose} x={pose === 'coin' ? 32 : 6} y={pose === 'coin' ? 46 : 10} />
    </svg>
  );
}

/** A round businessman: skin on top, a suit below. The three Financial tycoons differ in hair, face and what they carry. */
function Suit({
  pose,
  suit,
  shirt,
  tie,
  hair,
  extra,
  item,
  mouth,
}: {
  pose: Pose;
  suit: string;
  /** the shirt in the V of the jacket; none = a plain tee */
  shirt?: string;
  tie?: string;
  /** drawn inside the body (clipped), over the skin */
  hair: ReactNode;
  /** drawn over everything (glasses, brows) */
  extra?: ReactNode;
  /** what he carries, by his feet */
  item: ReactNode;
  mouth?: 'open' | 'smirk';
}) {
  const clip = useId();
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      <clipPath id={clip}>
        <path d={BODY} />
      </clipPath>
      <path d={BODY} fill={SKIN} />
      <g clipPath={`url(#${clip})`}>
        {hair}
        {shirt ? (
          <>
            <path d="M6 38 H26 L32 47 L38 38 H58 V64 H6z" fill={suit} />
            <path d="M26 38 L32 47 L38 38z" fill={shirt} />
            <path d="M26 38 L22 44 L29 42z M38 38 L42 44 L35 42z" fill="#000" opacity="0.15" />
          </>
        ) : (
          <path d="M6 38 q26 -1 52 0 V64 H6z" fill={suit} />
        )}
        {!shirt && <path d="M25 38 q7 4 14 0" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.4" fill="none" />}
        {tie && <path d="M30.5 39 h3 l1 3 -2.5 9 -2.5 -9z" fill={tie} />}
        {/* a round tummy under the jacket */}
        <path d="M20 52 q12 6 24 0" stroke="#000" strokeOpacity="0.15" strokeWidth="1.4" fill="none" />
      </g>
      <path d={BODY} fill="none" stroke={INK} strokeWidth="1.8" />
      <Arms pose={pose} dark={suit} y={40} />
      <Feet fill="#3a2b25" />
      <Face pose={pose} eyeY={26} mouth={mouth} />
      {extra}
      {item}
      <Prop pose={pose} x={pose === 'coin' ? 32 : 56} y={pose === 'coin' ? 49 : 10} />
    </svg>
  );
}

/** Financial: the old value investor, with white tufts, big round glasses and his fizzy drink. */
function Investor({ pose }: { pose: Pose }) {
  return (
    <Suit
      pose={pose}
      suit="#7a8796"
      shirt="#fff"
      tie="#c0392b"
      hair={
        <>
          <ellipse cx="14" cy="24" rx="5.5" ry="7.5" fill="#d9dae3" />
          <ellipse cx="50" cy="24" rx="5.5" ry="7.5" fill="#d9dae3" />
          <path d="M12 21 q3 2 4 6 M52 21 q-3 2 -4 6" stroke="#b4b6c3" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M27 14.5 q5 -3 10 0" stroke="#c9cad5" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      }
      extra={
        <g fill="none" stroke={INK} strokeWidth="1.5">
          <circle cx="23" cy="26" r="5" fill="#fff" fillOpacity="0.25" />
          <circle cx="41" cy="26" r="5" fill="#fff" fillOpacity="0.25" />
          <path d="M28 26 h8" />
          <path d="M19 19.5 q4 -1.6 8 0 M37 19.5 q4 -1.6 8 0" stroke="#d6d6de" strokeWidth="2" strokeLinecap="round" />
        </g>
      }
      item={
        <g>
          <rect x="53" y="45" width="7" height="11" rx="1.6" fill="#d6342c" stroke={INK} strokeWidth="1" />
          <path d="M53 49 h7" stroke="#fff" strokeWidth="1.4" />
        </g>
      }
    />
  );
}

/** Financial: the rocket tech boss, with a dark swoop of hair, a black tee, a smirk and his toy rocket. */
function Rocket({ pose }: { pose: Pose }) {
  return (
    <Suit
      pose={pose}
      suit="#26262e"
      mouth="smirk"
      hair={<path d="M8 24 q0 -14 24 -14 q24 0 24 14 q-6 -7 -15 -6 q-10 1 -15 6 q-5 -4 -18 0z" fill="#3b2a22" />}
      extra={<path d="M19 20 l7 1.4 M38 21.4 l7 -1.4" stroke="#3b2a22" strokeWidth="1.8" strokeLinecap="round" />}
      item={
        <g transform="translate(57 49) rotate(20)">
          <path d="M0 -9 c3 2 4 7 3 12 h-6 c-1 -5 0 -10 3 -12z" fill="#f4f3ff" stroke={INK} strokeWidth="1" />
          <circle cy="-3" r="1.4" fill="#2fd3e8" />
          <path d="M-2 3.5 q2 5 4 0z" fill="#ff9f43" />
        </g>
      }
    />
  );
}

/** Financial: the luxury tycoon, with swept-back silver hair, a navy suit, a pocket square and a designer bag. */
function Tycoon({ pose }: { pose: Pose }) {
  return (
    <Suit
      pose={pose}
      suit="#1f2d4a"
      shirt="#fff"
      tie="#5a6b8c"
      hair={
        <>
          <path d="M8 26 q0 -16 24 -16 q24 0 24 16 q-4 -8 -24 -8 q-20 0 -24 8z" fill="#c9ccd6" />
          <path d="M18 15 q14 -4 28 0" stroke="#eef0f5" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      }
      extra={
        <g>
          <path
            d="M19 20.5 q4 -1.4 8 0 M37 20.5 q4 -1.4 8 0"
            stroke="#9a9ea8"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M40 43 h4 l-.6 2.4 h-2.8z" fill="#e3c66a" />
        </g>
      }
      item={
        <g>
          <rect x="52" y="47" width="10" height="9" rx="1.5" fill="#c98b5e" stroke={INK} strokeWidth="1" />
          <path d="M54.5 47 q2.5 -4 5 0" stroke={INK} strokeWidth="1.1" fill="none" />
          <path d="M55 51 h4" stroke="#e3c66a" strokeWidth="1.4" />
        </g>
      }
    />
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
      ) : kind === 'fairy' ? (
        <Fairy pose={pose} />
      ) : kind === 'investor' ? (
        <Investor pose={pose} />
      ) : kind === 'rocket' ? (
        <Rocket pose={pose} />
      ) : kind === 'tycoon' ? (
        <Tycoon pose={pose} />
      ) : (
        <Astronaut pose={pose} />
      )}
    </span>
  );
}
