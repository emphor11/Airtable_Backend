const express = require("express");
const router = express.Router();
const Response = require("../models/Response");

router.post("/airtable", async (req, res) => {
  try {
    const { event, base, table, record } = req.body;

    console.log("Webhook received:", { event, base, table, recordId: record?.id });

    if (!event || !record) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const response = await Response.findOne({ airtableRecordId: record.id });

    if (!response) {
      console.log(`Response not found for Airtable record: ${record.id}`);
      return res.status(404).json({ message: "Response not found" });
    }

    switch (event) {
      case "record.updated":
        await Response.findByIdAndUpdate(response._id, {
          answers: record.fields,
          status: 'updated',
          updatedAt: new Date()
        });
        console.log(`Updated response ${response._id} for record ${record.id}`);
        break;

      case "record.deleted":
        await Response.findByIdAndUpdate(response._id, {
          deletedInAirtable: true,
          status: 'deleted',
          updatedAt: new Date()
        });
        console.log(`Marked response ${response._id} as deleted for record ${record.id}`);
        break;

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    res.json({ success: true, message: "Webhook processed" });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ 
      message: "Failed to process webhook", 
      error: err.message 
    });
  }
});

module.exports = router;

