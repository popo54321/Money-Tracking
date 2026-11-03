// A small, safe arithmetic evaluator for the amount keypad.
// Supports + − × ÷ (also + - * /), brackets, decimals and leading minus.
// Unclosed brackets at the end are closed automatically so the live preview works while typing.

type Tok = { t: 'num'; v: number } | { t: 'op'; v: '+' | '-' | '*' | '/' } | { t: '(' } | { t: ')' };

function tokenize(src: string): Tok[] | null {
  const s = src.replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i;
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
      const txt = s.slice(i, j);
      if ((txt.match(/\./g) || []).length > 1 || txt === '.') return null;
      out.push({ t: 'num', v: Number(txt) });
      i = j;
    } else if (c === '+' || c === '-' || c === '*' || c === '/') {
      out.push({ t: 'op', v: c });
      i++;
    } else if (c === '(') {
      out.push({ t: '(' });
      i++;
    } else if (c === ')') {
      out.push({ t: ')' });
      i++;
    } else {
      return null;
    }
  }
  return out;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  parse(): number | null {
    if (this.toks.length === 0) return null;
    const v = this.expr();
    if (v === null || this.i !== this.toks.length) return null;
    return v;
  }

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }

  private expr(): number | null {
    let left = this.term();
    if (left === null) return null;
    for (;;) {
      const p = this.peek();
      if (p && p.t === 'op' && (p.v === '+' || p.v === '-')) {
        this.i++;
        const right = this.term();
        if (right === null) return null;
        left = p.v === '+' ? left + right : left - right;
      } else return left;
    }
  }

  private term(): number | null {
    let left = this.factor();
    if (left === null) return null;
    for (;;) {
      const p = this.peek();
      if (p && p.t === 'op' && (p.v === '*' || p.v === '/')) {
        this.i++;
        const right = this.factor();
        if (right === null) return null;
        if (p.v === '/') {
          if (right === 0) return null;
          left = left / right;
        } else left = left * right;
      } else if (p && (p.t === '(' || p.t === 'num') && left !== null) {
        // implicit multiplication: 2(3+4) or (1+1)(2)
        const right = this.factor();
        if (right === null) return null;
        left = left * right;
      } else return left;
    }
  }

  private factor(): number | null {
    const p = this.peek();
    if (!p) return null;
    if (p.t === 'op' && (p.v === '-' || p.v === '+')) {
      this.i++;
      const v = this.factor();
      if (v === null) return null;
      return p.v === '-' ? -v : v;
    }
    if (p.t === 'num') {
      this.i++;
      return p.v;
    }
    if (p.t === '(') {
      this.i++;
      const v = this.expr();
      if (v === null) return null;
      const close = this.peek();
      if (!close || close.t !== ')') return null;
      this.i++;
      return v;
    }
    return null;
  }
}

/** Evaluate an expression. Returns null when it is empty, incomplete or invalid. */
export function evaluate(expr: string): number | null {
  const toks = tokenize(expr);
  if (!toks) return null;
  // auto-close open brackets
  let depth = 0;
  for (const t of toks) {
    if (t.t === '(') depth++;
    if (t.t === ')') depth--;
    if (depth < 0) return null;
  }
  for (let k = 0; k < depth; k++) toks.push({ t: ')' });
  const v = new Parser(toks).parse();
  if (v === null || !Number.isFinite(v)) return null;
  // trim floating noise such as 0.1 + 0.2
  return Math.round(v * 1e10) / 1e10;
}

/** True when the expression contains an operator, so the keypad should show a live result. */
export function hasOperator(expr: string): boolean {
  return /[-+*/×÷−()]/.test(expr.replace(/^[-−]/, ''));
}
