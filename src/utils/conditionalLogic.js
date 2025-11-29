function shouldShowQuestion(rules, answersSoFar) {
  if (!rules || !rules.conditions || rules.conditions.length === 0) {
    return true;
  }

  const { logic, conditions } = rules;

  const conditionResults = conditions.map(condition => {
    const { questionKey, operator, value } = condition;
    const answerValue = answersSoFar[questionKey];

    if (answerValue === undefined || answerValue === null || answerValue === '') {
      return false;
    }

    switch (operator) {
      case 'equals':
        if (Array.isArray(answerValue)) {
          return answerValue.includes(value) || answerValue.some(v => String(v) === String(value));
        }
        return String(answerValue) === String(value);

      case 'notEquals':
        if (Array.isArray(answerValue)) {
          return !answerValue.includes(value) && !answerValue.some(v => String(v) === String(value));
        }
        return String(answerValue) !== String(value);

      case 'contains':
        const answerStr = Array.isArray(answerValue) 
          ? answerValue.join(' ') 
          : String(answerValue);
        const valueStr = String(value);
        return answerStr.toLowerCase().includes(valueStr.toLowerCase());

      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  });

  if (logic === 'OR') {
    return conditionResults.some(result => result === true);
  } else {
    return conditionResults.every(result => result === true);
  }
}

function isSupportedFieldType(fieldType) {
  const SUPPORTED_TYPES = [
    'singleLineText',
    'multilineText',
    'singleSelect',
    'multipleSelects',
    'multipleAttachments'
  ];
  return SUPPORTED_TYPES.includes(fieldType);
}

module.exports = {
  shouldShowQuestion,
  isSupportedFieldType
};

