
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileUpload, FileUploadProgress } from "@/components/ui/file-upload"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Eye, Download, Upload, CheckCircle, AlertCircle } from "lucide-react"

interface DocumentProcessorProps {
  taxReturnId: string
  onDocumentProcessed: (extractedData: any) => void
  onDocumentUploaded?: (document: any) => void
}

interface ProcessingState {
  file: File | null
  uploading: boolean
  processing: boolean
  progress: number
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
  message: string
  document: any | null
  extractedData: any | null
}

export function DocumentProcessor({ 
  taxReturnId, 
  onDocumentProcessed, 
  onDocumentUploaded 
}: DocumentProcessorProps) {
  const [state, setState] = useState<ProcessingState>({
    file: null,
    uploading: false,
    processing: false,
    progress: 0,
    status: 'idle',
    message: '',
    document: null,
    extractedData: null
  })

  const handleFileSelect = (file: File) => {
    setState(prev => ({
      ...prev,
      file,
      status: 'idle',
      message: '',
      document: null,
      extractedData: null
    }))
  }

  const handleFileRemove = () => {
    setState(prev => ({
      ...prev,
      file: null,
      status: 'idle',
      message: '',
      document: null,
      extractedData: null
    }))
  }

  const processDocument = async () => {
    if (!state.file) return

    setState(prev => ({ ...prev, uploading: true, status: 'uploading', progress: 0 }))

    try {
      // Upload the document
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('taxReturnId', taxReturnId)

      setState(prev => ({ ...prev, progress: 30, message: 'Uploading document...' }))

      const uploadResponse = await fetch(`/api/documents/upload`, {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload document')
      }

      const document = await uploadResponse.json()
      setState(prev => ({ 
        ...prev, 
        document, 
        uploading: false, 
        processing: true, 
        status: 'processing',
        progress: 50,
        message: 'Extracting data from document...'
      }))

      onDocumentUploaded?.(document)

      // Process the document
      const processResponse = await fetch(`/api/documents/${document.id}/process`, {
        method: 'POST'
      })

      if (!processResponse.ok) {
        throw new Error('Failed to process document')
      }

      const reader = processResponse.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentProgress = 50

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              // Processing complete
              try {
                const extractedData = JSON.parse(buffer)
                setState(prev => ({
                  ...prev,
                  processing: false,
                  status: 'completed',
                  progress: 100,
                  message: 'Document processed successfully',
                  extractedData
                }))
                onDocumentProcessed(extractedData)
                return
              } catch (error) {
                throw new Error('Failed to parse extracted data')
              }
            }
            
            try {
              const parsed = JSON.parse(data)
              buffer += parsed.content
              currentProgress = Math.min(95, currentProgress + 5)
              setState(prev => ({
                ...prev,
                progress: currentProgress,
                message: 'Analyzing document content...'
              }))
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

    } catch (error) {
      console.error('Document processing error:', error)
      setState(prev => ({
        ...prev,
        uploading: false,
        processing: false,
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'An error occurred during processing'
      }))
    }
  }

  const getDocumentTypeLabel = (documentType: string) => {
    const labels: Record<string, string> = {
      'W2': 'W-2 Form',
      'FORM_1099_INT': '1099-INT Form',
      'FORM_1099_DIV': '1099-DIV Form',
      'FORM_1099_MISC': '1099-MISC Form',
      'FORM_1099_NEC': '1099-NEC Form',
      'FORM_1099_R': '1099-R Form',
      'FORM_1099_G': '1099-G Form',
      'OTHER_TAX_DOCUMENT': 'Other Tax Document'
    }
    return labels[documentType] || documentType
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload Tax Document</span>
          </CardTitle>
          <CardDescription>
            Upload your W-2, 1099, or other tax documents to automatically extract income and tax information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            selectedFile={state.file}
            disabled={state.uploading || state.processing}
            acceptedTypes={['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif']}
            maxSize={10}
          />

          {state.file && state.status === 'idle' && (
            <div className="mt-4">
              <Button 
                onClick={processDocument}
                disabled={state.uploading || state.processing}
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                Process Document
              </Button>
            </div>
          )}

          {(state.status === 'uploading' || state.status === 'processing') && (
            <div className="mt-4">
              <FileUploadProgress
                progress={state.progress}
                status={state.status}
                message={state.message}
              />
            </div>
          )}

          {state.status === 'error' && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          {state.status === 'completed' && state.document && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Document processed successfully! Review the extracted data below.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {state.document && state.extractedData && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Data Extraction Complete</span>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {getDocumentTypeLabel(state.document.documentType)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Successfully extracted tax information from your document. The data will be validated and added to your income section.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Next step:</strong> The extracted information will be automatically populated in your income forms after name validation. You can review and modify the data before adding it to your tax return.
                </AlertDescription>
              </Alert>
              
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Extracted Information</TabsTrigger>
                  <TabsTrigger value="raw">Raw Document Text</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="mt-4">
                  <div className="space-y-4">
                    {/* Format extracted data in a more user-friendly way */}
                    <div className="bg-white p-4 rounded-lg border">
                      <h4 className="font-medium text-sm text-gray-700 mb-3">Key Information Extracted:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {state.extractedData?.extractedData?.wages && (
                          <div>
                            <span className="text-gray-600">Wages:</span>
                            <span className="font-medium ml-2">${parseFloat(state.extractedData.extractedData.wages || '0').toLocaleString()}</span>
                          </div>
                        )}
                        {state.extractedData?.extractedData?.interestIncome && (
                          <div>
                            <span className="text-gray-600">Interest Income:</span>
                            <span className="font-medium ml-2">${parseFloat(state.extractedData.extractedData.interestIncome || '0').toLocaleString()}</span>
                          </div>
                        )}
                        {state.extractedData?.extractedData?.ordinaryDividends && (
                          <div>
                            <span className="text-gray-600">Dividends:</span>
                            <span className="font-medium ml-2">${parseFloat(state.extractedData.extractedData.ordinaryDividends || '0').toLocaleString()}</span>
                          </div>
                        )}
                        {state.extractedData?.extractedData?.employerName && (
                          <div>
                            <span className="text-gray-600">Employer:</span>
                            <span className="font-medium ml-2">{state.extractedData.extractedData.employerName}</span>
                          </div>
                        )}
                        {state.extractedData?.extractedData?.payerName && (
                          <div>
                            <span className="text-gray-600">Payer:</span>
                            <span className="font-medium ml-2">{state.extractedData.extractedData.payerName}</span>
                          </div>
                        )}
                        {(state.extractedData?.extractedData?.employeeName || state.extractedData?.extractedData?.recipientName) && (
                          <div>
                            <span className="text-gray-600">Name on Document:</span>
                            <span className="font-medium ml-2">{state.extractedData.extractedData.employeeName || state.extractedData.extractedData.recipientName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                        View all extracted data (JSON)
                      </summary>
                      <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-4 rounded-lg mt-2 overflow-x-auto">
                        {JSON.stringify(state.extractedData, null, 2)}
                      </pre>
                    </details>
                  </div>
                </TabsContent>
                <TabsContent value="raw" className="mt-4">
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                      <p className="text-sm font-mono whitespace-pre-wrap">
                        {state.document.ocrText || 'No OCR text available'}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
