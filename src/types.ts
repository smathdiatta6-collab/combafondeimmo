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
