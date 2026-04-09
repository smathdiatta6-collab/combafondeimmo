import { Property, Service } from './types';

export const PROPERTIES: Property[] = [
  {
    id: '1',
    title: 'Villa Moderne avec Piscine',
    city: 'Dakar',
    type: 'Villa',
    price: 120000000,
    description: 'Une magnifique villa contemporaine située dans un quartier calme de Dakar. Offrant des finitions haut de gamme et une piscine privée.',
    features: ['4 Chambres', 'Piscine', 'Garage', 'Jardin'],
    image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800',
    badge: 'Nouveau',
    bedrooms: 4,
    bathrooms: 3
  },
  {
    id: '2',
    title: 'Maison Familiale Spacieuse',
    city: 'Thiès',
    type: 'Maison',
    price: 60000000,
    description: 'Idéale pour une grande famille, cette maison offre de grands espaces de vie et une proximité avec toutes les commodités.',
    features: ['5 Chambres', 'Terrasse', 'Parking'],
    image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&q=80&w=800',
    badge: 'Populaire',
    bedrooms: 5,
    bathrooms: 4
  },
  {
    id: '3',
    title: 'Appartement de Luxe Vue Mer',
    city: 'Saint-Louis',
    type: 'Appartement',
    price: 75000000,
    description: 'Appartement d\'exception avec une vue imprenable sur l\'océan. Design moderne et sécurité 24/7.',
    features: ['3 Chambres', 'Vue Mer', 'Ascenseur', 'Balcon'],
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800',
    bedrooms: 3,
    bathrooms: 2
  },
  {
    id: '4',
    title: 'Terrain Constructible Almadies',
    city: 'Dakar',
    type: 'Terrain',
    price: 250000000,
    description: 'Emplacement stratégique aux Almadies pour un projet résidentiel de luxe ou commercial.',
    features: ['500m²', 'Titre Foncier', 'Zone Résidentielle'],
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800'
  }
];

export const SERVICES: Service[] = [
  {
    id: '1',
    title: 'Achat Immobilier',
    description: 'Nous vous accompagnons dans l’achat de votre maison ou terrain au Sénégal avec une expertise locale.',
    icon: 'Home'
  },
  {
    id: '2',
    title: 'Location',
    description: 'Trouvez rapidement un logement adapté à votre budget et à vos besoins spécifiques.',
    icon: 'Key'
  },
  {
    id: '3',
    title: 'Vente de Biens',
    description: 'Nous vous aidons à vendre votre bien rapidement au meilleur prix grâce à notre réseau.',
    icon: 'DollarSign'
  },
  {
    id: '4',
    title: 'Gestion Immobilière',
    description: 'Confiez-nous la gestion de vos biens : encaissement des loyers, suivi et entretien.',
    icon: 'BarChart'
  }
];
