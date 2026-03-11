// api/liveavatar-session.js
// LiveAvatar 세션 관리 (keep-alive, stop)

function corsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
    const body = req.body;
    const action = body.action;

    if (action === "keep-alive") {
      const r = await fetch("https://api.liveavatar.com/v1/sessions/keep-alive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": LIVEAVATAR_API_KEY,
        },
        body: JSON.stringify({ session_id: body.session_id }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (action === "stop") {
      const r = await fetch("https://api.liveavatar.com/v1/sessions/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": LIVEAVATAR_API_KEY,
        },
        body: JSON.stringify({
          session_id: body.session_id,
          reason: body.reason || "USER_CLOSED",
        }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(400).json({ error: "Invalid action (keep-alive|stop)" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
