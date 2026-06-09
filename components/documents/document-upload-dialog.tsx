"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileUpload } from "@/components/shared/file-upload"
import { useUploadDocument, useUploadEmployeeDocument } from "@/hooks/use-documents"
import { DOCUMENT_CATEGORY_LABELS, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/constants"

interface DocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId?: string
}

const ACCEPTED_TYPES = ALLOWED_FILE_TYPES.join(",")

export function DocumentUploadDialog({
  open,
  onOpenChange,
  employeeId,
}: DocumentUploadDialogProps) {
  // Locker uploads (employeeId set) go to the EmployeeDocument table; company
  // uploads go to the Document table. Both hooks run; we pick by employeeId.
  const companyUpload = useUploadDocument()
  const employeeUpload = useUploadEmployeeDocument(employeeId ?? "")
  const uploadMutation = employeeId ? employeeUpload : companyUpload

  const [file, setFile] = React.useState<File | null>(null)
  const [title, setTitle] = React.useState("")
  const [category, setCategory] = React.useState("OTHER")
  const [description, setDescription] = React.useState("")

  // Auto-fill title from filename (strip extension)
  const handleFileSelect = (selected: File) => {
    setFile(selected)
    if (!title) {
      const baseName = selected.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ")
      setTitle(baseName)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", title.trim() || file.name)
    formData.append("category", category)
    if (description.trim()) formData.append("description", description.trim())
    if (employeeId) formData.append("employeeId", employeeId)

    uploadMutation.mutate(formData, {
      onSuccess: () => {
        handleClose()
      },
    })
  }

  const handleClose = () => {
    if (uploadMutation.isPending) return
    setFile(null)
    setTitle("")
    setCategory("OTHER")
    setDescription("")
    onOpenChange(false)
  }

  const isSubmitting = uploadMutation.isPending
  const canSubmit = Boolean(file) && Boolean(title.trim()) && !isSubmitting

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-file">File</Label>
            <FileUpload
              accept={ACCEPTED_TYPES}
              maxSize={MAX_FILE_SIZE}
              onFileSelect={handleFileSelect}
              isUploading={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              maxLength={200}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-category">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
              <SelectTrigger id="doc-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-description">
              Description <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="doc-description"
              placeholder="Brief description of this document..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              maxLength={500}
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
