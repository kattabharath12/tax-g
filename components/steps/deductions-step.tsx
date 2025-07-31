
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Receipt, Plus, Trash2, ArrowRight, ArrowLeft, Info, Calculator, TrendingUp, DollarSign } from "lucide-react"
import { getStandardDeduction } from "@/lib/tax-calculations"
import { calculateDeductionComparison, generateTaxOptimizationSuggestions, calculateTaxImpactScenarios } from "@/lib/enhanced-tax-calculations"

interface DeductionsStepProps {
  taxReturn: any
  onUpdate: (data: any) => Promise<any>
  onAutoSave: (data: any) => Promise<any>
  onCompleteStep: (data: any) => Promise<any>
  onNext: () => void
  onPrev: () => void
  onMarkUnsaved: () => void
  loading: boolean
  saving: boolean
  autoSaving: boolean
  hasUnsavedChanges: boolean
  lastSaved: Date | null
}

const deductionTypes = [
  { value: "MORTGAGE_INTEREST", label: "Mortgage Interest" },
  { value: "STATE_LOCAL_TAXES", label: "State & Local Taxes" },
  { value: "CHARITABLE_CONTRIBUTIONS", label: "Charitable Contributions" },
  { value: "MEDICAL_EXPENSES", label: "Medical & Dental Expenses" },
  { value: "BUSINESS_EXPENSES", label: "Business Expenses" },
  { value: "STUDENT_LOAN_INTEREST", label: "Student Loan Interest" },
  { value: "IRA_CONTRIBUTIONS", label: "IRA Contributions" },
  { value: "OTHER_DEDUCTIONS", label: "Other Deductions" },
]

export function DeductionsStep({ 
  taxReturn, 
  onUpdate, 
  onAutoSave, 
  onCompleteStep, 
  onNext, 
  onPrev, 
  onMarkUnsaved, 
  loading, 
  saving, 
  autoSaving, 
  hasUnsavedChanges, 
  lastSaved 
}: DeductionsStepProps) {
  const [deductionEntries, setDeductionEntries] = useState(taxReturn.deductionEntries || [])
  const [deductionMethod, setDeductionMethod] = useState<"standard" | "itemized">("standard")
  const [comparison, setComparison] = useState<any>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [scenarios, setScenarios] = useState<any[]>([])
  const [newEntry, setNewEntry] = useState({
    deductionType: "",
    amount: "",
    description: "",
  })

  const standardDeduction = getStandardDeduction(taxReturn.filingStatus)
  const totalItemizedDeductions = deductionEntries.reduce((sum: number, entry: any) => 
    sum + parseFloat(entry.amount || 0), 0
  )

  // Auto-save functionality with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasUnsavedChanges && !autoSaving) {
        onAutoSave({ 
          standardDeduction: deductionMethod === "standard" ? standardDeduction : 0,
          itemizedDeduction: deductionMethod === "itemized" ? totalItemizedDeductions : 0,
        })
      }
    }, 3000) // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(timer)
  }, [deductionEntries, deductionMethod, totalItemizedDeductions, standardDeduction, hasUnsavedChanges, autoSaving, onAutoSave])

  useEffect(() => {
    // Calculate enhanced comparison
    const adjustedGrossIncome = parseFloat(taxReturn.adjustedGrossIncome || taxReturn.totalIncome || 0)
    const dependents = taxReturn.dependents || []
    
    const newComparison = calculateDeductionComparison(
      adjustedGrossIncome,
      taxReturn.filingStatus,
      totalItemizedDeductions,
      dependents
    )
    
    setComparison(newComparison)
    
    // Auto-select the better deduction method
    setDeductionMethod(newComparison.recommendedMethod)
    
    // Generate optimization suggestions
    const newSuggestions = generateTaxOptimizationSuggestions(
      newComparison,
      adjustedGrossIncome,
      taxReturn.filingStatus,
      dependents
    )
    setSuggestions(newSuggestions)
    
    // Calculate impact scenarios
    const newScenarios = calculateTaxImpactScenarios(
      adjustedGrossIncome,
      taxReturn.filingStatus,
      totalItemizedDeductions,
      dependents
    )
    setScenarios(newScenarios)
  }, [totalItemizedDeductions, taxReturn.filingStatus, taxReturn.adjustedGrossIncome, taxReturn.totalIncome, taxReturn.dependents])

  const handleAddDeduction = async () => {
    if (!newEntry.deductionType || !newEntry.amount) return

    const entry = {
      deductionType: newEntry.deductionType,
      amount: parseFloat(newEntry.amount),
      description: newEntry.description,
    }

    try {
      const response = await fetch(`/api/tax-returns/${taxReturn.id}/deductions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      })

      if (response.ok) {
        const savedEntry = await response.json()
        setDeductionEntries([...deductionEntries, savedEntry])
        onMarkUnsaved()
        setNewEntry({
          deductionType: "",
          amount: "",
          description: "",
        })
      }
    } catch (error) {
      console.error("Error adding deduction entry:", error)
    }
  }

  const handleDeleteDeduction = async (entryId: string) => {
    try {
      const response = await fetch(`/api/tax-returns/${taxReturn.id}/deductions/${entryId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setDeductionEntries(deductionEntries.filter((entry: any) => entry.id !== entryId))
        onMarkUnsaved()
      }
    } catch (error) {
      console.error("Error deleting deduction entry:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const finalDeduction = deductionMethod === "standard" ? standardDeduction : totalItemizedDeductions
    
    await onUpdate({ 
      standardDeduction: deductionMethod === "standard" ? standardDeduction : 0,
      itemizedDeduction: deductionMethod === "itemized" ? totalItemizedDeductions : 0,
    })
    onNext()
  }

  const handleSaveAndContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    await onCompleteStep({ 
      standardDeduction: deductionMethod === "standard" ? standardDeduction : 0,
      itemizedDeduction: deductionMethod === "itemized" ? totalItemizedDeductions : 0,
    })
    onNext()
  }

  const handleSaveOnly = async () => {
    await onAutoSave({ 
      standardDeduction: deductionMethod === "standard" ? standardDeduction : 0,
      itemizedDeduction: deductionMethod === "itemized" ? totalItemizedDeductions : 0,
    })
  }

  const finalDeduction = deductionMethod === "standard" ? standardDeduction : totalItemizedDeductions

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You can choose between the standard deduction (a fixed amount) or itemize your deductions (if they exceed the standard amount).
          </AlertDescription>
        </Alert>

        {/* Enhanced Deduction Comparison */}
        {comparison && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calculator className="h-5 w-5" />
                <span>Smart Deduction Analysis</span>
              </CardTitle>
              <CardDescription>
                Detailed comparison showing actual tax savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={`text-center p-4 rounded-lg border-2 ${
                  comparison.recommendedMethod === 'standard' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="text-2xl font-bold text-blue-600">
                    ${comparison.standardDeduction.toLocaleString()}
                  </div>
                  <p className="text-sm text-blue-800">Standard Deduction</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Tax: ${comparison.standardTaxLiability.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600">
                    Effective Rate: {comparison.effectiveStandardRate.toFixed(2)}%
                  </p>
                  {comparison.recommendedMethod === 'standard' && (
                    <Badge variant="default" className="mt-2 bg-green-100 text-green-800">
                      ✓ Recommended
                    </Badge>
                  )}
                </div>
                <div className={`text-center p-4 rounded-lg border-2 ${
                  comparison.recommendedMethod === 'itemized' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="text-2xl font-bold text-green-600">
                    ${comparison.itemizedDeduction.toLocaleString()}
                  </div>
                  <p className="text-sm text-green-800">Itemized Deductions</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Tax: ${comparison.itemizedTaxLiability.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600">
                    Effective Rate: {comparison.effectiveItemizedRate.toFixed(2)}%
                  </p>
                  {comparison.recommendedMethod === 'itemized' && (
                    <Badge variant="default" className="mt-2 bg-green-100 text-green-800">
                      ✓ Recommended
                    </Badge>
                  )}
                </div>
              </div>
              
              {comparison.taxSavings > 0 && (
                <div className="p-4 bg-green-100 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-800 font-medium">
                      💰 Tax Savings: ${comparison.taxSavings.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    {comparison.recommendedMethod === 'itemized' 
                      ? `Itemizing saves you $${comparison.taxSavings.toLocaleString()} compared to standard deduction`
                      : `Standard deduction saves you $${comparison.taxSavings.toLocaleString()} compared to itemizing`
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tax Optimization Suggestions */}
        {suggestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Tax Optimization Tips</span>
              </CardTitle>
              <CardDescription>
                Personalized suggestions to maximize your tax savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">{suggestion}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Impact Scenarios */}
        {scenarios.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>What-If Scenarios</span>
              </CardTitle>
              <CardDescription>
                See how additional deductions would impact your taxes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scenarios.map((scenario, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{scenario.scenario}</p>
                      <p className="text-sm text-gray-600">{scenario.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        Tax: ${scenario.taxLiability.toLocaleString()}
                      </p>
                      {scenario.savings > 0 && (
                        <p className="text-sm text-green-600">
                          Saves: ${scenario.savings.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deduction Method Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Choose Your Deduction Method</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={deductionMethod} onValueChange={(value: "standard" | "itemized") => {
              setDeductionMethod(value)
              onMarkUnsaved()
            }}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="standard" id="standard" />
                <Label htmlFor="standard">
                  Use Standard Deduction (${standardDeduction.toLocaleString()})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="itemized" id="itemized" />
                <Label htmlFor="itemized">
                  Itemize My Deductions (${totalItemizedDeductions.toLocaleString()})
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Itemized Deductions Section */}
        <Card>
          <CardHeader>
            <CardTitle>Itemized Deductions</CardTitle>
            <CardDescription>
              Add your deductible expenses to see if itemizing is beneficial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Deductions */}
            {deductionEntries.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Your Deductions</h4>
                {deductionEntries.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">
                          {deductionTypes.find(t => t.value === entry.deductionType)?.label}
                        </Badge>
                        <span className="font-medium">${parseFloat(entry.amount).toLocaleString()}</span>
                      </div>
                      {entry.description && (
                        <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDeduction(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Deduction */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Add Deduction</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deductionType">Deduction Type</Label>
                  <Select value={newEntry.deductionType} onValueChange={(value) => setNewEntry({...newEntry, deductionType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select deduction type" />
                    </SelectTrigger>
                    <SelectContent>
                      {deductionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="deductionAmount">Amount</Label>
                  <Input
                    id="deductionAmount"
                    type="number"
                    step="0.01"
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry({...newEntry, amount: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="deductionDescription">Description (Optional)</Label>
                <Input
                  id="deductionDescription"
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                  placeholder="Additional details"
                />
              </div>
              <Button
                type="button"
                onClick={handleAddDeduction}
                disabled={!newEntry.deductionType || !newEntry.amount}
                className="w-full mt-3"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Deduction
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Final Deduction Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Deduction Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <div className="text-3xl font-bold text-primary mb-2">
                ${finalDeduction.toLocaleString()}
              </div>
              <p className="text-gray-600">
                Your {deductionMethod === "standard" ? "Standard" : "Itemized"} Deduction
              </p>
              <Badge variant="outline" className="mt-2">
                {deductionMethod === "standard" ? "Standard Deduction" : "Itemized Deductions"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button type="button" variant="outline" onClick={onPrev}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {hasUnsavedChanges && !autoSaving && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveOnly}
                disabled={autoSaving}
                size="sm"
              >
                {autoSaving ? "Saving..." : "Save"}
              </Button>
            )}
            {autoSaving && (
              <div className="flex items-center space-x-1 text-blue-600 text-sm">
                <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>
                <span>Auto-saving...</span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button 
              type="button"
              variant="outline"
              onClick={handleSaveAndContinue}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save & Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
