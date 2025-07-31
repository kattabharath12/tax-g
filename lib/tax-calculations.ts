
export interface TaxBracket {
  min: number
  max: number
  rate: number
}

export interface StandardDeduction {
  single: number
  marriedFilingJointly: number
  marriedFilingSeparately: number
  headOfHousehold: number
  qualifyingSurvivingSpouse: number
}

// 2024 Tax Year Brackets
export const TAX_BRACKETS_2024: Record<string, TaxBracket[]> = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11601, max: 47150, rate: 0.12 },
    { min: 47151, max: 100525, rate: 0.22 },
    { min: 100526, max: 191950, rate: 0.24 },
    { min: 191951, max: 243725, rate: 0.32 },
    { min: 243726, max: 609350, rate: 0.35 },
    { min: 609351, max: Infinity, rate: 0.37 },
  ],
  marriedfilingjointly: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23201, max: 94300, rate: 0.12 },
    { min: 94301, max: 201050, rate: 0.22 },
    { min: 201051, max: 383900, rate: 0.24 },
    { min: 383901, max: 487450, rate: 0.32 },
    { min: 487451, max: 731200, rate: 0.35 },
    { min: 731201, max: Infinity, rate: 0.37 },
  ],
  marriedfilingseparately: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11601, max: 47150, rate: 0.12 },
    { min: 47151, max: 100525, rate: 0.22 },
    { min: 100526, max: 191950, rate: 0.24 },
    { min: 191951, max: 243725, rate: 0.32 },
    { min: 243726, max: 365600, rate: 0.35 },
    { min: 365601, max: Infinity, rate: 0.37 },
  ],
  headofhousehold: [
    { min: 0, max: 16550, rate: 0.10 },
    { min: 16551, max: 63100, rate: 0.12 },
    { min: 63101, max: 100500, rate: 0.22 },
    { min: 100501, max: 191950, rate: 0.24 },
    { min: 191951, max: 243700, rate: 0.32 },
    { min: 243701, max: 609350, rate: 0.35 },
    { min: 609351, max: Infinity, rate: 0.37 },
  ],
  qualifyingsurvivingspouse: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23201, max: 94300, rate: 0.12 },
    { min: 94301, max: 201050, rate: 0.22 },
    { min: 201051, max: 383900, rate: 0.24 },
    { min: 383901, max: 487450, rate: 0.32 },
    { min: 487451, max: 731200, rate: 0.35 },
    { min: 731201, max: Infinity, rate: 0.37 },
  ],
}

// 2024 Standard Deduction Amounts
export const STANDARD_DEDUCTION_2024: StandardDeduction = {
  single: 14600,
  marriedFilingJointly: 29200,
  marriedFilingSeparately: 14600,
  headOfHousehold: 21900,
  qualifyingSurvivingSpouse: 29200,
}

export function calculateTaxLiability(taxableIncome: number, filingStatus: string): number {
  const brackets = TAX_BRACKETS_2024[filingStatus.toLowerCase().replace(/_/g, '')]
  
  if (!brackets) {
    throw new Error(`Invalid filing status: ${filingStatus}`)
  }

  let tax = 0
  
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) {
      break
    }
    
    const taxableInThisBracket = Math.min(taxableIncome, bracket.max) - bracket.min
    tax += taxableInThisBracket * bracket.rate
  }
  
  return Math.round(tax * 100) / 100
}

export function getStandardDeduction(filingStatus: string): number {
  const status = filingStatus.toLowerCase().replace(/_/g, '')
  
  switch (status) {
    case 'single':
      return STANDARD_DEDUCTION_2024.single
    case 'marriedfilingjointly':
      return STANDARD_DEDUCTION_2024.marriedFilingJointly
    case 'marriedfilingseparately':
      return STANDARD_DEDUCTION_2024.marriedFilingSeparately
    case 'headofhousehold':
      return STANDARD_DEDUCTION_2024.headOfHousehold
    case 'qualifyingsurvivingspouse':
      return STANDARD_DEDUCTION_2024.qualifyingSurvivingSpouse
    default:
      return STANDARD_DEDUCTION_2024.single
  }
}

export function calculateChildTaxCredit(dependents: any[]): number {
  const qualifyingChildren = dependents?.filter(dep => dep.qualifiesForCTC) || []
  return qualifyingChildren.length * 2000
}

export function calculateEITC(income: number, dependents: any[]): number {
  const childCount = dependents?.filter(dep => dep.qualifiesForEITC)?.length || 0
  
  // 2024 EITC maximum amounts (simplified)
  const maxEITC = {
    0: 632,
    1: 4213,
    2: 6960,
    3: 7830,
  }
  
  const maxForChildren = maxEITC[Math.min(childCount, 3) as keyof typeof maxEITC]
  
  // Income limits (simplified - single filer)
  const incomeLimits = {
    0: 18591,
    1: 49084,
    2: 55768,
    3: 59899,
  }
  
  const limitForChildren = incomeLimits[Math.min(childCount, 3) as keyof typeof incomeLimits]
  
  if (income > limitForChildren) {
    return 0
  }
  
  // Simplified calculation - in reality, EITC has phase-in and phase-out ranges
  const phaseInRate = childCount === 0 ? 0.0765 : childCount === 1 ? 0.34 : 0.40
  const earnedCredit = Math.min(income * phaseInRate, maxForChildren)
  
  return Math.round(earnedCredit)
}

export interface TaxCalculationResult {
  grossIncome: number
  adjustedGrossIncome: number
  standardDeduction: number
  itemizedDeduction: number
  taxableIncome: number
  taxLiability: number
  childTaxCredit: number
  earnedIncomeCredit: number
  totalCredits: number
  finalTax: number
  effectiveRate: number
  marginalRate: number
}

export function calculateTaxReturn(data: {
  totalIncome: number
  filingStatus: string
  dependents: any[]
  itemizedDeductions: number
}): TaxCalculationResult {
  const { totalIncome, filingStatus, dependents, itemizedDeductions } = data
  
  const grossIncome = totalIncome
  const adjustedGrossIncome = grossIncome // No adjustments for Stage 1
  
  const standardDeduction = getStandardDeduction(filingStatus)
  const itemizedDeduction = itemizedDeductions || 0
  
  const deduction = Math.max(standardDeduction, itemizedDeduction)
  const taxableIncome = Math.max(0, adjustedGrossIncome - deduction)
  
  const taxLiability = calculateTaxLiability(taxableIncome, filingStatus)
  
  const childTaxCredit = calculateChildTaxCredit(dependents)
  const earnedIncomeCredit = calculateEITC(grossIncome, dependents)
  const totalCredits = childTaxCredit + earnedIncomeCredit
  
  const finalTax = Math.max(0, taxLiability - totalCredits)
  
  const effectiveRate = grossIncome > 0 ? (finalTax / grossIncome) * 100 : 0
  
  // Calculate marginal rate
  const brackets = TAX_BRACKETS_2024[filingStatus.toLowerCase().replace(/_/g, '')]
  let marginalRate = 0
  if (brackets) {
    for (const bracket of brackets) {
      if (taxableIncome > bracket.min) {
        marginalRate = bracket.rate * 100
      }
    }
  }
  
  return {
    grossIncome,
    adjustedGrossIncome,
    standardDeduction,
    itemizedDeduction,
    taxableIncome,
    taxLiability,
    childTaxCredit,
    earnedIncomeCredit,
    totalCredits,
    finalTax,
    effectiveRate,
    marginalRate,
  }
}
