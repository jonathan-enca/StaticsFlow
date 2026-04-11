// StaticsFlow type definitions

/** Customer vocabulary extracted from reviews */
export interface CustomerVocabulary {
  verbatims: string[];        // Top 20-30 real quotes from customers
  recurringWords: string[];   // Words/phrases they repeatedly use
  emotionalWords: string[];   // Emotional language (joy, frustration, relief…)
}

/** A detailed buyer persona */
export interface Persona {
  name: string;
  ageRange: string;         // e.g. "25-35"
  painPoints: string[];
  aspirations: string[];
  description: string;      // Free-text summary
}

/** Communication angle preferences */
export interface CommunicationAngles {
  preferred: string[];   // Angles to emphasize (e.g. "authenticity", "transformation")
  forbidden: string[];   // Angles to never use (e.g. "fear-based", "aggressive")
}

/** A custom brand asset uploaded by the user */
export interface CustomAsset {
  id: string;
  type: 'packshot' | 'studio' | 'ugc' | 'other';
  url: string;           // R2 public URL
  fileName: string;
  uploadedAt: string;    // ISO date string
}

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
