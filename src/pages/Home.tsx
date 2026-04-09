import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Search, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PROPERTIES, SERVICES } from '../data';
import PropertyCard from '../components/PropertyCard';
import { db } from '../firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { Property } from '../types';

export default function Home() {
  const [firestoreProperties, setFirestoreProperties] = useState<Property[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'properties'), limit(6));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setFirestoreProperties(data);
    }, (error) => {
      console.warn('Firestore featured properties fetch failed:', error);
    });
    return () => unsubscribe();
  }, []);

  // Use Firestore properties if they exist, otherwise fallback to static data
  const allProperties = firestoreProperties.length > 0 ? firestoreProperties : PROPERTIES;
  const featuredProperties = allProperties.slice(0, 3);

  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1920"
            alt="Hero Background"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl text-white"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Trouvez votre <span className="text-blue-400">maison idéale</span> au Sénégal
            </h1>
            <p className="text-xl mb-8 text-blue-50/90 max-w-lg">
              Coumba Fonde Immo vous accompagne dans tous vos projets immobiliers avec expertise et passion.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/biens"
                className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-500 transition-all flex items-center gap-2 shadow-xl shadow-blue-900/20"
              >
                Explorer les biens <ArrowRight size={20} />
              </Link>
              <Link
                to="/contact"
                className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all"
              >
                Nous contacter
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Biens à la une</h2>
              <p className="text-gray-600">Découvrez nos meilleures opportunités immobilières</p>
            </div>
            <Link to="/biens" className="text-blue-600 font-bold flex items-center gap-2 hover:gap-3 transition-all">
              Voir tout <ArrowRight size={20} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-blue-900 mb-4">Nos Services</h2>
            <p className="text-gray-600 text-lg">
              Une gamme complète de solutions pour répondre à tous vos besoins immobiliers au Sénégal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {SERVICES.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-8 rounded-3xl bg-gray-50 hover:bg-blue-50 transition-colors group"
              >
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{service.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {service.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto bg-blue-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-700/40 via-transparent to-transparent" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Vous avez un projet immobilier ?
            </h2>
            <p className="text-blue-100 text-xl mb-10 max-w-2xl mx-auto">
              Que ce soit pour acheter, louer ou vendre, notre équipe d'experts est là pour vous guider à chaque étape.
            </p>
            <Link
              to="/contact"
              className="inline-block bg-white text-blue-900 px-10 py-4 rounded-2xl font-bold text-lg hover:bg-blue-50 transition-all hover:scale-105 shadow-xl"
            >
              Contactez-nous aujourd'hui
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
