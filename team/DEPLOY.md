# 배포 가이드 — Docker + AWS EC2

할래말래를 **https 주소로 누구나 접속할 수 있게** 만드는 순서입니다. 처음 해 보는 사람이 위에서부터 그대로 따라 하면 끝나도록 썼습니다.

- **담당:** 박지호 (B). 다른 팀원도 이 문서만 보고 다시 올릴 수 있어야 합니다.
- **계획 · 이유:** [STATUS.md](STATUS.md) 6장 — 왜 AWS + Docker 인지, 언제 무엇을 하는지
- **참고한 실제 사례:** 7조가 같은 조건(Express · JSON 파일 저장 · 자동 배포 금지)으로 배포한 [docs/deploy.md](https://github.com/cjs1004ounds/oss-teamproject/blob/main/docs/deploy.md)

> **주의 — 아직 아무도 이 순서대로 실제로 올려 보지 않았습니다.** 명령과 파일은 지금 `main` 의 코드(`server.js` · `store.js` · `package.json` · `.env.example`)에 맞춰 썼지만, 1장의 `Dockerfile` 도 아직 빌드해 보지 않았습니다. 따라 하다가 다른 점을 찾으면 **이 문서를 고쳐 주세요.** AWS 화면의 메뉴 이름은 바뀔 수 있어서 "무엇을 만드는지" 위주로 적었습니다.

---

## 0. 먼저 읽기

### 다 하고 나면 이렇게 됩니다

```
평가자 · 팀원의 브라우저
        │  https://우리주소.duckdns.org
        ▼
  ┌──────────────────────── AWS EC2 서버 한 대 (Ubuntu) ────────────────────────┐
  │                                                                            │
  │   nginx (80 · 443 번)  ── https 인증서 처리, 받은 요청을 안으로 넘김            │
  │        │                                                                   │
  │        ▼  127.0.0.1:3000 (서버 안에서만 닿음)                                │
  │   Docker 컨테이너 "3oss-app"  ── 우리 Express 서버 (메모리 512MB 제한)        │
  │        │                                                                   │
  │        ▼  /data                                                            │
  │   Docker 볼륨 "3oss-data"  ── db.json (팀원 · 작업). 컨테이너를 지워도 남음   │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘
        ▲
        │ 관리자 접속: AWS 콘솔의 Session Manager (SSH 포트를 열지 않음)
     박지호
```

### 용어 — 이것만 알면 됩니다

| 말 | 뜻 |
|---|---|
| **EC2** | AWS 가 빌려주는 리눅스 컴퓨터 한 대 |
| **Docker 이미지** | 우리 앱과 Node 를 한 상자에 담아 둔 것. `Dockerfile` 로 만듦 |
| **컨테이너** | 이미지를 실제로 켠 것. 지우고 다시 만들어도 이미지만 있으면 똑같이 뜸 |
| **볼륨** | 컨테이너 밖에 있는 저장 공간. **컨테이너를 지워도 남음** — 그래서 `db.json` 은 여기에 둠 |
| **nginx** | 바깥 요청을 받아 컨테이너로 넘겨 주는 문지기. https 도 여기서 처리 |
| **DuckDNS** | 무료로 `이름.duckdns.org` 주소를 주는 곳 |
| **Session Manager** | AWS 웹 콘솔에서 서버 터미널을 여는 기능. 비밀 키 파일이나 22번 포트가 필요 없음 |

### 준비물

- AWS 계정 (카드 등록 필요 — 누구 명의로 할지 팀 합의 항목)
- GitHub 계정 (DuckDNS 로그인용)
- 내 컴퓨터에 Docker Desktop (2장에서 설치)
- Gemini API 키 (김권섭이 가진 것, 단톡방이 아니라 **직접** 전달받기)

### 걸리는 시간 (처음 해 보는 사람 기준)

| 장 | 내용 | 시간 |
|---|---|---|
| 1 ~ 2 | 코드 준비, 내 컴퓨터에서 Docker 확인 | 1 ~ 2시간 |
| 3 ~ 8 | AWS 계정 · 서버 만들기 · 앱 실행 | 2 ~ 3시간 |
| 9 ~ 10 | 주소 · https | 1시간 |
| 11 ~ 12 | 업데이트 · 백업 설정 | 30분 |

### 규칙 — 꼭 지키기

- **자동 배포 서비스를 쓰지 않습니다** (Vercel · Render · Railway 등, 수업 규칙). 서버에 직접 접속해서 손으로 올립니다
- **`.env` 와 `data/` 는 저장소에도, Docker 이미지에도 넣지 않습니다**
- **컨테이너는 항상 볼륨을 붙여서 실행합니다.** 빼먹으면 겉으로는 잘 돌다가 다시 만들 때 데이터가 사라집니다

---

## 1. 코드 준비 (내 컴퓨터, 한 번만)

브랜치를 하나 따서 PR 로 올립니다. 예: `jiho/docker`

```bash
git switch main
```

```bash
git pull origin main
```

```bash
git switch -c jiho/docker
```

### 1-1. 저장 위치를 바꿀 수 있게 — `src/lib/store.js`

지금은 `data/db.json` 이 코드 폴더 안에 고정돼 있습니다. 컨테이너에서는 이 파일을 **볼륨(`/data`)** 에 써야 하므로, 환경 변수 `DATA_DIR` 이 있으면 그 폴더를 쓰게 바꿉니다.

**지금**

```js
const dbPath = fileURLToPath(
    new URL('../../data/db.json', import.meta.url)
);
```

**바꾼 뒤**

```js
// DATA_DIR 이 있으면 그 폴더(Docker 에서는 볼륨 /data), 없으면 지금처럼 프로젝트의 data/
// || 를 쓰는 이유: .env 에 "DATA_DIR=" 처럼 빈 값이 있어도 기본 폴더로 가게
const dataDir = process.env.DATA_DIR || fileURLToPath(new URL('../../data', import.meta.url));
const dbPath = join(dataDir, 'db.json');
```

그리고 맨 위 `import { dirname } from 'node:path';` 를 다음으로 바꿉니다.

```js
import { dirname, join } from 'node:path';
```

- 내 컴퓨터에서는 `DATA_DIR` 을 안 넣으므로 **지금과 똑같이** 동작합니다
- `npm test` 가 그대로 통과하는지 확인합니다

### 1-2. `Dockerfile` (프로젝트 맨 위 폴더에 새 파일)

```dockerfile
# 할래말래 서버 이미지
# 만들기: docker build -t 3oss .
# 실행 방법: team/DEPLOY.md

# 개발과 같은 Node 22 (package.json 의 engines: >=22.9). alpine 은 크기가 작은 리눅스
FROM node:22-alpine

# alpine 에는 시간대 정보가 없어서 TZ=Asia/Seoul 이 먹지 않는다 — 주차별 수행률이 한국 날짜로 계산되게
RUN apk add --no-cache tzdata

WORKDIR /app

# 운영 모드 (Express 가 오류 내용을 응답에 덜 싣는다)
ENV NODE_ENV=production

# 패키지 목록만 먼저 복사해서 설치 — 코드만 바뀌었을 때 이 단계를 다시 하지 않아 빌드가 빠르다
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 실행에 필요한 것만 복사. 테스트 · 문서 · .env · data/ 는 넣지 않는다
COPY server.js ./
COPY src ./src
COPY public ./public

# 데이터는 /data 에 쓴다. 여기에 볼륨을 붙이면 컨테이너를 새로 만들어도 남는다
RUN mkdir -p /data && chown node:node /data
ENV DATA_DIR=/data
ENV PORT=3000
ENV TZ=Asia/Seoul

# 관리자(root)가 아닌 사용자로 실행
USER node

EXPOSE 3000

# 30초마다 첫 화면을 불러 서버가 살아 있는지 확인 (docker ps 에 healthy 로 보임)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3000/ >/dev/null || exit 1

# npm start 는 .env 파일을 직접 읽지만, Docker 에서는 --env-file 로 넘기므로 node 로 바로 실행
CMD ["node", "server.js"]
```

> 입장 코드의 체험 방(`seed/demo.json`)이 생기면 `COPY seed ./seed` 한 줄을 `COPY public` 아래에 추가합니다.

### 1-3. `.dockerignore` (맨 위 폴더에 새 파일)

이미지를 만들 때 **보내지 않을** 파일입니다. 특히 `.env`(API 키)와 `data/`(실제 데이터)가 이미지에 들어가지 않게 합니다.

```
node_modules
data
.env
.env.*
!.env.example
.git
.github
.claude
tmp
test
team
*.md
*.pdf
```

### 1-4. 커밋 · PR

- 커밋을 나눕니다: `Refactor: 저장 폴더를 DATA_DIR 로 바꿀 수 있게` → `Chore: Dockerfile 과 .dockerignore 추가`
- 입장 코드 뼈대도 `store.js` 를 고치므로 **이 PR 을 먼저 병합**하고 뼈대를 그 위에서 시작합니다

---

## 2. 내 컴퓨터에서 Docker 로 먼저 확인

서버에 올리기 전에 내 컴퓨터에서 똑같이 띄워 봅니다. 여기서 되면 서버에서도 됩니다.

### 2-1. Docker Desktop 설치 (Windows)

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) 을 받아 설치 — 설치 중 **WSL 2 사용**을 고름
2. 재부팅 뒤 Docker Desktop 을 켜 두고, 터미널에서 확인

```bash
docker --version
```

`Docker version ...` 이 나오면 됩니다.

### 2-2. 이미지 만들기

프로젝트 맨 위 폴더에서:

```bash
docker build -t 3oss .
```

마지막에 `naming to docker.io/library/3oss` 비슷한 줄이 나오면 성공입니다.

### 2-3. 실행

> **Windows 의 Git Bash 에서는** `/data` 가 `C:/Program Files/Git/data` 같은 윈도우 경로로 바뀌어 오류가 납니다. **PowerShell 에서 실행**하거나, Git Bash 라면 명령 앞에 `MSYS_NO_PATHCONV=1 ` 을 붙입니다.

```bash
docker run -d --name 3oss-app --init -p 3080:3000 --memory 512m --env-file .env -v 3oss-data:/data 3oss
```

| 옵션 | 하는 일 |
|---|---|
| `-d` | 뒤에서 실행 (터미널을 닫아도 계속 돎) |
| `--name 3oss-app` | 컨테이너 이름 |
| `--init` | 멈추라는 신호를 Node 에 잘 전달 → `docker stop` 이 바로 끝남 |
| `-p 3080:3000` | 내 컴퓨터 3080 번 → 컨테이너 3000 번 (내 컴퓨터의 `npm start` 와 안 겹치게) |
| `--memory 512m` | 수업 조건 512MB 안에서 도는지 확인 |
| `--env-file .env` | API 키를 이미지에 넣지 않고 실행할 때 넘김 |
| `-v 3oss-data:/data` | **볼륨 연결.** 컨테이너를 지워도 데이터가 남음 |

`.env` 에 `DATA_DIR=` 줄은 **넣지 않습니다** (이미지에 정해 둔 `/data` 를 덮어쓸 수 있음).

### 2-4. 확인

1. 브라우저로 `http://localhost:3080` → 할래말래 홈이 뜸
2. 팀원 하나, 작업 하나를 등록
3. 컨테이너를 **지우고 다시 만들어도** 데이터가 남는지 확인

```bash
docker rm -f 3oss-app
```

```bash
docker run -d --name 3oss-app --init -p 3080:3000 --memory 512m --env-file .env -v 3oss-data:/data 3oss
```

다시 `http://localhost:3080` 을 열어 방금 넣은 팀원 · 작업이 그대로면 **성공**입니다.

4. 로그 보기 (문제가 있을 때)

```bash
docker logs 3oss-app
```

5. 다 봤으면 정리

```bash
docker rm -f 3oss-app
```

---

## 3. AWS 계정과 비용 안전장치

### 3-1. 가입

1. [aws.amazon.com](https://aws.amazon.com/) → 계정 만들기. 카드와 휴대폰 인증이 필요합니다
2. **무료 조건을 공식 페이지에서 확인합니다** (2026년 기준 신규 계정은 크레딧 · 무료 플랜 방식 — 기간과 금액을 메모해 두기)
3. 오른쪽 위 지역(리전)을 **아시아 태평양(서울) `ap-northeast-2`** 로 바꿉니다. 이후 모든 작업은 서울에서

### 3-2. 루트 계정 보호

- 계정 메뉴 → 보안 자격 증명 → **MFA(2단계 인증)** 를 켭니다
- 비밀번호는 팀원과 공유하지 않습니다

### 3-3. 예산 알림 (꼭)

1. 검색창에 **Budgets** → 예산 만들기
2. 템플릿 **"제로 지출 예산(Zero spend budget)"** 을 고르고, 알림 받을 이메일 입력
3. 1센트라도 청구되면 메일이 옵니다 → 바로 단톡방에 알리기

> 공인 IP 주소(4-4)에는 시간당 소액 요금이 붙을 수 있습니다. 크레딧에서 빠지는지 예산 알림으로 확인합니다.

---

## 4. 서버(EC2) 만들기

### 4-1. Session Manager 용 역할 만들기 (서버에 접속하는 열쇠)

1. 검색창에 **IAM** → 역할 → 역할 만들기
2. 신뢰할 대상: **AWS 서비스 → EC2**
3. 권한: **`AmazonSSMManagedInstanceCore`** 하나만 체크
4. 이름: `3oss-ec2-role` → 만들기

### 4-2. 인스턴스 시작

검색창에 **EC2** → 인스턴스 시작

| 항목 | 고를 것 |
|---|---|
| 이름 | `3oss-server` |
| OS 이미지 | **Ubuntu Server 24.04 LTS** (64비트 x86) |
| 인스턴스 유형 | **t3.micro** (또는 "프리 티어 사용 가능" 표시가 있는 것) |
| 키 페어 | **키 페어 없이 진행** — Session Manager 로 접속하므로 필요 없음 |
| 네트워크 설정 → 보안 그룹 | 새로 만들기, 이름 `3oss-web`. **SSH 체크 해제**, **HTTP(80) · HTTPS(443) 만 "어디서나(0.0.0.0/0)"** |
| 스토리지 | 20 GiB gp3 (무료 범위 안에서) |
| 고급 세부 정보 → IAM 인스턴스 프로파일 | **`3oss-ec2-role`** |

→ 인스턴스 시작. 상태가 **실행 중**, 상태 검사가 **2/2 통과**가 될 때까지 몇 분 기다립니다.

### 4-3. 보안 그룹 확인 — 가장 흔한 실수

나중에 "서버는 켜졌는데 접속이 안 돼요" 의 대부분이 여기입니다. 인스턴스 → 보안 탭에서 **인바운드 규칙**이 이렇게만 있어야 합니다.

| 유형 | 포트 | 소스 |
|---|---|---|
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |

**3000 번은 열지 않습니다.** 컨테이너는 서버 안에서만 닿고, 바깥 요청은 nginx 가 받아 넘깁니다. **22 번(SSH)도 열지 않습니다.**

### 4-4. 고정 공인 IP (탄력적 IP)

서버를 껐다 켜면 공인 IP 가 바뀌어 주소가 끊기므로 고정합니다.

1. EC2 → 네트워크 및 보안 → **탄력적 IP** → 할당
2. 할당된 IP 선택 → 작업 → **연결** → 인스턴스 `3oss-server`
3. 이 IP 를 메모해 둡니다 (9장에서 씀)

---

## 5. 서버에 접속하기 (Session Manager)

1. EC2 → 인스턴스 → `3oss-server` 선택 → **연결**
2. **Session Manager** 탭 → 연결

> "연결" 버튼이 비활성이면: 서버를 만든 지 몇 분 안 됐거나, 4-2 에서 IAM 역할을 빼먹은 것입니다. 역할을 빼먹었다면 인스턴스 → 작업 → 보안 → **IAM 역할 수정**에서 `3oss-ec2-role` 을 붙이고 5분쯤 뒤 다시 시도합니다.

3. 검은 터미널이 열리면 처음에 한 번 사용자를 바꿉니다

```bash
sudo -iu ubuntu
```

이후 이 문서의 서버 명령은 전부 이 터미널에서 실행합니다.

---

## 6. 서버에 Docker · git 설치 (한 번만)

```bash
sudo apt update && sudo apt upgrade -y
```

```bash
sudo apt install -y docker.io git
```

```bash
sudo usermod -aG docker ubuntu
```

`usermod` 는 `sudo` 없이 `docker` 를 쓰게 하는 설정입니다. **적용하려면 한 번 나갔다 들어옵니다.**

```bash
exit
```

```bash
sudo -iu ubuntu
```

확인:

```bash
docker --version
```

---

## 7. 코드 받기와 `.env` 만들기

### 7-1. 저장소 받기

저장소가 공개라 로그인 없이 받을 수 있습니다.

```bash
git clone https://github.com/Heetaeeee/3oss.git
```

```bash
cd ~/3oss
```

### 7-2. `.env` 만들기

```bash
cp .env.example .env
```

```bash
nano .env
```

다음처럼 채웁니다. 키는 직접 전달받은 값으로.

```
PORT=3000
GEMINI_API_KEY=여기에_키
GEMINI_MODEL=
TZ=Asia/Seoul
```

- 저장: `Ctrl + O` → `Enter`, 나가기: `Ctrl + X`
- `DATA_DIR` 줄은 넣지 않습니다
- 다른 사람이 못 읽게:

```bash
chmod 600 .env
```

---

## 8. 이미지 만들고 실행

```bash
cd ~/3oss
```

```bash
docker build -t 3oss .
```

```bash
docker run -d --name 3oss-app --init --restart unless-stopped -p 127.0.0.1:3000:3000 --memory 512m --env-file .env -v 3oss-data:/data 3oss
```

2장과 다른 점 두 가지:

| 옵션 | 왜 |
|---|---|
| `--restart unless-stopped` | 서버가 재부팅되거나 앱이 죽어도 자동으로 다시 뜸 |
| `-p 127.0.0.1:3000:3000` | **서버 자신만** 3000 번으로 닿게. 바깥은 nginx 를 거쳐야 함 |

확인:

```bash
docker ps
```

`3oss-app` 이 `Up ... (healthy)` 이면 됩니다 (healthy 는 30초쯤 뒤에 붙음).

```bash
curl -s http://127.0.0.1:3000/ | head -5
```

HTML 몇 줄(`<!doctype html>` …)이 보이면 앱이 살아 있습니다.

---

## 9. 주소 만들기 (DuckDNS)

1. [duckdns.org](https://www.duckdns.org/) → GitHub 로 로그인
2. sub domain 칸에 원하는 이름 (예: `hallaemallae`) → **add domain**
3. 생긴 줄의 **current ip** 칸에 4-4 의 **탄력적 IP** 를 넣고 **update ip**
4. 1 ~ 2분 뒤 서버 터미널에서 확인

```bash
getent hosts hallaemallae.duckdns.org
```

탄력적 IP 가 나오면 됩니다. 아래에서 `hallaemallae` 는 정한 이름으로 바꿔 쓰세요.

> 탄력적 IP 는 바뀌지 않으므로 DuckDNS 자동 갱신 스크립트는 필요 없습니다.

---

## 10. nginx 와 https

### 10-1. nginx 설치

```bash
sudo apt install -y nginx
```

### 10-2. 우리 사이트 설정

```bash
sudo nano /etc/nginx/sites-available/3oss
```

아래를 붙여 넣습니다 (`server_name` 은 정한 주소로).

```nginx
server {
    listen 80;
    server_name hallaemallae.duckdns.org;

    # 요청 본문 상한. 앱은 10KB 까지 받으므로 넉넉히
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # AI 세분화는 최대 15초 기다리므로 넉넉히
        proxy_read_timeout 30s;
    }
}
```

켜기 (기본 사이트는 끄고 우리 것만):

```bash
sudo ln -s /etc/nginx/sites-available/3oss /etc/nginx/sites-enabled/3oss
```

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

```bash
sudo nginx -t
```

`syntax is ok` · `test is successful` 이 나오면:

```bash
sudo systemctl reload nginx
```

이제 브라우저로 `http://hallaemallae.duckdns.org` 가 열려야 합니다 (아직 https 아님).

### 10-3. https 인증서 (Let's Encrypt, 무료)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

```bash
sudo certbot --nginx -d hallaemallae.duckdns.org
```

- 이메일 입력 → 약관 동의(`Y`) → 홍보 메일은 `N`
- 끝나면 certbot 이 nginx 설정에 443 과 "http → https 넘기기"를 알아서 넣습니다

자동 갱신이 되는지 시험:

```bash
sudo certbot renew --dry-run
```

`Congratulations, all simulated renewals succeeded` 가 나오면 됩니다.

**`https://hallaemallae.duckdns.org` 가 자물쇠와 함께 열리면 배포 완료입니다.** README 와 [STATUS.md](STATUS.md) 맨 위에 주소를 적습니다.

---

## 11. 업데이트 — `main` 에 병합될 때마다 (수동 배포)

자동 배포는 쓰지 않으므로, PR 이 `main` 에 병합되면 B 가 서버에 들어가 손으로 올립니다. 5장대로 접속한 뒤:

```bash
cd ~/3oss
```

```bash
git pull origin main
```

```bash
docker build -t 3oss .
```

```bash
docker rm -f 3oss-app
```

```bash
docker run -d --name 3oss-app --init --restart unless-stopped -p 127.0.0.1:3000:3000 --memory 512m --env-file .env -v 3oss-data:/data 3oss
```

- `docker rm -f` 는 **컨테이너만** 지웁니다. 데이터는 볼륨에 있어 남습니다
- 컨테이너를 지운 순간부터 새로 뜰 때까지 몇 초 접속이 끊깁니다
- 올린 뒤 브라우저로 주소를 열어 확인하고, 단톡방에 "몇 시에 어느 PR 까지 올림" 을 남깁니다

> 쌓인 옛 이미지 정리 (가끔): `docker image prune -f`

---

## 12. 백업 — 하루 한 번 `db.json` 복사

볼륨이 있어도 실수로 지우거나 데이터가 깨질 수 있으니 날짜별로 복사해 둡니다.

```bash
mkdir -p ~/backups
```

```bash
crontab -e
```

(처음이면 편집기를 고르라고 함 → `1` nano) 맨 아래에 두 줄을 붙여 넣고 저장합니다.

```
0 4 * * * docker cp 3oss-app:/data/db.json /home/ubuntu/backups/db-$(date +\%F).json
10 4 * * * find /home/ubuntu/backups -name 'db-*.json' -mtime +14 -delete
```

- 매일 새벽 4시에 복사, 14일 지난 것은 지움
- `%` 앞의 `\` 는 crontab 에서 꼭 필요합니다

**되돌리기** (데이터가 깨졌을 때):

```bash
docker cp /home/ubuntu/backups/db-2026-11-30.json 3oss-app:/data/db.json
```

```bash
docker restart 3oss-app
```

---

## 13. 다 했는지 확인

- [ ] `https://…duckdns.org` 가 자물쇠와 함께 열린다 (휴대폰 데이터로도)
- [ ] 팀원 · 작업을 넣고 **11장 업데이트를 한 번 해도** 그대로 남아 있다
- [ ] `sudo reboot` 로 서버를 재부팅해도 몇 분 뒤 다시 열린다
- [ ] `http://` 로 들어가면 `https://` 로 넘어간다
- [ ] AI 로 나누기가 동작한다 (키를 넣었으므로 `AI 제안` 이 와야 함. 느리면 15초 뒤 직접 입력)
- [ ] 바깥에서 `http://탄력적IP:3000` 은 **열리지 않는다** (3000 번이 닫혀 있다는 뜻)
- [ ] 예산 알림 메일 주소가 맞다
- [ ] 다음 날 `~/backups` 에 파일이 하나 생겼다
- [ ] README 에 배포 주소를 적었다

---

## 14. 막혔을 때

| 증상 | 원인 | 해결 |
|---|---|---|
| 브라우저에서 주소가 계속 로딩만 됨 | 보안 그룹에 80 · 443 이 없음 | 4-3 확인 |
| `502 Bad Gateway` | nginx 는 살아 있는데 컨테이너가 죽음 | `docker ps -a` 로 상태, `docker logs 3oss-app` 로 오류 확인 |
| 컨테이너가 바로 꺼짐 (`Exited`) | `.env` 가 없거나 잘못됨, 저장 데이터가 깨짐 | `docker logs 3oss-app`. 데이터 문제면 12장 되돌리기 |
| `permission denied ... /data` | `.env` 에 `DATA_DIR=` 가 들어 있음 | `.env` 에서 그 줄을 지우고 컨테이너 다시 만들기 |
| 컨테이너를 다시 만들었더니 데이터가 사라짐 | `-v 3oss-data:/data` 를 빼먹음 | 항상 11장 명령을 그대로 복사. 백업에서 되돌리기 |
| `docker: permission denied` | 6장의 `usermod` 뒤 다시 접속을 안 함 | `exit` → `sudo -iu ubuntu` |
| Session Manager "연결" 이 회색 | IAM 역할이 없음 · 만든 지 얼마 안 됨 | 5장 상자 참고 |
| certbot 이 실패 | DuckDNS IP 가 틀림 · 80 번이 닫힘 | 9장 `getent hosts` 로 IP 확인, 4-3 확인 |
| 주차별 수행률 날짜가 하루 어긋남 | 시간대가 UTC | `docker exec 3oss-app date` 가 KST 인지. 아니면 `Dockerfile` 의 `tzdata` · `TZ` 확인 |
| AI 로 나누기가 늘 직접 입력으로 감 | 키가 비었거나 틀림, 무료 한도 초과 | `docker logs 3oss-app` 에 `LLM 호출 실패: HTTP …` 가 있는지 (키는 로그에 안 찍힘) |
| Windows 에서 `docker run` 이 경로 오류 | Git Bash 가 `/data` 를 바꿈 | PowerShell 에서 실행, 또는 `MSYS_NO_PATHCONV=1` |

---

## 15. 하지 않는 것

- GitHub 에 연결해 자동으로 올리는 서비스 · GitHub Actions 로 배포 (수업 규칙. Actions 는 테스트에만)
- 3000 번 · 22 번 포트를 바깥에 열기
- `.env` · `data/` · API 키를 커밋하거나 단톡방에 올리기
- `docker volume rm 3oss-data` — **모든 데이터가 지워집니다**
- 루트 계정 비밀번호 공유

---

## 16. 입장 코드(R1)가 켜진 뒤 달라지는 것

- 체험 방 처음 상태 파일이 생기면 `Dockerfile` 에 `COPY seed ./seed` 추가 (1-2)
- 입장 코드 스위치는 환경 변수로 켭니다 — `.env` 에 `ROOMS_ENABLED=1` 을 넣고 11장 업데이트
- 저장 구조가 바뀌는 병합을 올리기 **직전에** 12장 백업을 손으로 한 번 더 떠 둡니다

```bash
docker cp 3oss-app:/data/db.json /home/ubuntu/backups/before-rooms.json
```
