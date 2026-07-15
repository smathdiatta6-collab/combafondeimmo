import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Building2, Briefcase, Mail, User, ShieldCheck, Menu, X, LogOut, AlertCircle, ExternalLink, Lock, CheckCircle2 } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import Modal from './Modal';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, isAdmin, login, logout, authError, setAuthError, loginWithPasscode } = useFirebase();

  // Custom login states
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const success = await loginWithPasscode(loginEmail, loginPasscode);
      if (success) {
        setIsLoginModalOpen(false);
        setLoginEmail('');
        setLoginPasscode('');
      } else {
        setLoginError("Code d'accès incorrect ou email non autorisé.");
      }
    } catch (err: any) {
      setLoginError(err.message || "Une erreur s'est produite.");
    } finally {
      setIsLoggingIn(false);
    }
  };

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
                onClick={() => setIsLoginModalOpen(true)}
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
                  onClick={() => setIsLoginModalOpen(true)}
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

      {/* Login Modal */}
      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setLoginError('');
        }}
        title="Connexion au Tableau de Bord"
        maxWidth="max-w-md"
      >
        <div className="space-y-6">
          <p className="text-sm text-gray-500 leading-relaxed">
            Pour accéder à vos fonctionnalités d'administration, connectez-vous ci-dessous.
          </p>

          {/* Option 1: Google Login */}
          <button
            onClick={async () => {
              setLoginError('');
              try {
                await login();
                setIsLoginModalOpen(false);
              } catch (e) {
                // Error is set in global FirebaseContext
              }
            }}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 text-gray-700 font-bold py-3.5 px-4 rounded-2xl transition-all shadow-sm group text-sm cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Se connecter avec Google
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-150"></div>
            <span className="flex-shrink mx-4 text-xs text-gray-400 font-bold uppercase tracking-wider">OU</span>
            <div className="flex-grow border-t border-gray-150"></div>
          </div>

          {/* Option 2: Passcode Login */}
          <form onSubmit={handlePasscodeLogin} className="space-y-4">
            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
              <span className="text-[11px] text-blue-700 font-bold uppercase tracking-wider block mb-1">
                Connexion alternative sans pop-up
              </span>
              <p className="text-[11px] text-blue-600 leading-normal">
                Si la fenêtre de connexion Google ne s'affiche pas, saisissez votre email et votre code secret ci-dessous.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Adresse Email Autorisé
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Ex: Elhadjisillyndiaye@icloud.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Code secret / Passcode
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={loginPasscode}
                  onChange={(e) => setLoginPasscode(e.target.value)}
                  placeholder="Saisissez votre code d'accès"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-800"
                />
                <Lock className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="text-xs font-medium">{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-900 text-white font-bold py-3 px-4 rounded-xl text-sm hover:bg-blue-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoggingIn ? 'Connexion en cours...' : "Accéder à l'administration"}
            </button>
          </form>
        </div>
      </Modal>
    </header>
  );
}
