import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Receipt, Trash2, Plus, ArrowLeft, Printer, Download, Edit2, Copy } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { generateReceiptPDF } from '../utils/pdfGenerator';
import { numberToWordsFrench } from '../utils/numberToWords';
import Logo from '../components/Logo';

const AdminReceipts: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [newReceipt, setNewReceipt] = useState({ 
    clientName: '', 
    amount: 0, 
    amountInWords: '',
    date: '', 
    periodStart: '',
    periodEnd: '',
    contractId: '', 
    paymentMethodId: 'Especes', 
    reference: '' 
  });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && isAdmin) {
      fetchReceipts();
      fetchContracts();
      fetchPayments();
    }
  }, [user, isAdmin]);

  const formatAmount = (val: number) => {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const fetchReceipts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'receipts'));
      const fetchedReceipts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Sort alphabetically by client name
      fetchedReceipts.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || ''));
      setReceipts(fetchedReceipts);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'receipts');
    }
  };

  const fetchContracts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'contracts'));
      setContracts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'contracts');
    }
  };

  const fetchPayments = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'paymentMethods'));
      setPayments(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'paymentMethods');
    }
  };

  const handleAddReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'receipts', editingId), { 
          ...newReceipt, 
          paymentMethodId: 'Especes',
          updatedByUID: user?.uid,
          updatedByName: user?.displayName || user?.email,
          updatedAt: new Date().toISOString()
        });
        alert('Quittance mise à jour avec succès !');
      } else {
        await addDoc(collection(db, 'receipts'), { 
          ...newReceipt, 
          paymentMethodId: 'Especes', 
          reference: '',
          createdByUID: user?.uid,
          createdByName: user?.displayName || user?.email,
          createdAt: new Date().toISOString()
        });
        alert('Quittance enregistrée avec succès !');
      }
      setNewReceipt({ 
        clientName: '', 
        amount: 0, 
        amountInWords: '',
        date: '', 
        periodStart: '',
        periodEnd: '',
        contractId: '', 
        paymentMethodId: 'Especes', 
        reference: '' 
      });
      setIsAdding(false);
      setEditingId(null);
      fetchReceipts();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'receipts');
    }
  };

  const handleEditClick = (receipt: any) => {
    setNewReceipt({
      clientName: receipt.clientName || '',
      amount: receipt.amount || 0,
      amountInWords: receipt.amountInWords || '',
      date: receipt.date || '',
      periodStart: receipt.periodStart || '',
      periodEnd: receipt.periodEnd || '',
      contractId: receipt.contractId || '',
      paymentMethodId: receipt.paymentMethodId || 'Especes',
      reference: receipt.reference || ''
    });
    setEditingId(receipt.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = (receipt: any) => {
    setNewReceipt({
      clientName: `${receipt.clientName} (Copie)`,
      amount: receipt.amount || 0,
      amountInWords: receipt.amountInWords || '',
      date: new Date().toISOString().split('T')[0],
      periodStart: receipt.periodStart || '',
      periodEnd: receipt.periodEnd || '',
      contractId: receipt.contractId || '',
      paymentMethodId: receipt.paymentMethodId || 'Especes',
      reference: ''
    });
    setEditingId(null);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteReceipt = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette quittance ?')) {
      try {
        await deleteDoc(doc(db, 'receipts', id));
        fetchReceipts();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `receipts/${id}`);
      }
    }
  };

  const handleDownloadPDF = (receipt: any) => {
    const contract = contracts.find(c => c.id === receipt.contractId);
    const paymentMethod = payments.find(p => p.id === receipt.paymentMethodId);
    generateReceiptPDF(receipt, contract, paymentMethod);
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

        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-6">
            <Logo className="h-16" />
            <h1 className="text-4xl font-bold text-gray-900">Quittances</h1>
          </div>
          <button
            onClick={() => {
              if (isAdding && editingId) {
                setEditingId(null);
                setNewReceipt({ 
                  clientName: '', 
                  amount: 0, 
                  amountInWords: '',
                  date: '', 
                  periodStart: '',
                  periodEnd: '',
                  contractId: '', 
                  paymentMethodId: 'Especes', 
                  reference: '' 
                });
              }
              setIsAdding(!isAdding);
            }}
            className="bg-blue-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-800 transition-all shadow-lg"
          >
            <Plus size={20} />
            {isAdding && editingId ? 'Annuler l\'édition' : 'Générer une quittance'}
          </button>
        </div>

        {isAdding && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 mb-12">
            <h3 className="text-2xl font-bold mb-6">{editingId ? 'Modifier la Quittance' : 'Nouvelle Quittance'}</h3>
            <form onSubmit={handleAddReceipt} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Nom du Client</label>
                <input
                  type="text"
                  required
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newReceipt.clientName}
                  onChange={(e) => setNewReceipt({ ...newReceipt, clientName: e.target.value })}
                />
              </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Montant (FCFA)</label>
                    <input
                      type="number"
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={newReceipt.amount}
                      onChange={(e) => {
                        const amt = parseInt(e.target.value) || 0;
                        setNewReceipt({ 
                          ...newReceipt, 
                          amount: amt,
                          amountInWords: numberToWordsFrench(amt)
                        });
                      }}
                    />
                  </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Montant en lettres (Généré automatiquement)</label>
                <input
                  type="text"
                  readOnly
                  className="w-full px-5 py-4 bg-gray-100 border-none rounded-2xl focus:ring-0 outline-none cursor-not-allowed font-bold text-gray-700"
                  value={newReceipt.amountInWords}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Période du</label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newReceipt.periodStart}
                  onChange={(e) => setNewReceipt({ ...newReceipt, periodStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Période au</label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newReceipt.periodEnd}
                  onChange={(e) => setNewReceipt({ ...newReceipt, periodEnd: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Contrat Associé</label>
                <select
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                  value={newReceipt.contractId}
                  onChange={(e) => setNewReceipt({ ...newReceipt, contractId: e.target.value })}
                  required
                >
                  <option value="">Sélectionner un contrat</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.clientName} - {c.type}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Date du Paiement</label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={newReceipt.date}
                  onChange={(e) => setNewReceipt({ ...newReceipt, date: e.target.value })}
                />
              </div>
              <div className="flex gap-4 md:col-span-2">
                <button type="submit" className="bg-blue-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all">
                  {editingId ? 'Mettre à jour' : 'Générer'}
                </button>
                <button type="button" onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setNewReceipt({ 
                    clientName: '', 
                    amount: 0, 
                    amountInWords: '',
                    date: '', 
                    periodStart: '',
                    periodEnd: '',
                    contractId: '', 
                    paymentMethodId: 'Especes', 
                    reference: '' 
                  });
                }} className="bg-gray-200 text-gray-700 px-8 py-4 rounded-2xl font-bold hover:bg-gray-300 transition-all">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-xl transition-all">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                    <Receipt size={28} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDuplicate(receipt)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Dupliquer la quittance"
                    >
                      <Copy size={20} />
                    </button>
                    <button
                      onClick={() => handleEditClick(receipt)}
                      className="text-gray-400 hover:text-orange-600 transition-colors"
                      title="Modifier la quittance"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(receipt)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Télécharger PDF"
                    >
                      <Download size={20} />
                    </button>
                    <button
                      onClick={() => handleDeleteReceipt(receipt.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{receipt.clientName}</h3>
                <p className="text-green-600 font-bold text-lg mb-4">{formatAmount(receipt.amount)} FCFA</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>Date: {receipt.date}</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-50">
                <button
                  onClick={() => handleDownloadPDF(receipt)}
                  className="w-full text-blue-600 font-bold text-sm flex items-center justify-center gap-2 hover:gap-3 transition-all"
                >
                  Télécharger PDF <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminReceipts;
