
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Check, X, Edit, DollarSign, FileText, AlertCircle } from "lucide-react"

interface ExtractedEntry {
  id: string
  type: 'income' | 'deduction'
  documentType: string
  extractedData: any
  confidence: number
  isVerified: boolean
  isEdited: boolean
}

interface ExtractedDataVerificationProps {
  entries: ExtractedEntry[]
  onAccept: (entryId: string, data: any) => void
  onReject: (entryId: string) => void
  onEdit: (entryId: string, data: any) => void
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

export function ExtractedDataVerification({ 
  entries, 
  onAccept, 
  onReject, 
  onEdit 
}: ExtractedDataVerificationProps) {
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<any>({})

  const handleStartEdit = (entry: ExtractedEntry) => {
    setEditingEntry(entry.id)
    setEditedData(entry.extractedData)
  }

  const handleSaveEdit = (entryId: string) => {
    onEdit(entryId, editedData)
    setEditingEntry(null)
    setEditedData({})
  }

  const handleCancelEdit = () => {
    setEditingEntry(null)
    setEditedData({})
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600"
    if (confidence >= 0.6) return "text-yellow-600"
    return "text-red-600"
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High"
    if (confidence >= 0.6) return "Medium"
    return "Low"
  }

  const formatDocumentType = (documentType: string) => {
    const types: Record<string, string> = {
      'W2': 'W-2 Form',
      'FORM_1099_INT': '1099-INT',
      'FORM_1099_DIV': '1099-DIV',
      'FORM_1099_MISC': '1099-MISC',
      'FORM_1099_NEC': '1099-NEC',
      'OTHER_TAX_DOCUMENT': 'Other Tax Document'
    }
    return types[documentType] || documentType
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No extracted data to verify</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Extracted Data Verification</CardTitle>
          <CardDescription>
            Review and verify the information extracted from your documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {entries.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      {formatDocumentType(entry.documentType)}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={getConfidenceColor(entry.confidence)}
                    >
                      {getConfidenceLabel(entry.confidence)} Confidence
                    </Badge>
                    {entry.isVerified && (
                      <Badge variant="default" className="text-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    {entry.isEdited && (
                      <Badge variant="outline" className="text-blue-600">
                        <Edit className="h-3 w-3 mr-1" />
                        Edited
                      </Badge>
                    )}
                  </div>
                  
                  {!entry.isVerified && (
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit(entry)}
                        disabled={editingEntry === entry.id}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAccept(entry.id, entry.extractedData)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onReject(entry.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {editingEntry === entry.id ? (
                  <EditingForm
                    data={editedData}
                    onChange={setEditedData}
                    onSave={() => handleSaveEdit(entry.id)}
                    onCancel={handleCancelEdit}
                    type={entry.type}
                  />
                ) : (
                  <DataPreview data={entry.extractedData} type={entry.type} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface EditingFormProps {
  data: any
  onChange: (data: any) => void
  onSave: () => void
  onCancel: () => void
  type: 'income' | 'deduction'
}

function EditingForm({ data, onChange, onSave, onCancel, type }: EditingFormProps) {
  const updateData = (field: string, value: any) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {type === 'income' && (
          <div>
            <Label>Income Type</Label>
            <Select 
              value={data.incomeType || ''} 
              onValueChange={(value) => updateData('incomeType', value)}
            >
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
        )}
        
        <div>
          <Label>Amount</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              step="0.01"
              value={data.amount || ''}
              onChange={(e) => updateData('amount', parseFloat(e.target.value) || 0)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Input
          value={data.description || ''}
          onChange={(e) => updateData('description', e.target.value)}
        />
      </div>

      {data.employerName !== undefined && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Employer Name</Label>
            <Input
              value={data.employerName || ''}
              onChange={(e) => updateData('employerName', e.target.value)}
            />
          </div>
          <div>
            <Label>Employer EIN</Label>
            <Input
              value={data.employerEIN || ''}
              onChange={(e) => updateData('employerEIN', e.target.value)}
            />
          </div>
        </div>
      )}

      {data.payerName !== undefined && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Payer Name</Label>
            <Input
              value={data.payerName || ''}
              onChange={(e) => updateData('payerName', e.target.value)}
            />
          </div>
          <div>
            <Label>Payer TIN</Label>
            <Input
              value={data.payerTIN || ''}
              onChange={(e) => updateData('payerTIN', e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          Save Changes
        </Button>
      </div>
    </div>
  )
}

interface DataPreviewProps {
  data: any
  type: 'income' | 'deduction'
}

function DataPreview({ data, type }: DataPreviewProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-500">
            {type === 'income' ? 'Income Type' : 'Deduction Type'}
          </Label>
          <p className="text-sm">
            {type === 'income' 
              ? incomeTypes.find(t => t.value === data.incomeType)?.label || data.incomeType
              : data.deductionType
            }
          </p>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-500">Amount</Label>
          <p className="text-sm font-medium">${data.amount?.toLocaleString() || '0'}</p>
        </div>
      </div>

      {data.description && (
        <div>
          <Label className="text-sm font-medium text-gray-500">Description</Label>
          <p className="text-sm">{data.description}</p>
        </div>
      )}

      {(data.employerName || data.payerName) && (
        <div className="grid grid-cols-2 gap-4">
          {data.employerName && (
            <div>
              <Label className="text-sm font-medium text-gray-500">Employer</Label>
              <p className="text-sm">{data.employerName}</p>
              {data.employerEIN && (
                <p className="text-xs text-gray-400">EIN: {data.employerEIN}</p>
              )}
            </div>
          )}
          {data.payerName && (
            <div>
              <Label className="text-sm font-medium text-gray-500">Payer</Label>
              <p className="text-sm">{data.payerName}</p>
              {data.payerTIN && (
                <p className="text-xs text-gray-400">TIN: {data.payerTIN}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
