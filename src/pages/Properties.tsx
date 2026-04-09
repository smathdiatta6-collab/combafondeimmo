import { useState, useEffect } from 'react';
import { PROPERTIES } from '../data';
import PropertyCard from '../components/PropertyCard';
import { Search, Filter, SlidersHorizontal, Bed, Bath, Banknote } from 'lucide-react';
import { motion } from 'motion/react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Property } from '../types';

export default function Properties() {
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('Tous');
  const [type, setType] = useState('Tous');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('Tous');
  const [bathrooms, setBathrooms] = useState('Tous');
  const [firestoreProperties, setFirestoreProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'properties'), orderBy('title'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setFirestoreProperties(data);
      setLoading(false);
    }, (error) => {
      // We don't want to break the page if Firestore fails (e.g. no collection yet)
      console.warn('Firestore properties fetch failed, using static data only:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Use Firestore properties if they exist, otherwise fallback to static data
  const allProperties = firestoreProperties.length > 0 ? firestoreProperties : PROPERTIES;

  const filteredProperties = allProperties.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
                         p.city.toLowerCase().includes(search.toLowerCase());
    const matchesCity = city === 'Tous' || p.city === city;
    const matchesType = type === 'Tous' || p.type === type;
    const matchesMinPrice = !minPrice || p.price >= parseInt(minPrice);
    const matchesMaxPrice = !maxPrice || p.price <= parseInt(maxPrice);
    const matchesBedrooms = bedrooms === 'Tous' || (p.bedrooms && p.bedrooms >= parseInt(bedrooms));
    const matchesBathrooms = bathrooms === 'Tous' || (p.bathrooms && p.bathrooms >= parseInt(bathrooms));
    
    return matchesSearch && matchesCity && matchesType && matchesMinPrice && matchesMaxPrice && matchesBedrooms && matchesBathrooms;
  });

  const cities = ['Tous', ...new Set(allProperties.map(p => p.city))];
  const types = ['Tous', ...new Set(allProperties.map(p => p.type))];
  const bedroomOptions = ['Tous', '1', '2', '3', '4', '5+'];
  const bathroomOptions = ['Tous', '1', '2', '3', '4+'];

  const resetFilters = () => {
    setSearch('');
    setCity('Tous');
    setType('Tous');
    setMinPrice('');
    setMaxPrice('');
    setBedrooms('Tous');
    setBathrooms('Tous');
  };

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Nos Biens Immobiliers</h1>
          <p className="text-gray-600 text-lg">Découvrez notre sélection exclusive de villas, appartements et terrains au Sénégal.</p>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-12">
          <div className="space-y-6">
            {/* Main Search and Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher par titre ou ville..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="relative">
                <select
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none cursor-pointer"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none hidden sm:inline">Ville:</span>
              </div>

              <div className="relative">
                <select
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none cursor-pointer"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <SlidersHorizontal className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none hidden sm:inline">Type:</span>
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
              <div className="relative">
                <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="number"
                  placeholder="Prix Min (FCFA)"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>

              <div className="relative">
                <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="number"
                  placeholder="Prix Max (FCFA)"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>

              <div className="relative">
                <select
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none cursor-pointer"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                >
                  {bedroomOptions.map(opt => <option key={opt} value={opt}>{opt === 'Tous' ? 'Chambres: Tous' : `${opt} + Chambres`}</option>)}
                </select>
                <Bed className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>

              <div className="relative">
                <select
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none cursor-pointer"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                >
                  {bathroomOptions.map(opt => <option key={opt} value={opt}>{opt === 'Tous' ? 'Salles de bain: Tous' : `${opt} + Salles de bain`}</option>)}
                </select>
                <Bath className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-dashed border-gray-300">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Aucun bien trouvé</h3>
            <p className="text-gray-500">Essayez d'ajuster vos filtres de recherche.</p>
            <button
              onClick={resetFilters}
              className="mt-6 text-blue-600 font-bold hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
