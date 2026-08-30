# O.HOME — 자캐놀이용 개인홈

내 글·그림·캐릭터를 올려두고 지인들과 함께 노는 개인 홈페이지.
데이터베이스는 **직접 만든 무료 계정**(Supabase 또는 Firebase)을 씁니다 — 서버 비용 없이 내 데이터는 내 계정에.

---

## 설치 (터미널 없이)

### 1. 이 저장소를 내 계정으로 가져오기 — 오른쪽 위 [Fork]

**GitHub 계정이 없다면 먼저 만듭니다** — [github.com/signup](https://github.com/signup), 무료이고 1분이면 됩니다. 코드를 보관하는 곳이라 홈을 운영하는 내내 쓰게 됩니다.

계정이 준비되면 이 페이지 **오른쪽 위의 [Fork]** → **[Create fork]** 를 누릅니다. 내 계정에 똑같은 저장소가 생기고, 여기서부터는 **내 저장소**에서 진행합니다.

> 포크로 가져오면 나중에 **새 버전을 버튼 두 번으로 받을 수 있습니다.** 아래 「새 버전 받기」 참고.

### 2. Vercel에 올리기

Vercel은 홈을 인터넷에 띄워 주는 곳입니다. **처음이면 계정부터 만들어야 하는데, 방금 만든 GitHub 계정으로 그냥 시작할 수 있습니다.**

**① Vercel 시작하기**

[vercel.com/signup](https://vercel.com/signup) 에 접속해 **[Continue with GitHub]** 를 누릅니다.

- GitHub 로그인 화면이 뜨면 로그인합니다
- **[Authorize Vercel]** 버튼이 나오면 눌러 허용합니다 — Vercel이 내 저장소를 읽기 위해 필요합니다
- 이름·용도를 묻는 화면이 나오면 **Hobby(개인용)** 를 고르고 넘어갑니다

**② GitHub 저장소 연결하기**

로그인하면 **Import Git Repository** 화면이 나옵니다. 여기가 처음 쓰는 분들이 막히는 곳입니다.

- 저장소 목록이 **비어 있거나** **[Continue with GitHub]** 버튼만 보인다면, 아직 GitHub이 연결되지 않은 상태입니다. **그 버튼을 눌러 연결하세요**
- **[Install]** 설치 화면이 뜨면 접근 범위를 고릅니다
  - **All repositories** — 전부 허용 (간단합니다)
  - **Only select repositories** — `O.home` 하나만 골라도 됩니다
- 설치가 끝나면 목록에 저장소가 나타납니다

**③ 배포하기**

1. 목록에서 **O.home** 을 찾아 옆의 **[Import]** 클릭
2. 설정 화면이 나와도 **아무것도 건드리지 말고** **[Deploy]** 클릭
3. 1~3분 기다리면 완료 — 축하 화면이 뜹니다
4. 나온 **`https://내프로젝트.vercel.app`** 주소를 눌러 들어갑니다

명령어를 칠 일도, 환경변수를 넣을 일도 없습니다.

**④ 서버 위치를 서울로 — 꼭 해 주세요 (한국에서 쓴다면)**

Vercel은 기본값이 **미국 동부**라, 그냥 두면 페이지를 열 때마다 태평양을 왕복합니다. **자동으로는 안 바뀌니 직접 눌러 주셔야 합니다.**

1. **Settings → Functions → Function Region → `Seoul (icn1)` → [Save]**
2. **Deployments → 맨 위 배포의 ⋯ → [Redeploy]** ← 이걸 해야 실제로 적용됩니다

30초면 끝나고 체감이 확실히 달라집니다. 잘 됐는지는 홈에서 `F12` → **Network** → 맨 위 요청 → **Response Headers** 의 `x-vercel-id`가 **`icn1::…`** 로 시작하면 성공입니다.

### 3. 데이터베이스 연결 — 화면 안내대로

그 주소로 들어가면 **설치 화면**이 뜹니다.

1. **Supabase / Firebase** 중 선택
   - 글 위주면 Supabase, **그림이 많으면 Firebase**(이미지 무료 한도 5GB)
2. 화면이 시키는 대로 프로젝트를 만들고 **주소·키를 붙여넣기**
   - Firebase는 콘솔의 설정 코드를 통째로 붙여넣으면 자동으로 채워집니다
3. **[SQL 복사]** 또는 **[규칙 복사]** → 콘솔에 붙여넣고 실행/게시
4. **[연결 확인]** → **관리자 계정 만들기** (첫 계정이 관리자)
5. 마지막 화면에서 **설정 파일 내려받기 → 저장소에 올리기**
   - 저장소 주소를 넣으면 **업로드 페이지 링크**를 만들어 줍니다. 파일을 끌어다 놓고 [Commit changes]만 누르면 끝
   - 또는 Vercel 환경변수에 붙여넣어도 됩니다 (화면에 복사 버튼 있음)

끝입니다. 이제 방문자에게도 내 홈이 보입니다.

---

## 다른 방법

<details>
<summary>한 번에 배포하기 (대신 새 버전을 못 받습니다)</summary>

[![Vercel로 배포](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/w00j00working/O.home)

버튼 하나로 저장소 복사와 배포가 한 번에 끝납니다. 다만 이렇게 만들어진 저장소는 원본과 **연결이 끊긴 복사본**이라 **[Sync fork]로 업데이트를 받을 수 없습니다.** 새 버전을 계속 받고 싶다면 위의 포크 방식을 쓰세요.

아래 주소를 그대로 보내 줘도 버튼과 똑같이 동작합니다.

```
https://vercel.com/new/clone?repository-url=https://github.com/w00j00working/O.home
```
</details>

<details>
<summary>zip을 받았다면 (포크 대신)</summary>

```bash
npm install
npm run build     # 확인용
npx vercel        # 안내에 따라 로그인 → 배포 (GitHub 없이도 됩니다)
```

GitHub를 쓰고 싶다면 저장소를 만들고 올린 뒤 Vercel에서 Import 해도 같습니다.
</details>

<details>
<summary>내 컴퓨터에서만 돌려보기</summary>

```bash
npm install
npm run dev       # http://localhost:3000
```

데이터베이스를 연결하지 않으면 이 브라우저 안에만 저장됩니다(혼자 보는 용도).
</details>

<details>
<summary>배포본 zip 만들기 (나눠 주는 사람용)</summary>

```bash
npm run pack      # dist/ohome-<버전>-<날짜>.zip
```

`node_modules`·`.next`·`.git`과 **연결 정보 파일·`.env`는 자동으로 빠집니다.**
</details>

<details>
<summary>나눠 주는 사람이 챙길 것</summary>

- 이 저장소를 **공개(Public)** 로 둘 것 — 비공개면 포크도 배포 버튼도 동작하지 않습니다
- 새 기능을 만들면 **여기에 올리기만** 하면 됩니다. 받은 사람이 [Sync fork]를 누를 때 반영됩니다
- **`public/ohome.config.json`은 절대 올리지 말 것** — 내 데이터베이스 연결 정보라, 올라가면 설치한 사람 전부가 내 DB에 붙습니다. `.gitignore`에 걸어 뒀지만 강제로 추가하지 않도록 주의하세요
- 저장 방식을 바꾸는 변경은 **불러올 때 자동 변환**되게 만들 것 — 받는 사람이 손댈 일이 없어야 합니다
</details>

---

## 새 버전 받기

포크로 설치했다면 **버튼 두 번**입니다.

1. 내 저장소 페이지 위쪽의 **[Sync fork]** → **[Update branch]**
2. 끝. Vercel이 알아서 1~2분 안에 새로 배포합니다.

**글·이미지·테마·회원·메인 배치는 전부 내 데이터베이스에 있으므로 그대로입니다.** 코드만 새것으로 바뀝니다. 홈 주소도 그대로라 방문자에게 다시 알릴 필요가 없습니다.

내 저장소의 파일을 직접 고친 적이 없다면 충돌도 나지 않습니다. (설치할 때 올린 연결 정보 파일 `public/ohome.config.json`은 원본 저장소에 없는 파일이라 건드려지지 않습니다.)

> 업데이트는 **내가 누를 때만** 일어납니다. 원본이 바뀌었다고 내 홈이 저절로 바뀌지는 않습니다.

---

## 알아두면 좋은 것

- **백업**: 환경설정 → 데이터 백업 → `↓ 데이터만` / `↓ 회원까지` (이미지까지 zip 하나)
- **DB 옮기기**: 같은 화면의 **데이터베이스 이전** — 새 프로젝트나 Supabase ↔ Firebase 서로 이동
- **초기화**: 지울 항목을 메뉴별로 골라서
- **환경설정은 PC 전용**입니다 (모바일에서는 열람만)

설치·운영을 더 자세히: [**설치 가이드**](SETUP_GUIDE.md)

---

## 개발 메모

```
src/
  app/                  페이지 (Next.js App Router · 전부 클라이언트 렌더)
  components/ui/        자체 UI 킷 — 기본 브라우저 컨트롤은 쓰지 않음
  lib/
    backend/            저장소 어댑터: supabaseBackend · firebaseBackend
    postStore.ts        목록 저장 훅 (서버면 DB, 아니면 브라우저)
    settingStore.ts     사이트 설정 (테마·메뉴·폰트…) 저장 계층
    transfer.ts         백업·복원·DB 이전 공용 엔진
    serverConfig.ts     런타임 연결 설정 (config 파일 → 로컬 → env)
supabase/schema.sql     Supabase 스키마·권한
firebase/*.rules        Firestore·Storage 보안 규칙
```

- **기본 브라우저 UI 금지** — 모든 폼 컨트롤은 `components/ui` 킷 사용
- **기획서와 달라지거나 추가되는 사항은 기획서 상단 「구현 반영 로그」에 기록**
