import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Building2, Briefcase, Mail, User, ShieldCheck, Menu, X, LogOut, AlertCircle, ExternalLink } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, isAdmin, login, logout, authError, setAuthError } = useFirebase();

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
              <div className="flex items-center gap-4">
                <NotificationBell />
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
              </div>
            )}

            {!user ? (
              <button
                onClick={login}
                className="flex items-center gap-2 text-gray-600 font-medium hover:text-blue-700 transition-colors"
              >
                <User size={18} />
                Connexion
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 shrink-0 max-w-[200px] lg:max-w-[280px]">
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[11px] text-gray-400 font-bold uppercase truncate max-w-full">
                    {user.displayName || 'Utilisateur'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono truncate max-w-full" title={user.email || ''}>
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors shrink-0"
                  title="Déconnexion"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}

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

      {/* Authentication Error Banner */}
      <AnimatePresence>
        {authError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-amber-600 text-white font-sans text-sm py-3.5 px-4 shadow-md border-t border-amber-700 flex justify-between items-center z-55 relative gap-3"
          >
            <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={20} className="shrink-0 text-amber-100" />
                <span className="font-semibold leading-relaxed text-left text-xs sm:text-sm">
                  {authError}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white text-amber-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 hover:bg-amber-50 transition-colors shadow-sm"
                >
                  <ExternalLink size={14} />
                  Ouvrir dans un nouvel onglet
                </a>
                <button
                  onClick={() => setAuthError(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl">
                    <span className="text-sm font-bold text-gray-600">Notifications</span>
                    <NotificationBell />
                  </div>
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
                </div>
              )}

              {!user ? (
                <button
                  onClick={login}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 font-medium hover:bg-gray-50 hover:text-blue-700 transition-colors"
                >
                  <User size={20} />
                  Connexion
                </button>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-400 uppercase">
                      {user.displayName || 'Utilisateur'}
                    </span>
                    <span className="text-xs text-gray-500 font-mono truncate">
                      {user.email}
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 font-bold bg-white border border-red-100 hover:bg-red-50 hover:text-red-700 transition-colors"
                  >
                    <LogOut size={20} />
                    Déconnexion
                  </button>
                </div>
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
