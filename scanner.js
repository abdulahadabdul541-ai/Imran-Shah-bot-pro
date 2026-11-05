/* IMRAN SHAH PRO TRADING BOT
   JS Scanner Engine
   UTC+5 | LIVE / OTC | 5s, 10s, 15s, 1m
*/

const ImranScanner = (() => {
  "use strict";

  const CONFIG = {
    timezone: "Asia/Karachi",
    expiries: ["5s", "10s", "15s", "1m"],
    minConfidence: 75,
    requireConfluence: true
  };

  let running = false;
  let timer = null;

  const state = {
    market: "LIVE",
    pair: "",
    timeframe: "1m",
    lastSignal: null
  };

  function analyze(candles = []) {
    if (!Array.isArray(candles) || candles.length < 30) {
      return wait("Insufficient candle data");
    }

    const valid = candles.every(c =>
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close) &&
      c.high >= c.low
    );

    if (!valid) return wait("Invalid candle data");

    const recent = candles.slice(-30);
    const closes = recent.map(c => c.close);
    const last = recent[recent.length - 1];
    const previous = recent[recent.length - 2];

    const ema = (values, period) => {
      const k = 2 / (period + 1);
      return values.slice(1).reduce(
        (result, value) => value * k + result * (1 - k),
        values[0]
      );
    };

    const emaFast = ema(closes.slice(-12), 5);
    const emaSlow = ema(closes.slice(-26), 12);

    const body = Math.abs(last.close - last.open);
    const range = last.high - last.low;

    if (range === 0) return wait("No candle movement");

    const upperWick = last.high - Math.max(last.open, last.close);
    const lowerWick = Math.min(last.open, last.close) - last.low;

    const bullish = emaFast > emaSlow;
    const bearish = emaFast < emaSlow;

    const bullishCandle = last.close > last.open;
    const bearishCandle = last.close < last.open;

    const momentum = body / range;

    let score = 0;
    let direction = "WAIT";
    const reasons = [];

    if (bullish && bullishCandle) {
      score += 30;
      direction = "BUY";
      reasons.push("Bullish trend and candle");
    }

    if (bearish && bearishCandle) {
      score += 30;
      direction = "SELL";
      reasons.push("Bearish trend and candle");
    }

    if (momentum >= 0.6) {
      score += 20;
      reasons.push("Strong candle momentum");
    }

    if (
      direction === "BUY" &&
      lowerWick > upperWick
    ) {
      score += 15;
      reasons.push("Lower wick rejection");
    }

    if (
      direction === "SELL" &&
      upperWick > lowerWick
    ) {
      score += 15;
      reasons.push("Upper wick rejection");
    }

    if (
      direction === "BUY" &&
      last.close > previous.high
    ) {
      score += 15;
      reasons.push("Bullish breakout");
    }

    if (
      direction === "SELL" &&
      last.close < previous.low
    ) {
      score += 15;
      reasons.push("Bearish breakout");
    }

    if (score < CONFIG.minConfidence) {
      return wait("Confluence is insufficient", score);
    }

    return {
      signal: direction,
      confidence: Math.min(score, 95),
      reasons,
      timestamp: new Date().toLocaleString("en-PK", {
        timeZone: CONFIG.timezone
      })
    };
  }

  function wait(reason, score = 0) {
    return {
      signal: "WAIT",
      confidence: score,
      reasons: [reason],
      timestamp: new Date().toISOString()
    };
  }

  function start(callback) {
    if (running) return;
    running = true;
    if (typeof callback === "function") callback({
      status: "STARTED",
      message: "Scanner ready; waiting for real market data."
    });
  }

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
    return { status: "STOPPED" };
  }

  function setMarket(market) {
    if (!["LIVE", "OTC"].includes(market)) {
      throw new Error("Market must be LIVE or OTC");
    }
    state.market = market;
  }

  function setPair(pair) {
    state.pair = String(pair || "").trim();
  }

  function setExpiry(expiry) {
    if (!CONFIG.expiries.includes(expiry)) {
      throw new Error("Unsupported expiry");
    }
    state.timeframe = expiry;
  }

  return {
    analyze,
    start,
    stop,
    setMarket,
    setPair,
    setExpiry,
    config: CONFIG
  };
})();

if (typeof window !== "undefined") {
  window.ImranScanner = ImranScanner;
}

if (typeof module !== "undefined") {
  module.exports = ImranScanner;
}
