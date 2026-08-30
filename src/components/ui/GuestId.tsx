'use client';
// 게스트 신원 입력 바 (v1.9) — 방문자 댓글 허용 시 댓글창 위에 붙는 컴팩트 한 줄 UI.
// GUEST 칩 + 닉네임 · 비밀번호(수정·삭제용) — 자체 스타일 (기본 브라우저 UI 미사용, 7장)
import React from 'react';

export function GuestIdBar({ name, pw, onName, onPw, style }: {
  name: string; pw: string;
  onName: (v: string) => void; onPw: (v: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div className="guest-id" style={style}>
      <span className="gi-tag">GUEST</span>
      <input value={name} placeholder="닉네임" maxLength={20}
        onChange={e => onName(e.target.value)} />
      <span className="gi-sep" />
      <input type="password" value={pw} placeholder="비밀번호 (수정·삭제용)" maxLength={30}
        onChange={e => onPw(e.target.value)} />
    </div>
  );
}
