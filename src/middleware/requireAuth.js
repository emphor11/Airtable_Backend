const User = require("../models/User")
const mongoose = require("mongoose")

const requireAuth = async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"];
      
      if (!userId) {
        console.log("Missing user ID in headers");
        return res.status(401).json({ message: "Missing user ID" });
      }
  
      console.log("Looking up user with ID:", userId);
      
      let user = null;
      
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId);
      }
      
      if (!user && userId.startsWith('usr')) {
        user = await User.findOne({ airtableUserId: userId });
      }
      
      if (!user) {
        user = await User.findOne({ airtableUserId: userId });
      }
      
      if (!user) {
        console.log("User not found with ID:", userId);
        return res.status(401).json({ message: "User not found" });
      }
  
      console.log("User found:", {
        id: user._id,
        airtableUserId: user.airtableUserId,
        hasAccessToken: !!user.accessToken,
        hasRefreshToken: !!user.refreshToken
      });
  
      req.user = user;
      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      res.status(500).json({ message: "Auth failed", error: err.message });
    }
};

module.exports = requireAuth