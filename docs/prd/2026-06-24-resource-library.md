# PRD: 배우기 '자료실' (게시판형 + 외부링크 연동)

- 작성일: 2026-06-24 · 작성자: Claude (요청자: 오너)
- 범위: 홈 배우기 섹션 카드 + 신규 '자료실' 탭(데스크톱·모바일) + 관리자 CRUD + DB(M012) + API. 파일 본문은 외부(드라이브/노션/URL) 링크, **메타데이터만 DB 저장**.
- 확정 결정(2026-06-24): ① 등록=관리자만(큐레이션) ② 풀 게시판(댓글·좋아요) ③ 드라이브+노션+URL 새 탭 ④ 데스크톱+모바일 동시.

## 1. 배경/문제
배우기 영역에 학습 자료를 모아둘 곳이 없음. 파일 자체를 DB/Blob에 올리면 용량·비용 부담 → **자료 실체는 구글드라이브/노션에 두고, 캠퍼스엔 게시판형 목록(메타데이터+링크)만** 둔다.

## 2. 목표/비목표
- G1. 배우기 섹션에 '자료실' 카드 추가 → 클릭 시 자료실 페이지.
- G2. 자료실 = 게시판형 목록(제목·설명·카테고리·외부링크·조회수·좋아요·댓글).
- G3. 자료 클릭 → 외부 링크 **새 탭**(`noopener,noreferrer`) + 조회수 +1.
- G4. 풀 게시판: 자료별 **좋아요·댓글**(댓글 좋아요 포함, 기존 게시판 패리티).
- G5. 등록/수정/삭제 = **관리자만**(권한 `resources`). 회원은 열람·좋아요·댓글.
- G6. **데스크톱 + 모바일(app/m/resources)** 동시.
- 비목표: 파일 업로드/스토리지(외부 링크로 대체). 익명 게시판화(자료실 댓글은 회원 표시명). 외부 콘텐츠 임베드(권한 이슈 → 새 탭 이동만). 회원의 자료 등록(이번 범위 아님).

## 3. 사용자 시나리오
- S1. 회원이 배우기 '자료실' 카드 클릭 → 목록(카테고리 필터) → 자료 클릭 → 새 탭으로 드라이브/노션 열림, 조회수 증가.
- S2. 회원이 자료에 좋아요·댓글, 댓글에 좋아요.
- S3. 관리자가 관리자 대시보드 '자료실' 탭에서 자료 등록(제목·설명·카테고리·링크) / 수정 / 삭제 / 상단고정.
- S4. 모바일 사용자가 `app/m` 홈/자료실에서 동일 열람·상호작용.

## 4. 기능 요구사항
- F1. **DB(M012, 멱등)**: `resources`(id·title·description·category·external_url·link_type·created_by·view_count·is_pinned·sort_order·created_at·updated_at), `resource_likes`(resource_id·user_id PK), `resource_comments`(id·resource_id·user_id·author_name·content·created_at), `resource_comment_likes`(comment_id·user_id PK). `schema.sql` 동기화.
- F2. **타입/라우팅**: `TabType`에 `'resources'`, `AdminTabType`에 `'resources'` 추가. `app/page.tsx` `VALID_TABS`·`renderTab`에 자료실. 모바일 `app/m/resources`.
- F3. **공개 API(회원, no-store)**: `GET /api/resources`(목록·카테고리 필터), `POST /api/resources/[id]/view`(조회수, 레이트리밋), `POST/DELETE /api/resources/[id]/like`, `GET/POST /api/resources/[id]/comments`, `DELETE /api/comments`류 대응(`/api/resources/comments/[id]` 삭제·`/like`). 기존 posts/comments 라우트 패턴 미러링.
- F4. **관리자 API**: `GET/POST /api/admin/resources`, `PATCH/DELETE /api/admin/resources/[id]`. master 또는 `resources` 권한 보유 admin만. 파라미터화 SQL.
- F5. **링크 처리**: 등록 시 `external_url`은 `https://`만 허용(검증). `link_type` 자동 판별(drive/notion/url)로 목록에 아이콘 표시. 렌더 시 `target="_blank" rel="noopener noreferrer"`.
- F6. **UI**: 데스크톱 `components/ResourcesPage.tsx`(목록·카테고리 탭·좋아요/댓글), 모바일 `app/m/resources/page.tsx`, 관리자 `components/AdminResources.tsx`(CRUD·고정·순서). 배우기 섹션 카드(`MainPage.tsx`) + 모바일 홈 카드.
- F7. **레이트리밋**: view·like·comment(세션 uid 또는 IP). **에러 통일**(catch→"서버 오류가 발생했습니다."). **PII**: 댓글 응답에 user_id 비노출(표시명만), 캐시 no-store.

## 5. UX/디자인
- 배우기 카드: 기존 'AI 학습 시작하기'(FeaturedCard) 옆/아래에 '자료실' 카드(아이콘=폴더/문서). ac-grid-2 레이아웃 유지.
- 목록: 카드/행에 제목·설명(2줄 말줄임)·카테고리 배지·링크유형 아이콘·조회수·좋아요·댓글수·등록일. 상단고정(is_pinned) 우선 정렬 → sort_order → 최신.
- 자료 클릭=외부 링크 새 탭(내부 상세 페이지 없음, 게시판 댓글/좋아요는 목록 내 펼침 또는 자료 카드 하단). 한글 인코딩 정상.

## 6. 엣지 케이스
| 케이스 | 동작 |
|---|---|
| external_url이 http/비URL | 등록 거부(https만), 기존 데이터 없음(신규) |
| 자료 삭제 시 | 연결 댓글·좋아요 CASCADE 정리 |
| 비로그인 접근 | 열람은 회원 전제(로그인 게이트) — 기존 탭과 동일 |
| 관리자 아님이 admin API 호출 | 403(권한 체크) |
| 카테고리 없음 | '전체'만 표시, 필터 비활성 |
| 모바일/데스크톱 데이터 | 동일 API 공유(패리티) |
| 댓글 작성자 표시 | author_name만, user_id 비노출 |
| Capacitor versionCode | 모바일 변경 동반 시 증가 |

## 7. 성공 기준
- [ ] 배우기 '자료실' 카드 → 자료실 목록 진입.
- [ ] 관리자 자료 등록/수정/삭제/고정, 회원 열람·좋아요·댓글·댓글좋아요 동작.
- [ ] 자료 클릭 시 외부 링크 새 탭 + 조회수 증가.
- [ ] 데스크톱·모바일(app/m) 동일 동작.
- [ ] 권한: 비관리자 admin API 차단, 공개 API 레이트리밋.
- [ ] M012 멱등 적용 + schema.sql 동기화.
- [ ] TypeScript 컴파일 에러 없음 + build 통과.

## 8. 미해결/후속
- 카테고리 = 자유 텍스트 vs 고정 셋? → MVP는 자유 텍스트(관리자 입력), 추후 정규화 가능.
- 외부 링크 도메인 화이트리스트(드라이브/노션만)는 보류(관리자만 등록이라 위험 낮음, URL 자유 허용). 회원 등록 확장 시 재검토.
- 정렬/검색 고도화는 후속(이번엔 카테고리 필터 + 고정/최신 정렬).

## 보안/영향
- 신규 admin API에 master/`resources` 권한 + 레이트리밋. 외부 링크는 `noopener noreferrer` + https 검증(오픈리다이렉트/탭내빙 방지). 댓글 PII 비노출. M012 멱등·하위호환. 모바일 패리티(versionCode↑). 한글 인코딩 가드.
