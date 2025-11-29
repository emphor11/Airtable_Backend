const mongoose = require("mongoose");

const ResponseSchema = new mongoose.Schema({
  formId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Form", 
    required: true 
  },
  airtableRecordId: { 
    type: String, 
    required: true
  },
  answers: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true
  },
  deletedInAirtable: { 
    type: Boolean, 
    default: false
  },
  status: { 
    type: String, 
    enum: ['submitted', 'updated', 'deleted'],
    default: 'submitted'
  }
}, { timestamps: true });

module.exports = mongoose.model("Response", ResponseSchema);

