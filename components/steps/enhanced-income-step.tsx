
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DocumentProcessor } from "@/components/document-processor"
import { NameValidationDialog } from "@/components/name-validation-dialog"
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  Info, 
  FileText, 
  CheckCircle,
  Upload,
  Sparkles
} from "lucide-react"
import { validateNames, extractNamesFromDocument, type NameValidationResult } from "@/lib/name-validation"

interface EnhancedIncomeStepProps {
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

const incomeTypes = [
  { value: "W2_WAGES", label: "W-2 Wages" },
  { value: "INTEREST", label: "Interest Income" },
  { value: "DIVIDENDS", label: "Dividends" },
  { value: "UNEMPLOYMENT", label: "Unemployment Compensation" },
  { value: "RETIREMENT_DISTRIBUTIONS", label: "Retirement Distributions" },
  { value: "SOCIAL_SECURITY", label: "Social Security Benefits" },
  { value: "OTHER_INCOME", label: "Other Income" },
]

interface AutoPopulatedEntry {
  incomeType: string
  amount: string
  description: string
  employerName: string
  employerEIN: string
  payerName: string
  payerTIN: string
  isAutoPopulated: boolean
  documentId?: string
  documentType?: string
  confidence?: number
}

export function EnhancedIncomeStep({ 
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
}: EnhancedIncomeStepProps) {
  const [incomeEntries, setIncomeEntries] = useState(taxReturn.incomeEntries || [])
  const [pendingAutoEntries, setPendingAutoEntries] = useState<AutoPopulatedEntry[]>([])
  const [newEntry, setNewEntry] = useState({
    incomeType: "",
    amount: "",
    description: "",
    employerName: "",
    employerEIN: "",
    payerName: "",
    payerTIN: "",
  })
  
  // Name validation state
  const [nameValidationDialog, setNameValidationDialog] = useState<{
    isOpen: boolean
    validationResult: NameValidationResult | null
    documentType: string
    extractedData: any
  }>({
    isOpen: false,
    validationResult: null,
    documentType: '',
    extractedData: null
  })

  const totalIncome = incomeEntries.reduce((sum: number, entry: any) => 
    sum + parseFloat(entry.amount || 0), 0
  )

  // Auto-save functionality with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasUnsavedChanges && !autoSaving && incomeEntries.length > 0) {
        onAutoSave({ 
          totalIncome: totalIncome,
          adjustedGrossIncome: totalIncome 
        })
      }
    }, 3000) // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(timer)
  }, [incomeEntries, totalIncome, hasUnsavedChanges, autoSaving, onAutoSave])

  const handleDocumentProcessed = async (extractedData: any) => {
    console.log('Document processing completed:', extractedData)
    
    // Extract names for validation
    const extractedNames = extractNamesFromDocument(extractedData?.extractedData || extractedData)
    const profileNames = {
      firstName: taxReturn.firstName || '',
      lastName: taxReturn.lastName || '',
      spouseFirstName: taxReturn.spouseFirstName,
      spouseLastName: taxReturn.spouseLastName
    }

    // Validate names
    const validationResult = validateNames(profileNames, extractedNames)
    
    // Show name validation dialog
    setNameValidationDialog({
      isOpen: true,
      validationResult,
      documentType: extractedData?.documentType || 'tax document',
      extractedData
    })
  }

  const handleNameValidationConfirm = async (proceedWithMismatches: boolean) => {
    const { extractedData } = nameValidationDialog
    
    if (!proceedWithMismatches && !nameValidationDialog.validationResult?.isValid) {
      // User chose to update profile first - close dialog
      setNameValidationDialog((prev: typeof nameValidationDialog) => ({ ...prev, isOpen: false }))
      return
    }

    // Convert extracted data to income entries
    const autoEntries = convertExtractedDataToIncomeEntries(extractedData)
    setPendingAutoEntries(autoEntries)
    
    // Close dialog
    setNameValidationDialog((prev: typeof nameValidationDialog) => ({ ...prev, isOpen: false }))
  }

  const convertExtractedDataToIncomeEntries = (extractedData: any): AutoPopulatedEntry[] => {  
    const entries: AutoPopulatedEntry[] = []
    const data = extractedData?.extractedData || extractedData

    // Handle W-2 data
    if (extractedData?.documentType === 'W2' || data?.wages) {
      entries.push({
        incomeType: 'W2_WAGES',
        amount: cleanAmount(data.wages || '0'),
        description: `W-2 Wages from ${data.employerName || 'Employer'}`,
        employerName: data.employerName || '',
        employerEIN: data.employerEIN || '',
        payerName: '',
        payerTIN: '',
        isAutoPopulated: true,
        documentType: 'W2',
        confidence: extractedData?.confidence || 0.85
      })
    }

    // Handle 1099-INT data
    if (extractedData?.documentType === 'FORM_1099_INT' || data?.interestIncome) {
      entries.push({
        incomeType: 'INTEREST',
        amount: cleanAmount(data.interestIncome || '0'),
        description: `Interest Income from ${data.payerName || 'Financial Institution'}`,
        employerName: '',
        employerEIN: '',
        payerName: data.payerName || '',
        payerTIN: data.payerTIN || '',
        isAutoPopulated: true,
        documentType: 'FORM_1099_INT',
        confidence: extractedData?.confidence || 0.85
      })
    }

    // Handle 1099-DIV data
    if (extractedData?.documentType === 'FORM_1099_DIV' || data?.ordinaryDividends) {
      entries.push({
        incomeType: 'DIVIDENDS',
        amount: cleanAmount(data.ordinaryDividends || '0'),
        description: `Dividend Income from ${data.payerName || 'Investment Account'}`,
        employerName: '',
        employerEIN: '',
        payerName: data.payerName || '',
        payerTIN: data.payerTIN || '',
        isAutoPopulated: true,
        documentType: 'FORM_1099_DIV',
        confidence: extractedData?.confidence || 0.85
      })
    }

    // Handle 1099-MISC data
    if (extractedData?.documentType === 'FORM_1099_MISC') {
      const miscAmount = data.nonemployeeCompensation || data.otherIncome || data.rents || '0'
      if (parseFloat(cleanAmount(miscAmount)) > 0) {
        entries.push({
          incomeType: 'OTHER_INCOME',
          amount: cleanAmount(miscAmount),
          description: `1099-MISC Income from ${data.payerName || 'Payer'}`,
          employerName: '',
          employerEIN: '',
          payerName: data.payerName || '',
          payerTIN: data.payerTIN || '',
          isAutoPopulated: true,
          documentType: 'FORM_1099_MISC',
          confidence: extractedData?.confidence || 0.85
        })
      }
    }

    // Handle 1099-NEC data
    if (extractedData?.documentType === 'FORM_1099_NEC' || data?.nonemployeeCompensation) {
      entries.push({
        incomeType: 'OTHER_INCOME',
        amount: cleanAmount(data.nonemployeeCompensation || '0'),
        description: `1099-NEC Nonemployee Compensation from ${data.payerName || 'Payer'}`,
        employerName: '',
        employerEIN: '',
        payerName: data.payerName || '',
        payerTIN: data.payerTIN || '',
        isAutoPopulated: true,
        documentType: 'FORM_1099_NEC',
        confidence: extractedData?.confidence || 0.85
      })
    }

    return entries.filter(entry => parseFloat(entry.amount) > 0)
  }

  const cleanAmount = (amount: string): string => {
    if (!amount) return '0'
    // Remove currency symbols, commas, and extra spaces
    return amount.toString().replace(/[$,\s]/g, '').replace(/[^\d.-]/g, '') || '0'
  }

  const handleAcceptAutoEntry = async (entry: AutoPopulatedEntry, index: number) => {
    try {
      const entryData = {
        incomeType: entry.incomeType,
        amount: parseFloat(entry.amount),
        description: entry.description,
        employerName: entry.employerName,
        employerEIN: entry.employerEIN,
        payerName: entry.payerName,
        payerTIN: entry.payerTIN,
      }

      const response = await fetch(`/api/tax-returns/${taxReturn.id}/income`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entryData),
      })

      if (response.ok) {
        const savedEntry = await response.json()
        // Mark as auto-populated for visual indication
        savedEntry.isAutoPopulated = true
        savedEntry.confidence = entry.confidence
        
        setIncomeEntries((prev: any[]) => [...prev, savedEntry])
        setPendingAutoEntries((prev: AutoPopulatedEntry[]) => prev.filter((_, i) => i !== index))
      }
    } catch (error) {
      console.error("Error adding auto-populated income entry:", error)
    }
  }

  const handleRejectAutoEntry = (index: number) => {
    setPendingAutoEntries((prev: AutoPopulatedEntry[]) => prev.filter((_, i) => i !== index))
  }

  const handleAcceptAllAutoEntries = async () => {
    for (let i = 0; i < pendingAutoEntries.length; i++) {
      await handleAcceptAutoEntry(pendingAutoEntries[i], 0) // Always use index 0 since array shrinks
    }
  }

  const handleAddEntry = async () => {
    if (!newEntry.incomeType || !newEntry.amount) return

    const entry = {
      incomeType: newEntry.incomeType,
      amount: parseFloat(newEntry.amount),
      description: newEntry.description,
      employerName: newEntry.employerName,
      employerEIN: newEntry.employerEIN,
      payerName: newEntry.payerName,
      payerTIN: newEntry.payerTIN,
    }

    try {
      const response = await fetch(`/api/tax-returns/${taxReturn.id}/income`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      })

      if (response.ok) {
        const savedEntry = await response.json()
        setIncomeEntries([...incomeEntries, savedEntry])
        onMarkUnsaved()
        setNewEntry({
          incomeType: "",
          amount: "",
          description: "",
          employerName: "",
          employerEIN: "",
          payerName: "",
          payerTIN: "",
        })
      }
    } catch (error) {
      console.error("Error adding income entry:", error)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const response = await fetch(`/api/tax-returns/${taxReturn.id}/income/${entryId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setIncomeEntries(incomeEntries.filter((entry: any) => entry.id !== entryId))
        onMarkUnsaved()
      }
    } catch (error) {
      console.error("Error deleting income entry:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onUpdate({ 
      totalIncome: totalIncome,
      adjustedGrossIncome: totalIncome // For Stage 1, AGI = Total Income
    })
    onNext()
  }

  const handleSaveAndContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    await onCompleteStep({ 
      totalIncome: totalIncome,
      adjustedGrossIncome: totalIncome
    })
    onNext()
  }

  const handleSaveOnly = async () => {
    await onAutoSave({ 
      totalIncome: totalIncome,
      adjustedGrossIncome: totalIncome
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Upload your tax documents to automatically extract income information, or add income sources manually. Documents are validated for accuracy and name matching.
          </AlertDescription>
        </Alert>

        {/* Document Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Upload Tax Documents</span>
            </CardTitle>
            <CardDescription>
              Upload W-2s, 1099s, and other tax documents to automatically populate your income information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentProcessor
              taxReturnId={taxReturn.id}
              onDocumentProcessed={handleDocumentProcessed}
            />
          </CardContent>
        </Card>

        {/* Auto-populated entries awaiting approval */}
        {pendingAutoEntries.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span>Extracted Income Data</span>
              </CardTitle>
              <CardDescription>
                Review the income information extracted from your documents. Accept individual entries or all at once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end mb-4">
                <Button
                  type="button"
                  onClick={handleAcceptAllAutoEntries}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accept All ({pendingAutoEntries.length})
                </Button>
              </div>
              
              {pendingAutoEntries.map((entry, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-blue-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {incomeTypes.find(t => t.value === entry.incomeType)?.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Sparkles className="mr-1 h-3 w-3" />
                          Auto-extracted
                        </Badge>
                        {entry.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(entry.confidence * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                      <div className="font-medium text-lg mb-1">
                        ${parseFloat(entry.amount).toLocaleString()}
                      </div>
                      {entry.description && (
                        <p className="text-sm text-gray-600 mb-2">{entry.description}</p>
                      )}
                      <div className="text-xs text-gray-500 space-y-1">
                        {entry.employerName && <p>Employer: {entry.employerName}</p>}
                        {entry.employerEIN && <p>Employer EIN: {entry.employerEIN}</p>}
                        {entry.payerName && <p>Payer: {entry.payerName}</p>}
                        {entry.payerTIN && <p>Payer TIN: {entry.payerTIN}</p>}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAcceptAutoEntry(entry, index)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRejectAutoEntry(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Current Income Entries */}
        {incomeEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Income Sources</CardTitle>
              <CardDescription>
                Current total: ${totalIncome.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {incomeEntries.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">
                        {incomeTypes.find(t => t.value === entry.incomeType)?.label}
                      </Badge>
                      {entry.isAutoPopulated && (
                        <Badge variant="outline" className="text-xs text-blue-600">
                          <Sparkles className="mr-1 h-3 w-3" />
                          Auto-populated
                        </Badge>
                      )}
                      <span className="font-medium">${parseFloat(entry.amount).toLocaleString()}</span>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                    )}
                    {entry.employerName && (
                      <p className="text-sm text-gray-600 mt-1">Employer: {entry.employerName}</p>
                    )}
                    {entry.payerName && (
                      <p className="text-sm text-gray-600 mt-1">Payer: {entry.payerName}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteEntry(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Add New Income Entry - Manual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Add Income Source Manually</span>
            </CardTitle>
            <CardDescription>
              Manually add wages, interest, dividends, and other income
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="incomeType">Income Type *</Label>
                <Select value={newEntry.incomeType} onValueChange={(value) => setNewEntry({...newEntry, incomeType: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select income type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry({...newEntry, amount: e.target.value})}
                    className="pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={newEntry.description}
                onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                placeholder="Additional details about this income"
              />
            </div>

            {newEntry.incomeType === "W2_WAGES" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employerName">Employer Name</Label>
                  <Input
                    id="employerName"
                    value={newEntry.employerName}
                    onChange={(e) => setNewEntry({...newEntry, employerName: e.target.value})}
                    placeholder="Your employer's name"
                  />
                </div>
                <div>
                  <Label htmlFor="employerEIN">Employer EIN</Label>
                  <Input
                    id="employerEIN"
                    value={newEntry.employerEIN}
                    onChange={(e) => setNewEntry({...newEntry, employerEIN: e.target.value})}
                    placeholder="00-0000000"
                  />
                </div>
              </div>
            )}

            {(newEntry.incomeType === "INTEREST" || newEntry.incomeType === "DIVIDENDS") && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="payerName">Payer Name</Label>
                  <Input
                    id="payerName"
                    value={newEntry.payerName}
                    onChange={(e) => setNewEntry({...newEntry, payerName: e.target.value})}
                    placeholder="Bank or institution name"
                  />
                </div>
                <div>
                  <Label htmlFor="payerTIN">Payer TIN</Label>
                  <Input
                    id="payerTIN"
                    value={newEntry.payerTIN}
                    onChange={(e) => setNewEntry({...newEntry, payerTIN: e.target.value})}
                    placeholder="00-0000000"
                  />
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={handleAddEntry}
              disabled={!newEntry.incomeType || !newEntry.amount}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Income Source
            </Button>
          </CardContent>
        </Card>

        {/* Total Income Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Income Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <div className="text-3xl font-bold text-primary mb-2">
                ${totalIncome.toLocaleString()}
              </div>
              <p className="text-gray-600">Total Income</p>
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

      {/* Name Validation Dialog */}
      <NameValidationDialog
        isOpen={nameValidationDialog.isOpen}
        onClose={() => setNameValidationDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleNameValidationConfirm}
        validationResult={nameValidationDialog.validationResult}
        documentType={nameValidationDialog.documentType}
      />
    </form>
  )
}
