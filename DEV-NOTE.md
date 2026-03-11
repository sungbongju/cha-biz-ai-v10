# v10 개발 노트

## 개요
- **배포**: Vercel (https://cha-biz-ai-v10.vercel.app)
- **GitHub**: sungbongju/cha-biz-ai-v10
- **아바타**: HeyGen LiveAvatar (Interactive Avatar에서 마이그레이션)
- **모드**: LITE (STT는 서버, LLM/TTS 제어는 클라이언트)

## 왜 v10인가?
- v4: Netlify + Interactive Avatar + Web Speech API
- v5: Whisper API 시도 → 환각 문제로 폐기
- v6: Speechmatics 실시간 STT → WebSocket 복잡도 높음
- v9: LiveAvatar FULL 모드 → 발음 제어 불가 (블랙박스)
- **v10**: LiveAvatar LITE 모드 + Vercel + 소켓 분리 AEC

## 아키텍처

### LITE 모드 파이프라인
```
[사용자 음성] → LiveKit 마이크 → 서버 Deepgram STT
    → user.transcription 이벤트 (DataChannel)
    → processUserInput(text)
    → /api/openai-chat (GPT-4o-mini)
    → { reply(표시용), ttsReply(발음최적화), action, tabId }
    → 채팅 버블: reply (cleanForDisplay 적용)
    → 아바타 발화: avatar.speak_text(ttsReply) → ElevenLabs TTS + 립싱크
    → 섹션 스크롤: navigateToSection(tabId)
```

### FULL 모드와의 차이
| 항목 | FULL 모드 | LITE 모드 (현재) |
|------|-----------|-----------------|
| STT | 서버 Deepgram | 서버 Deepgram (동일) |
| LLM | 서버 내장 (블랙박스) | **우리 GPT API** |
| TTS | 서버 자동 (제어 불가) | **avatar.speak_text** (발음 제어 가능) |
| 발음 규칙 | 적용 불가 | **applyTtsPostProcessing** |
| 지식 베이스 | Context API (제한적) | **openai-chat.js** (전체 지식) |

### 소켓 분리 AEC (에코 방지)
```
Output 소켓: 아바타 오디오 → GainNode → 스피커
Input 소켓:  마이크 → GainNode → LiveKit

에코 방지 4단계:
1. avatar.speak_started → 마이크 트랙 disabled (하드웨어 레벨)
2. InputGainNode → gain=0 (소프트웨어 레벨)
3. avatar.speak_ended → 1초 딜레이 후 마이크 복원
4. avatar.transcription 텍스트 기록 → 에코 필터링용

Interrupt (말 끊기):
1. OutputGainNode → gain=0 (버퍼 오디오 즉시 차단)
2. sendCommand('avatar.interrupt') → 서버 생성 중단
3. 500ms 후 OutputGainNode 복원
```

## 프로젝트 구조
```
cha-biz-ai-v10/
├── vercel.json              ← rewrites 설정
├── DEV-NOTE.md              ← 이 파일
├── api/
│   ├── liveavatar-token.js  ← 세션 생성 (토큰 + 시작 통합, LITE 모드)
│   ├── liveavatar-session.js ← keep-alive, stop
│   ├── liveavatar-context.js ← Context API CRUD
│   └── openai-chat.js       ← GPT 상담사 (지식, 발음규칙, TTS후처리, 키워드폴백)
└── public/
    └── index.html            ← 랜딩페이지 + 아바타 JS 전체
```

## Vercel 환경변수
- `LIVEAVATAR_API_KEY` — HeyGen LiveAvatar API 키
- `OPENAI_API_KEY` — OpenAI API 키 (GPT-4o-mini)

## API 엔드포인트

### POST /api/openai-chat
GPT 상담사 API. 발음 규칙 + 섹션 스크롤 + 키워드 폴백 포함.
```json
// 요청
{ "type": "chat", "message": "취업률이 어때?", "history": [] }

// 응답
{
  "reply": "취업과 진로에 대해 말씀드릴게요...",      // 채팅 버블용 (cleanForDisplay)
  "ttsReply": "취업 과 진로 에 대해 말씀드릴게요...", // TTS용 (applyTtsPostProcessing)
  "action": "navigate",
  "tabId": "careers"
}
```

### POST /api/liveavatar-token
세션 생성 (2단계 통합: 토큰 발급 + 세션 시작).
```json
// 요청
{ "avatar_id": "...", "context_id": "...", "interactivity_type": "CONVERSATIONAL" }

// 응답
{ "session_id": "...", "session_token": "...", "livekit_url": "...", "livekit_client_token": "..." }
```

### POST /api/liveavatar-session
세션 관리.
```json
{ "action": "keep-alive", "session_id": "..." }
{ "action": "stop", "session_id": "...", "reason": "USER_CLOSED" }
```

## TTS 발음 3단계 시스템
1. **GPT 프롬프트**: 해요체 강제, 영어→한글 발음, 합성어 띄어쓰기
2. **applyTtsPostProcessing()**: 후처리 (합성어+조사 분리, 합니다→해요 변환)
3. **cleanForDisplay()**: 채팅 버블용 역변환 (한글→영어, 합성어 합치기, 퍼센트→%)

## LiveAvatar DataChannel 이벤트
- `user.speak_started` — 사용자 발화 시작 감지
- `user.speak_ended` — 사용자 발화 종료 감지
- `user.transcription` — STT 결과 (Deepgram) → processUserInput 호출
- `avatar.speak_started` — 아바타 발화 시작 → 마이크 뮤트
- `avatar.speak_ended` — 아바타 발화 종료 → 1초 후 마이크 언뮤트
- `avatar.transcription` — 아바타 발화 텍스트 (LITE에서는 무시)
- `session.stopped` — 세션 종료

## 섹션 ID 매핑
- research: 전공 소개 & 교육목표
- curriculum: 커리큘럼
- ai: 차별성 & 복수전공
- faculty: 교수진 소개
- careers: 취업 & 취업률
- career-fields: 5대 진로 분야
- only-cha: 차의과학대 강점
- experience: 실전 경험
- faq: FAQ

## 현재 설정
- 아바타 ID: `513fd1b7-7ef9-466d-9af2-344e51eeb833` (Public 테스트용)
- Context ID: `a64a5909-4fb0-423f-a657-1a68b6ed7869`
- STT: Deepgram (서버측)
- TTS: ElevenLabs `eleven_flash_v2_5`
- LLM: GPT-4o-mini (우리 API)
- Keep-alive: 4분 간격

## 알려진 이슈 / TODO
- [ ] 교수님 아바타 마이그레이션 (Interactive → Live Avatar)
- [ ] ElevenLabs 커스텀 보이스 (교수님 음성 클론)
- [ ] 대화 내용 DB 저장 (chatHistory → save_chat API)
- [ ] 모바일 테스트 (iOS Safari, Android Chrome)
- [ ] Push-to-talk 모드 (교실/데모 환경용)
