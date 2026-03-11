// api/liveavatar-context.js
// LiveAvatar Context(지식베이스) CRUD

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

  const LIVEAVATAR_API_KEY = process.env.LIVEAVATAR_API_KEY;
  if (!LIVEAVATAR_API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const body = req.body || {};
    const action = body.action || "list";

    if (action === "list") {
      const r = await fetch("https://api.liveavatar.com/v1/contexts", {
        headers: { "X-API-KEY": LIVEAVATAR_API_KEY, "Accept": "application/json" },
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (action === "create") {
      const r = await fetch("https://api.liveavatar.com/v1/contexts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": LIVEAVATAR_API_KEY,
        },
        body: JSON.stringify({
          name: body.name || "CHA BIZ AI Context",
          prompt: body.prompt || "",
          opening_text: body.opening_text || "",
        }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (action === "update") {
      if (!body.context_id) {
        return res.status(400).json({ error: "context_id required" });
      }
      const r = await fetch("https://api.liveavatar.com/v1/contexts/" + body.context_id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": LIVEAVATAR_API_KEY,
        },
        body: JSON.stringify({
          name: body.name,
          prompt: body.prompt,
          opening_text: body.opening_text,
        }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (action === "delete") {
      if (!body.context_id) {
        return res.status(400).json({ error: "context_id required" });
      }
      const r = await fetch("https://api.liveavatar.com/v1/contexts/" + body.context_id, {
        method: "DELETE",
        headers: { "X-API-KEY": LIVEAVATAR_API_KEY },
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(400).json({ error: "Invalid action" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
