// 자관 질문 리스트 (v1.9) — 환경설정에서 관리하는 질문 세트.
// CP(커플)/NCP(커플 아님)로 구분 — 자관·AU의 CP/NCP에 맞는 세트를 골라 QUESTIONS 섹션에 넣는다.
// 기본 DB는 추후 사용자 제공분으로 교체 예정 — 아래 시드는 자리 표시용 소량.
import { RelCpTag } from './charStore';

export interface RelQuestionSet {
  id: string;
  name: string;          // 세트 이름
  cat: RelCpTag;         // CP / NCP
  questions: string[];
}

export const RELQ_KEY = 'ohome.relqsets.v1';

export const RELQ_SEED: RelQuestionSet[] = [];

export const CP_LABEL: Record<RelCpTag, string> = { cp: 'CP', ncp: 'NCP' };
