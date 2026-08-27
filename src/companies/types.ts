export interface ManufacturingSpecification {
  id: number
  company_id: number
  size: string
  greentile_thick: string
  upper_punch: string
  up_master_no: string
  lower_punch: string
  lp_master_no: string
  cavity: string
}

export interface Company {
  id: number
  name: string
  address: string
  director_name: string
  director_contact: string
  created_at: string
  updated_at: string
  manufacturing_specifications: ManufacturingSpecification[]
}

export interface ManufacturingSpecificationInput {
  size: string
  greentile_thick: string
  upper_punch: string
  up_master_no: string
  lower_punch: string
  lp_master_no: string
  cavity: string
}

export interface CreateCompanyRequest {
  name: string
  address: string
  director_name: string
  director_contact: string
  manufacturing_specifications: ManufacturingSpecificationInput[]
}

export type UpdateCompanyRequest = CreateCompanyRequest
