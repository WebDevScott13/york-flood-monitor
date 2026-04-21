export interface EAStation {
  '@id': string
  stationReference: string
  label: string
  lat: number
  long: number
  riverName?: string
  town?: string
  catchmentName?: string
  status?: string
  stageScale?: {
    typicalRangeLow?: number
    typicalRangeHigh?: number
    scaleMax?: number
    maxOnRecord?: { value: number; dateTime: string }
    minOnRecord?: { value: number; dateTime: string }
    highestRecent?: { value: number; dateTime: string }
  }
  measures?: EAMeasure[]
}

export interface EAMeasure {
  '@id': string
  parameter: string
  parameterName: string
  qualifier?: string
  unitName?: string
  period?: number
  latestReading?: {
    '@id'?: string
    dateTime: string
    value: number
    measure?: string
  }
}

export interface EAFloodWarning {
  '@id': string
  description: string
  eaAreaName?: string
  eaRegionName?: string
  floodArea: {
    '@id': string
    county?: string
    description?: string
    notation?: string
    polygon?: string
    riverOrSea?: string
  }
  floodAreaID: string
  isTidal?: boolean
  message?: string
  severity: string
  severityLevel: 1 | 2 | 3 | 4
  timeMessageChanged?: string
  timeRaised?: string
  timeSeverityChanged?: string
}

export interface ProcessedStation {
  id: string
  label: string
  lat: number
  long: number
  riverName: string
  town?: string
  latestLevel?: number
  typicalRangeLow?: number
  typicalRangeHigh?: number
  levelStatus: 'normal' | 'typical' | 'above' | 'high' | 'unknown'
  unitName?: string
  lastReadingAt?: string
}

export interface ProcessedWarning {
  id: string
  description: string
  severity: string
  severityLevel: 1 | 2 | 3 | 4
  message?: string
  riverOrSea?: string
  county?: string
  polygonUrl?: string
  timeRaised?: string
  isTidal?: boolean
}
