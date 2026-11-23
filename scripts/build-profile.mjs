#!/usr/bin/env node
/**
 * build-profile.mjs — 从 profile.config.json 生成 README.md 与全部 SVG 素材。
 *
 *   node scripts/build-profile.mjs           用 config.fallback 的数据出图（离线可用）
 *   node scripts/build-profile.mjs --fetch   从 GitHub API 拉真实统计（GH_TOKEN 可选）
 *
 * 输出：assets/*.svg + README.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'profile.config.json'), 'utf8'));
const assets = join(root, 'assets');
mkdirSync(assets, { recursive: true });

/* ---------- 设计变量（全部走 CSS 变量，因此自带深色模式） ---------- */
const FONT =
  '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", KaiTi, "Kaiti SC", "STKaiti", cursive';

const LIGHT = {
  ink: '#4E4133',
  muted: '#6E5C4A',
  paper: '#FFF8E9',
  edge: '#D3C6AA',
  rule: '#B6AB84',
  green: '#A7BB68',
  deep: '#7E9440',
  blue: '#8BC1C6',
  gold: '#F0CD79',
  sky1: '#DEEDF2',
  sky2: '#FBF7EA',
  hill1: '#C4E2A6',
  blade: '#6E9B45',
  hill2: '#A6D489',
  fur: '#FDF5E4',
  furline: '#8A6E4F',
  blush: '#F0B49A',
};

const DARK = {
  ink: '#FBEFD9',
  muted: '#D6C8AE',
  paper: '#2B2C25',
  edge: '#5B6150',
  rule: '#8A8668',
  green: '#A2BB76',
  deep: '#8DA652',
  blue: '#88B8BD',
  gold: '#EEC76C',
  sky1: '#243029',
  sky2: '#2B2C25',
  hill1: '#3A4B2E',
  blade: '#7C9B57',
  hill2: '#31402A',
  fur: '#F2E7CE',
  furline: '#C9B58F',
  blush: '#C98A72',
};

const vars = (map) => Object.entries(map).map(([k, v]) => `--${k}:${v};`).join('');

const themeStyle = () => `<style>
      svg { ${vars(LIGHT)} }
      @media (prefers-color-scheme: dark) { svg { ${vars(DARK)} } }
      text { font-family: ${FONT}; }
    </style>`;

const fill = (v) => `style="fill:var(--${v})"`;
const stroke = (v, w = 1.6, extra = '') => `style="stroke:var(--${v});stroke-width:${w};${extra}"`;
const both = (f, s, w = 1.6) => `style="fill:var(--${f});stroke:var(--${s});stroke-width:${w}"`;

/* ---------- 工具 ---------- */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const num = new Intl.NumberFormat('en-US');

const rr = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
  `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
  `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

/** 中文按 1em、拉丁按 0.56em 估算行宽，用于自动缩字号和下划线长度 */
function textWidth(str, size) {
  let w = 0;
  for (const ch of str) w += /[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(ch) ? 1 : 0.56;
  return w * size;
}

function fitSize(str, size, maxWidth, floor = 22) {
  let s = size;
  while (s > floor && textWidth(str, s) > maxWidth) s -= 2;
  return s;
}

const rough = (scale = 2) => `
    <filter id="rough" x="-6%" y="-6%" width="112%" height="112%">
      <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;

const paperDefs = (extra = '') => `
    <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="7" cy="7" r=".8" ${fill('rule')} opacity=".22"/>
    </pattern>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--sky1)"/>
      <stop offset="1" style="stop-color:var(--sky2)"/>
    </linearGradient>
    ${rough()}${extra}`;

/** 手绘下划线 */
function squiggle(x, y, w, color) {
  return `<path d="M${x} ${y}q${w * 0.18} -5 ${w * 0.38} -1t${w * 0.4} 2" fill="none"
        ${stroke(color, 2.6, 'stroke-linecap:round;')} opacity=".9"/>`;
}

/* ---------- 小部件 ---------- */
/** 羊毛外轮廓：以圆为基座，用二次曲线鼓出一圈波浪，读起来像云朵羊毛 */
function woolPath(cx, cy, R, lobes, bump) {
  let d = '';
  for (let i = 0; i <= lobes; i += 1) {
    const a = (Math.PI * 2 * i) / lobes - Math.PI / 2;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    if (i === 0) {
      d += `M${x.toFixed(2)} ${y.toFixed(2)}`;
      continue;
    }
    const am = a - Math.PI / lobes;
    d += `Q${(cx + Math.cos(am) * (R + bump)).toFixed(2)} ${(cy + Math.sin(am) * (R + bump)).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

/** 懒洋洋：白毛、闭眼、张大嘴、黄围兜 */
function mascot(x, y, s) {
  const line = '#DCCBA8';
  return `<g transform="translate(${x} ${y}) scale(${s})">
        <ellipse cx="0" cy="0" rx="30" ry="6" ${fill('furline')} opacity=".15"/>
        <ellipse cx="-7" cy="-3.5" rx="5.5" ry="4" fill="#FDFBF4" stroke="${line}" stroke-width="1.7"/>
        <ellipse cx="6" cy="-3.5" rx="5.5" ry="4" fill="#FDFBF4" stroke="${line}" stroke-width="1.7"/>
        <path d="${woolPath(0, -28, 18, 8, 6)}" fill="#FDFBF4" stroke="${line}" stroke-width="1.7"/>
        <path d="M-10-38h20v8.5q0 9-10 9t-10-9Z" fill="#F5D34E" stroke="#D9AF2E" stroke-width="1.5"/>
        <ellipse cx="-21" cy="-30" rx="6.5" ry="4.5" fill="#FDFBF4" stroke="${line}" stroke-width="1.7" transform="rotate(-18 -21 -30)"/>
        <ellipse cx="20" cy="-31" rx="6.5" ry="4.5" fill="#FDFBF4" stroke="${line}" stroke-width="1.7" transform="rotate(16 20 -31)"/>
        <ellipse cx="-29" cy="-74" rx="9.5" ry="5" fill="#C9A98E" stroke="#B08E74" stroke-width="1.5" transform="rotate(-26 -29 -74)"/>
        <ellipse cx="27" cy="-76" rx="9.5" ry="5" fill="#C9A98E" stroke="#B08E74" stroke-width="1.5" transform="rotate(24 27 -76)"/>
        <path d="${woolPath(0, -66, 24, 10, 8)}" fill="#FDFBF4" stroke="${line}" stroke-width="1.9"/>
        <ellipse cx="0" cy="-64" rx="19" ry="17.5" fill="#FBE0C8" stroke="#E8B99A" stroke-width="1.4"/>
        <path d="M-14-72q4 5 8 0" fill="none" stroke="#5A4436" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M5-73q4 5 8 0" fill="none" stroke="#5A4436" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="-15" cy="-59" r="4.5" fill="#F2A0A0" opacity=".5"/>
        <circle cx="13" cy="-60" r="4.5" fill="#F2A0A0" opacity=".5"/>
        <ellipse cx="0" cy="-62" rx="3.6" ry="3" fill="#2E2320"/>
        <ellipse cx="-1.2" cy="-63" rx="1.1" ry=".9" fill="#FFFFFF" opacity=".85"/>
        <path d="M-7-54q7-4 14 0q1 10-7 10t-7-10Z" fill="#8E4B48" stroke="#6E3735" stroke-width="1"/>
        <ellipse cx="0" cy="-45.5" rx="4" ry="2.6" fill="#C97A72"/>
      </g>`;
}

function chip(item, x, y) {
  const t = TONES[item.tone] ?? TONES.mint;
  const w = Math.max(64, Math.round(textWidth(item.label, 15) + 38));
  const svg = `<g>
        <rect x="${x}" y="${y}" width="${w}" height="30" rx="15" fill="${t.fill}" stroke="${t.edge}" stroke-width="1.4"/>
        <circle cx="${x + 16}" cy="${y + 15}" r="4.2" fill="${t.dot}"/>
        <text x="${x + 28}" y="${y + 20.5}" font-size="15" style="fill:${t.ink}">${esc(item.label)}</text>
      </g>`;
  return { svg, w };
}

const TONES = {
  mint: { fill: '#E6F2E4', edge: '#A9C9A9', ink: '#3E5A3E', dot: '#8FBF8F' },
  cream: { fill: '#FBF1D9', edge: '#DCC79B', ink: '#5B4A2F', dot: '#D9BE86' },
  sky: { fill: '#E4F0F5', edge: '#A8C8D5', ink: '#31505C', dot: '#8FBCCD' },
  blush: { fill: '#FBE8E5', edge: '#E0B4AC', ink: '#63362F', dot: '#D99A92' },
  lilac: { fill: '#EFEAF8', edge: '#C4B8DF', ink: '#443A5E', dot: '#B3A2D6' },
  gold: { fill: '#FAF0D8', edge: '#DCC182', ink: '#5E4A22', dot: '#D9B65E' },
};

/* ---------- 横幅 ---------- */
// 有抠好的懒洋洋就用真图，没有则退回手绘版
let sheepURI = null;
try {
  sheepURI = `data:image/png;base64,${readFileSync(join(assets, 'sheep.png')).toString('base64')}`;
} catch {
  sheepURI = null;
}

function flower(x, y, scale = 1) {
  const petals = [0, 72, 144, 216, 288]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return `<circle cx="${(x + Math.cos(rad) * 3.1 * scale).toFixed(1)}" cy="${(y + Math.sin(rad) * 3.1 * scale).toFixed(1)}" r="${2.3 * scale}" ${fill('paper')}/>`;
    })
    .join('');
  return `<g opacity=".92">${petals}<circle cx="${x}" cy="${y}" r="${1.9 * scale}" ${fill('gold')}/></g>`;
}

/** 更鲜艳的太阳：光晕 + 八道光芒 */
function sun(cx, cy) {
  const rays = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8 + Math.PI / 8;
    rays.push(
      `<line x1="${(cx + Math.cos(a) * 27).toFixed(1)}" y1="${(cy + Math.sin(a) * 27).toFixed(1)}" ` +
        `x2="${(cx + Math.cos(a) * 35).toFixed(1)}" y2="${(cy + Math.sin(a) * 35).toFixed(1)}" ` +
        `stroke="#F6C445" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>`,
    );
  }
  return `<g>
        <circle cx="${cx}" cy="${cy}" r="43" fill="#FFD34E" opacity=".12"/>
        <circle cx="${cx}" cy="${cy}" r="31" fill="#FFD34E" opacity=".28"/>
        ${rays.join('')}
        <circle cx="${cx}" cy="${cy}" r="20" fill="#FFD54A"/>
        <circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="#F0B429" stroke-width="1.3" opacity=".65"/>
      </g>`;
}

/** 更密的草丛，每丛三片叶子，分组做轻微摆动 */
function grassTufts(W, H, mobile) {
  const count = mobile ? 10 : 18;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const x = Math.round(W * (0.035 + t * 0.93));
    const baseY = Math.round(H - 10 - ((i * 37) % 72));
    const h = 12 + ((i * 53) % 13);
    const cls = ['sway-a', 'sway-b', 'sway-c'][i % 3];
    const op = (0.5 + ((i * 29) % 35) / 100).toFixed(2);
    out.push(`<g class="${cls}" fill="none" ${stroke('blade', 1.7, 'stroke-linecap:round;')} opacity="${op}">
          <path d="M${x} ${baseY}q2 ${(-h * 0.7).toFixed(1)} 7 ${-h}"/>
          <path d="M${x + 1} ${baseY}q-5 ${(-h * 0.6).toFixed(1)} -11 ${(-h * 0.75).toFixed(1)}"/>
          <path d="M${x + 2} ${baseY}q6 ${(-h * 0.5).toFixed(1)} 12 ${(-h * 0.6).toFixed(1)}"/>
        </g>`);
  }
  return out.join('\n        ');
}

/** 补上被原图裁掉的那只角：颜色取自角根(#7E6554)，根部不描边避免接缝 */
function horn() {
  // 轮廓完整覆盖原图角根（x222-268, y0-30），同色填充就不会出现接缝
  const body = 'M223 30L222 2Q217 -18 205 -34Q196 -46 209 -43Q236 -26 258 -4L268 4L268 28Z';
  const edge = 'M223 30L222 2Q217 -18 205 -34Q196 -46 209 -43Q236 -26 258 -4L268 4L268 28';
  return `<g>
          <path d="${body}" fill="#7E6554"/>
          <path d="${edge}" fill="none" stroke="#4A382C" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M227 10Q246 4 264 12" fill="none" stroke="#4A382C" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M221 -10Q238 -14 254 -4" fill="none" stroke="#4A382C" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M259 16Q244 -10 216 -30" fill="none" stroke="#94795F" stroke-width="5" stroke-linecap="round" opacity=".45"/>
        </g>`;
}

function banner(mobile) {
  const W = mobile ? 428 : 880;
  const H = mobile ? 314 : 252;
  const skyH = mobile ? 152 : 170;
  const padX = mobile ? 26 : 50;
  const card = rr(2, 2, W - 4, H - 4, 22);

  const nameSize = fitSize(cfg.displayName, mobile ? 42 : 60, mobile ? W - 150 : 440, 24);
  const nameY = mobile ? 112 : 122;
  const tagSize = fitSize(cfg.tagline, mobile ? 16 : 20, mobile ? W - 56 : 470, 12);

  // 桌面端标签右下对齐，移动端靠左自动换行
  const chipY = mobile ? 196 : H - 46;
  const chipMax = mobile ? 244 : W - 262;
  const chips = [];
  let cx = mobile ? padX : Math.max(40, W - 262 - cfg.chips.reduce((sum, c) => sum + chip(c, 0, 0).w + 10, -10));
  let cy = chipY;
  for (const item of cfg.chips) {
    const c = chip(item, cx, cy);
    if (cx + c.w > chipMax) {
      cx = padX;
      cy += 38;
    }
    chips.push(chip(item, cx, cy).svg);
    cx += chip(item, cx, cy).w + 10;
  }

  // 懒洋洋：趴在草地上，底部贴第二条草坡
  const sw = mobile ? 152 : 210;
  const sh = sw * (266 / 420);
  const sx = mobile ? W - 26 - sw : W - 30 - sw;
  const sy = (mobile ? 272 : 230) - sh;
  const sheep = sheepURI
    ? `<g transform="translate(${sx} ${sy}) scale(${sw / 420})">
         <ellipse cx="210" cy="260" rx="185" ry="13" ${fill('furline')} opacity=".13"/>
         <image href="${sheepURI}" width="420" height="266"/>
         ${horn()}
       </g>`
    : mascot(mobile ? W - 62 : W - 92, mobile ? H - 30 : 206, mobile ? 1.06 : 1.25);

  const decor = `<g clip-path="url(#card)">
        <rect x="2" y="2" width="${W - 4}" height="${skyH + 8}" fill="url(#sky)"/>
        ${sun(W - 84, 42)}
        <g class="cloud-a">
          <ellipse cx="${W * 0.3}" cy="48" rx="27" ry="11" ${fill('paper')}/>
          <ellipse cx="${W * 0.33}" cy="41" rx="17" ry="10" ${fill('paper')}/>
          <ellipse cx="${W * 0.26}" cy="45" rx="13" ry="8" ${fill('paper')}/>
        </g>
        <g class="cloud-b" opacity=".85">
          <ellipse cx="${W * 0.6}" cy="30" rx="21" ry="8" ${fill('paper')}/>
          <ellipse cx="${W * 0.63}" cy="25" rx="12" ry="7" ${fill('paper')}/>
        </g>
        <path d="M2 ${skyH - 4}C${W * 0.18} ${skyH - 26} ${W * 0.4} ${skyH + 6} ${W * 0.58} ${skyH - 2}
                 C${W * 0.76} ${skyH - 10} ${W * 0.9} ${skyH + 8} ${W - 2} ${skyH}L${W - 2} ${H}L2 ${H}Z"
              ${fill('hill1')}/>
        <path d="M2 ${skyH + 46}C${W * 0.22} ${skyH + 28} ${W * 0.44} ${skyH + 52} ${W * 0.62} ${skyH + 42}
                 C${W * 0.8} ${skyH + 34} ${W * 0.92} ${skyH + 52} ${W - 2} ${skyH + 40}L${W - 2} ${H}L2 ${H}Z"
              ${fill('hill2')}/>
        ${grassTufts(W, H, mobile)}
        ${flower(W * 0.13, H - 40, 0.95)}
        ${flower(W * 0.33, H - 26, 0.8)}
        ${mobile ? '' : flower(W * 0.47, H - 44, 0.85)}
        <g class="butterfly">
          <ellipse cx="${W * 0.52}" cy="${skyH - 40}" rx="8" ry="5.5" ${fill('gold')} transform="rotate(-24 ${W * 0.52} ${skyH - 40})"/>
          <ellipse cx="${W * 0.52 + 7}" cy="${skyH - 40}" rx="8" ry="5.5" ${fill('gold')} opacity=".8" transform="rotate(24 ${W * 0.52 + 7} ${skyH - 40})"/>
          <line x1="${W * 0.52 + 3}" y1="${skyH - 46}" x2="${W * 0.52 + 3}" y2="${skyH - 34}" ${stroke('ink', 1.5, 'stroke-linecap:round;')}/>
        </g>
      </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">${esc(cfg.displayName)}</title>
  <desc id="desc">${esc(cfg.bannerAlt)}</desc>
  <defs>
    ${paperDefs(`<clipPath id="card"><path d="${card}"/></clipPath>`)}
    ${themeStyle()}
    <style>
      @media (prefers-reduced-motion: no-preference) {
        .cloud-a { animation: drift 24s ease-in-out infinite alternate; }
        .cloud-b { animation: drift 31s ease-in-out infinite alternate-reverse; }
        .butterfly { animation: bob 7s ease-in-out infinite; }
        .sway-a, .sway-b, .sway-c { transform-box: fill-box; transform-origin: 50% 100%; }
        .sway-a { animation: sway 3.6s ease-in-out infinite; }
        .sway-b { animation: sway 4.4s ease-in-out infinite .6s; }
        .sway-c { animation: sway 5.1s ease-in-out infinite 1.2s; }
        @keyframes sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        @keyframes drift { from { transform: translateX(0); } to { transform: translateX(22px); } }
        @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
      }
    </style>
  </defs>
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="22" ${fill('paper')}/>
  ${decor}
  <path d="${card}" fill="none" ${stroke('edge', 2)} filter="url(#rough)"/>
  <text x="${padX}" y="${mobile ? 58 : 64}" font-size="${mobile ? 15 : 17}" ${fill('muted')}>${esc(cfg.handle)}</text>
  <text x="${padX - 2}" y="${nameY}" font-size="${nameSize}" font-weight="700" font-style="italic" ${fill('ink')}>${esc(cfg.displayName)}</text>
  ${squiggle(padX, nameY + 12, Math.min(textWidth(cfg.displayName, nameSize) * 0.9, mobile ? 220 : 340), 'deep')}
  <text x="${padX}" y="${mobile ? 150 : 166}" font-size="${tagSize}" ${fill('muted')}>${esc(cfg.tagline)}</text>
  ${chips.join('\n      ')}
  ${sheep}
</svg>
`;
}

/** 简易断行：拉丁按空格切，中文按字切，保证不越出便签宽度 */
function wrapText(lines, maxWidth, size) {
  const out = [];
  const push = (text) => {
    let cur = '';
    for (const ch of text) {
      if (cur && textWidth(cur + ch, size) > maxWidth) {
        out.push(cur);
        cur = '';
      }
      cur += ch;
    }
    if (cur) out.push(cur);
  };

  for (const raw of lines) {
    const line = String(raw).trim();
    if (!line) continue;
    if (textWidth(line, size) <= maxWidth) {
      out.push(line);
      continue;
    }
    // 先按空格聚成词，词过长再按字切
    let cur = '';
    for (const word of line.split(/(\s+)/)) {
      if (!word) continue;
      if (textWidth(cur + word, size) <= maxWidth) {
        cur += word;
        continue;
      }
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      if (textWidth(word, size) <= maxWidth) {
        cur = word.trim();
      } else {
        push(word.trim());
      }
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

/* ---------- 关于便签 ---------- */
function aboutNote(mobile) {
  const W = mobile ? 428 : 660;
  const padX = mobile ? 26 : 36;
  const fs = mobile ? 16 : 18;
  const lineH = mobile ? 26 : 32;
  const top = mobile ? 76 : 88;
  const lines = wrapText(cfg.aboutLines, W - padX * 2, fs);
  const H = Math.max(mobile ? 206 : 180, top + lines.length * lineH + 26);
  const card = rr(4, 4, W - 10, H - 10, 16);

  const body = lines
    .map((line, i) => `<text x="${padX}" y="${top + i * lineH}" font-size="${fs}" ${fill('ink')}>${esc(line)}</text>`)
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">${esc(cfg.aboutHeading)}</title>
  <desc id="desc">${esc(cfg.aboutLines.join(' '))}</desc>
  <defs>${paperDefs()}${themeStyle()}</defs>
  <g transform="rotate(-1.1 ${W / 2} ${H / 2})">
    <rect x="6" y="8" width="${W - 12}" height="${H - 14}" rx="16" ${fill('edge')} opacity=".45"/>
    <rect x="4" y="4" width="${W - 12}" height="${H - 14}" rx="16" ${fill('paper')}/>
    <rect x="4" y="4" width="${W - 12}" height="${H - 14}" rx="16" fill="url(#dots)"/>
    <path d="${card}" fill="none" ${stroke('edge', 1.8)} filter="url(#rough)"/>
    <rect x="${W / 2 - 56}" y="0" width="112" height="24" rx="3" ${fill('gold')} opacity=".7" transform="rotate(-2 ${W / 2} 12)"/>
    <text x="${padX}" y="${mobile ? 48 : 54}" font-size="${mobile ? 22 : 25}" font-weight="700" ${fill('ink')}>${esc(cfg.aboutHeading)}</text>
    ${squiggle(padX, (mobile ? 48 : 54) + 9, Math.min(textWidth(cfg.aboutHeading, mobile ? 22 : 25) * 0.9, 240), 'green')}
    ${body}
    <path d="M${W - 46} ${H - 18}q12 -19 26 -23q-7 19 -19 26Z" fill="none"
          ${stroke('green', 1.8, 'stroke-linejoin:round;')} opacity=".75"/>
  </g>
</svg>
`;
}

/* ---------- 联系方式贴纸 ---------- */
function glyph(kind, cx, cy, color) {
  const s = `fill="none" style="stroke:${color};stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"`;
  if (kind === 'mail')
    return `<g ${s}><rect x="${cx - 8}" y="${cy - 6}" width="16" height="12" rx="2.5"/><path d="M${cx - 8} ${cy - 4}l8 6 8-6"/></g>`;
  if (kind === 'code')
    return `<g ${s}><path d="M${cx - 5} ${cy - 5}l-5 5 5 5"/><path d="M${cx + 5} ${cy - 5}l5 5-5 5"/><path d="M${cx + 1.5} ${cy - 7}l-3 14"/></g>`;
  if (kind === 'play')
    return `<g ${s}><rect x="${cx - 8}" y="${cy - 6}" width="16" height="12" rx="3"/><path d="M${cx - 2} ${cy - 3}l6 3-6 3Z" fill="${color}"/></g>`;
  return `<g ${s}><circle cx="${cx}" cy="${cy}" r="8"/><ellipse cx="${cx}" cy="${cy}" rx="3.6" ry="8"/><path d="M${cx - 8} ${cy}h16"/></g>`;
}

function sticker(link) {
  const W = 216;
  const H = 62;
  const t = TONES[link.tone] ?? TONES.mint;
  const cy = (H - 6) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">${esc(link.label)}</title>
  <style>text { font-family: ${FONT}; }</style>
  <g transform="rotate(-0.7 ${W / 2} ${H / 2})">
    <rect x="2" y="5" width="${W - 6}" height="${H - 10}" rx="20" fill="${t.edge}" opacity=".55"/>
    <rect x="1" y="1" width="${W - 6}" height="${H - 10}" rx="20" fill="${t.fill}"/>
    <rect x="1" y="1" width="${W - 6}" height="${H - 10}" rx="20" fill="none" stroke="${t.edge}" stroke-width="1.6"/>
    <circle cx="34" cy="${cy}" r="17" fill="#FFFFFF" opacity=".75"/>
    ${glyph(link.icon, 34, cy, t.ink)}
    <text x="60" y="${cy + 7}" font-size="20" style="fill:${t.ink}">${esc(link.label)}</text>
  </g>
</svg>
`;
}

/* ---------- 统计卡片 ---------- */
function shareRows(list) {
  const grouped = new Map();
  for (const item of list ?? []) {
    if (!item || !item.language) continue;
    grouped.set(item.language, (grouped.get(item.language) ?? 0) + Number(item.count ?? 1));
  }
  const rows = [...grouped]
    .map(([language, count]) => ({ language, count }))
    .filter((r) => r.count > 0);
  if (!rows.length) return [];

  const ranked = rows.sort((a, b) => b.count - a.count || a.language.localeCompare(b.language, 'en'));
  const lead = ranked.slice(0, 3);
  if (ranked.length > 3) lead.push({ language: 'Other', count: ranked.slice(3).reduce((s, r) => s + r.count, 0) });

  const total = lead.reduce((s, r) => s + r.count, 0);
  const out = lead.map((r) => ({
    ...r,
    percent: Math.floor((r.count * 100) / total),
    rem: (r.count * 100) % total,
  }));
  let gap = 100 - out.reduce((s, r) => s + r.percent, 0);
  for (const r of [...out].sort((a, b) => b.rem - a.rem).slice(0, gap)) r.percent += 1;
  return out;
}

function snapshot(stats, mobile) {
  const W = mobile ? 428 : 880;
  const H = mobile ? 356 : 180;
  const SW = 380;
  const bars = ['#A2B968', '#81BCC9', '#DFBD73', '#BCA187'];
  const frame = rr(3, 3, W - 6, H - 6, 18);
  const xs = [32, 152, 276];

  const metrics = [
    ['Stars', stats.stars],
    ['Followers', stats.followers],
    ['Public repos', stats.repos],
  ];

  const statsBlock = `<text x="0" y="21" font-size="23" font-weight="700" ${fill('ink')}>Open source</text>
      ${squiggle(0, 29, 158, 'green')}
      <text x="0" y="48" font-size="14" ${fill('muted')}>Public GitHub activity</text>
      <g transform="translate(2 78)" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12-3 4 8 9 1-6 6 1 9-8-4-8 4 1-9-7-6 10-2Z" ${both('gold', 'furline', 1.7)}/>
        <path d="m10 3-2 5-5 1" fill="none" ${stroke('paper', 1.6)}/>
      </g>
      ${metrics
        .map(([label, value], i) => {
          const text = num.format(value);
          const size = text.length > 6 ? 24 : 31;
          const fit = text.length > 5 ? ` textLength="104" lengthAdjust="spacingAndGlyphs"` : '';
          return `<text x="${xs[i]}" y="98" font-size="${size}" font-weight="700" ${fill('ink')}${fit}>${text}</text>
      <text x="${xs[i]}" y="126" font-size="14" ${fill('muted')}>${label}</text>`;
        })
        .join('\n      ')}`;

  let langs = shareRows(stats.languages);
  let langNote = 'Share of public repos by main language';
  if (!langs.length) {
    // 还没有公开仓库：先展示学过的语言，之后 Actions 拉到真实数据会自动换掉
    const learned = shareRows(cfg.fallback.languages);
    if (learned.length) {
      langs = learned;
      langNote = "What I've learned so far";
    }
  }
  let legend;
  if (langs.length) {
    let x = 0;
    const segs = langs
      .map((l) => {
        const w = (l.count / langs.reduce((s, r) => s + r.count, 0)) * SW;
        const seg = `<rect x="${x.toFixed(2)}" y="66" width="${w.toFixed(2)}" height="12" fill="${bars[langs.indexOf(l)]}"/>`;
        x += w;
        return seg;
      })
      .join('\n        ');
    legend = `<g clip-path="url(#bar)">${segs}</g>
      <path d="${rr(0, 66, SW, 12, 6)}" fill="none" ${stroke('rule', 1.1)}/>
      ${langs
        .map((l, i) => {
          const lx = (i % 2) * 196;
          const ly = 110 + Math.floor(i / 2) * 24;
          const label = l.language.length > 16 ? `${l.language.slice(0, 15)}…` : l.language;
          return `<circle cx="${lx + 4}" cy="${ly - 5}" r="4" fill="${bars[i]}"/>
      <text x="${lx + 16}" y="${ly}" font-size="14" ${fill('muted')}>${esc(label)}</text>
      <text x="${lx + 182}" y="${ly}" font-size="14" ${fill('muted')} text-anchor="end">${l.percent}%</text>`;
        })
        .join('\n      ')}`;
  } else {
    legend = `<text x="0" y="102" font-size="14" ${fill('muted')}>No language data yet</text>`;
  }

  const langBlock = `<text x="0" y="21" font-size="23" font-weight="700" ${fill('ink')}>Primary languages</text>
      ${squiggle(0, 29, 232, 'blue')}
      <text x="0" y="48" font-size="14" ${fill('muted')}>${esc(langNote)}</text>
      ${legend}`;

  const divider = mobile ? `M24 ${H / 2 - 2}q190 -3 380 1` : `M440 24q4 66 -1 132`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">GitHub snapshot</title>
  <desc id="desc">${esc(
    [...metrics.map(([l, v]) => `${l}: ${num.format(v)}`), ...langs.map((l) => `${l.language}: ${l.percent}%`)].join(', '),
  )}</desc>
  <defs>
    ${paperDefs(`<clipPath id="bar"><rect x="0" y="66" width="${SW}" height="12" rx="6"/></clipPath>`)}
    ${themeStyle()}
  </defs>
  <path d="${frame}" transform="translate(0 4)" ${fill('edge')} opacity=".5"/>
  <path d="${frame}" ${fill('paper')}/>
  <path d="${frame}" fill="url(#dots)"/>
  <path d="${frame}" fill="none" ${stroke('edge', 1.6)} filter="url(#rough)"/>
  <path d="${divider}" fill="none" ${stroke('rule', 1.3, 'stroke-dasharray:4 5;stroke-linecap:round;')}/>
  <g transform="translate(${mobile ? 24 : 28} 24)">${statsBlock}</g>
  <g transform="translate(${mobile ? 24 : 468} ${mobile ? H / 2 + 10 : 24})">${langBlock}</g>
</svg>
`;
}

/* ---------- 取数 ---------- */
async function fetchStats() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'profile-card-builder' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const u = encodeURIComponent(cfg.username);

  const userRes = await fetch(`https://api.github.com/users/${u}`, { headers });
  if (!userRes.ok) throw new Error(`GET users/${cfg.username} → ${userRes.status}`);
  const user = await userRes.json();

  const all = [];
  for (let page = 1; page <= 5; page += 1) {
    const res = await fetch(`https://api.github.com/users/${u}/repos?per_page=100&type=owner&page=${page}`, {
      headers,
    });
    if (!res.ok) throw new Error(`GET repos page ${page} → ${res.status}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }

  const repos = all.filter((r) => !r.private && !r.fork);
  // 语言占比排除「同名主页仓库」本身：它的 .mjs 构建脚本会把占比刷成 JavaScript 100%，
  // 反而盖掉真正想展示的语言构成。
  const codeRepos = repos.filter((r) => (r.name ?? '').toLowerCase() !== cfg.username.toLowerCase());
  return {
    stars: repos.reduce((s, r) => s + (r.stargazers_count ?? 0), 0),
    followers: user.followers,
    repos: repos.length,
    languages: codeRepos.map((r) => ({ language: r.language, count: 1 })),
  };
}

/* ---------- README ---------- */
function readme() {
  const links = cfg.links
    .map(
      (l, i) =>
        `  <a href="${esc(l.href)}"><img src="assets/link-${i + 1}.svg" alt="${esc(l.label)}" width="24%"></a>${
          i < cfg.links.length - 1 ? '<br>' : ''
        }`,
    )
    .join('\n');

  const projects = cfg.projects.map((p) => `- [**${p.name}**](${p.href}) — ${p.desc}`).join('\n');

  return `<div align="center">

<picture>
  <source media="(max-width: 650px)" srcset="assets/banner-mobile.svg">
  <img src="assets/banner.svg" alt="${esc(cfg.bannerAlt)}" width="880">
</picture>

</div>

<div align="center">

<picture>
  <source media="(max-width: 650px)" srcset="assets/about-note-mobile.svg">
  <img align="left" src="assets/about-note.svg" alt="${esc(cfg.aboutHeading)}" width="69%">
</picture>

${links}

<br clear="all">

</div>

## GitHub snapshot

<div align="center">

<picture>
  <source media="(max-width: 650px)" srcset="assets/github-snapshot-mobile.svg">
  <img src="assets/github-snapshot.svg" alt="Stars, followers, public repositories and primary languages" width="880">
</picture>

</div>

## Selected projects

${projects}
`;
}

/* ---------- 本地预览页：模拟 GitHub 主页渲染 README，永远与配置同步 ---------- */
function mdToHtml(md) {
  const out = [];
  let inList = false;
  for (const line of md.split('\n')) {
    if (/^## /.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${esc(line.replace(/^## /, ''))}</h2>`);
    } else if (/^- \[/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(
        line.replace(
          /^- \[\*\*(.+?)\*\*\]\((.+?)\) — (.+)$/,
          '<li><a href="$2"><strong>$1</strong></a> — $3</li>',
        ),
      );
    } else {
      if (inList && line.trim() === '') { out.push('</ul>'); inList = false; }
      out.push(line);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function preview(stats) {
  const email = cfg.links.find((l) => (l.href ?? '').startsWith('mailto:'));
  const body = mdToHtml(readme());
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>GitHub 主页预览</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; color: #1f2328;
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased; }
  .topbar { height: 48px; background: #24292f; display: flex; align-items: center;
    gap: 16px; padding: 0 24px; color: #d0d7de; font-size: 14px; }
  .topbar .logo { width: 22px; height: 22px; border-radius: 50%; background: #d0d7de; }
  .topbar .search { flex: 0 0 260px; height: 26px; border: 1px solid #57606a; border-radius: 6px; }
  .wrap { display: flex; gap: 24px; max-width: 1216px; margin: 0 auto; padding: 28px 24px 60px; }
  .side { flex: 0 0 296px; }
  .avatar { width: 276px; height: 276px; border-radius: 50%;
    background: radial-gradient(circle at 42% 34%, #fdf5e4 0 46%, #dcebc4 47% 100%);
    border: 1px solid #d8dee4; display: block; object-fit: cover; }
  .name { font-size: 24px; line-height: 1.25; margin: 16px 0 2px; font-weight: 600; }
  .login { font-size: 20px; color: #57606a; font-weight: 300; }
  .bio { font-size: 16px; margin: 16px 0; }
  .meta { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #24292f; margin: 6px 0; }
  .meta .ico { width: 16px; height: 16px; border-radius: 3px; background: #d0d7de; }
  .follow { margin: 16px 0; height: 32px; border: 1px solid #d0d7de; border-radius: 6px;
            display: grid; place-items: center; font-size: 14px; color: #24292f; background: #f6f8fa; }
  .hr { height: 1px; background: #d8dee4; margin: 20px 0; }
  .ach { display: flex; gap: 8px; }
  .badge { width: 52px; height: 52px; border-radius: 50%; background: #eaeef2;
           border: 1px solid #d8dee4; display: grid; place-items: center; font-size: 11px; color: #57606a; }
  .main { flex: 1 1 auto; min-width: 0; }
  .readme { border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; }
  .readme-head { display: flex; align-items: center; gap: 8px; padding: 8px 16px;
    border-bottom: 1px solid #d0d7de; background: #f6f8fa; font-size: 13px; color: #57606a; }
  .readme-body { padding: 32px; font-size: 16px; line-height: 1.5; }
  .readme-body img { max-width: 100%; }
  .readme-body h2 { font-size: 24px; font-weight: 600; margin: 24px 0 16px;
    padding-bottom: 8px; border-bottom: 1px solid #d8dee4; }
  .readme-body ul { padding-left: 2em; margin: 0 0 16px; }
  .readme-body li { margin: 4px 0; }
  .readme-body a { color: #0969da; text-decoration: none; }
  .readme-body div[align="center"] { text-align: center; }
  .readme-body br[clear] { clear: both; }
  .hint { font-size: 12px; color: #57606a; margin: 0 0 12px; }
</style>
</head>
<body>
<div class="topbar"><div class="logo"></div><div class="search"></div></div>
<div class="wrap">
  <aside class="side">
    <img class="avatar" src="assets/avatar.jpg" alt="头像">
    <h1 class="name">${esc(cfg.displayName)}</h1>
    <div class="login">${esc(cfg.username)}</div>
    <div class="follow">关注</div>
    <p class="bio">${esc(cfg.tagline)}</p>
    <div class="meta"><span class="ico"></span> ${num.format(stats.followers)} 关注者 · 0 关注</div>
    <div class="meta"><span class="ico"></span> ${esc(cfg.location ?? 'China')}</div>
    ${email ? `<div class="meta"><span class="ico"></span> ${esc(email.href.replace('mailto:', ''))}</div>` : ''}
    <div class="hr"></div>
    <h2 style="font-size:16px;margin:0 0 12px">成就</h2>
    <div class="ach">
      <div class="badge">Star</div><div class="badge">Pull</div><div class="badge">Issue</div>
    </div>
    <div class="hr"></div>
    <div style="font-size:12px;color:#57606a">拉黑或举报 user</div>
  </aside>
  <main class="main">
    <p class="hint">左侧信息来自 Edit profile，右侧全部来自同名仓库的 README.md</p>
    <div class="readme">
      <div class="readme-head">${esc(cfg.username)} / README.md</div>
      <div class="readme-body">
${body}
      </div>
    </div>
  </main>
</div>
</body>
</html>
`;
}

/* ---------- 执行 ---------- */
let useFetch = process.argv.includes('--fetch');
let stats = cfg.fallback;
let source = 'config.fallback';

// 防止把占位符当成真实账号，误采集陌生人的数据
if (useFetch && !/^[A-Za-z0-9-]{1,39}$/.test(cfg.username ?? '')) {
  console.warn('[warn] profile.config.json 里的 username 还没填，本次不拉取线上数据。');
  useFetch = false;
}

if (useFetch) {
  try {
    stats = await fetchStats();
    source = 'GitHub API';
  } catch (err) {
    console.warn(`[warn] ${err.message} — 回退到 config.fallback 的数据`);
  }
}

const files = {
  'banner.svg': banner(false),
  'banner-mobile.svg': banner(true),
  'about-note.svg': aboutNote(false),
  'about-note-mobile.svg': aboutNote(true),
  'github-snapshot.svg': snapshot(stats, false),
  'github-snapshot-mobile.svg': snapshot(stats, true),
};
cfg.links.forEach((l, i) => {
  files[`link-${i + 1}.svg`] = sticker(l);
});

for (const [name, svg] of Object.entries(files)) writeFileSync(join(assets, name), svg);
writeFileSync(join(root, 'README.md'), readme());
writeFileSync(join(root, 'preview.html'), preview(stats));

console.log(`已生成 ${Object.keys(files).length} 个 SVG + README.md + preview.html`);
console.log(
  `统计来源：${source}｜Stars ${num.format(stats.stars)} · Followers ${num.format(stats.followers)} · Repos ${num.format(stats.repos)}`,
);
