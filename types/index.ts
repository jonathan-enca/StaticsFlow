// StaticsFlow type definitions

/** Brand DNA extracted from a URL */
export interface BrandDNA {
  id: string
  userId: string
  url: string
  name: string
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  fonts: string[]
  logoUrl: string | null
  toneOfVoice: string
  keyBenefits: string[]
  personas: string[]
  forbiddenWords: string[]
  createdAt: Date
  updatedAt: Date
}

/** A generated ad creative */
export interface Creative {
  id: string
  brandDnaId: string
  imageUrl: string
  headline: string
  copy: string
  format: AdFormat
  angle: CreativeAngle
  score: number | null
  status: 'generating' | 'qa_review' | 'approved' | 'rejected'
  createdAt: Date
}

/** Supported ad formats */
export type AdFormat =
  | '1080x1080' // Square
  | '1080x1350' // Portrait
  | '1200x628' // Landscape

/** Creative angle / hook type */
export type CreativeAngle =
  | 'pain'
  | 'curiosity'
  | 'social_proof'
  | 'fomo'
  | 'benefit'
  | 'authority'
  | 'urgency'
