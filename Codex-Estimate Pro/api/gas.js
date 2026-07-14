module.exports = async function handler(req, res) {
  const action = String(req.query.action || "").trim();
  const gasBaseUrl = process.env.GAS_WEB_APP_URL;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!gasBaseUrl) {
    return res.status(500).json({
      error: true,
      message: "Missing GAS_WEB_APP_URL environment variable"
    });
  }

  if (!action) {
    return res.status(400).json({
      error: true,
      message: "Missing action query parameter"
    });
  }

  const targetUrl = `${gasBaseUrl.replace(/\/+$/, "")}?action=${encodeURIComponent(action)}`;
  const isGet = req.method === "GET";

  try {
    const clientIp = String(req.headers["x-forwarded-for"] || "")
      .split(",")[0].trim() || req.socket?.remoteAddress || "";
    const clientUa = String(req.headers["user-agent"] || "");
    const outboundBody = isGet
      ? undefined
      : JSON.stringify({
          ...(req.body || {}),
          _client: { ip: clientIp, ua: clientUa }
        });

    const gasResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json"
      },
      body: outboundBody
    });

    const text = await gasResponse.text();
    const contentType = gasResponse.headers.get("content-type") || "application/json";

    res.status(gasResponse.status);
    res.setHeader("Content-Type", contentType);
    return res.send(text);
  } catch (error) {
    return res.status(502).json({
      error: true,
      message: error.message || "Proxy request failed"
    });
  }
};
