const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth")
const {airtableRequest} = require("../../utils/airtableRequest");
const Form = require("../models/Form");
const Response = require("../models/Response");
const { isSupportedFieldType } = require("../utils/conditionalLogic");

router.get("/test-auth", requireAuth, async (req, res) => {
  try {
    const token = req.user.accessToken;
    
    if (!token) {
      return res.status(401).json({ 
        message: "No access token found",
        user: {
          id: req.user._id,
          airtableUserId: req.user.airtableUserId,
          hasAccessToken: false
        }
      });
    }
    
    try {
      const response = await airtableRequest(
        token,
        "https://api.airtable.com/v0/meta/whoami"
      );
      
      return res.json({
        success: true,
        message: "Token is valid",
        user: {
          id: req.user._id,
          airtableUserId: req.user.airtableUserId,
          airtableUserInfo: response.data,
          hasAccessToken: true
        }
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Token is invalid or expired",
        error: err.response?.data || err.message,
        user: {
          id: req.user._id,
          airtableUserId: req.user.airtableUserId,
          hasAccessToken: true
        }
      });
    }
  } catch (err) {
    res.status(500).json({ 
      message: "Error testing auth",
      error: err.message 
    });
  }
});

router.get("/bases", requireAuth, async (req, res) => {
    try {
      const token = req.user.accessToken;
      
      if (!token) {
        console.log("No access token found for user:", req.user._id);
        return res.status(401).json({ 
          message: "No access token found. Please authenticate with Airtable first." 
        });
      }
      
      console.log("Fetching bases with token:", token ? "Token exists" : "No token");
      console.log("User ID:", req.user._id);
      
      const response = await airtableRequest(
        token,
        "https://api.airtable.com/v0/meta/bases"
      );
      
      console.log("FULL AIRTABLE RESPONSE:", JSON.stringify(response.data, null, 2));
      
      const bases = response.data.bases || [];
      console.log("Number of bases found:", bases.length);
      
      if (bases.length === 0) {
        console.warn("⚠️ No bases found. This could mean:");
        console.warn("1. The user has no bases in their Airtable account");
        console.warn("2. The bases are not shared with the OAuth app");
        console.warn("3. The user needs to share bases with the OAuth app in Airtable settings");
      }
  
      res.json(bases);
    } catch (err) {
      console.error("Error fetching bases:");
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      console.error("Error message:", err.message);
      
      if (err.response?.status === 401) {
        return res.status(401).json({ 
          message: "Invalid or expired access token. Please re-authenticate with Airtable." 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to fetch bases",
        error: err.response?.data || err.message 
      });
    }
  });

router.get("/:baseId/tables", requireAuth, async (req, res) => {
    try {
      const token = req.user.accessToken;
      const { baseId } = req.params;
  
      const response = await airtableRequest(
        token,
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables`
      );
  
      res.json(response.data.tables);
    } catch (err) {
      console.log(err.response?.data || err);
      res.status(500).json({ message: "Failed to fetch tables" });
    }
  });


  router.get("/:baseId/tables/:tableId/fields", requireAuth, async (req, res) => {
    try {
      const token = req.user.accessToken;
      const { baseId, tableId } = req.params;
  
      const response = await airtableRequest(
        token,
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables`
      );
  
      const table = response.data.tables.find(t => t.id === tableId);
  
      if (!table)
        return res.status(404).json({ message: "Table not found" });
  
      const supportedFields = table.fields.filter(field => isSupportedFieldType(field.type));
      const unsupportedFields = table.fields.filter(field => !isSupportedFieldType(field.type));
      
      if (unsupportedFields.length > 0) {
        console.log(`Filtered out ${unsupportedFields.length} unsupported field(s):`, 
          unsupportedFields.map(f => `${f.name} (${f.type})`).join(', '));
      }
  
      res.json(supportedFields);
    } catch (err) {
      console.log(err.response?.data || err);
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  router.post("/", requireAuth, async (req, res) => {
    try {
      if (req.body.questions && Array.isArray(req.body.questions)) {
        const unsupportedQuestions = req.body.questions.filter(q => !isSupportedFieldType(q.type));
        if (unsupportedQuestions.length > 0) {
          return res.status(400).json({ 
            message: "Unsupported field types found",
            unsupported: unsupportedQuestions.map(q => ({ 
              label: q.label, 
              type: q.type 
            }))
          });
        }

        const token = req.user.accessToken;
        if (token && req.body.airtableBaseId && req.body.airtableTableId) {
          try {
            const tableResponse = await airtableRequest(
              token,
              `https://api.airtable.com/v0/meta/bases/${req.body.airtableBaseId}/tables`
            );
            
            const table = tableResponse.data.tables.find(t => t.id === req.body.airtableTableId);
            
            if (table) {
              for (const question of req.body.questions) {
                const airtableField = table.fields.find(f => f.id === question.airtableFieldId);
                if (airtableField) {
                  if (question.type === 'singleSelect' && airtableField.options?.choices) {
                    question.options = airtableField.options.choices.map(choice => choice.name);
                  } else if (question.type === 'multipleSelects' && airtableField.options?.choices) {
                    question.options = airtableField.options.choices.map(choice => choice.name);
                  }
                }
              }
            }
          } catch (err) {
            console.warn("Could not fetch field options from Airtable:", err.message);
          }
        }
      }

      const form = await Form.create({
        owner: req.user._id,
        ...req.body,
      });
  
      res.json(form);
    } catch (err) {
      console.log(err);
      if (err.name === 'ValidationError') {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: Object.keys(err.errors).map(key => ({
            field: key,
            message: err.errors[key].message
          }))
        });
      }
      res.status(500).json({ message: "Failed to create form", error: err.message });
    }
  });
  
  router.get("/", requireAuth, async (req, res) => {
    const forms = await Form.find({ owner: req.user._id });
    res.json(forms);
  });

  router.get("/public/:formId", async (req, res) => {
    try {
      const form = await Form.findById(req.params.formId);
      if (!form) return res.status(404).json({ message: "Form not found" });
      res.json(form);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch form" });
    }
  });

  router.get("/:formId", requireAuth, async (req, res) => {
    try {
      const form = await Form.findOne({
        _id: req.params.formId,
        owner: req.user._id,
      });
  
      if (!form) return res.status(404).json({ message: "Form not found" });
  
      res.json(form);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch form" });
    }
  });

  router.post("/:formId/submit", async (req, res) => {
    try {
      const { formId } = req.params;
      const { answers } = req.body;

      const form = await Form.findById(formId);
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      const requiredQuestions = form.questions.filter(q => q.required);
      const missingFields = requiredQuestions.filter(q => {
        const answer = answers[q.questionKey];
        return answer === undefined || answer === null || answer === '' || 
               (Array.isArray(answer) && answer.length === 0);
      });

      if (missingFields.length > 0) {
        return res.status(400).json({
          message: "Missing required fields",
          missingFields: missingFields.map(q => q.label)
        });
      }

      const validationErrors = [];
      for (const question of form.questions) {
        const answer = answers[question.questionKey];
        if (answer === undefined || answer === null) continue;

        if (question.type === 'singleSelect') {
          if (typeof answer !== 'string') {
            validationErrors.push(`${question.label} must be a single selection`);
          }
        } else if (question.type === 'multipleSelects') {
          if (!Array.isArray(answer)) {
            validationErrors.push(`${question.label} must be an array of selections`);
          }
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Validation errors",
          errors: validationErrors
        });
      }

      const User = require("../models/User");
      const owner = await User.findById(form.owner);
      if (!owner || !owner.accessToken) {
        return res.status(500).json({ message: "Form owner authentication not found" });
      }

      const airtableFields = {};
      for (const question of form.questions) {
        const answer = answers[question.questionKey];
        if (answer === undefined || answer === null || answer === '') {
          continue;
        }

        switch (question.type) {
          case 'singleSelect':
            const singleSelectValue = String(answer);
            if (question.options && question.options.length > 0) {
              if (!question.options.includes(singleSelectValue)) {
                return res.status(400).json({
                  message: `Invalid option for "${question.label}"`,
                  error: `"${singleSelectValue}" is not a valid option. Valid options: ${question.options.join(', ')}`
                });
              }
            }
            airtableFields[question.airtableFieldId] = singleSelectValue;
            break;

          case 'multipleSelects':
            let multiSelectValues = [];
            if (Array.isArray(answer)) {
              multiSelectValues = answer.map(a => String(a));
            } else if (typeof answer === 'string') {
              multiSelectValues = answer.split(',').map(s => s.trim()).filter(s => s);
            } else {
              multiSelectValues = [String(answer)];
            }
            if (question.options && question.options.length > 0) {
              const invalidOptions = multiSelectValues.filter(v => !question.options.includes(v));
              if (invalidOptions.length > 0) {
                return res.status(400).json({
                  message: `Invalid options for "${question.label}"`,
                  error: `"${invalidOptions.join(', ')}" are not valid options. Valid options: ${question.options.join(', ')}`
                });
              }
            }
            airtableFields[question.airtableFieldId] = multiSelectValues;
            break;

          case 'multipleAttachments':
            if (Array.isArray(answer) && answer.length > 0) {
              console.warn(`Skipping attachment field ${question.airtableFieldId} - file upload not implemented`);
            }
            break;

          case 'singleLineText':
          case 'multilineText':
          default:
            airtableFields[question.airtableFieldId] = String(answer);
            break;
        }
      }

      if (Object.keys(airtableFields).length === 0) {
        return res.status(400).json({
          message: "No valid fields to submit",
          error: "All fields are empty or invalid"
        });
      }

      console.log("Submitting to Airtable:", {
        baseId: form.airtableBaseId,
        tableId: form.airtableTableId,
        fields: airtableFields
      });

      const airtableResponse = await airtableRequest(
        owner.accessToken,
        `https://api.airtable.com/v0/${form.airtableBaseId}/${form.airtableTableId}`,
        'POST',
        { fields: airtableFields }
      );

      const airtableRecordId = airtableResponse.data.id;

      const response = await Response.create({
        formId: form._id,
        airtableRecordId,
        answers,
        status: 'submitted'
      });

      res.json({
        success: true,
        responseId: response._id,
        airtableRecordId,
        message: "Form submitted successfully"
      });

    } catch (err) {
      console.error("Form submission error:", err);
      console.error("Error details:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });

      if (err.response?.status === 422) {
        const airtableError = err.response.data?.error || err.response.data;
        return res.status(400).json({
          message: "Airtable validation error - The data format doesn't match the table schema",
          error: airtableError,
          details: "This usually means: 1) A required field is missing, 2) Field type mismatch (e.g., sending text to number field), 3) Invalid option for select fields, or 4) Wrong field ID"
        });
      }

      if (err.response?.status === 401) {
        return res.status(401).json({
          message: "Authentication failed with Airtable",
          error: "The access token may be expired. Please re-authenticate."
        });
      }

      res.status(500).json({ 
        message: "Failed to submit form", 
        error: err.message,
        details: err.response?.data || "Unknown error occurred"
      });
    }
  });

  router.get("/:formId/responses", requireAuth, async (req, res) => {
    try {
      const { formId } = req.params;

      const form = await Form.findOne({
        _id: formId,
        owner: req.user._id,
      });

      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      const responses = await Response.find({ formId })
        .sort({ createdAt: -1 })
        .select('_id airtableRecordId answers status deletedInAirtable createdAt updatedAt');

      res.json(responses);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch responses" });
    }
  });

  module.exports = router


