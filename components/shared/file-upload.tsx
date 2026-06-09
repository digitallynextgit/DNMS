"use client"

import * as React from "react"
import { Upload, X, FileText, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatFileSize } from "@/lib/utils"

interface FileUploadProps {
  accept?: string
  maxSize?: number
  onFileSelect: (file: File) => void
  isUploading?: boolean
  className?: string
}

export function FileUpload({
  accept,
  maxSize = 20 * 1024 * 1024, // 20MB default
  onFileSelect,
  isUploading = false,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)} limit`
    }
    if (accept) {
      const acceptedTypes = accept.split(",").map((t) => t.trim())
      const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`
      const fileMimeType = file.type
      const isAccepted = acceptedTypes.some(
        (type) =>
          type === fileExtension ||
          type === fileMimeType ||
          (type.endsWith("/*") && fileMimeType.startsWith(type.slice(0, -1))),
      )
      if (!isAccepted) {
        return `File type not allowed. Accepted: ${accept}`
      }
    }
    return null
  }

  const handleFile = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setSelectedFile(null)
      return
    }
    setError(null)
    setSelectedFile(file)
    onFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedFile(null)
    setError(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            if (!isUploading) inputRef.current?.click()
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "focus-visible:ring-ring relative flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded border-2 border-dashed p-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/60 hover:bg-muted/30",
          isUploading && "pointer-events-none opacity-60",
          error && "border-destructive/60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <>
            <Loader2 className="text-primary h-10 w-10 animate-spin" />
            <p className="text-muted-foreground text-sm font-medium">Uploading...</p>
          </>
        ) : selectedFile ? (
          <div className="bg-muted/50 flex w-full items-center gap-3 rounded border px-4 py-3">
            <FileText className="text-primary h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-foreground truncate text-sm font-medium">{selectedFile.name}</p>
              <p className="text-muted-foreground text-xs">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="text-muted-foreground hover:bg-background hover:text-foreground ml-auto shrink-0 rounded-full p-1 transition-colors"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
              <Upload className="text-muted-foreground h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-foreground text-sm font-medium">
                Drag and drop or{" "}
                <span className="text-primary underline underline-offset-2">browse</span>
              </p>
              <p className="text-muted-foreground text-xs">
                {accept ? `Accepted: ${accept}` : "All file types accepted"} - Max{" "}
                {formatFileSize(maxSize)}
              </p>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-destructive mt-1.5 text-xs font-medium">{error}</p>}
    </div>
  )
}
