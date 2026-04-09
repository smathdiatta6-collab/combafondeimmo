import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Linkedin } from 'lucide-react';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2">
              <Logo className="h-12 bg-white p-1 rounded-lg" />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed">
              Votre partenaire de confiance pour tous vos projets immobiliers au Sénégal. Expertise, transparence et accompagnement personnalisé.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors">
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold mb-6">Liens Rapides</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li><Link to="/" className="hover:text-white transition-colors">Accueil</Link></li>
              <li><Link to="/biens" className="hover:text-white transition-colors">Nos Biens</Link></li>
              <li><Link to="/services" className="hover:text-white transition-colors">Services</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-bold mb-6">Contact</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-blue-500" />
                +221 77 551 96 83
              </li>
              <li className="flex items-center gap-3">
                <Mail size={16} className="text-blue-500" />
                contact@coumbafonde-immo.com
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={16} className="text-blue-500" />
                Dakar, Sénégal
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-lg font-bold mb-6">Newsletter</h4>
            <p className="text-gray-400 text-sm mb-4">Inscrivez-vous pour recevoir nos dernières offres.</p>
            <form className="space-y-3">
              <input
                type="email"
                placeholder="Votre email"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              />
              <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 transition-all text-sm">
                S'abonner
              </button>
            </form>
          </div>
        </div>

        <div className="pt-10 border-t border-white/5 text-center text-gray-500 text-xs">
          <p>© {new Date().getFullYear()} Coumba Fonde Immo. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
