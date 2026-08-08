const mongoose = require("mongoose");

function dbState() {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  return states[mongoose.connection.readyState] || "unknown";
}

exports.health = async (_req, res) => {
  res.json({
    success: true,
    service: "PO System API",
    timestamp: new Date().toISOString(),
    database: dbState()
  });
};

exports.database = async (_req, res) => {
  const state = dbState();
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return res.status(503).json({
      success: false,
      database: state,
      message: "MongoDB is not connected"
    });
  }

  try {
    const startedAt = Date.now();
    const result = await mongoose.connection.db.admin().ping();
    return res.json({
      success: result?.ok === 1,
      database: "connected",
      pingMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      database: state,
      message: "MongoDB ping failed"
    });
  }
};
