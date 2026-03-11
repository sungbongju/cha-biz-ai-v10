// api/liveavatar-token.js
// LiveAvatar 세션 토큰 생성 + 세션 시작 (2단계 통합)

function corsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  corsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const LIVEAVATAR_API_KEY = process.env.LIVEAVATAR_API_KEY;
  if (!LIVEAVATAR_API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const body = req.body || {};
    const avatarId = body.avatar_id;
    const contextId = body.context_id || null;
    const interactivityType = body.interactivity_type || "CONVERSATIONAL";

    if (!avatarId) {
      return res.status(400).json({ error: "avatar_id required" });
    }

    // Step 1: 세션 토큰 생성
    const tokenRes = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": LIVEAVATAR_API_KEY,
      },
      body: JSON.stringify({
        mode: "LITE",
        avatar_id: avatarId,
        is_sandbox: false,
        video_settings: {
          quality: "medium",
          encoding: "H264",
        },
        avatar_persona: {
          context_id: contextId,
          language: "ko",
          voice_settings: {
            model: "eleven_flash_v2_5",
            speed: 1.0,
          },
          stt_config: {
            provider: "deepgram",
          },
        },
        interactivity_type: interactivityType,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.code !== 1000) {
      return res.status(tokenRes.status).json({ error: "Token creation failed", detail: tokenData });
    }

    const sessionToken = tokenData.data.session_token;
    const sessionId = tokenData.data.session_id;

    // Step 2: 세션 시작
    const startRes = await fetch("https://api.liveavatar.com/v1/sessions/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + sessionToken,
      },
    });

    const startData = await startRes.json();
    if (!startRes.ok || startData.code !== 1000) {
      return res.status(startRes.status).json({ error: "Session start failed", detail: startData });
    }

    return res.status(200).json({
      session_id: sessionId,
      session_token: sessionToken,
      livekit_url: startData.data.livekit_url,
      livekit_client_token: startData.data.livekit_client_token,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
