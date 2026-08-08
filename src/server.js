require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = Number(process.env.PORT || 5000);

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  await connectDB();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[API] PO System running on port ${PORT}`);
    console.log(
      `[API] Environment: ${process.env.NODE_ENV || "development"}`
    );
  });
}

start().catch((error) => {
  console.error("[STARTUP]", error);
  process.exit(1);
});