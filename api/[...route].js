const COMPUTE_SERVICE_URL = process.env.COMPUTE_SERVICE_URL || "http://localhost:12000";
const HISTORY_SERVICE_URL = process.env.HISTORY_SERVICE_URL || "http://localhost:13000";

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function handleCalculate(req, res) {
  let payload;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "Invalid JSON payload." });
  }

  let computeResponse;
  try {
    computeResponse = await requestJson(`${COMPUTE_SERVICE_URL}/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    return sendJson(res, 502, { error: "Failed to reach compute service." });
  }

  if (!computeResponse.ok) {
    return sendJson(res, computeResponse.status || 502, {
      error: computeResponse.data.error || "Failed to reach compute service."
    });
  }

  try {
    const saveResponse = await requestJson(`${HISTORY_SERVICE_URL}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(computeResponse.data)
    });

    if (!saveResponse.ok) {
      return sendJson(res, 200, {
        ...computeResponse.data,
        history: [],
        historyWarning: "Calculation completed, but history service is unavailable."
      });
    }
  } catch (error) {
    return sendJson(res, 200, {
      ...computeResponse.data,
      history: [],
      historyWarning: "Calculation completed, but history service is unavailable."
    });
  }

  try {
    const historyResponse = await requestJson(`${HISTORY_SERVICE_URL}/history?limit=20`);
    return sendJson(res, 200, {
      ...computeResponse.data,
      history: historyResponse.data.history || []
    });
  } catch (error) {
    return sendJson(res, 200, {
      ...computeResponse.data,
      history: []
    });
  }
}

async function handleComputeProxy(req, res, targetPath) {
  let payload;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: "Invalid JSON payload." });
  }

  try {
    const response = await requestJson(`${COMPUTE_SERVICE_URL}${targetPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    return sendJson(res, response.status || 502, response.data);
  } catch (error) {
    const fallback = targetPath === "/age-calculator" ? "Failed to calculate age." : "Failed to compute.";
    return sendJson(res, 502, { error: fallback });
  }
}

async function handleHistory(req, res) {
  const limit = req.query && req.query.limit ? req.query.limit : "20";

  try {
    const response = await requestJson(`${HISTORY_SERVICE_URL}/history?limit=${encodeURIComponent(limit)}`);

    if (!response.ok) {
      return sendJson(res, 502, { error: "Failed to reach history service." });
    }

    return sendJson(res, 200, { history: response.data.history || [] });
  } catch (error) {
    return sendJson(res, 502, { error: "Failed to reach history service." });
  }
}

module.exports = async function handler(req, res) {
  const segments = Array.isArray(req.query.route)
    ? req.query.route
    : typeof req.query.route === "string"
      ? [req.query.route]
      : [];
  const route = `/${segments.join("/")}`;

  if (req.method === "GET" && route === "/health") {
    const out = {
      service: "vercel-gateway",
      status: "ok",
      computeService: "unreachable",
      historyService: "unreachable"
    };

    try {
      const computeHealth = await requestJson(`${COMPUTE_SERVICE_URL}/health`);
      if (computeHealth.ok) out.computeService = "ok";
    } catch (error) {
      out.computeService = "unreachable";
    }

    try {
      const historyHealth = await requestJson(`${HISTORY_SERVICE_URL}/health`);
      if (historyHealth.ok) out.historyService = "ok";
    } catch (error) {
      out.historyService = "unreachable";
    }

    return sendJson(res, 200, out);
  }

  if (req.method === "POST" && route === "/calculate") {
    return handleCalculate(req, res);
  }

  if (req.method === "POST" && route === "/scientific") {
    return handleComputeProxy(req, res, "/scientific");
  }

  if (req.method === "POST" && route === "/trigonometry") {
    return handleComputeProxy(req, res, "/trigonometry");
  }

  if (req.method === "POST" && route === "/convert/temperature") {
    return handleComputeProxy(req, res, "/convert/temperature");
  }

  if (req.method === "POST" && route === "/convert/length") {
    return handleComputeProxy(req, res, "/convert/length");
  }

  if (req.method === "POST" && route === "/convert/weight") {
    return handleComputeProxy(req, res, "/convert/weight");
  }

  if (req.method === "POST" && route === "/age-calculator") {
    return handleComputeProxy(req, res, "/age-calculator");
  }

  if (req.method === "GET" && route === "/history") {
    return handleHistory(req, res);
  }

  return sendJson(res, 404, { error: "Route not found." });
};