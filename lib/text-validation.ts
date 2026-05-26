// 텍스트 입력 검증 헬퍼.
//
// 주된 목적: 인코딩이 손상된 텍스트(U+FFFD replacement character 포함)가
// DB에 저장되는 것을 방지. 정상 클라이언트(브라우저 fetch)는 UTF-8을
// 그대로 전송하므로 영향 없음. 잘못된 도구(예: Windows curl + CP949)에서
// 한글이 깨져 들어오는 케이스만 차단.

/** U+FFFD (replacement character) 포함 여부 */
export function containsReplacementChar(s: string): boolean {
  return typeof s === 'string' && s.includes('�');
}

/** 검증 실패 시 에러 throw */
export class BadTextError extends Error {
  constructor(public field: string) {
    super(`'${field}' 필드에 지원하지 않는 문자가 포함되어 있습니다.`);
    this.name = 'BadTextError';
  }
}

/** 단일 문자열 검증 */
export function assertCleanText(value: unknown, field: string): void {
  if (typeof value === 'string' && containsReplacementChar(value)) {
    throw new BadTextError(field);
  }
}

/** 객체의 여러 필드를 일괄 검증. undefined/null 필드는 통과. */
export function assertCleanFields(obj: Record<string, unknown>, fields: string[]): void {
  for (const f of fields) {
    const v = obj[f];
    if (typeof v === 'string') assertCleanText(v, f);
  }
}
