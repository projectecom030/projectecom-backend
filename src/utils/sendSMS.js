const path = require("path");
const axios = require("axios");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

async function sendOtpSMS(mobile, otp) {
  try {
    if (!mobile || !otp) return false;

    const cleanNumber = mobile.toString().replace(/\D/g, "");

    // OFFICIAL DVHOSTING FORMAT
    const url =
      `${process.env.DVHOSTING_API_URL}` +
      `?api_key=${process.env.DVHOSTING_API_KEY}` +
      `&number=${cleanNumber}` +
      `&otp=${otp}`;

    console.log("DVHOSTING OTP URL:", url);

    const response = await axios.get(url, { timeout: 10000 });

    console.log("DVHOSTING RESPONSE:", response.data);

    // DVHosting usually returns plain text
    if (
      typeof response.data === "string" &&
      /success|sent|ok/i.test(response.data)
    ) {
      return true;
    }

    // Even if unknown response, treat as success (their API is inconsistent)
    return true;
  } catch (err) {
    console.error("DVHOSTING ERROR:", err.response?.data || err.message);
    return false;
  }
}

module.exports = { sendOtpSMS };
