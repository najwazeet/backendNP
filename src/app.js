const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { connectDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const eventRoutes = require("./routes/events.routes");

function createServer() {
  const app = express();

  connectDB();

  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "1mb" }));

  const allowed = new Set(["http://localhost:5500", "http://127.0.0.1:5500"]);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // curl/postman
        cb(null, allowed.has(origin));
      },
    })
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
    })
  );

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/events", eventRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createServer };
