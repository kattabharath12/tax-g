
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DollarSign, Plus, Trash2, ArrowRight, ArrowLeft, Info } from "lucide-react"

interface IncomeStepProps {
  taxReturn: any
  onUpdate: (data: any) => Promise<any>
  onNext: () => void
  onPrev: () => void
  loading: boolean
  saving: boolean
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

export function IncomeStep({ taxReturn, onUpdate, onNext, onPrev, loading, saving }: IncomeStepProps) {
  const [incomeEntries, setIncomeEntries] = useState(taxReturn.incomeEntries || [])
  const [newEntry, setNewEntry] = useState({
    incomeType: "",
    amount: "",
    description: "",
    employerName: "",
    employerEIN: "",
    payerName: "",
    payerTIN: "",
  })

  const totalIncome = incomeEntries.reduce((sum: number, entry: any) => 
    sum + parseFloat(entry.amount || 0), 0
  )

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Enter all your income from W-2s, 1099s, and other sources. You can find these amounts on your tax documents.
          </AlertDescription>
        </Alert>

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

        {/* Add New Income Entry */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Add Income Source</span>
            </CardTitle>
            <CardDescription>
              Add your wages, interest, dividends, and other income
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
