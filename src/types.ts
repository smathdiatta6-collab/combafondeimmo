export interface Property {
  id: string;
  title: string;
  city: string;
  type: 'Maison' | 'Villa' | 'Terrain' | 'Appartement';
  price: number;
  description: string;
  features: string[];
  image: string;
  badge?: string;
  bedrooms?: number;
  bathrooms?: number;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface FurnishedStay {
  id?: string;
  contractNumber?: string;
  clientName: string;
  clientPhone: string;
  clientIdentity: string;
  stayDuration: '3 JOURS' | '1 SEMAINE' | '2 SEMAINES' | '1 MOIS' | 'AUTRE' | string;
  customDuration?: string;
  housingType: 'APPARTEMENTS' | 'STUDIO' | 'APPARTEMENT MEUBLÉ' | string;
  propertyName?: string;
  amount: number;
  date: string;
  acceptTerms: boolean;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}
