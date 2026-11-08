# 행사레이더 업무계획 수집 서버

광주·전남 행사레이더에서 사용하는 광주·전남 29개 기관의 공식 업무계획 문서 수집 서버임.
기존 `jerom1213-sudo/flag` 저장소의 `fix/seogu-plan-collector-20261007` 브랜치 `collector/` 코드를 이 저장소로 옮긴 구성임.

## 구성

- `collector/server.mjs`: 공식 PDF 수집 및 서버 간 인증 처리임.
- `collector/package.json`: 실행·문법 검사 명령 정의임.
- `collector/README.md`: 기능과 제한사항 안내임.
- `render.yaml`: Render 배포 설정임. 서비스 루트는 `collector` 디렉터리임.

## 실행

Node.js 22 이상 환경에서 `collector` 디렉터리로 이동한 후 `npm run check`, `npm start` 순서로 실행함.
`COLLECTOR_TOKEN`은 24자 이상의 비밀값을 환경변수로 설정해야 함. 실제 토큰을 저장소에 기록하지 않음.

## Render 및 행사레이더 연결

`render.yaml`을 기준으로 배포한 후 수집 서버의 `COLLECTOR_TOKEN`과 행사레이더의 `PLAN_COLLECTOR_TOKEN`을 동일하게 설정함.
행사레이더의 `PLAN_COLLECTOR_URL`에는 배포된 서비스 주소를 설정함.
`GET /health`의 정상 응답은 서버 실행 확인이며, 실제 서구청 PDF 다운로드와 행사 분석 성공 여부는 별도 확인 대상임.

이 저장소는 수집 서버이며 행사레이더 화면 전체의 복사본은 아님. 기관별 공식 HTTPS 도메인에서 PDF·HWP·HWPX·XLSX 문서를 수집함. 원본 저장 및 저장자료 검색은 연결된 행사레이더 서버가 담당함.

