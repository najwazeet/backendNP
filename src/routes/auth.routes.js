const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const { RegisterSchema, LoginSchema } = require("../utils/validators");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function userDto(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name || "",
    photo: user.photo || "",
  };
}

/** Register (email + password) */
router.post("/register", async (req, res, next) => {
  try {
    const data = RegisterSchema.parse(req.body);

    const exists = await User.findOne({ email: data.email });
    if (exists) return res.status(409).json({ message: "Email already used" });

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({ email: data.email, passwordHash });

    res.status(201).json({ id: user._id.toString(), email: user.email });
  } catch (e) {
    next(e);
  }
});

/** Login (email + password) */
router.post("/login", async (req, res, next) => {
  try {
    const data = LoginSchema.parse(req.body);

    const user = await User.findOne({ email: data.email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    // kalau user Google tidak punya passwordHash, compare akan false (aman)
    const ok = await bcrypt.compare(data.password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken(user);
    res.json({ token, user: { id: user._id.toString(), email: user.email } });
  } catch (e) {
    next(e);
  }
});

/** Login with Google (GIS ID token -> JWT aplikasi) */
router.post("/google", async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ message: "Missing credential" });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const p = ticket.getPayload();
    const googleId = p?.sub;
    const email = (p?.email || "").toLowerCase();
    const name = p?.name || "";
    const photo = p?.picture || "";
    const emailVerified = !!p?.email_verified;

    if (!googleId)
      return res.status(400).json({ message: "Invalid Google token" });
    if (!email || !emailVerified) {
      return res.status(400).json({ message: "Google email not verified" });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = await User.create({ email, googleId, name, photo });
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (!user.name) user.name = name;
      if (!user.photo) user.photo = photo;
      await user.save();
    }

    const token = signToken(user);
    res.json({ token, user: userDto(user) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
