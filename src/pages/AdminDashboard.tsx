import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { Link, Navigate } from 'react-router-dom';
import { CreditCard, FileText, Receipt, LayoutDashboard, LogOut, FileBarChart, MessageSquare, ShieldCheck } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import Logo from '../components/Logo';

const AdminDashboard: React.FC = () => {
  const { user, isAdmin, isSuperAdmin, loading, logout } = useFirebase();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'contacts'), where('status', '==', 'unread'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isAdmin) return <Navigate to="/" />;

  const menuItems = [
    ...(isSuperAdmin ? [{ title: 'Gestion des Biens', icon: LayoutDashboard, path: '/admin/biens', color: 'bg-indigo-500' }] : []),
    { title: 'Messages', icon: MessageSquare, path: '/admin/messages', color: 'bg-pink-500', badge: unreadCount },
    ...(isSuperAdmin ? [{ title: 'Contrôle Activité', icon: ShieldCheck, path: '/admin/super', color: 'bg-red-600' }] : []),
    { title: 'Modes de Paiement', icon: CreditCard, path: '/admin/paiements', color: 'bg-blue-500' },
    { title: 'Contrats', icon: FileText, path: '/admin/contrats', color: 'bg-purple-500' },
    { title: 'Quittances', icon: Receipt, path: '/admin/quittances', color: 'bg-green-500' },
    { title: 'Bilans Mensuels', icon: FileBarChart, path: '/admin/bilans', color: 'bg-orange-500' },
  ];

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-6">
            <Logo className="h-20" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Tableau de Bord Admin</h1>
              <p className="text-gray-600">Gérez vos paiements, contrats, quittances et bilans.</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-red-600 font-bold hover:text-red-700 transition-colors bg-white px-6 py-3 rounded-2xl shadow-sm"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group border border-gray-100 flex flex-col items-center text-center relative"
            >
              {item.badge && item.badge > 0 ? (
                <div className="absolute top-6 right-6 bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center animate-bounce">
                  {item.badge}
                </div>
              ) : null}
              <div className={`w-20 h-20 ${item.color} text-white rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                <item.icon size={40} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm">Gérer les {item.title.toLowerCase()} de l'agence.</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
