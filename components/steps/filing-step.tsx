
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Send, ArrowLeft, CheckCircle, FileText, Shield, Clock } from "lucide-react"

interface FilingStepProps {
  taxReturn: any
  onUpdate: (data: any) => Promise<any>
  onNext: () => void
  onPrev: () => void
  loading: boolean
  saving: boolean
}

export function FilingStep({ taxReturn, onUpdate, onNext, onPrev, loading, saving }: FilingStepProps) {
  const [isAgreed, setIsAgreed] = useState(false)
  const [isFiling, setIsFiling] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isAgreed) return
    
    setIsFiling(true)
    
    // Simulate filing process
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    await onUpdate({
      isFiled: true,
      currentStep: 7
    })
    
    setIsFiling(false)
    setIsComplete(true)
  }

  const isRefund = Number(taxReturn.refundAmount) > 0
  const amount = isRefund ? Number(taxReturn.refundAmount) : Number(taxReturn.amountOwed)

  if (isComplete) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Tax Return Filed Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            Your {taxReturn.taxYear} tax return has been submitted to the IRS.
          </p>
          
          <div className="bg-green-50 p-6 rounded-lg mb-6">
            <div className="text-3xl font-bold text-green-600 mb-2">
              ${amount.toLocaleString()}
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              {isRefund ? "Expected Refund" : "Amount Owed"}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What's Next?</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-left">
                  {isRefund ? (
                    <>
                      <li>• Your refund will be processed within 21 days</li>
                      <li>• You'll receive an email confirmation</li>
                      <li>• Track your refund status online</li>
                    </>
                  ) : (
                    <>
                      <li>• Payment is due by April 15, 2025</li>
                      <li>• You can pay online or by mail</li>
                      <li>• Set up a payment plan if needed</li>
                    </>
                  )}
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Important Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-left">
                  <li>• Keep a copy of your tax return</li>
                  <li>• Save all supporting documents</li>
                  <li>• Your return is available in your dashboard</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          
          <Button onClick={() => window.location.href = '/dashboard'} size="lg">
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (isFiling) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Filing Your Tax Return
          </h2>
          <p className="text-gray-600 mb-6">
            Please wait while we submit your return to the IRS...
          </p>
          
          <div className="bg-blue-50 p-6 rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">Validating return data</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm">Transmitting to IRS</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Clock className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Awaiting confirmation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <Alert>
          <Send className="h-4 w-4" />
          <AlertDescription>
            You're ready to file your tax return! Please review the information below and confirm your submission.
          </AlertDescription>
        </Alert>

        {/* Filing Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Filing Summary</span>
            </CardTitle>
            <CardDescription>
              {taxReturn.taxYear} Tax Return for {taxReturn.firstName} {taxReturn.lastName}
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
              <p className="text-gray-600 mt-4">
                Filing Status: {taxReturn.filingStatus.replace(/_/g, ' ')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Security & Privacy</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">Your data is encrypted with 256-bit SSL</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">We use IRS-approved e-filing methods</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">Your personal information is protected</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Information */}
        <Card>
          <CardHeader>
            <CardTitle>Important Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Filing Deadline:</strong> Your {taxReturn.taxYear} tax return must be filed by April 15, 2025.
              </p>
              {isRefund ? (
                <p>
                  <strong>Refund Processing:</strong> If you're owed a refund, it typically takes 21 days to process when filed electronically.
                </p>
              ) : (
                <p>
                  <strong>Payment Due:</strong> If you owe taxes, payment is due by April 15, 2025, even if you file an extension.
                </p>
              )}
              <p>
                <strong>Record Keeping:</strong> Keep a copy of your tax return and all supporting documents for at least 3 years.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Agreement */}
        <Card>
          <CardHeader>
            <CardTitle>Taxpayer Declaration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm">
                Under penalties of perjury, I declare that I have examined this return and accompanying schedules and statements, and to the best of my knowledge and belief, they are true, correct, and complete.
              </p>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="agreement"
                  checked={isAgreed}
                  onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
                />
                <Label htmlFor="agreement" className="text-sm">
                  I agree to the taxpayer declaration and authorize the electronic filing of my tax return.
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onPrev}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit" disabled={!isAgreed || isFiling} size="lg">
            {isFiling ? "Filing..." : "File Tax Return"}
            <Send className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  )
}
