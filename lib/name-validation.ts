
// Name validation utility for comparing user profile names with document names

export interface NameValidationResult {
  isValid: boolean
  confidence: number
  mismatches: NameMismatch[]
  suggestions: string[]
}

export interface NameMismatch {
  field: string
  profileName: string
  documentName: string
  severity: 'low' | 'medium' | 'high'
}

export interface ExtractedNames {
  employeeName?: string
  recipientName?: string
  spouseName?: string
  [key: string]: string | undefined
}

export interface ProfileNames {  
  firstName: string
  lastName: string
  spouseFirstName?: string
  spouseLastName?: string
}

/**
 * Validates names extracted from documents against user profile names
 */
export function validateNames(
  profileNames: ProfileNames,
  extractedNames: ExtractedNames
): NameValidationResult {
  const mismatches: NameMismatch[] = []
  const suggestions: string[] = []
  
  // Normalize names for comparison
  const normalizeString = (str: string): string => {
    return str?.toLowerCase().replace(/[^a-z\s]/g, '').trim() || ''
  }

  // Split full names into parts
  const splitName = (fullName: string): { first: string; last: string } => {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length === 1) {
      return { first: parts[0], last: '' }
    }
    return {
      first: parts[0],
      last: parts.slice(-1)[0] // Take last part as last name
    }
  }

  // Calculate similarity between two strings using Levenshtein distance
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0
    
    const s1 = normalizeString(str1)
    const s2 = normalizeString(str2)
    
    if (s1 === s2) return 1.0
    
    // Handle common variations
    const commonVariations: Record<string, string[]> = {
      'robert': ['bob', 'rob', 'bobby'],
      'william': ['bill', 'will', 'billy'],
      'richard': ['rick', 'dick', 'rich'],
      'michael': ['mike', 'mick'],
      'elizabeth': ['liz', 'beth', 'betty'],
      'katherine': ['kate', 'kathy', 'katie'],
      'jennifer': ['jen', 'jenny'],
      'christopher': ['chris'],
      'matthew': ['matt'],
      'benjamin': ['ben'],
      'joseph': ['joe', 'joey'],
      'daniel': ['dan', 'danny'],
      'anthony': ['tony'],
      'patricia': ['pat', 'patty'],
      'susan': ['sue', 'susie'],
      'margaret': ['maggie', 'meg', 'peggy']
    }

    // Check for nickname matches
    for (const [fullName, nicknames] of Object.entries(commonVariations)) {
      if ((s1 === fullName && nicknames.includes(s2)) || 
          (s2 === fullName && nicknames.includes(s1)) ||
          (nicknames.includes(s1) && nicknames.includes(s2))) {
        return 0.9
      }
    }

    // Levenshtein distance calculation
    const matrix: number[][] = []
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }
    
    const maxLength = Math.max(s1.length, s2.length)
    return maxLength > 0 ? 1 - (matrix[s2.length][s1.length] / maxLength) : 0
  }

  // Validate primary taxpayer name
  if (extractedNames.employeeName || extractedNames.recipientName) {
    const documentName = extractedNames.employeeName || extractedNames.recipientName || ''
    const { first: docFirst, last: docLast } = splitName(documentName)
    
    const profileFullName = `${profileNames.firstName} ${profileNames.lastName}`.trim()
    const profileFirst = normalizeString(profileNames.firstName)
    const profileLast = normalizeString(profileNames.lastName)
    
    const firstNameSimilarity = calculateSimilarity(profileFirst, docFirst)
    const lastNameSimilarity = calculateSimilarity(profileLast, docLast)
    const fullNameSimilarity = calculateSimilarity(profileFullName, documentName)
    
    // Check for mismatches
    if (firstNameSimilarity < 0.8) {
      mismatches.push({
        field: 'firstName',
        profileName: profileNames.firstName,
        documentName: docFirst,
        severity: firstNameSimilarity < 0.5 ? 'high' : firstNameSimilarity < 0.7 ? 'medium' : 'low'
      })
      
      if (firstNameSimilarity > 0.5) {
        suggestions.push(`Did you mean "${docFirst}" instead of "${profileNames.firstName}"?`)
      }
    }
    
    if (lastNameSimilarity < 0.8) {
      mismatches.push({
        field: 'lastName',
        profileName: profileNames.lastName,
        documentName: docLast,
        severity: lastNameSimilarity < 0.5 ? 'high' : lastNameSimilarity < 0.7 ? 'medium' : 'low'
      })
      
      if (lastNameSimilarity > 0.5) {
        suggestions.push(`Did you mean "${docLast}" instead of "${profileNames.lastName}"?`)
      }
    }
  }

  // Validate spouse name if applicable
  if ((profileNames.spouseFirstName || profileNames.spouseLastName) && extractedNames.spouseName) {
    const { first: docSpouseFirst, last: docSpouseLast } = splitName(extractedNames.spouseName)
    
    const spouseFirstSimilarity = calculateSimilarity(
      profileNames.spouseFirstName || '', 
      docSpouseFirst
    )
    const spouseLastSimilarity = calculateSimilarity(
      profileNames.spouseLastName || '', 
      docSpouseLast
    )
    
    if (spouseFirstSimilarity < 0.8) {
      mismatches.push({
        field: 'spouseFirstName',
        profileName: profileNames.spouseFirstName || '',
        documentName: docSpouseFirst,
        severity: spouseFirstSimilarity < 0.5 ? 'high' : spouseFirstSimilarity < 0.7 ? 'medium' : 'low'
      })
    }
    
    if (spouseLastSimilarity < 0.8) {
      mismatches.push({
        field: 'spouseLastName', 
        profileName: profileNames.spouseLastName || '',
        documentName: docSpouseLast,
        severity: spouseLastSimilarity < 0.5 ? 'high' : spouseLastSimilarity < 0.7 ? 'medium' : 'low'
      })
    }
  }

  // Overall validation result
  const highSeverityCount = mismatches.filter(m => m.severity === 'high').length
  const mediumSeverityCount = mismatches.filter(m => m.severity === 'medium').length
  
  let confidence = 1.0
  if (highSeverityCount > 0) {
    confidence = Math.max(0.1, 1.0 - (highSeverityCount * 0.4) - (mediumSeverityCount * 0.2))
  } else if (mediumSeverityCount > 0) {
    confidence = Math.max(0.6, 1.0 - (mediumSeverityCount * 0.2))
  } else if (mismatches.length > 0) {
    confidence = Math.max(0.8, 1.0 - (mismatches.length * 0.1))
  }

  return {
    isValid: mismatches.length === 0 || mismatches.every(m => m.severity === 'low'),
    confidence,
    mismatches,
    suggestions
  }
}

/**
 * Extract names from document data for validation
 */
export function extractNamesFromDocument(extractedData: any): ExtractedNames {
  const names: ExtractedNames = {}
  
  if (extractedData?.employeeName) {
    names.employeeName = extractedData.employeeName
  }
  
  if (extractedData?.recipientName) {
    names.recipientName = extractedData.recipientName
  }
  
  // For joint tax returns, try to extract spouse name from various fields
  if (extractedData?.spouseName) {
    names.spouseName = extractedData.spouseName
  }
  
  return names
}
