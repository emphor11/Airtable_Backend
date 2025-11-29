const axios = require("axios");

async function airtableRequest(token, url, method = "GET", body = null) {
  try {
    const options = {
      url,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    };

    if (method !== "GET" && method !== "DELETE") {
      options.data = body;
    }

    return await axios(options);
  } catch (err) {
    console.log("Airtable API error:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { airtableRequest };
