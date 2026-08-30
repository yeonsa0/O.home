// 윈도우 애니메이션 커서(.ani) 파서 (5.1 v1.9) — 브라우저는 .ani를 직접 지원하지 않으므로
// RIFF(ACON) 컨테이너에서 프레임(.cur/.ico)과 재생 속도를 뽑아 CSS cursor를 프레임마다 교체해 재생.
// 참조 구조: "RIFF" size "ACON" { anih(헤더 36B) · rate(스텝별 jiffy) · seq(스텝→프레임) · LIST "fram" { icon... } }

export interface AniData {
  frames: Blob[];     // 각 프레임 — 그 자체로 유효한 .cur/.ico (핫스팟 내장)
  steps: number[];    // 재생 순서 (프레임 인덱스)
  delays: number[];   // 스텝별 지연 ms (jiffy = 1/60s)
}

export function parseAni(buf: ArrayBuffer): AniData | null {
  if (buf.byteLength < 12) return null;
  const dv = new DataView(buf);
  const tag = (o: number) =>
    String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'ACON') return null;

  let dispRate = 6;                 // 기본 6 jiffy = 100ms
  let rates: number[] | null = null;
  let seq: number[] | null = null;
  const frames: Blob[] = [];

  let o = 12;
  while (o + 8 <= buf.byteLength) {
    const id = tag(o);
    const size = dv.getUint32(o + 4, true);
    const body = o + 8;
    if (body + size > buf.byteLength) break;
    if (id === 'anih' && size >= 36) {
      dispRate = dv.getUint32(body + 28, true) || 6;
    } else if (id === 'rate') {
      rates = [];
      for (let i = 0; i < Math.floor(size / 4); i++) rates.push(dv.getUint32(body + i * 4, true));
    } else if (id === 'seq ') {
      seq = [];
      for (let i = 0; i < Math.floor(size / 4); i++) seq.push(dv.getUint32(body + i * 4, true));
    } else if (id === 'LIST' && tag(body) === 'fram') {
      let p = body + 4;
      while (p + 8 <= body + size) {
        const cid = tag(p);
        const csize = dv.getUint32(p + 4, true);
        if (cid === 'icon') frames.push(new Blob([buf.slice(p + 8, p + 8 + csize)], { type: 'image/x-icon' }));
        p += 8 + csize + (csize % 2);   // RIFF 청크는 2바이트 정렬
      }
    }
    o = body + size + (size % 2);
  }

  if (frames.length === 0) return null;
  const steps = (seq ?? frames.map((_, i) => i)).filter(i => i < frames.length);
  if (steps.length === 0) return null;
  const delays = steps.map((_, i) => Math.max(16, Math.round(((rates?.[i] ?? dispRate) * 1000) / 60)));
  return { frames, steps, delays };
}

/** .cur 정적 커서 여부 — 핫스팟이 파일에 내장돼 있어 CSS에서 좌표를 생략해야 함 */
export function isCur(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const dv = new DataView(buf);
  return dv.getUint16(0, true) === 0 && dv.getUint16(2, true) === 2;
}
