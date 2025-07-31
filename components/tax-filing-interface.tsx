
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  ArrowLeft, 
  ArrowRight, 
  Check,
  User,
  DollarSign,
  Receipt,
  Calculator,
  Eye,
  Send,
  Home
} from "lucide-react"

// Import step components
import { PersonalInfoStep } from "@/components/steps/personal-info-step"
import { EnhancedIncomeStep } from "@/components/steps/enhanced-income-step"
import { DeductionsStep } from "@/components/steps/deductions-step"
import { TaxCalculationStep } from "@/components/steps/tax-calculation-step"
import { ReviewStep } from "@/components/steps/review-step"
import { FilingStep } from "@/components/steps/filing-step"

interface TaxFilingInterfaceProps {
  taxReturn: {
    id: string
    taxYear: number
    filingStatus: string
    firstName: string | null
    lastName: string | null
    ssn: string | null
    spouseFirstName: string | null
    spouseLastName: string | null
    spouseSsn: string | null
    address: string | null
    city: string | null
    state: string | null
    zipCode: string | null
    totalIncome: any
    adjustedGrossIncome: any
    standardDeduction: any
    itemizedDeduction: any
    taxableIncome: any
    taxLiability: any
    totalCredits: any
    refundAmount: any
    amountOwed: any
    currentStep: number
    completedSteps: number[]
    lastSavedAt: Date | null
    isCompleted: boolean
    isFiled: boolean
    incomeEntries: any[]
    deductionEntries: any[]
    dependents: any[]
    createdAt: Date
    updatedAt: Date
  }
}

const steps = [
  {
    id: 1,
    title: "Getting Started",
    description: "Basic information and filing status",
    icon: User,
    component: PersonalInfoStep
  },
  {
    id: 2,
    title: "Personal Information",
    description: "Your details and contact information",
    icon: User,
    component: PersonalInfoStep
  },
  {
    id: 3,
    title: "Income",
    description: "W-2s, 1099s, and other income sources",
    icon: DollarSign,
    component: EnhancedIncomeStep
  },
  {
    id: 4,
    title: "Deductions",
    description: "Standard or itemized deductions",
    icon: Receipt,
    component: DeductionsStep
  },
  {
    id: 5,
    title: "Tax Calculation",
    description: "Calculate your tax liability and credits",
    icon: Calculator,
    component: TaxCalculationStep
  },
  {
    id: 6,
    title: "Review",
    description: "Review your complete tax return",
    icon: Eye,
    component: ReviewStep
  },
  {
    id: 7,
    title: "Filing",
    description: "Submit your tax return",
    icon: Send,
    component: FilingStep
  }
]

export function TaxFilingInterface({ taxReturn: initialTaxReturn }: TaxFilingInterfaceProps) {
  const [taxReturn, setTaxReturn] = useState(initialTaxReturn)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(
    initialTaxReturn.lastSavedAt ? new Date(initialTaxReturn.lastSavedAt) : null
  )
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const router = useRouter()

  const currentStep = steps.find(step => step.id === taxReturn.currentStep) || steps[0]
  const CurrentStepComponent = currentStep.component
  const progressPercentage = (taxReturn.currentStep / steps.length) * 100

  const updateTaxReturn = async (data: any) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/tax-returns/${taxReturn.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const updatedTaxReturn = await response.json()
        setTaxReturn(updatedTaxReturn)
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
        return updatedTaxReturn
      }
    } catch (error) {
      console.error("Error updating tax return:", error)
    } finally {
      setSaving(false)
    }
  }

  const autoSave = async (data: any) => {
    if (autoSaving) return // Prevent concurrent auto-saves
    
    setAutoSaving(true)
    try {
      const response = await fetch(`/api/tax-returns/${taxReturn.id}/auto-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const result = await response.json()
        setTaxReturn(result.taxReturn)
        setLastSaved(new Date(result.savedAt))
        setHasUnsavedChanges(false)
        return result.taxReturn
      }
    } catch (error) {
      console.error("Error auto-saving tax return:", error)
    } finally {
      setAutoSaving(false)
    }
  }

  const completeStepAndContinue = async (stepNumber: number, data: any) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/tax-returns/${taxReturn.id}/complete-step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stepNumber, data }),
      })

      if (response.ok) {
        const result = await response.json()
        setTaxReturn(result.taxReturn)
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
        return result.taxReturn
      }
    } catch (error) {
      console.error("Error completing step:", error)
    } finally {
      setSaving(false)
    }
  }

  const goToStep = (stepId: number) => {
    if (stepId >= 1 && stepId <= steps.length) {
      updateTaxReturn({ currentStep: stepId })
    }
  }

  const nextStep = () => {
    const nextStepId = Math.min(taxReturn.currentStep + 1, steps.length)
    goToStep(nextStepId)
  }

  const prevStep = () => {
    const prevStepId = Math.max(taxReturn.currentStep - 1, 1)
    goToStep(prevStepId)
  }

  const handleBackToDashboard = () => {
    router.push("/dashboard")
  }

  const formatLastSaved = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={handleBackToDashboard}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <div className="flex items-center space-x-2">
                <FileText className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold text-gray-900">
                  {taxReturn.taxYear} Tax Return
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Save Status Indicator */}
              <div className="flex items-center space-x-2 text-sm">
                {autoSaving ? (
                  <div className="flex items-center space-x-1 text-blue-600">
                    <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>
                    <span>Auto-saving...</span>
                  </div>
                ) : hasUnsavedChanges ? (
                  <div className="flex items-center space-x-1 text-amber-600">
                    <div className="h-2 w-2 bg-amber-600 rounded-full"></div>
                    <span>Unsaved changes</span>
                  </div>
                ) : lastSaved ? (
                  <div className="flex items-center space-x-1 text-green-600">
                    <Check className="h-3 w-3" />
                    <span>Saved {formatLastSaved(lastSaved)}</span>
                  </div>
                ) : null}
              </div>
              
              <Badge variant={taxReturn.isCompleted ? "default" : "secondary"}>
                {taxReturn.isCompleted ? "Completed" : "In Progress"}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleBackToDashboard}>
                <Home className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {taxReturn.currentStep} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progressPercentage)}% Complete
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Step Navigation Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {steps.map((step) => {
                  const Icon = step.icon
                  const isActive = step.id === taxReturn.currentStep
                  const isCompleted = (taxReturn.completedSteps || []).includes(step.id)
                  const isAccessible = step.id <= taxReturn.currentStep || isCompleted
                  
                  return (
                    <button
                      key={step.id}
                      onClick={() => isAccessible && goToStep(step.id)}
                      disabled={!isAccessible}
                      className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isCompleted
                          ? "bg-green-50 text-green-800 hover:bg-green-100"
                          : isAccessible
                          ? "hover:bg-gray-50"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className={`flex-shrink-0 ${
                        isActive ? "text-primary-foreground" : 
                        isCompleted ? "text-green-600" : 
                        "text-gray-400"
                      }`}>
                        {isCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${
                          isActive ? "text-primary-foreground" : 
                          isCompleted ? "text-green-800" : 
                          "text-gray-900"
                        }`}>
                          {step.title}
                        </p>
                        <p className={`text-xs ${
                          isActive ? "text-primary-foreground/80" : 
                          isCompleted ? "text-green-600" : 
                          "text-gray-500"
                        }`}>
                          {step.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <currentStep.icon className="h-6 w-6" />
                  <span>{currentStep.title}</span>
                </CardTitle>
                <CardDescription>{currentStep.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <CurrentStepComponent
                  taxReturn={taxReturn}
                  onUpdate={updateTaxReturn}
                  onAutoSave={autoSave}
                  onCompleteStep={(data: any) => completeStepAndContinue(taxReturn.currentStep, data)}
                  onNext={nextStep}
                  onPrev={prevStep}
                  onMarkUnsaved={() => setHasUnsavedChanges(true)}
                  loading={loading}
                  saving={saving}
                  autoSaving={autoSaving}
                  hasUnsavedChanges={hasUnsavedChanges}
                  lastSaved={lastSaved}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
