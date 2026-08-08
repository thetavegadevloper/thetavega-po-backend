const mongoose = require("mongoose");
const dns = require("dns");

// =====================================================
// DNS CONFIGURATION FOR MONGODB ATLAS
// =====================================================
dns.setServers([
  "8.8.8.8",
  "1.1.1.1"
]);

// =====================================================
// CONNECT DATABASE
// =====================================================
async function connectDB() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is required");
    }

    const connection = await mongoose.connect(
      process.env.MONGODB_URI
    );

    console.log("[DB] MongoDB connected successfully");
    console.log(`[DB] Host: ${connection.connection.host}`);
    console.log(`[DB] Database: ${connection.connection.name}`);

    return connection;
  } catch (error) {
    console.error(
      "[DB] MongoDB connection failed:",
      error
    );

    throw error;
  }
}

module.exports = connectDB;