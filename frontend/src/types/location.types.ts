export interface Department {
  code: string
  name: string
}

export interface City {
  code: string
  name: string
  department?: Department
}
