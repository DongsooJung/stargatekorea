# stargatekorea.net 워드프레스 전환 키트 (B → A)

지금은 GitHub Pages 정적 사이트(B안)로 운영합니다. 호스팅어 호스팅 결제 후 이 순서대로 하면 **URL·글·카테고리를 그대로 유지한 채** 워드프레스(A안)로 넘어갑니다.

## 키트 구성

| 파일 | 용도 |
|---|---|
| `wordpress-import.xml` | 모든 글·페이지·카테고리·태그를 담은 워드프레스 가져오기 파일 (WXR 1.2). 글을 추가할 때마다 `node export-wordpress.mjs`로 다시 생성 |
| `wp-setup.sh` | WP-CLI 일괄 설정 스크립트 (퍼머링크, 시간대, 플러그인, 테마, 가져오기, 메뉴) |
| `additional.css` | 현재 사이트 색상·폰트 토큰을 워드프레스(Kadence 테마)에 옮기는 CSS |

## 왜 바로 넘어갈 수 있는가

- 정적 사이트의 주소 규칙을 처음부터 워드프레스 기본값과 같게 만들었습니다.
  - 글: `/글-슬러그/` = 워드프레스 `/%postname%/`
  - 카테고리: `/category/슬러그/` = 워드프레스 기본 카테고리 주소
  - 페이지: `/about/`, `/contact/`, `/privacy-policy/`, `/campus-trips/`
- 그래서 전환 후에도 구글 색인과 외부 링크가 깨지지 않습니다.

## 전환 절차 (약 1시간)

### 1단계 — 호스팅 결제와 워드프레스 설치
1. hPanel → 호스팅 구매 → **Premium** 이상 결제 (동수 님 직접)
2. 웹사이트 → 추가 → WordPress → 기존 도메인 `stargatekorea.net` 선택
3. 관리자 이메일 `ceo@stargateedu.co.kr`, 언어 English, 사이트 제목 `Stargate Korea`

### 2단계 — 설치 직후 임시 주소로 세팅 (DNS 바꾸기 전)
호스팅어가 주는 임시 도메인(미리보기 주소)에서 작업하면 **현재 사이트가 계속 열려 있는 상태로** 준비할 수 있습니다.

- SSH 사용 시: hPanel → 고급 → SSH 접속 → `public_html`에 `wordpress-import.xml`, `wp-setup.sh` 업로드 → `bash wp-setup.sh`
- SSH 없이: 아래를 관리자 화면에서 수동으로
  1. 설정 → 고유주소 → **글 이름** (`/%postname%/`)
  2. 설정 → 일반 → 시간대 **서울**
  3. 플러그인 설치: WordPress Importer, Rank Math SEO, LiteSpeed Cache, Contact Form 7, WPCode, Site Kit by Google
  4. 도구 → 가져오기 → WordPress → `wordpress-import.xml` 업로드 → 작성자를 기존 관리자에게 할당
  5. 외모 → 테마 → **Kadence** 설치 → 사용자 정의 → 추가 CSS에 `additional.css` 붙여넣기
  6. 외모 → 메뉴: Main(Study·Living·Travel·Culture·Campus Trips·About), Footer(About·Contact·Privacy Policy)

### 3단계 — 리디렉션 (Rank Math → 리디렉션)
| 기존 주소 | 새 주소 | 이유 |
|---|---|---|
| `/feed.xml` | `/feed/` | 정적 사이트 RSS 주소 유지 |
| `/sitemap.xml` | `/sitemap_index.xml` | 구글 서치콘솔에 등록한 사이트맵 유지 |

### 4단계 — DNS 전환 (마지막에)
hPanel → 도메인 → stargatekorea.net → DNS / 네임서버

| 지금 (GitHub Pages) | 전환 후 (호스팅어) |
|---|---|
| A `@` → 185.199.108.153 / 109 / 110 / 111 | A `@` → 호스팅어가 안내하는 서버 IP (GitHub A 레코드 4개 삭제) |
| CNAME `www` → dongsoojung.github.io | CNAME `www` → `stargatekorea.net` |

- 전환 후 hPanel → 보안 → SSL에서 무료 SSL 설치 확인
- GitHub 저장소 Settings → Pages의 Custom domain을 비워 두면 이중 서비스가 끝납니다(저장소는 백업으로 남겨 둠).

### 5단계 — 수익화 설정
1. 애드센스 승인 후 WPCode → 헤더에 애드센스 코드, `ads.txt`는 Rank Math 또는 WPCode로 생성
2. Site Kit으로 서치콘솔·애널리틱스 연결
3. Contact Form 7로 Campus Trips 문의 폼을 `/campus-trips/`에 추가

## 전환 전까지 글 쓰는 법 (B안)

1. `content/posts/`에 마크다운 파일 추가 (맨 위 front matter: title, slug, date, category, tags, excerpt)
2. GitHub에 push → Actions가 자동으로 빌드·배포
3. 전환 직전에 `node export-wordpress.mjs` 실행 → 최신 `wordpress-import.xml` 생성

카테고리 슬러그: `study-in-korea`, `living-in-korea`, `travel-korea`, `korean-culture`, `books`

## 애드센스·광고 슬롯 (B안에서도 가능)

- `site.config.mjs`의 `adsenseClient`에 `ca-pub-…`를 넣으면 모든 페이지에 광고 스크립트와 `ads.txt`가 자동 생성됩니다.
- 글 본문 위·아래에 `<!-- ad-slot -->` 자리가 마련되어 있습니다.
