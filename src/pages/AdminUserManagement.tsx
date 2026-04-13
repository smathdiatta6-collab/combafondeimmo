import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { ArrowLeft, Users, Shield, ShieldAlert, Search, Mail, Calendar } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import Logo from '../components/Logo';

const AdminUserManagement: React.FC = () => {
  const { user, isSuperAdmin, loading } = useFirebase();
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (user && isSuperAdmin) {
      fetchUsers();
    }
  }, [user, isSuperAdmin]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  };

  const toggleAdminRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const confirmMessage = newRole === 'admin' 
      ? "Voulez-vous vraiment donner les accès Administrateur à cet utilisateur ?" 
      : "Voulez-vous retirer les accès Administrateur de cet utilisateur ?";
    
    if (!window.confirm(confirmMessage)) return;

    setIsUpdating(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      await fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isSuperAdmin) return <Navigate to="/" />;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/admin/super" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium mb-8 transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Retour au Contrôle Activité
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-6">
            <Logo className="h-16" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
              <p className="text-gray-600">Attribuez les accès Administrateur à votre équipe</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
          <input
            type="text"
            placeholder="Rechercher un utilisateur par nom ou email..."
            className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-[2rem] shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Utilisateur</th>
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Email</th>
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Date d'inscription</th>
                  <th className="px-8 py-4 text-sm font-bold text-gray-600">Rôle Actuel</th>
                  <th className="px-8 py-4 text-sm font-bold text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${u.role === 'admin' ? 'bg-purple-600' : 'bg-blue-900'}`}>
                          {u.displayName?.charAt(0) || u.email?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{u.displayName || 'Utilisateur'}</p>
                          {u.email === "smathdiatta6@gmail.com" && (
                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold uppercase">Propriétaire</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail size={14} />
                        {u.email}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role === 'admin' ? <Shield size={14} /> : <Users size={14} />}
                        {u.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {u.email !== "smathdiatta6@gmail.com" ? (
                        <button
                          onClick={() => toggleAdminRole(u.id, u.role)}
                          disabled={isUpdating === u.id}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            u.role === 'admin' 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          } disabled:opacity-50`}
                        >
                          {isUpdating === u.id ? 'Mise à jour...' : (u.role === 'admin' ? 'Retirer Admin' : 'Nommer Admin')}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Non modifiable</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-gray-500">
                      Aucun utilisateur trouvé.
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

export default AdminUserManagement;
