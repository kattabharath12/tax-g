
"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, X, FileText, AlertCircle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  acceptedTypes?: string[]
  maxSize?: number // in MB
  disabled?: boolean
  className?: string
  selectedFile?: File | null
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  acceptedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'],
  maxSize = 10,
  disabled = false,
  className,
  selectedFile
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size must be less than ${maxSize}MB`
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedTypes.includes(fileExtension)) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`
    }

    return null
  }, [acceptedTypes, maxSize])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    const validationError = validateFile(file)
    
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    onFileSelect(file)
  }, [validateFile, onFileSelect])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (disabled) return
    
    const files = e.dataTransfer.files
    handleFiles(files)
  }, [disabled, handleFiles])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (disabled) return
    
    const files = e.target.files
    handleFiles(files)
  }, [disabled, handleFiles])

  const handleClick = useCallback(() => {
    if (disabled) return
    inputRef.current?.click()
  }, [disabled])

  const handleRemove = useCallback(() => {
    setError(null)
    onFileRemove()
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [onFileRemove])

  return (
    <div className={cn("space-y-4", className)}>
      {!selectedFile ? (
        <Card 
          className={cn(
            "border-2 border-dashed transition-colors cursor-pointer",
            dragActive && "border-primary bg-primary/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Upload className="h-10 w-10 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">
              Drop your tax document here or click to browse
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Supported formats: PDF, PNG, JPG, JPEG, TIFF (max {maxSize}MB)
            </p>
            <Button type="button" variant="outline" disabled={disabled}>
              Browse Files
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={acceptedTypes.join(',')}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  )
}

interface FileUploadProgressProps {
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  message?: string
}

export function FileUploadProgress({ progress, status, message }: FileUploadProgressProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Upload className="h-4 w-4 text-blue-500" />
      case 'processing':
        return <FileText className="h-4 w-4 text-yellow-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading document...'
      case 'processing':
        return 'Processing document...'
      case 'completed':
        return 'Document processed successfully'
      case 'error':
        return 'Error processing document'
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3 mb-3">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="font-medium">{getStatusText()}</p>
            {message && (
              <p className="text-sm text-gray-600">{message}</p>
            )}
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </CardContent>
    </Card>
  )
}
