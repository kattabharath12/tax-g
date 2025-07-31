
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle, User, Users, Info } from "lucide-react"
import { NameValidationResult, NameMismatch } from "@/lib/name-validation"

interface NameValidationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (proceedWithMismatches: boolean) => void
  validationResult: NameValidationResult | null
  documentType: string
}

export function NameValidationDialog({
  isOpen,
  onClose,
  onConfirm,
  validationResult,
  documentType
}: NameValidationDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async (proceedWithMismatches: boolean) => {
    setLoading(true)
    try {
      await onConfirm(proceedWithMismatches)
    } finally {
      setLoading(false)
    }
  }

  // Add null check for validationResult
  if (!validationResult) {
    return null
  }

  const getSeverityColor = (severity: NameMismatch['severity']) => {
    switch (severity) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const getSeverityIcon = (severity: NameMismatch['severity']) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <Info className="h-4 w-4" />
      case 'low':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      firstName: 'First Name',
      lastName: 'Last Name',
      spouseFirstName: 'Spouse First Name',
      spouseLastName: 'Spouse Last Name'
    }
    return labels[field] || field
  }

  if (validationResult.isValid) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Name Validation Successful</span>
            </DialogTitle>
            <DialogDescription>
              The names in your {documentType} document match your profile information.
            </DialogDescription>
          </DialogHeader>
          
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Document processing will continue automatically. The extracted data will be added to your tax return.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button 
              onClick={() => handleConfirm(false)} 
              disabled={loading}
              className="w-full"
            >
              {loading ? "Processing..." : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span>Name Validation Required</span>
          </DialogTitle>
          <DialogDescription>
            We found some differences between the names in your {documentType} document and your profile information. Please review and decide how to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Confidence Score */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Validation Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Match Confidence</span>
                <Badge variant={validationResult.confidence > 0.7 ? "default" : "destructive"}>
                  {Math.round(validationResult.confidence * 100)}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Name Mismatches */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Name Differences Found</span>
              </CardTitle>
              <CardDescription>
                Review the differences between your profile and document names
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {validationResult.mismatches.map((mismatch, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <Badge variant={getSeverityColor(mismatch.severity)}>
                      {getSeverityIcon(mismatch.severity)}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {getFieldLabel(mismatch.field)}
                    </p>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Profile: <span className="font-mono">{mismatch.profileName || 'Not set'}</span></p>
                      <p>Document: <span className="font-mono">{mismatch.documentName || 'Not found'}</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Suggestions */}
          {validationResult.suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center space-x-2">
                  <Info className="h-4 w-4" />
                  <span>Suggestions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {validationResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Warning for high severity mismatches */}
          {validationResult.mismatches.some(m => m.severity === 'high') && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> We found significant name differences. Please ensure the document belongs to you or update your profile information before continuing.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleConfirm(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Update Profile First
          </Button>
          <Button
            onClick={() => handleConfirm(true)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Processing..." : "Continue Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
