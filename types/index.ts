export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ApiError {
  error: string
  details?: Record<string, string[]>
}

export interface SelectOption {
  value: string
  label: string
}

export interface OrgNode {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  designation: { title: string } | null
  department: { name: string } | null
  profilePhoto: string | null
  children: OrgNode[]
}
