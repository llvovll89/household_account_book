# 잔고플랜 검색 노출 운영

대표 서비스 주소는 `https://balance-plan.vercel.app/`입니다.

## 구현된 공개 페이지

- `/`: 가계부 앱과 공개 소개 링크. 개인 앱 영역에는 `data-nosnippet`을 적용합니다.
- `/about/`: 기능, 사용 환경, 로그인 전후 저장 방식 설명.
- `/guide/`: 거래 입력, 검색, 예산, 카드·구독, 홈 화면 추가, 기록 보관 안내.
- `/sitemap.xml`: 위 공개 URL만 포함. 생성 시각을 실제 수정일처럼 기록하지 않습니다.
- `/robots.txt`: 공개 문서와 JavaScript·CSS를 크롤링할 수 있도록 허용합니다.

소개와 사용법은 빌드 시 HTML로 생성되므로 JavaScript 실행 없이 본문을 읽을 수 있습니다. 페이지별 제목·설명·canonical·Open Graph·Twitter 정보를 생성하고 WebSite, WebPage, WebApplication 구조화 데이터를 제공합니다. 존재하지 않는 평가나 리뷰는 추가하지 않습니다. 구조화 데이터는 검색 순위나 리치 결과 노출을 보장하지 않습니다.

`data-nosnippet`은 검색 요약 제한이며 접근 통제나 데이터 보안 기능이 아닙니다. 개인 기록 접근은 기존 로컬 저장 및 Firebase 인증·권한 체계를 따릅니다. 공개 HTML에는 실제 거래 내역을 넣지 않습니다.

## 배포 설정

- `SITE_URL`: 대표 주소를 변경할 때만 HTTPS origin을 지정합니다. 경로·쿼리·계정 정보는 허용하지 않습니다. 기본값은 위 대표 주소입니다.
- `GOOGLE_SITE_VERIFICATION`: Search Console이 발급한 HTML 태그의 `content` 값만 지정하면 빌드한 HTML에 삽입합니다. 임의 토큰을 만들지 않습니다.
- `.env.local`과 Vercel 환경변수를 지원합니다. 환경변수 변경 후 재배포가 필요합니다.
- `VERCEL_ENV=preview`에서는 HTML에 `noindex, follow`를 설정하고 robots.txt에서 사이트맵 링크를 생략합니다.
- 대표 도메인은 로그인 없이 접근할 수 있어야 합니다. Vercel 배포 보호·플랫폼 헤더가 검색을 차단하지 않는지 확인합니다.

## 소유자가 해야 할 Search Console 설정

1. Google Search Console에서 `https://balance-plan.vercel.app/` URL 접두어 속성을 추가합니다.
2. HTML 태그 방식의 인증 값을 `GOOGLE_SITE_VERIFICATION` 환경변수로 등록하고 재배포한 뒤 소유권 확인을 완료합니다. 이미 소유권을 확인했다면 반복하지 않습니다.
3. 사이트맵 메뉴에서 `https://balance-plan.vercel.app/sitemap.xml`을 제출합니다.
4. URL 검사에서 `/`, `/about/`, `/guide/`를 확인하고 필요하면 색인 생성을 요청합니다.
5. 페이지 색인 생성 보고서와 실적 보고서에서 노출·클릭·검색어를 확인합니다. 색인 및 순위 반영에는 시간이 걸리며 보장되지 않습니다.

Search Console 소유권 확인과 사이트맵 제출은 계정 권한이 필요하며 코드 배포만으로 자동 완료되지 않습니다.

## 유지 관리

실제 기능이 바뀌면 `seo/`의 안내도 수정합니다. 동일 문구를 늘린 키워드 페이지를 만들기보다 실제 사용자가 필요한 설명을 보강합니다. 새 공개 페이지를 만들 때는 `build/seo.ts`의 페이지 목록과 내부 링크를 함께 갱신합니다. `npm run verify`로 메타데이터, 구조화 데이터, 사이트맵 및 앱 동작을 검증합니다.
