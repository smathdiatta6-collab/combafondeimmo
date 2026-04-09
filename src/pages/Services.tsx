import { motion } from 'motion/react';
import { SERVICES } from '../data';
import { CheckCircle2, ShieldCheck, Zap, Users, TrendingUp, Scale, HeartHandshake } from 'lucide-react';
import { Link } from 'react-router-dom';

const EXTRA_SERVICES = [
  { title: 'Assistance Juridique', description: 'Sécurisation de vos transactions, contrats et documents officiels.', icon: Scale },
  { title: 'Conseil en Investissement', description: 'Analyse du marché pour optimiser vos rendements immobiliers.', icon: TrendingUp },
  { title: 'Accompagnement Personnalisé', description: 'Un suivi dédié de la recherche à la signature finale.', icon: HeartHandshake },
];

export default function Services() {
  return (
    <div className="pt-32 pb-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold text-blue-900 mb-6"
          >
            Nos Services Experts
          </motion.h1>
          <p className="text-gray-600 text-xl leading-relaxed">
            Nous offrons des solutions immobilières complètes et sur mesure pour les particuliers et les investisseurs au Sénégal.
          </p>
        </div>

        {/* Main Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          {SERVICES.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex gap-6 p-8 rounded-[2.5rem] bg-gray-50 hover:bg-blue-50 transition-all group"
            >
              <div className="flex-shrink-0 w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {service.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Extra Services */}
        <div className="bg-blue-900 rounded-[3rem] p-12 md:p-20 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-48 -mt-48 blur-3xl" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-12 text-center">Services Complémentaires</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {EXTRA_SERVICES.map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                    <item.icon size={32} className="text-blue-300" />
                  </div>
                  <h4 className="text-xl font-bold mb-3">{item.title}</h4>
                  <p className="text-blue-100/80 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">Pourquoi nous choisir ?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: 'Expertise Locale', icon: Zap },
              { title: 'Transparence Totale', icon: ShieldCheck },
              { title: 'Réseau Étendu', icon: Users },
              { title: 'Satisfaction Client', icon: CheckCircle2 },
            ].map((item, index) => (
              <div key={index} className="p-6">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <item.icon size={24} />
                </div>
                <h5 className="font-bold text-gray-900">{item.title}</h5>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 text-center">
          <Link
            to="/contact"
            className="inline-block bg-blue-900 text-white px-12 py-5 rounded-2xl font-bold text-xl hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/20"
          >
            Démarrer votre projet
          </Link>
        </div>
      </div>
    </div>
  );
}
