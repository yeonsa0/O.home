// TRPG 캐릭터 리스트 (v1.9 신규) — 1:1 인장 카드 + 표정별 스탠딩/차분 전환
// 표정마다 원본 이미지(인장·스탠딩 무관)와 1:1 썸네일 위치(크롭)를 저장 —
// 카드 메인은 현재 표정의 1:1 크롭, 썸네일 클릭으로 표정 전환, 메인 클릭 시 원본(스탠딩) 확대
import type { CropValue } from '@/components/ui/CropEditor';

export interface TrpgFace {
  id: string;
  label?: string;            // 표정 이름 (선택 — 기본/웃음 등)
  imgId?: string;            // 원본 이미지 (IndexedDB — 인장 또는 스탠딩)
  crop?: CropValue;          // 1:1 썸네일 위치
  ph?: string;               // 데모 플레이스홀더
}

export interface TrpgChar {
  id: string;
  name: string;              // 이름 (필수)
  scenario: string;          // 다녀온 시나리오
  rule: string;              // 룰 (CoC 7th 등)
  role: string;              // 역할 — PL · GMPC · HO1 등
  desc: string;              // 간단한 설명 (리치 에디터 HTML — 격리 렌더)
  // 이미지 방식 (v1.9): 단일 인장(표정마다 1:1 인장, 개별 크롭) /
  // 스탠딩 인장(표정 차분 — 모든 파일의 가로세로 크기 동일 강제, 썸네일 크롭 위치 공유)
  imgMode?: 'stamp' | 'standing';
  crop?: import('@/components/ui/CropEditor').CropValue; // 스탠딩 공유 썸네일 위치
  stdW?: number; stdH?: number; // 스탠딩 기준 크기 (업로드 검증용)
  faces: TrpgFace[];         // 첫 번째가 대표 인장
  ph: string;
}

/** 표정의 썸네일 크롭 — 스탠딩이면 공유 크롭, 단일 인장이면 개별 크롭 */
export const faceCrop = (c: TrpgChar, f?: TrpgFace) =>
  (c.imgMode === 'standing' ? c.crop : f?.crop) ?? f?.crop;

export const TCHAR_SEED: TrpgChar[] = [];
