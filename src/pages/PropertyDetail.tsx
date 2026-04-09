import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PROPERTIES } from '../data';
import { MapPin, ArrowLeft, CheckCircle2, MessageCircle, Share2, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Property } from '../types';

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | undefined>(PROPERTIES.find(p => p.id === id));
  const [loading, setLoading] = useState(!property);

  useEffect(() => {
    if (property || !id) {
      setLoading(false);
      return;
    }

    const fetchProperty = async () => {
      try {
        const docRef = doc(db, 'properties', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching property from Firestore:', error);
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id, property]);

  if (loading) {
    return <div className="pt-32 text-center">Chargement...</div>;
  }

  if (!property) {
    return (
      <div className="pt-32 text-center">
        <h2 className="text-2xl font-bold">Bien non trouvé</h2>
        <Link to="/biens" className="text-blue-600 hover:underline">Retour à la liste</Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium mb-8 transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Retour
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Content: Image & Description */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-video rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <img
                src={property.image}
                alt={property.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-6 right-6 flex gap-3">
                <button className="p-3 bg-white/90 backdrop-blur-md rounded-2xl text-gray-900 hover:bg-white transition-all shadow-lg">
                  <Heart size={20} />
                </button>
                <button className="p-3 bg-white/90 backdrop-blur-md rounded-2xl text-gray-900 hover:bg-white transition-all shadow-lg">
                  <Share2 size={20} />
                </button>
              </div>
            </motion.div>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-xl font-bold text-sm">
                  {property.type}
                </span>
                <div className="flex items-center gap-1 text-gray-500 font-medium">
                  <MapPin size={18} className="text-blue-600" />
                  {property.city}, Sénégal
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900">{property.title}</h1>
              
              <div className="text-3xl font-bold text-green-600">
                {property.price.toLocaleString()} FCFA
              </div>

              <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed">
                <p>{property.description}</p>
              </div>

              <div className="pt-8 border-t border-gray-100">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Caractéristiques</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {property.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                      <CheckCircle2 size={20} className="text-blue-600" />
                      <span className="font-medium text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Content: Contact Sidebar */}
          <div className="space-y-8">
            <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 sticky top-32">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Intéressé par ce bien ?</h3>
              
              <div className="space-y-4 mb-8">
                <button className="w-full bg-blue-900 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2">
                  Contacter l'agence
                </button>
                <a
                  href={`https://wa.me/221775519683?text=Je suis intéressé par le bien: ${property.title}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold hover:bg-[#1ebe5d] transition-all shadow-lg shadow-green-600/10 flex items-center justify-center gap-2"
                >
                  <MessageCircle size={20} />
                  WhatsApp direct
                </a>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                    CF
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Coumba Fonde</h4>
                    <p className="text-sm text-gray-500">Agent Immobilier Senior</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 italic">
                  "Je suis à votre disposition pour organiser une visite ou répondre à vos questions sur ce bien d'exception."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
