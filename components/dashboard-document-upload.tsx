
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DocumentProcessor } from "@/components/document-processor"
import { DocumentManagement } from "@/components/document-management"
import { 
  Upload, 
  FolderOpen, 
  FileText, 
  Info, 
  Plus,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react"

interface DashboardDocumentUploadProps {
  taxReturnId: string
  onDocumentProcessed?: (extractedData: any) => void
}

export function DashboardDocumentUpload({ taxReturnId, onDocumentProcessed }: DashboardDocumentUploadProps) {
  const [activeTab, setActiveTab] = useState("upload")

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Upload your tax documents (W-2, 1099 forms, etc.) for automatic data extraction and processing. 
          This will save time when you're ready to file your tax return.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Upload Documents</span>
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center space-x-2">
            <FolderOpen className="h-4 w-4" />
            <span>Manage Documents</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5 text-blue-500" />
                <span>Document Upload</span>
              </CardTitle>
              <CardDescription>
                Upload your tax documents for automatic processing and data extraction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentProcessor
                taxReturnId={taxReturnId}
                onDocumentProcessed={onDocumentProcessed || (() => {})}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supported Document Types</CardTitle>
              <CardDescription>
                We support the following tax document types for automatic processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { type: "W-2", description: "Wage and Tax Statement" },
                  { type: "1099-INT", description: "Interest Income" },
                  { type: "1099-DIV", description: "Dividend Income" },
                  { type: "1099-MISC", description: "Miscellaneous Income" },
                  { type: "1099-NEC", description: "Nonemployee Compensation" },
                  { type: "1099-R", description: "Retirement Distributions" },
                ].map((doc) => (
                  <div
                    key={doc.type}
                    className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg"
                  >
                    <FileText className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="font-medium text-sm">{doc.type}</p>
                      <p className="text-xs text-gray-600">{doc.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <DocumentManagement
            taxReturnId={taxReturnId}
            onDocumentProcessed={onDocumentProcessed || (() => {})}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
