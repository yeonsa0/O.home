'use client';
// 현재 로그인 사용자 id를 훅 밖에서도 읽기 위한 아주 작은 창구 (v2.0)
// 저장 계층(db·postStore)이 AuthProvider에 의존하지 않도록 분리했다. AuthProvider가 값을 넣어 준다.

let uid: string | null = null;

export function setCurrentUserId(id: string | null) { uid = id; }
export function currentUserId(): string | null { return uid; }
