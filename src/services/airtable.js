const axios = require("axios")

const airtableRequest = async (token, url) => {
    return axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  };

module.exports = { airtableRequest };