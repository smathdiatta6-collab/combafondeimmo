import { Link } from 'react-router-dom';
import { Property } from '../types';
import { MapPin, ArrowRight, Bed, Bath, Pencil } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';
import { useFirebase } from '../contexts/FirebaseContext';

interface PropertyCardProps {
  property: Property;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const { isSuperAdmin } = useFirebase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all group border border-gray-100 relative"
    >
      {isSuperAdmin && (
        <Link
          to={`/admin/biens?edit=${property.id}`}
          className="absolute top-4 right-4 z-20 p-2 bg-white/90 backdrop-blur-md text-blue-600 rounded-xl hover:bg-white transition-all shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil size={18} />
        </Link>
      )}
      <Link to={`/biens/${property.id}`} className="block relative aspect-[4/3] overflow-hidden">
        {property.badge && (
          <span className="absolute top-4 left-4 z-10 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
            {property.badge}
          </span>
        )}
        <img
          src={property.image}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
          <span className="text-white font-medium flex items-center gap-2">
            Voir les détails <ArrowRight size={16} />
          </span>
        </div>
      </Link>

      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-blue-600 text-sm font-medium">
            <MapPin size={14} />
            {property.city}
          </div>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
            {property.type}
          </span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
          {property.title}
        </h3>
        
        {(property.bedrooms || property.bathrooms) && (
          <div className="flex items-center gap-4 mb-4 text-gray-500 text-sm">
            {property.bedrooms && (
              <span className="flex items-center gap-1.5">
                <Bed size={16} /> {property.bedrooms} Ch.
              </span>
            )}
            {property.bathrooms && (
              <span className="flex items-center gap-1.5">
                <Bath size={16} /> {property.bathrooms} Sdb.
              </span>
            )}
          </div>
        )}

        <p className="text-gray-500 text-sm mb-4 line-clamp-2">
          {property.description}
        </p>
        <div className="flex justify-between items-center pt-4 border-t border-gray-50">
          <span className="text-lg font-bold text-green-600">
            {property.price.toLocaleString()} FCFA
          </span>
          <Link 
            to={`/biens/${property.id}`}
            className="text-blue-600 font-semibold text-sm hover:underline"
          >
            Détails
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default PropertyCard;
