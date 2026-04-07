const path = require("path");
const express = require("express");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 11000;
const computeServiceUrl = process.env.COMPUTE_SERVICE_URL || "http://localhost:12000";
const historyServiceUrl = process.env.HISTORY_SERVICE_URL || "http://localhost:13000";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", async (req, res) => {
  let computeStatus = "unreachable";
  let historyStatus = "unreachable";

  try {
    await axios.get(`${computeServiceUrl}/health`, { timeout: 2000 });
    computeStatus = "ok";
  } catch (error) {
    computeStatus = "unreachable";
  }

  try {
    await axios.get(`${historyServiceUrl}/health`, { timeout: 2000 });
    historyStatus = "ok";
  } catch (error) {
    historyStatus = "unreachable";
  }

  res.json({
    service: "gateway",
    status: "ok",
    port,
    computeService: computeStatus,
    historyService: historyStatus
  });
});

// Basic arithmetic
app.post("/api/calculate", async (req, res) => {
  try {
    const computeResponse = await axios.post(`${computeServiceUrl}/compute`, req.body, {
      timeout: 5000
    });

    try {
      await axios.post(`${historyServiceUrl}/history`, computeResponse.data, {
        timeout: 5000
      });
    } catch (historyError) {
      return res.json({
        ...computeResponse.data,
        history: [],
        historyWarning: "Calculation completed, but history service is unavailable."
      });
    }

    const historyResponse = await axios.get(`${historyServiceUrl}/history?limit=20`, {
      timeout: 5000
    });

    return res.json({
      ...computeResponse.data,
      history: historyResponse.data.history || []
    });
  } catch (error) {
    const status = error.response ? error.response.status : 502;
    const message = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : "Failed to reach compute service.";

    return res.status(status).json({ error: message });
  }
});

// Scientific operations
app.post("/api/scientific", async (req, res) => {
  try {
    const computeResponse = await axios.post(`${computeServiceUrl}/scientific`, req.body, {
      timeout: 5000
    });
    return res.json(computeResponse.data);
  } catch (error) {
    const status = error.response ? error.response.status : 502;
    const message = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : "Failed to compute.";
    return res.status(status).json({ error: message });
  }
});

// Trigonometric
app.post("/api/trigonometry", async (req, res) => {
  try {
    const computeResponse = await axios.post(`${computeServiceUrl}/trigonometry`, req.body, {
      timeout: 5000
    });
    return res.json(computeResponse.data);
  } catch (error) {
    const status = error.response ? error.response.status : 502;
    const message = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : "Failed to compute.";
    return res.status(status).json({ error: message });
  }
});

// Temperature conversion
app.post("/api/convert/temperature", async (req, res) => {
  try {
    const computeResponse = await axios.post(`${computeServiceUrl}/convert/temperature`, req.body, {
      timeout: 5000
    });
    return res.json(computeResponse.data);
  } catch (error) {
    const status = error.response ? error.response.status : 502;
    const message = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : "Failed to convert.";
    return res.status(status).json({ error: message });
  }
});

// Length conversion
app.post("/api/convert/length", async (req, res) => {
  try {
    const computeResponse = await axios.post(`${computeServiceUrl}/convert/length`, req.body, {
      timeout: 5000
    });
    return res.json(computeResponse.data);
  } catch (error) {
    const status = error.response ? error.response.status : 502;
    const message = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : "Failed to convert.";
    return res.status(status).json({ error: message });
  }
});

// Weight conversion
app.post("/api/convert/weight", async (req, res) => {
  try {
    const computeResponse = await axios.post(`${computeServiceUrl}/convert/weight`, req.body, {
      timeout: 5000
    });
    return res.json(computeResponse.data);
  } catch (error) {
    const status = error.response ? error.response.status : 502;
    const message = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : "Failed to convert.";
    return res.status(status).json({ error: message });
  }
});

// Age calculator
app.post("/api/age-calculator", async (req, res) => {
  try {
    const computeResponse = await axios.post(`${computeServiceUrl}/age-calculator`, req.body, {
      timeout: 5000
    });
    return res.json(computeResponse.data);
  } catch (error) {
    const status = error.response ? error.response.status : 502;
    const message = error.response && error.response.data && error.response.data.error
      ? error.response.data.error
      : "Failed to calculate age.";
    return res.status(status).json({ error: message });
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const historyResponse = await axios.get(`${historyServiceUrl}/history?limit=20`, {
      timeout: 5000
    });

    return res.json({ history: historyResponse.data.history || [] });
  } catch (error) {
    return res.status(502).json({ error: "Failed to reach history service." });
  }
});

const toolRoutes = [
  "/",
  "/emi",
  "/gst",
  "/sip",
  "/tax",
  "/bmi",
  "/age",
  "/temp",
  "/length",
  "/weight",
  "/gold",
  "/fuel",
  "/percentage",
  "/discount",
  "/trig"
];

app.get(toolRoutes, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Gateway service running on http://localhost:${port}`);
});
