
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calculator, ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { calculateTaxReturn } from "@/lib/tax-calculations"

interface TaxCalculationStepProps {
  taxReturn: any
  onUpdate: (data: any) => Promise<any>
  onNext: () => void
  onPrev: () => void
  loading: boolean
  saving: boolean
}

export function TaxCalculationStep({ taxReturn, onUpdate, onNext, onPrev, loading, saving }: TaxCalculationStepProps) {
  const [calculation, setCalculation] = useState<any>(null)

  useEffect(() => {
    // Calculate tax return based on current data
    const totalIncome = Number(taxReturn.totalIncome) || 0
    const itemizedDeductions = taxReturn.deductionEntries?.reduce((sum: number, entry: any) => 
      sum + parseFloat(entry.amount || 0), 0
    ) || 0
    
    const result = calculateTaxReturn({
      totalIncome,
      filingStatus: taxReturn.filingStatus,
      dependents: taxReturn.dependents || [],
      itemizedDeductions,
    })
    
    setCalculation(result)
  }, [taxReturn])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!calculation) return

    const refundAmount = calculation.finalTax < 0 ? Math.abs(calculation.finalTax) : 0
    const amountOwed = calculation.finalTax > 0 ? calculation.finalTax : 0
    
    await onUpdate({
      totalIncome: calculation.grossIncome,
      adjustedGrossIncome: calculation.adjustedGrossIncome,
      standardDeduction: calculation.standardDeduction,
      itemizedDeduction: calculation.itemizedDeduction,
      taxableIncome: calculation.taxableIncome,
      taxLiability: calculation.taxLiability,
      totalCredits: calculation.totalCredits,
      refundAmount,
      amountOwed,
    })
    onNext()
  }

  if (!calculation) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Calculating your taxes...</p>
        </div>
      </div>
    )
  }

  const isRefund = calculation.finalTax <= 0
  const amount = Math.abs(calculation.finalTax)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <Alert>
          <Calculator className="h-4 w-4" />
          <AlertDescription>
            Based on your income, deductions, and credits, here's your calculated tax liability.
          </AlertDescription>
        </Alert>

        {/* Tax Calculation Result */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Your Tax Calculation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className={`text-4xl font-bold mb-4 ${isRefund ? 'text-green-600' : 'text-red-600'}`}>
                {isRefund ? (
                  <div className="flex items-center justify-center space-x-2">
                    <TrendingUp className="h-8 w-8" />
                    <span>${amount.toLocaleString()}</span>
                  </div>
                ) : amount > 0 ? (
                  <div className="flex items-center justify-center space-x-2">
                    <TrendingDown className="h-8 w-8" />
                    <span>${amount.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <Minus className="h-8 w-8" />
                    <span>$0</span>
                  </div>
                )}
              </div>
              <Badge variant={isRefund ? "default" : "destructive"} className="text-lg px-4 py-2">
                {isRefund ? "Expected Refund" : amount > 0 ? "Amount Owed" : "No Tax Due"}
              </Badge>
              <p className="text-gray-600 mt-4">
                {isRefund 
                  ? "You've overpaid your taxes and should receive a refund"
                  : amount > 0
                  ? "You owe additional taxes"
                  : "Your tax liability is exactly covered by withholdings"
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Calculation Breakdown</CardTitle>
            <CardDescription>
              Here's how we calculated your tax liability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Gross Income</span>
                <span className="font-medium">${calculation.grossIncome.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Adjusted Gross Income</span>
                <span className="font-medium">${calculation.adjustedGrossIncome.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">
                  {calculation.itemizedDeduction > 0 ? "Itemized" : "Standard"} Deduction
                </span>
                <span className="font-medium">
                  -${Math.max(calculation.standardDeduction, calculation.itemizedDeduction).toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b font-medium">
                <span>Taxable Income</span>
                <span>${calculation.taxableIncome.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Tax Liability</span>
                <span className="font-medium">${calculation.taxLiability.toLocaleString()}</span>
              </div>
              
              {calculation.childTaxCredit > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Child Tax Credit</span>
                  <span className="font-medium text-green-600">
                    -${calculation.childTaxCredit.toLocaleString()}
                  </span>
                </div>
              )}
              
              {calculation.earnedIncomeCredit > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Earned Income Credit</span>
                  <span className="font-medium text-green-600">
                    -${calculation.earnedIncomeCredit.toLocaleString()}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2 border-b font-medium">
                <span>Total Credits</span>
                <span className="text-green-600">
                  -${calculation.totalCredits.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-3 bg-gray-50 rounded-lg px-4 font-bold text-lg">
                <span>Final Tax</span>
                <span className={isRefund ? 'text-green-600' : 'text-red-600'}>
                  {isRefund ? '-' : ''}${amount.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Rate Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {calculation.effectiveRate.toFixed(2)}%
                </div>
                <p className="text-sm text-blue-800">Effective Tax Rate</p>
                <p className="text-xs text-gray-600 mt-1">
                  Actual percentage of income paid in taxes
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {calculation.marginalRate.toFixed(0)}%
                </div>
                <p className="text-sm text-purple-800">Marginal Tax Rate</p>
                <p className="text-xs text-gray-600 mt-1">
                  Tax rate on your last dollar of income
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onPrev}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  )
}
