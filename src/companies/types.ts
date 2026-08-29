/** A master number for a punch-type variant that doesn't fit the plain Upper/Lower slots
 * (e.g. "U - DIN" alongside the spec's default "U - ISO" up_master_no). Added one at a time
 * via the order form's "Add New Master Number" button — the backend attaches it to this
 * existing specification rather than creating a new one. */
export interface OtherMasterNumber {
  punch_type: string
  master_number: string
}

export interface ManufacturingSpecification {
  id: number
  company_id: number
  size: string
  greentile_thick: string
  upper_punch: string
  up_master_no: string
  lower_punch: string
  lp_master_no: string
  other_masters: OtherMasterNumber[]
  cavity: string
  created_at: string
  updated_at: string
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
