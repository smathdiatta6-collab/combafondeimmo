import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { CreditCard, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

const AdminPayments: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const [payments, setPayments] = useState<any[]>([]);
  const [newPayment, setNewPayment] = useState({ name: '', type: 'Wave', details: '', isActive: true });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      fetchPayments();
    }
  }, [user, isAdmin]);

  const fetchPayments = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'paymentMethods'));
      setPayments(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'paymentMethods');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'paymentMethods'), newPayment);
      setNewPayment({ name: '', type: 'Wave', details: '', isActive: true });
      setIsAdding(false);
      fetchPayments();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'paymentMethods');
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce mode de paiement ?')) {
      try {
        await deleteDoc(doc(db, 'paymentMethods', id));
        fetchPayments();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `paymentMethods/${id}`);
      }
    }
  };

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isAdmin) return <Navigate to="/" />;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/admin" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium mb-8 transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Retour au Dashboard
        </Link>

        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Modes de Paiement</h1>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-blue-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-800 transition-all shadow-lg"
          >
            <Plus size={20} />
            Ajouter un mode
          </button>
        </div>

        {isAdding && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 mb-12">
            <h3 className="text-2xl font-bold mb-6">Nouveau Mode de Paiement</h3>
            <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Nom (ex: Wave)</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newPayment.name}
                  onChange={(e) => setNewPayment({ ...newPayment, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Type</label>
                <select
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                  value={newPayment.type}
                  onChange={(e) => setNewPayment({ ...newPayment, type: e.target.value })}
                >
                  <option value="Wave">Wave</option>
                  <option value="Orange Money">Orange Money</option>
                  <option value="Virement Bancaire">Virement Bancaire</option>
                  <option value="Espèces">Espèces</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Détails (Numéro, RIB...)</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newPayment.details}
                  onChange={(e) => setNewPayment({ ...newPayment, details: e.target.value })}
                />
              </div>
              <div className="flex gap-4 md:col-span-2">
                <button type="submit" className="bg-blue-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all">
                  Enregistrer
                </button>
                <button type="button" onClick={() => setIsAdding(false)} className="bg-gray-200 text-gray-700 px-8 py-4 rounded-2xl font-bold hover:bg-gray-300 transition-all">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {payments.map((payment) => (
            <div key={payment.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-xl transition-all">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                    <CreditCard size={28} />
                  </div>
                  <button
                    onClick={() => handleDeletePayment(payment.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{payment.name}</h3>
                <p className="text-blue-600 font-bold text-sm mb-4">{payment.type}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{payment.details}</p>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${payment.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {payment.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
