
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Eye, ArrowRight, ArrowLeft, Edit, FileText, User, DollarSign, Receipt, Calculator } from "lucide-react"

interface ReviewStepProps {
  taxReturn: any
  onUpdate: (data: any) => Promise<any>
  onNext: () => void
  onPrev: () => void
  loading: boolean
  saving: boolean
}

export function ReviewStep({ taxReturn, onUpdate, onNext, onPrev, loading, saving }: ReviewStepProps) {
  const [isReviewing, setIsReviewing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsReviewing(true)
    
    await onUpdate({
      isCompleted: true,
      currentStep: 7
    })
    
    setIsReviewing(false)
    onNext()
  }

  const isRefund = Number(taxReturn.refundAmount) > 0
  const amount = isRefund ? Number(taxReturn.refundAmount) : Number(taxReturn.amountOwed)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Please review your tax return carefully before proceeding to filing. You can go back to make changes if needed.
          </AlertDescription>
        </Alert>

        {/* Tax Return Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Tax Return Summary</span>
            </CardTitle>
            <CardDescription>
              {taxReturn.taxYear} Tax Return - {taxReturn.filingStatus.replace(/_/g, ' ')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <div className={`text-4xl font-bold mb-4 ${isRefund ? 'text-green-600' : 'text-red-600'}`}>
                ${amount.toLocaleString()}
              </div>
              <Badge variant={isRefund ? "default" : "destructive"} className="text-lg px-4 py-2">
                {isRefund ? "Expected Refund" : "Amount Owed"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Personal Information</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                <Edit className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{taxReturn.firstName} {taxReturn.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Filing Status:</span>
                <span className="font-medium">{taxReturn.filingStatus.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Address:</span>
                <span className="font-medium">{taxReturn.address}, {taxReturn.city}, {taxReturn.state} {taxReturn.zipCode}</span>
              </div>
              {taxReturn.spouseFirstName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Spouse:</span>
                  <span className="font-medium">{taxReturn.spouseFirstName} {taxReturn.spouseLastName}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Income Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5" />
              <span>Income Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {taxReturn.incomeEntries?.map((entry: any) => (
                <div key={entry.id} className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{entry.incomeType.replace(/_/g, ' ')}</span>
                    {entry.employerName && (
                      <span className="text-gray-600 ml-2">({entry.employerName})</span>
                    )}
                  </div>
                  <span className="font-medium">${Number(entry.amount).toLocaleString()}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Income:</span>
                <span>${Number(taxReturn.totalIncome).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deductions Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Receipt className="h-5 w-5" />
              <span>Deductions Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Number(taxReturn.itemizedDeduction) > 0 ? (
                <>
                  <div className="space-y-2">
                    {taxReturn.deductionEntries?.map((entry: any) => (
                      <div key={entry.id} className="flex justify-between items-center">
                        <span className="font-medium">{entry.deductionType.replace(/_/g, ' ')}</span>
                        <span className="font-medium">${Number(entry.amount).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Itemized Deductions:</span>
                    <span>${Number(taxReturn.itemizedDeduction).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-bold">
                  <span>Standard Deduction:</span>
                  <span>${Number(taxReturn.standardDeduction).toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tax Calculation Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calculator className="h-5 w-5" />
              <span>Tax Calculation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Adjusted Gross Income:</span>
                <span className="font-medium">${Number(taxReturn.adjustedGrossIncome).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Deductions:</span>
                <span className="font-medium">
                  -${Math.max(Number(taxReturn.standardDeduction), Number(taxReturn.itemizedDeduction)).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Taxable Income:</span>
                <span className="font-medium">${Number(taxReturn.taxableIncome).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax Liability:</span>
                <span className="font-medium">${Number(taxReturn.taxLiability).toLocaleString()}</span>
              </div>
              {Number(taxReturn.totalCredits) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax Credits:</span>
                  <span className="font-medium text-green-600">
                    -${Number(taxReturn.totalCredits).toLocaleString()}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>{isRefund ? "Refund Amount:" : "Amount Owed:"}</span>
                <span className={isRefund ? 'text-green-600' : 'text-red-600'}>
                  ${amount.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dependents (if any) */}
        {taxReturn.dependents && taxReturn.dependents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dependents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {taxReturn.dependents.map((dependent: any) => (
                  <div key={dependent.id} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{dependent.firstName} {dependent.lastName}</span>
                      <span className="text-gray-600 ml-2">({dependent.relationship})</span>
                    </div>
                    <div className="flex space-x-2">
                      {dependent.qualifiesForCTC && (
                        <Badge variant="secondary">CTC</Badge>
                      )}
                      {dependent.qualifiesForEITC && (
                        <Badge variant="secondary">EITC</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onPrev}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" disabled={isReviewing}>
            {isReviewing ? "Preparing..." : "Ready to File"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  )
}
