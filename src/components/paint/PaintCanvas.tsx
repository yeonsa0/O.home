'use client';
// 그림판(오에카키) 캔버스 — 원본(skins/board/paint/canvas.js)의 핵심 기능을
// React 컴포넌트로 새로 작성했다. 원본은 DOM을 직접 만들고 전역 함수를 window에
// 걸어 두는 방식(SPA 재진입 시 teardown 필요)이라 React 트리 안에서 그대로 쓰면
// 리렌더와 충돌하기 쉽다 — 그래서 캔버스 자체는 ref로만 다루고, 상태는 React가
// 들고 있는 형태로 다시 짰다. 레이어(여러 장 겹치기)는 1차 버전에서는 뺐고,
// 펜/지우개/도형·굵기·색·투명도·되돌리기·이어그리기(배경 이미지)까지 지원한다.
import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';

export interface PaintCanvasHandle {
  /** 지금 그림을 PNG Blob으로 — 실패하면(예: 원본 이미지 CORS 문제) null */
  exportBlob: () => Promise<Blob | null>;
  /** 캔버스에 그린 게 하나도 없는지 (제목만 쓰고 빈 그림 등록 방지용) */
  hasDrawing: () => boolean;
}

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'ellipse';

interface CanvasSize { w: number; h: number; label: string }

const SIZE_PRESETS: CanvasSize[] = [
  { label: '작게 · 400×400', w: 400, h: 400 },
  { label: '보통 · 600×450', w: 600, h: 450 },
  { label: '크게 · 800×600', w: 800, h: 600 },
];

const SWATCHES = [
  '#000000', '#ffffff', '#a63a45', '#e08a3c', '#e0c53c',
  '#4a9c5c', '#3c7ae0', '#7a4ae0', '#c06060', '#8a8f98',
];

const MAX_HISTORY = 30;

const TOOL_LABEL: Record<Tool, string> = {
  pen: '펜', eraser: '지우개', line: '직선', rect: '사각형', ellipse: '원',
};

/** 포인터 이벤트 좌표 → 캔버스 픽셀 좌표 (표시 크기와 실제 픽셀 크기가 달라도 정확히) */
function toCanvasPoint(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

export const PaintCanvas = forwardRef<PaintCanvasHandle, {
  /** 이어그리기/수정 — 처음에 배경으로 깔아 둘 이미지 주소 */
  initialImageUrl?: string;
  /** 이어그리기/수정 모드에서는 크기를 바꾸면 원본과 안 맞으므로 프리셋 선택을 숨긴다 */
  lockSize?: boolean;
}>(function PaintCanvas({ initialImageUrl, lockSize }, ref) {
  const mainRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<CanvasSize>(SIZE_PRESETS[1]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(6);
  const [alpha, setAlpha] = useState(100);
  const [loading, setLoading] = useState(!!initialImageUrl);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dirty, setDirty] = useState(false); // 실제로 뭔가 그려졌는지 (빈 그림 등록 방지)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const drawing = useRef(false);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const shiftHeld = useRef(false);

  const ctx = useCallback(() => mainRef.current?.getContext('2d') ?? null, []);
  const octx = useCallback(() => overlayRef.current?.getContext('2d') ?? null, []);

  /** 흰 배경으로 초기화 (+ initialImageUrl이 있으면 그 위에 이미지를 얹는다) */
  const resetCanvas = useCallback((s: CanvasSize, imgUrl?: string) => {
    const cvs = mainRef.current;
    const ov = overlayRef.current;
    if (!cvs || !ov) return;
    cvs.width = s.w; cvs.height = s.h;
    ov.width = s.w; ov.height = s.h;
    const c = cvs.getContext('2d');
    if (!c) return;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, s.w, s.h);
    undoStack.current = []; redoStack.current = [];
    setCanUndo(false); setCanRedo(false); setDirty(false);

    if (!imgUrl) { setLoading(false); return; }
    setLoading(true); setLoadFailed(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      c.drawImage(img, 0, 0, s.w, s.h);
      setLoading(false);
    };
    img.onerror = () => { setLoading(false); setLoadFailed(true); };
    img.src = imgUrl;
  }, []);

  // 최초 마운트 + 이어그리기 이미지가 바뀌면(원본 글이 확정되면) 다시 그림
  useEffect(() => {
    resetCanvas(size, initialImageUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImageUrl]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeld.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeld.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const pushHistory = useCallback(() => {
    const c = ctx(); const cvs = mainRef.current;
    if (!c || !cvs) return;
    undoStack.current.push(c.getImageData(0, 0, cvs.width, cvs.height));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true); setCanRedo(false);
  }, [ctx]);

  const undo = useCallback(() => {
    const c = ctx(); const cvs = mainRef.current;
    if (!c || !cvs || undoStack.current.length === 0) return;
    redoStack.current.push(c.getImageData(0, 0, cvs.width, cvs.height));
    const prev = undoStack.current.pop()!;
    c.putImageData(prev, 0, 0);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [ctx]);

  const redo = useCallback(() => {
    const c = ctx(); const cvs = mainRef.current;
    if (!c || !cvs || redoStack.current.length === 0) return;
    undoStack.current.push(c.getImageData(0, 0, cvs.width, cvs.height));
    const next = redoStack.current.pop()!;
    c.putImageData(next, 0, 0);
    setCanRedo(redoStack.current.length > 0);
    setCanUndo(true);
  }, [ctx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const c = ctx(); if (!c) return;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = lineWidth;
    c.globalAlpha = tool === 'eraser' ? 1 : alpha / 100;
    c.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    c.strokeStyle = color;
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
    c.restore();
  };

  const drawDot = (p: { x: number; y: number }) => {
    const c = ctx(); if (!c) return;
    c.save();
    c.globalAlpha = tool === 'eraser' ? 1 : alpha / 100;
    c.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    c.fillStyle = color;
    c.beginPath();
    c.arc(p.x, p.y, lineWidth / 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  const previewShape = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const oc = octx(); const ov = overlayRef.current;
    if (!oc || !ov) return;
    let { x: ex, y: ey } = end;
    if (shiftHeld.current) {
      const d = Math.min(Math.abs(ex - start.x), Math.abs(ey - start.y));
      ex = start.x + (ex > start.x ? d : -d);
      ey = start.y + (ey > start.y ? d : -d);
    }
    oc.clearRect(0, 0, ov.width, ov.height);
    oc.save();
    oc.strokeStyle = color; oc.lineWidth = lineWidth; oc.globalAlpha = alpha / 100;
    oc.lineCap = 'round'; oc.lineJoin = 'round';
    oc.beginPath();
    if (tool === 'line') { oc.moveTo(start.x, start.y); oc.lineTo(ex, ey); oc.stroke(); }
    else if (tool === 'rect') { oc.strokeRect(start.x, start.y, ex - start.x, ey - start.y); }
    else if (tool === 'ellipse') {
      const rx = (ex - start.x) / 2, ry = (ey - start.y) / 2;
      oc.ellipse(start.x + rx, start.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      oc.stroke();
    }
    oc.restore();
    return { x: ex, y: ey };
  };

  const commitShape = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const c = ctx(); const ov = overlayRef.current; const oc = octx();
    if (!c || !ov || !oc) return;
    oc.clearRect(0, 0, ov.width, ov.height);
    c.save();
    c.strokeStyle = color; c.lineWidth = lineWidth; c.globalAlpha = alpha / 100;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    if (tool === 'line') { c.moveTo(start.x, start.y); c.lineTo(end.x, end.y); c.stroke(); }
    else if (tool === 'rect') { c.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y); }
    else if (tool === 'ellipse') {
      const rx = (end.x - start.x) / 2, ry = (end.y - start.y) / 2;
      c.ellipse(start.x + rx, start.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (loading) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const cvs = mainRef.current; if (!cvs) return;
    const p = toCanvasPoint(cvs, e);
    pushHistory();
    setDirty(true);
    if (tool === 'pen' || tool === 'eraser') {
      drawing.current = true;
      lastPt.current = p;
      drawDot(p);
    } else {
      shapeStart.current = p;
      drawing.current = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || loading) return;
    const cvs = mainRef.current; if (!cvs) return;
    const p = toCanvasPoint(cvs, e);
    if (tool === 'pen' || tool === 'eraser') {
      if (lastPt.current) drawSegment(lastPt.current, p);
      lastPt.current = p;
    } else if (shapeStart.current) {
      previewShape(shapeStart.current, p);
    }
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const cvs = mainRef.current;
    if (cvs && shapeStart.current && (tool === 'line' || tool === 'rect' || tool === 'ellipse')) {
      const p = toCanvasPoint(cvs, e);
      const end = previewShape(shapeStart.current, p) ?? p;
      commitShape(shapeStart.current, end);
    }
    drawing.current = false;
    shapeStart.current = null;
    lastPt.current = null;
  };

  const clearAll = () => {
    if (!confirm('전체 지우기 — 그림을 처음부터 다시 그릴까요?')) return;
    pushHistory();
    resetCanvas(size); // 이어그리기 배경 이미지는 유지하지 않고 흰 캔버스로 (원본과 동일하게 완전 초기화)
  };

  const changeSize = (s: CanvasSize) => {
    if (s.w === size.w && s.h === size.h) return;
    if (dirty && !confirm('캔버스 크기를 바꾸면 지금 그린 그림이 사라집니다. 계속할까요?')) return;
    setSize(s);
    resetCanvas(s, initialImageUrl);
  };

  useImperativeHandle(ref, () => ({
    hasDrawing: () => dirty,
    exportBlob: () => new Promise<Blob | null>((resolve) => {
      const cvs = mainRef.current;
      if (!cvs) { resolve(null); return; }
      try {
        cvs.toBlob((blob) => resolve(blob), 'image/png');
      } catch {
        resolve(null); // 원본 이미지가 CORS를 허용하지 않아 캔버스가 오염된 경우 등
      }
    }),
  }), [dirty]);

  const cursorStyle = useMemo(() => (tool === 'eraser' || tool === 'pen' ? 'crosshair' : 'crosshair'), [tool]);

  return (
    <div className="paint-wrap">
      <div className="paint-toolbar">
        <div className="mini-seg">
          {(['pen', 'eraser', 'line', 'rect', 'ellipse'] as Tool[]).map(t => (
            <button key={t} type="button" className={tool === t ? 'on' : ''} onClick={() => setTool(t)}>
              {TOOL_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="paint-field">
          <label>색</label>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="paint-color" />
          <div className="paint-swatches">
            {SWATCHES.map(sw => (
              <button key={sw} type="button" className={`paint-swatch ${color === sw ? 'on' : ''}`}
                style={{ background: sw }} onClick={() => setColor(sw)} aria-label={sw} />
            ))}
          </div>
        </div>

        <div className="paint-field">
          <label>굵기 {lineWidth}px</label>
          <input type="range" min={1} max={40} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} />
        </div>

        <div className="paint-field">
          <label>투명도 {alpha}%</label>
          <input type="range" min={10} max={100} value={alpha} onChange={e => setAlpha(Number(e.target.value))} />
        </div>

        <div className="paint-field" style={{ marginLeft: 'auto', flexDirection: 'row', gap: 6 }}>
          <button type="button" className="btn btn-onbk" disabled={!canUndo} onClick={undo}>↶ 실행취소</button>
          <button type="button" className="btn btn-onbk" disabled={!canRedo} onClick={redo}>↷ 다시실행</button>
          <button type="button" className="btn btn-onbk" onClick={clearAll}>전체지우기</button>
        </div>
      </div>

      {!lockSize && (
        <div className="paint-field" style={{ marginBottom: 10 }}>
          <label>캔버스 크기</label>
          <div className="mini-seg">
            {SIZE_PRESETS.map(s => (
              <button key={s.label} type="button" className={size.w === s.w && size.h === s.h ? 'on' : ''}
                onClick={() => changeSize(s)}>{s.label}</button>
            ))}
          </div>
        </div>
      )}

      {initialImageUrl && (
        <div className={`paint-notice ${loadFailed ? 'warn' : ''}`}>
          {loading ? '원본 그림을 불러오는 중…'
            : loadFailed ? '⚠️ 원본 그림을 불러오지 못했습니다 — 흰 캔버스로 새로 그려집니다'
              : '🔗 원본 그림 위에 이어서 그리는 중'}
        </div>
      )}

      <div className="paint-stage" style={{ width: size.w, height: size.h, cursor: cursorStyle }}>
        <canvas ref={mainRef} width={size.w} height={size.h} />
        <canvas
          ref={overlayRef} width={size.w} height={size.h}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          style={{ touchAction: 'none' }}
        />
        {loading && <div className="paint-loading">불러오는 중…</div>}
      </div>
    </div>
  );
});
