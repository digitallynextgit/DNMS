"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormDialog } from "@/components/shared/form-dialog"
import { useCreateDevice, useUpdateDevice } from "@/features/attendance/hooks/use-attendance"
import type { HikvisionDevice } from "@/features/attendance/hooks/use-attendance"

interface DeviceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editDevice?: HikvisionDevice | null
}

export function DeviceFormDialog({ open, onOpenChange, editDevice }: DeviceFormDialogProps) {
  const isEdit = !!editDevice

  const [name, setName] = useState("")
  const [deviceSerial, setDeviceSerial] = useState("")
  const [ipAddress, setIpAddress] = useState("")
  const [port, setPort] = useState("8000")
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("")
  const [location, setLocation] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const createDevice = useCreateDevice()
  const updateDevice = useUpdateDevice()
  const isPending = createDevice.isPending || updateDevice.isPending

  useEffect(() => {
    if (editDevice) {
      setName(editDevice.name)
      setDeviceSerial(editDevice.deviceSerial)
      setIpAddress(editDevice.ipAddress)
      setPort(String(editDevice.port))
      setUsername(editDevice.username)
      setPassword(editDevice.password)
      setLocation(editDevice.location ?? "")
    } else {
      setName("")
      setDeviceSerial("")
      setIpAddress("")
      setPort("8000")
      setUsername("admin")
      setPassword("")
      setLocation("")
    }
    setShowPassword(false)
  }, [editDevice, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: Record<string, unknown> = {
      name,
      deviceSerial,
      ipAddress,
      port: Number(port),
      username,
      password,
      location: location || null,
    }

    if (isEdit && editDevice) {
      await updateDevice.mutateAsync({ id: editDevice.id, body: payload })
    } else {
      await createDevice.mutateAsync(payload)
    }

    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit Device" : "Add Hikvision Device"}
      isEdit={isEdit}
      isPending={isPending}
      submitDisabled={!name || !deviceSerial || !ipAddress || (!isEdit && !password)}
      submitLabel={isEdit ? "Save Changes" : "Add Device"}
      onSubmit={handleSubmit}
      contentClassName="sm:max-w-[480px]"
    >
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="device-name">Device Name</Label>
        <Input
          id="device-name"
          placeholder="e.g. Main Entrance"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Device Serial */}
      <div className="space-y-2">
        <Label htmlFor="device-serial">Device Serial</Label>
        <Input
          id="device-serial"
          placeholder="e.g. DS-K1T671TM-A12345"
          value={deviceSerial}
          onChange={(e) => setDeviceSerial(e.target.value)}
          required
        />
      </div>

      {/* IP + Port */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="ip-address">IP Address</Label>
          <Input
            id="ip-address"
            placeholder="192.168.1.100"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Username */}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          placeholder="admin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="device-password">Password</Label>
        <div className="relative">
          <Input
            id="device-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEdit}
            placeholder={isEdit ? "Leave blank to keep current" : ""}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          placeholder="e.g. Building A, Ground Floor"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
    </FormDialog>
  )
}
