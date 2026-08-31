import { Property, Service } from './types';

export const PROPERTIES: Property[] = [
  {
    id: '1',
    title: 'Villa Moderne avec Piscine',
    city: 'Dakar',
    type: 'Villa',
    price: 120000000,
    description: 'Une magnifique villa contemporaine située dans un quartier calme de Dakar. Offrant des finitions haut de gamme, un vaste salon lumineux, une cuisine équipée moderne, 4 suites parentales et une piscine privée avec jardin paysager.',
    features: ['4 Chambres', 'Piscine', 'Garage', 'Jardin', 'Grand Salon', 'Cuisine équipée'],
    image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1200',
    images: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=1200'
    ],
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
    description: 'Idéale pour une grande famille, cette maison offre de grands espaces de vie, une terrasse aérée, des chambres spacieuses et une proximité immédiate avec toutes les commodités scolaires et commerciales.',
    features: ['5 Chambres', 'Terrasse', 'Parking', 'Cour intérieure', 'Salon spacieux'],
    image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&q=80&w=1200',
    images: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&q=80&w=1200'
    ],
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
    description: 'Appartement d\'exception avec une vue imprenable sur l\'océan et le fleuve. Design moderne, balcon panoramique, cuisine américaine équipée, finitions marbre et sécurité 24/7.',
    features: ['3 Chambres', 'Vue Mer', 'Ascenseur', 'Balcon', 'Climatisation', 'Cuisine américaine'],
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200',
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&q=80&w=1200'
    ],
    bedrooms: 3,
    bathrooms: 2
  },
  {
    id: '4',
    title: 'Terrain Constructible Almadies',
    city: 'Dakar',
    type: 'Terrain',
    price: 250000000,
    description: 'Emplacement stratégique exceptionnel aux Almadies pour un projet résidentiel de grand standing, immeuble de standing ou siège commercial. Terrain plat, viabilisé avec titre foncier en règle.',
    features: ['500m²', 'Titre Foncier', 'Zone Résidentielle', 'Viabilisé Eau & Électricité'],
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=1200',
    images: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1524813686514-a57563d77d61?auto=format&fit=crop&q=80&w=1200'
    ]
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
