require("dotenv").config();
const express = require("express");
const axios = require("axios");
const qs = require("qs");
const User = require("../models/User");
const crypto = require("crypto");
const router = express.Router();

const AIRTABLE_AUTH_URL = "https://airtable.com/oauth2/v1/authorize";
const AIRTABLE_TOKEN_URL = "https://airtable.com/oauth2/v1/token";
const AIRTABLE_USER_URL = "https://api.airtable.com/v0/meta/whoami";

function base64url(buffer) {
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

router.get("/login",(req,res)=>{
  const codeVerifier = base64url(crypto.randomBytes(32));

  res.cookie("code_verifier", codeVerifier, { httpOnly: true });

  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = base64url(hash);
  const state = base64url(crypto.randomBytes(32));
  res.cookie("oauth_state", state, { httpOnly: true });
  
  const params = new URLSearchParams({
    client_id: process.env.AIRTABLE_CLIENT_ID,
    redirect_uri: process.env.AIRTABLE_REDIRECT_URI,
    response_type: "code",
    scope:
      "data.records:read data.records:write data.recordComments:read data.recordComments:write schema.bases:read",
    state ,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

    console.log("Redirecting to Airtable with:", `${AIRTABLE_AUTH_URL}?${params.toString()}`);
    res.redirect(`${AIRTABLE_AUTH_URL}?${params.toString()}`);
})

router.get("/callback", async (req, res) => {
    const { code, error, state } = req.query;
    const codeVerifier = req.cookies.code_verifier;
    const savedState = req.cookies.oauth_state;
  
    if (!state || state !== savedState) {
      return res.status(400).send("Invalid state parameter");
    }
  
    if (error) {
      console.error("OAuth error:", error);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=${error}`);
    }
  
    if (!code) return res.status(400).send("No code provided");
    if (!codeVerifier) return res.status(400).send("Missing code verifier");
  
    try {
      const basicAuth = Buffer.from(
        `${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`
      ).toString("base64");
      
      const tokenResponse = await axios.post(
        AIRTABLE_TOKEN_URL,
        qs.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.AIRTABLE_REDIRECT_URI,
          client_id: process.env.AIRTABLE_CLIENT_ID,
          code_verifier: codeVerifier,
        }),
        {
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuth}`,
          }
        }
      );
  
      const { access_token, refresh_token } = tokenResponse.data;
  
      const userProfile = await axios.get(AIRTABLE_USER_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
  
      const { id: airtableUserId } = userProfile.data;
  
      const user = await User.findOneAndUpdate(
        { airtableUserId },
        {
          airtableUserId,
          profile: userProfile.data,
          accessToken: access_token,
          refreshToken: refresh_token,
          lastLoginAt: new Date(),
        },
        { upsert: true, new: true }
      );
  
      res.clearCookie("code_verifier");
      res.clearCookie("oauth_state");
  
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?login=success&userId=${user._id}`);
  
    } catch (err) {
      console.error("OAuth error:", err.response?.data || err);
      return res.status(500).send("Airtable OAuth failed");
    }
  });

router.get("/user/:airtableUserId", async (req, res) => {
  try {
    const user = await User.findOne({ airtableUserId: req.params.airtableUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ 
      userId: user._id,
      airtableUserId: user.airtableUserId,
      hasAccessToken: !!user.accessToken,
      lastLoginAt: user.lastLoginAt
    });
  } catch (err) {
    console.error("Error finding user:", err);
    res.status(500).json({ message: "Error finding user", error: err.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, { 
      _id: 1, 
      airtableUserId: 1, 
      profile: 1, 
      hasAccessToken: { $cond: [{ $ifNull: ["$accessToken", false] }, true, false] },
      lastLoginAt: 1 
    });
    res.json(users.map(u => ({
      userId: u._id,
      airtableUserId: u.airtableUserId,
      email: u.profile?.email,
      hasAccessToken: !!u.accessToken,
      lastLoginAt: u.lastLoginAt
    })));
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users", error: err.message });
  }
});

module.exports = router