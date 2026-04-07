const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 12000;

app.use(cors());
app.use(express.json());

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUnit(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.toLowerCase().trim().replace(/\s+/g, "");
}

function normalizeTemperatureUnit(value) {
  const raw = normalizeUnit(value).replace(/°/g, "");
  let unit = raw;

  if (raw.startsWith("deg")) {
    unit = raw.slice(3);
  }

  unit = unit.replace("degrees", "degree");

  const aliases = {
    c: "celsius",
    celsius: "celsius",
    celcius: "celsius",
    centigrade: "celsius",
    degreecelsius: "celsius",
    degreecelcius: "celsius",
    celciseus: "celsius",
    f: "fahrenheit",
    fahrenheit: "fahrenheit",
    farenheit: "fahrenheit",
    farnheat: "fahrenheit",
    degreefahrenheit: "fahrenheit",
    k: "kelvin",
    kelvin: "kelvin",
    degreekelvin: "kelvin"
  };

  return aliases[unit] || "";
}

app.get("/health", (req, res) => {
  res.json({
    service: "compute",
    status: "ok",
    port,
    features: ["basic", "advanced", "scientific", "conversions", "ageCalculator"]
  });
});

// Basic arithmetic
app.post("/compute", (req, res) => {
  const { a, b, operation } = req.body;
  const left = toNumber(a);
  const right = toNumber(b);

  if (left === null || right === null) {
    return res.status(400).json({ error: "Both a and b must be valid numbers." });
  }

  let result;

  switch (operation) {
    case "add":
      result = left + right;
      break;
    case "subtract":
      result = left - right;
      break;
    case "multiply":
      result = left * right;
      break;
    case "divide":
      if (right === 0) {
        return res.status(400).json({ error: "Division by zero is not allowed." });
      }
      result = left / right;
      break;
    case "modulo":
      if (right === 0) {
        return res.status(400).json({ error: "Modulo by zero is not allowed." });
      }
      result = left % right;
      break;
    case "power":
      result = Math.pow(left, right);
      break;
    default:
      return res.status(400).json({
        error: "Invalid operation. Use add, subtract, multiply, divide, modulo, or power."
      });
  }

  return res.json({
    a: left,
    b: right,
    operation,
    result
  });
});

// Scientific operations
app.post("/scientific", (req, res) => {
  const { value, operation } = req.body;
  const num = toNumber(value);

  if (num === null) {
    return res.status(400).json({ error: "Value must be a valid number." });
  }

  let result;

  switch (operation) {
    case "sqrt":
      if (num < 0) {
        return res.status(400).json({ error: "Square root of negative number is not allowed." });
      }
      result = Math.sqrt(num);
      break;
    case "cbrt":
      result = Math.cbrt(num);
      break;
    case "square":
      result = num * num;
      break;
    case "cube":
      result = num * num * num;
      break;
    case "abs":
      result = Math.abs(num);
      break;
    case "log10":
      if (num <= 0) {
        return res.status(400).json({ error: "Log10 requires positive number." });
      }
      result = Math.log10(num);
      break;
    case "ln":
      if (num <= 0) {
        return res.status(400).json({ error: "Natural log requires positive number." });
      }
      result = Math.log(num);
      break;
    case "exp":
      result = Math.exp(num);
      break;
    case "reciprocal":
      if (num === 0) {
        return res.status(400).json({ error: "Reciprocal of zero is not allowed." });
      }
      result = 1 / num;
      break;
    default:
      return res.status(400).json({
        error: "Invalid operation. Use sqrt, cbrt, square, cube, abs, log10, ln, exp, or reciprocal."
      });
  }

  return res.json({
    value: num,
    operation,
    result
  });
});

// Trigonometric operations (input in degrees, output in radians for trig, degrees for inverse)
app.post("/trigonometry", (req, res) => {
  const { value, operation, angleMode = "degrees" } = req.body;
  const num = toNumber(value);

  if (num === null) {
    return res.status(400).json({ error: "Value must be a valid number." });
  }

  let angle = angleMode === "degrees" ? (num * Math.PI) / 180 : num;
  let result;

  switch (operation) {
    case "sin":
      result = Math.sin(angle);
      break;
    case "cos":
      result = Math.cos(angle);
      break;
    case "tan":
      result = Math.tan(angle);
      break;
    case "asin":
      if (num < -1 || num > 1) {
        return res.status(400).json({ error: "asin domain is [-1, 1]." });
      }
      result = (Math.asin(num) * 180) / Math.PI;
      break;
    case "acos":
      if (num < -1 || num > 1) {
        return res.status(400).json({ error: "acos domain is [-1, 1]." });
      }
      result = (Math.acos(num) * 180) / Math.PI;
      break;
    case "atan":
      result = (Math.atan(num) * 180) / Math.PI;
      break;
    default:
      return res.status(400).json({
        error: "Invalid operation. Use sin, cos, tan, asin, acos, or atan."
      });
  }

  return res.json({
    value: num,
    operation,
    angleMode,
    result: Math.round(result * 100000000) / 100000000
  });
});

// Temperature conversion
app.post("/convert/temperature", (req, res) => {
  const { value, fromUnit, toUnit } = req.body;
  const num = toNumber(value);
  const from = normalizeTemperatureUnit(fromUnit);
  const to = normalizeTemperatureUnit(toUnit);

  if (num === null) {
    return res.status(400).json({ error: "Value must be a valid number." });
  }

  let celsius;

  if (from === "celsius") {
    celsius = num;
  } else if (from === "fahrenheit") {
    celsius = (num - 32) * (5 / 9);
  } else if (from === "kelvin") {
    celsius = num - 273.15;
  } else {
    return res.status(400).json({
      error: "Invalid fromUnit. Use celsius, fahrenheit, or kelvin (aliases like deg C/deg F are also supported)."
    });
  }

  let result;

  if (to === "celsius") {
    result = celsius;
  } else if (to === "fahrenheit") {
    result = celsius * (9 / 5) + 32;
  } else if (to === "kelvin") {
    result = celsius + 273.15;
  } else {
    return res.status(400).json({
      error: "Invalid toUnit. Use celsius, fahrenheit, or kelvin (aliases like deg C/deg F are also supported)."
    });
  }

  return res.json({
    value: num,
    fromUnit: from,
    toUnit: to,
    result: Math.round(result * 100) / 100
  });
});

// Length conversion
app.post("/convert/length", (req, res) => {
  const { value, fromUnit, toUnit } = req.body;
  const num = toNumber(value);
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (num === null) {
    return res.status(400).json({ error: "Value must be a valid number." });
  }

  const toMeters = {
    mm: 0.001,
    cm: 0.01,
    dm: 0.1,
    decimeter: 0.1,
    m: 1,
    dam: 10,
    decameter: 10,
    hm: 100,
    hectometer: 100,
    km: 1000,
    inch: 0.0254,
    foot: 0.3048,
    ft: 0.3048,
    yard: 0.9144,
    yd: 0.9144,
    mile: 1609.34
  };

  if (!toMeters[from] || !toMeters[to]) {
    return res.status(400).json({
      error: "Invalid unit. Use mm, cm, dm, m, dam, hm, km, inch, foot, yard, or mile."
    });
  }

  const meters = num * toMeters[from];
  const result = meters / toMeters[to];

  return res.json({
    value: num,
    fromUnit: from,
    toUnit: to,
    result: Math.round(result * 100000) / 100000
  });
});

// Weight conversion
app.post("/convert/weight", (req, res) => {
  const { value, fromUnit, toUnit } = req.body;
  const num = toNumber(value);
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (num === null) {
    return res.status(400).json({ error: "Value must be a valid number." });
  }

  const toGrams = {
    ug: 0.000001,
    mcg: 0.000001,
    mg: 0.001,
    cg: 0.01,
    dg: 0.1,
    g: 1,
    dag: 10,
    hg: 100,
    kg: 1000,
    tonne: 1000000,
    ton: 1000000,
    t: 1000000,
    oz: 28.3495,
    lb: 453.592,
    stone: 6350.29
  };

  if (!toGrams[from] || !toGrams[to]) {
    return res.status(400).json({
      error: "Invalid unit. Use ug, mg, cg, dg, g, dag, hg, kg, tonne, oz, lb, or stone."
    });
  }

  const grams = num * toGrams[from];
  const result = grams / toGrams[to];

  return res.json({
    value: num,
    fromUnit: from,
    toUnit: to,
    result: Math.round(result * 100000) / 100000
  });
});

// Age calculator
app.post("/age-calculator", (req, res) => {
  const { birthDate } = req.body;

  if (!birthDate) {
    return res.status(400).json({ error: "birthDate is required (YYYY-MM-DD format)." });
  }

  const birth = new Date(birthDate);

  if (isNaN(birth.getTime())) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
  }

  const today = new Date();

  if (birth > today) {
    return res.status(400).json({ error: "Birth date cannot be in the future." });
  }

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += lastMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalDays = Math.floor((today - birth) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.floor(totalDays / 7);
  const totalHours = Math.floor((today - birth) / (1000 * 60 * 60));

  return res.json({
    birthDate,
    years,
    months,
    days,
    totalDays,
    totalWeeks,
    totalHours,
    formatted: `${years} years, ${months} months, and ${days} days`
  });
});

app.listen(port, () => {
  console.log(`Compute service running on http://localhost:${port}`);
});
