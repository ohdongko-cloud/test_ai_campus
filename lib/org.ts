// 법인·조직(부서/직무) 분류 상수 및 타입.
//
// - 법인 목록은 고정 7개(코드 상수, 변동이 드묾).
// - 부서/직무는 DB(org_units 테이블)로 관리하고 어드민에서 수정한다.
// - 이 파일은 클라이언트/서버 공용(서버 전용 import 없음).

/** 가입 폼 법인 드롭다운 고정 목록 */
export const CORPORATIONS: string[] = [
  '이랜드리테일',
  '팜앤푸드(킴스클럽 포함)',
  '이랜드월드',
  '이랜드이츠',
  '이랜드건설',
  '이랜드파크',
  '기타(업데이트중)',
];

/** 부서/직무 조직도를 보유한 법인 — 이 법인 선택 시에만 드롭다운 목록을 노출한다. */
export const ORG_DIRECTORY_CORP = '이랜드리테일';

/** '기타' 법인 — 선택 시 법인명을 직접입력한다. */
export const CORP_OTHER = '기타(업데이트중)';

export interface OrgDepartment {
  department: string;
  positions: string[];
}

/** GET /api/org-units 응답 형태 */
export interface OrgUnitsResponse {
  corporation: string;
  departments: OrgDepartment[];
}
