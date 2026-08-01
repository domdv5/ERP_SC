export interface SystemStatusActivatedBy {
  id: string
  name: string
}

export interface SystemStatus {
  readOnlyMode: boolean
  activatedAt: string | null
  activatedBy: SystemStatusActivatedBy | null
}
