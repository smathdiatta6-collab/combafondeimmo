import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ShieldCheck, ArrowLeft, Users, FileText, Receipt, TrendingUp, Calendar, Clock } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import Logo from '../components/Logo';

const SuperAdminDashboard: React.FC = () => {
  const { user, isSuperAdmin, loading } = useFirebase();
  const [users, setUsers] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    if (user && isSuperAdmin) {
      fetchData();
    }
  }, [user, isSuperAdmin, filter]);

  const fetchData = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      const receiptsSnap = await getDocs(collection(db, 'receipts'));

      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const contractsList = contractsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const receiptsList = receiptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setUsers(usersList);
      setContracts(contractsList);
      setReceipts(receiptsList);

      calculateStats(usersList, contractsList, receiptsList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'all');
    }
  };

  const calculateStats = (usersList: any[], contractsList: any[], receiptsList: any[]) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filteredContracts = contractsList.filter(c => {
      if (filter === 'all') return true;
      const date = new Date(c.createdAt);
      if (filter === 'day') return date >= startOfDay;
      if (filter === 'week') return date >= startOfWeek;
      if (filter === 'month') return date >= startOfMonth;
      return true;
    });

    const filteredReceipts = receiptsList.filter(r => {
      if (filter === 'all') return true;
      const date = new Date(r.createdAt);
      if (filter === 'day') return date >= startOfDay;
      if (filter === 'week') return date >= startOfWeek;
      if (filter === 'month') return date >= startOfMonth;
      return true;
    });

    const userStats = usersList.map(u => {
      const userContracts = filteredContracts.filter(c => c.createdByUID === u.id);
      const userReceipts = filteredReceipts.filter(r => r.createdByUID === u.id);
      const totalAmount = userReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);

      return {
        ...u,
        contractCount: userContracts.length,
        receiptCount: userReceipts.length,
        totalAmount
      };
    }).filter(u => u.contractCount > 0 || u.receiptCount > 0 || u.role === 'admin');

    setStats(userStats);
  };

  const formatAmount = (val: number) => {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isSuperAdmin) return <Navigate to="/" />;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/admin" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium mb-8 transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Retour au Dashboard
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-6">
            <Logo className="h-16" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Contrôle Activité</h1>
              <p className="text-gray-600">Suivi des performances de l'équipe</p>
            </div>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
            {[
              { id: 'all', label: 'Tout' },
              { id: 'day', label: 'Jour' },
              { id: 'week', label: 'Semaine' },
              { id: 'month', label: 'Mois' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  filter === f.id ? 'bg-blue-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <FileText size={24} />
            </div>
            <p className="text-gray-500 font-medium">Contrats Créés</p>
            <h3 className="text-3xl font-bold text-gray-900">{contracts.length}</h3>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-4">
              <Receipt size={24} />
            </div>
            <p className="text-gray-500 font-medium">Paiements Enregistrés</p>
            <h3 className="text-3xl font-bold text-gray-900">{receipts.length}</h3>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
              <TrendingUp size={24} />
            </div>
            <p className="text-gray-500 font-medium">Total Encaissé</p>
            <h3 className="text-3xl font-bold text-gray-900">
              {formatAmount(receipts.reduce((sum, r) => sum + (r.amount || 0), 0))} FCFA
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="text-blue-900" />
              Activité par Utilisateur
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Utilisateur</th>
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Contrats</th>
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Paiements</th>
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Montant Total</th>
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Rôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold">
                          {u.displayName?.charAt(0) || u.email?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{u.displayName || 'Utilisateur'}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-gray-900">{u.contractCount}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-gray-900">{u.receiptCount}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-green-600">{formatAmount(u.totalAmount)} FCFA</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-gray-500">
                      Aucune activité enregistrée pour cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
