import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Building2, Briefcase, Mail, User, ShieldCheck, Menu, X } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, isAdmin, login } = useFirebase();

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Accueil', path: '/', icon: Home },
    { name: 'Biens', path: '/biens', icon: Building2 },
    { name: 'Services', path: '/services', icon: Briefcase },
  ];

  return (
    <header className="fixed top-0 left-0 w-full bg-white/90 backdrop-blur-md shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <Logo className="h-14" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2 font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-blue-700'
                    : 'text-gray-600 hover:text-blue-700'
                }`}
              >
                <link.icon size={18} />
                {link.name}
              </Link>
            ))}

            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 font-bold transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'text-purple-600'
                    : 'text-gray-600 hover:text-purple-600'
                }`}
              >
                <ShieldCheck size={18} />
                Admin
              </Link>
            )}

            {!user ? (
              <button
                onClick={login}
                className="flex items-center gap-2 text-gray-600 font-medium hover:text-blue-700 transition-colors"
              >
                <User size={18} />
                Connexion
              </button>
            ) : null}

            <Link
              to="/contact"
              className="bg-blue-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-all hover:scale-105 shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <Mail size={18} />
              Contact
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-blue-900 focus:outline-none"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-blue-700'
                  }`}
                >
                  <link.icon size={20} />
                  {link.name}
                </Link>
              ))}

              {isAdmin && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-purple-50 text-purple-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-purple-600'
                  }`}
                >
                  <ShieldCheck size={20} />
                  Admin
                </Link>
              )}

              {!user && (
                <button
                  onClick={login}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 font-medium hover:bg-gray-50 hover:text-blue-700 transition-colors"
                >
                  <User size={20} />
                  Connexion
                </button>
              )}

              <Link
                to="/contact"
                className="flex items-center justify-center gap-2 bg-blue-900 text-white px-6 py-4 rounded-xl font-semibold hover:bg-blue-800 transition-all shadow-md mt-4"
              >
                <Mail size={20} />
                Contactez-nous
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
