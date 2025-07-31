
// Utility functions for mapping extracted document data to form fields

export interface FormField {
  id: string
  label: string
  value: string
  isAutoPopulated: boolean
  confidence?: number
  documentType?: string
  source?: string
}

export interface TaxDocumentMapping {
  incomeType: string
  fields: FormField[]
  metadata: {
    documentType: string
    confidence: number
    extractionMethod: 'google_ai' | 'llm' | 'manual'
  }
}

/**
 * Maps extracted document data to tax form fields
 */
export function mapDocumentDataToFormFields(extractedData: any): TaxDocumentMapping[] {
  const mappings: TaxDocumentMapping[] = []
  const data = extractedData?.extractedData || extractedData
  const documentType = extractedData?.documentType || 'UNKNOWN'
  const confidence = extractedData?.confidence || 0.85

  // Handle W-2 data mapping
  if (documentType === 'W2' && data) {
    const w2Fields: FormField[] = []
    
    if (data.wages && parseFloat(cleanAmount(data.wages)) > 0) {
      w2Fields.push({
        id: 'wages',
        label: 'Wages (Box 1)',
        value: cleanAmount(data.wages),
        isAutoPopulated: true,
        confidence,
        documentType: 'W2',
        source: 'Box 1 - Wages, tips, other compensation'
      })
    }

    if (data.federalTaxWithheld && parseFloat(cleanAmount(data.federalTaxWithheld)) > 0) {
      w2Fields.push({
        id: 'federalTaxWithheld',
        label: 'Federal Tax Withheld (Box 2)',
        value: cleanAmount(data.federalTaxWithheld),
        isAutoPopulated: true,
        confidence,
        documentType: 'W2',
        source: 'Box 2 - Federal income tax withheld'
      })
    }

    if (data.employerName) {
      w2Fields.push({
        id: 'employerName',
        label: 'Employer Name',
        value: data.employerName,
        isAutoPopulated: true,
        confidence,
        documentType: 'W2',
        source: 'Employer information'
      })
    }

    if (data.employerEIN) {
      w2Fields.push({
        id: 'employerEIN',
        label: 'Employer EIN',
        value: data.employerEIN,
        isAutoPopulated: true,
        confidence,
        documentType: 'W2',
        source: 'Employer identification number'
      })
    }

    if (w2Fields.length > 0) {
      mappings.push({
        incomeType: 'W2_WAGES',
        fields: w2Fields,
        metadata: {
          documentType: 'W2',
          confidence,
          extractionMethod: extractedData?.confidence ? 'google_ai' : 'llm'
        }
      })
    }
  }

  // Handle 1099-INT data mapping
  if (documentType === 'FORM_1099_INT' && data) {
    const intFields: FormField[] = []
    
    if (data.interestIncome && parseFloat(cleanAmount(data.interestIncome)) > 0) {
      intFields.push({
        id: 'interestIncome',
        label: 'Interest Income (Box 1)',
        value: cleanAmount(data.interestIncome),
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_INT',
        source: 'Box 1 - Interest income'
      })
    }

    if (data.payerName) {
      intFields.push({
        id: 'payerName',
        label: 'Payer Name',
        value: data.payerName,
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_INT',
        source: 'Payer information'
      })
    }

    if (data.payerTIN) {
      intFields.push({
        id: 'payerTIN',
        label: 'Payer TIN',
        value: data.payerTIN,
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_INT',
        source: 'Payer identification number'
      })
    }

    if (intFields.length > 0) {
      mappings.push({
        incomeType: 'INTEREST',
        fields: intFields,
        metadata: {
          documentType: 'FORM_1099_INT',
          confidence,
          extractionMethod: extractedData?.confidence ? 'google_ai' : 'llm'
        }
      })
    }
  }

  // Handle 1099-DIV data mapping
  if (documentType === 'FORM_1099_DIV' && data) {
    const divFields: FormField[] = []
    
    if (data.ordinaryDividends && parseFloat(cleanAmount(data.ordinaryDividends)) > 0) {
      divFields.push({
        id: 'ordinaryDividends',
        label: 'Ordinary Dividends (Box 1a)',
        value: cleanAmount(data.ordinaryDividends),
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_DIV',
        source: 'Box 1a - Ordinary dividends'
      })
    }

    if (data.qualifiedDividends && parseFloat(cleanAmount(data.qualifiedDividends)) > 0) {
      divFields.push({
        id: 'qualifiedDividends',
        label: 'Qualified Dividends (Box 1b)',
        value: cleanAmount(data.qualifiedDividends),
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_DIV',
        source: 'Box 1b - Qualified dividends'
      })
    }

    if (data.payerName) {
      divFields.push({
        id: 'payerName',
        label: 'Payer Name',
        value: data.payerName,
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_DIV',
        source: 'Payer information'
      })
    }

    if (divFields.length > 0) {
      mappings.push({
        incomeType: 'DIVIDENDS',
        fields: divFields,
        metadata: {
          documentType: 'FORM_1099_DIV',
          confidence,
          extractionMethod: extractedData?.confidence ? 'google_ai' : 'llm'
        }
      })
    }
  }

  // Handle 1099-MISC data mapping
  if (documentType === 'FORM_1099_MISC' && data) {
    const miscFields: FormField[] = []
    
    const miscAmount = data.nonemployeeCompensation || data.otherIncome || data.rents || '0'
    if (parseFloat(cleanAmount(miscAmount)) > 0) {
      miscFields.push({
        id: 'miscIncome',
        label: 'Miscellaneous Income',
        value: cleanAmount(miscAmount),
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_MISC',
        source: 'Various boxes - Miscellaneous income'
      })
    }

    if (data.payerName) {
      miscFields.push({
        id: 'payerName',
        label: 'Payer Name',
        value: data.payerName,
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_MISC',
        source: 'Payer information'
      })
    }

    if (miscFields.length > 0) {
      mappings.push({
        incomeType: 'OTHER_INCOME',
        fields: miscFields,
        metadata: {
          documentType: 'FORM_1099_MISC',
          confidence,
          extractionMethod: extractedData?.confidence ? 'google_ai' : 'llm'
        }
      })
    }
  }

  // Handle 1099-NEC data mapping
  if (documentType === 'FORM_1099_NEC' && data) {
    const necFields: FormField[] = []
    
    if (data.nonemployeeCompensation && parseFloat(cleanAmount(data.nonemployeeCompensation)) > 0) {
      necFields.push({
        id: 'nonemployeeCompensation',
        label: 'Nonemployee Compensation (Box 1)',
        value: cleanAmount(data.nonemployeeCompensation),
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_NEC',
        source: 'Box 1 - Nonemployee compensation'
      })
    }

    if (data.payerName) {
      necFields.push({
        id: 'payerName',
        label: 'Payer Name',
        value: data.payerName,
        isAutoPopulated: true,
        confidence,
        documentType: 'FORM_1099_NEC',
        source: 'Payer information'
      })
    }

    if (necFields.length > 0) {
      mappings.push({
        incomeType: 'OTHER_INCOME',
        fields: necFields,
        metadata: {
          documentType: 'FORM_1099_NEC',
          confidence,
          extractionMethod: extractedData?.confidence ? 'google_ai' : 'llm'
        }
      })
    }
  }

  return mappings.filter(mapping => mapping.fields.length > 0)
}

/**
 * Clean and format monetary amounts
 */
function cleanAmount(amount: string): string {
  if (!amount) return '0'
  // Remove currency symbols, commas, and extra spaces
  return amount.toString().replace(/[$,\s]/g, '').replace(/[^\d.-]/g, '') || '0'
}

/**
 * Generate a summary of extracted data for user review
 */
export function generateExtractionSummary(mappings: TaxDocumentMapping[]): {
  totalAmount: number
  documentTypes: string[]
  fieldCount: number
  averageConfidence: number
} {
  let totalAmount = 0
  const documentTypes = new Set<string>()
  let fieldCount = 0
  let totalConfidence = 0

  mappings.forEach(mapping => {
    documentTypes.add(mapping.metadata.documentType)
    fieldCount += mapping.fields.length
    totalConfidence += mapping.metadata.confidence

    // Sum up monetary amounts
    mapping.fields.forEach(field => {
      if (field.id.includes('ncome') || field.id.includes('wage') || field.id.includes('dividend')) {
        totalAmount += parseFloat(field.value || '0')
      }
    })
  })

  return {
    totalAmount,
    documentTypes: Array.from(documentTypes),
    fieldCount,
    averageConfidence: mappings.length > 0 ? totalConfidence / mappings.length : 0
  }
}

/**
 * Validate extracted data for completeness and accuracy
 */
export interface ValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
  suggestions: string[]
}

export function validateExtractedData(mappings: TaxDocumentMapping[]): ValidationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const suggestions: string[] = []

  mappings.forEach(mapping => {
    // Check confidence levels
    if (mapping.metadata.confidence < 0.7) {
      warnings.push(`Low confidence (${Math.round(mapping.metadata.confidence * 100)}%) for ${mapping.metadata.documentType}. Please review the extracted data carefully.`)
    }

    // Check for missing critical fields
    if (mapping.incomeType === 'W2_WAGES') {
      const hasWages = mapping.fields.some(f => f.id === 'wages')
      const hasEmployer = mapping.fields.some(f => f.id === 'employerName')
      
      if (!hasWages) {
        errors.push('W-2 wage amount not found. Please verify the document and re-upload if necessary.')
      }
      if (!hasEmployer) {
        warnings.push('Employer name not detected in W-2. You may need to enter this manually.')
      }
    }

    // Check for unreasonable amounts
    mapping.fields.forEach(field => {
      const amount = parseFloat(field.value || '0')
      if (field.id.includes('ncome') || field.id.includes('wage')) {
        if (amount > 1000000) {
          warnings.push(`Very high income amount detected ($${amount.toLocaleString()}). Please verify this is correct.`)
        }
        if (amount < 0) {
          errors.push(`Negative income amount detected ($${amount.toLocaleString()}). This may indicate an extraction error.`)
        }
      }
    })
  })

  // Suggestions for improvement
  if (mappings.length === 0) {
    suggestions.push('No income data was extracted. Ensure the document is clear and in a supported format (PDF, PNG, JPG).')
  }

  const totalConfidence = mappings.reduce((sum, m) => sum + m.metadata.confidence, 0) / mappings.length
  if (totalConfidence < 0.8) {
    suggestions.push('Consider re-uploading a higher quality scan or photo of your tax document for better accuracy.')
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    suggestions
  }
}
