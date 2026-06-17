import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { Link, Navigate } from 'react-router-dom';
import { CreditCard, FileText, Receipt, LayoutDashboard, LogOut, FileBarChart, MessageSquare, ShieldCheck, Building, TrendingUp, Clock, ChevronRight, MessageCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import Logo from '../components/Logo';

const AdminDashboard: React.FC = () => {
  const { user, isAdmin, isSuperAdmin, loading, logout } = useFirebase();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestMessages, setLatestMessages] = useState<any[]>([]);
  const [stats, setStats] = useState({
    propertiesCount: 0,
    contractsCount: 0,
    totalCollected: 0,
    totalPending: 0,
  });

  useEffect(() => {
    if (!isAdmin) return;

    // Unread messages count
    const qMessages = query(collection(db, 'contacts'), where('status', '==', 'unread'));
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    // Latest 3 messages
    const qMessagesList = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'), limit(3));
    const unsubscribeMessagesList = onSnapshot(qMessagesList, (snapshot) => {
      setLatestMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Error loading latest messages:', error);
    });

    // Properties snapshot
    const unsubscribeProperties = onSnapshot(collection(db, 'properties'), (snapshot) => {
      setStats(prev => ({ ...prev, propertiesCount: snapshot.size }));
    }, (error) => {
      console.warn('Error loading properties for statistics:', error);
    });

    // Contracts snapshot
    const unsubscribeContracts = onSnapshot(collection(db, 'contracts'), (snapshot) => {
      setStats(prev => ({ ...prev, contractsCount: snapshot.size }));
    }, (error) => {
      console.warn('Error loading contracts for statistics:', error);
    });

    // Receipts snapshot to aggregate payments
    const unsubscribeReceipts = onSnapshot(collection(db, 'receipts'), (snapshot) => {
      let collected = 0;
      let pending = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const amt = Number(data.amount) || 0;
        if (data.status === 'Payé') {
          collected += amt;
        } else {
          pending += amt;
        }
      });
      setStats((prev) => ({
        ...prev,
        totalCollected: collected,
        totalPending: pending,
      }));
    }, (error) => {
      console.warn('Error loading receipts for statistics:', error);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeMessagesList();
      unsubscribeProperties();
      unsubscribeContracts();
      unsubscribeReceipts();
    };
  }, [isAdmin]);

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isAdmin) return <Navigate to="/" />;

  const formatAmount = (val: any) => {
    if (val === undefined || val === null) return "0";
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const menuItems = [
    ...(isSuperAdmin ? [{ title: 'Gestion des Biens', icon: LayoutDashboard, path: '/admin/biens', color: 'bg-indigo-500' }] : []),
    { title: 'Messages', icon: MessageSquare, path: '/admin/messages', color: 'bg-pink-500', badge: unreadCount },
    ...(isSuperAdmin ? [{ title: 'Contrôle Activité', icon: ShieldCheck, path: '/admin/super', color: 'bg-red-650' }] : []),
    { title: 'Modes de Paiement', icon: CreditCard, path: '/admin/paiements', color: 'bg-blue-500' },
    { title: 'Contrats', icon: FileText, path: '/admin/contrats', color: 'bg-purple-500' },
    { title: 'Quittances', icon: Receipt, path: '/admin/quittances', color: 'bg-green-500' },
    { title: 'Bilans Mensuels', icon: FileBarChart, path: '/admin/bilans', color: 'bg-orange-500' },
  ];

  // Recovery Rate computation
  const totalFunds = stats.totalCollected + stats.totalPending;
  const recoveryRate = totalFunds > 0 ? Math.round((stats.totalCollected / totalFunds) * 100) : 0;

  // Circular progress math
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (recoveryRate / 100) * circumference;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-6">
            <Logo className="h-20" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 font-sans tracking-tight">Tableau de Bord Admin</h1>
              <p className="text-gray-600">Gérez vos paiements, baux commerciaux, quittances de loyer et bilans d'activité.</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-red-600 font-bold hover:text-red-700 transition-colors bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>

        {/* KPI Stats Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Card 1: Biens */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Biens Gérés</p>
              <h3 className="text-3xl font-black text-gray-900">{stats.propertiesCount}</h3>
              <p className="text-[11px] text-indigo-600 mt-1 font-bold">Maisons & Appartements</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center shrink-0">
              <Building size={24} />
            </div>
          </div>

          {/* Card 2: Contrats */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Contrats Actifs</p>
              <h3 className="text-3xl font-black text-gray-900">{stats.contractsCount}</h3>
              <p className="text-[11px] text-purple-600 mt-1 font-bold">Baux signés enregistrés</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
          </div>

          {/* Card 3: Payé */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Loyers Encaissés</p>
              <h3 className="text-2xl font-black text-green-700 font-mono">
                {formatAmount(stats.totalCollected)} <span className="text-[11px] font-sans font-bold">FCFA</span>
              </h3>
              <p className="text-[11px] text-green-600 mt-1 font-bold">Quittances Réglées</p>
            </div>
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shrink-0">
              <TrendingUp size={24} />
            </div>
          </div>

          {/* Card 4: En Attente */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">En Attente</p>
              <h3 className="text-2xl font-black text-amber-700 font-mono">
                {formatAmount(stats.totalPending)} <span className="text-[11px] font-sans font-bold">FCFA</span>
              </h3>
              <p className="text-[11px] text-amber-600 mt-1 font-bold">Reste à recouvrer</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
              <Clock size={24} />
            </div>
          </div>
        </div>

        {/* Bento Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Block: Quick Access Menu */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 px-1">Accès Rapides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="bg-white p-7 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group border border-gray-100 flex flex-col items-center text-center relative"
                >
                  {item.badge && item.badge > 0 ? (
                    <div className="absolute top-5 right-5 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow">
                      {item.badge}
                    </div>
                  ) : null}
                  <div className={`w-16 h-16 ${item.color} text-white rounded-2xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform shadow-md duration-300`}>
                    <item.icon size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-400 text-xs leading-normal px-2">Gérez et suivez les {item.title.toLowerCase()} de l'agence.</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Right Block: Sidebar Insights */}
          <div className="space-y-8">
            
            {/* Widget 1: Collection Rate circular progress */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Efficacité de Recouvrement</h3>
              
              <div className="flex items-center gap-6">
                <div className="relative">
                  <svg className="w-24 h-24 transform -rotate-90">
                    {/* Background Circle */}
                    <circle 
                      cx="48" 
                      cy="48" 
                      r={radius} 
                      className="text-gray-100" 
                      strokeWidth="8" 
                      stroke="currentColor" 
                      fill="transparent" 
                    />
                    {/* Foreground Circle */}
                    <circle 
                      cx="48" 
                      cy="48" 
                      r={radius} 
                      className="text-green-500 transition-all duration-1000 ease-out" 
                      strokeWidth="8" 
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      stroke="currentColor" 
                      fill="transparent" 
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-extrabold text-gray-800 font-mono">{recoveryRate}%</span>
                  </div>
                </div>

                <div className="flex-grow space-y-1">
                  <div className="text-base font-black text-gray-900">Taux de Rentrée</div>
                  <div className="text-xs text-gray-500">
                    Pourcentage total de loyers déjà payés par rapport aux appels de fonds émis ce mois.
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 2: Latest Contact Messages Inbox */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Derniers Messages</h3>
                <Link to="/admin/messages" className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                  Voir tout <ChevronRight size={14} />
                </Link>
              </div>

              {latestMessages.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {latestMessages.map((msg) => (
                    <Link 
                      key={msg.id} 
                      to="/admin/messages"
                      className="block py-3 hover:bg-gray-50/50 rounded-xl transition-colors px-2 -mx-2 group"
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="font-bold text-sm text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                          {msg.name}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 font-mono">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {msg.status === 'unread' && (
                          <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" title="Non lu" />
                        )}
                        <p className="text-xs text-gray-500 truncate leading-relaxed">
                          {msg.subject || msg.message}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <MessageCircle size={18} />
                  </div>
                  <p className="text-xs">Aucun message reçu</p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
