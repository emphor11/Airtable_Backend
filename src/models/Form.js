const mongoose = require("mongoose")

const SUPPORTED_FIELD_TYPES = [
  'singleLineText',
  'multilineText',
  'singleSelect',
  'multipleSelects',
  'multipleAttachments'
];

const ConditionSchema = new mongoose.Schema({
  questionKey: { type: String, required: true },
  operator: { 
    type: String, 
    enum: ['equals', 'notEquals', 'contains'],
    required: true 
  },
  value: mongoose.Schema.Types.Mixed,
});

const ConditionalRulesSchema = new mongoose.Schema({
  logic: { 
    type: String, 
    enum: ['AND', 'OR'], 
    default: 'AND' 
  },
  conditions: [ConditionSchema]
});

const QuestionSchema = new mongoose.Schema({
  questionKey: { type: String, required: true },
  airtableFieldId: { type: String, required: true },
  label: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return SUPPORTED_FIELD_TYPES.includes(v);
      },
      message: props => `${props.value} is not a supported field type. Supported types: ${SUPPORTED_FIELD_TYPES.join(', ')}`
    }
  },
  required: { type: Boolean, default: false },
  options: { type: [String], default: [] },
  conditionalRules: { type: ConditionalRulesSchema, default: null }
});

const FormSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  airtableBaseId: { type: String, required: true },
  airtableTableId: { type: String, required: true },
  questions: [QuestionSchema],
}, { timestamps: true });

module.exports = mongoose.model("Form", FormSchema);
