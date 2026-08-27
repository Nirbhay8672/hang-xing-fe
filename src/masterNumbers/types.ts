export interface MasterNumber {
  id: number
  company_id: number
  size: string
  punch_type: string
  master_number: string
}

export interface CreateMasterNumberRequest {
  company_id: number
  size: string
  punch_type: string
  master_number: string
}
