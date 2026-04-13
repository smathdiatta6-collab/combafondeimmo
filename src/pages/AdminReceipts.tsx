import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Receipt, Trash2, Plus, ArrowLeft, Printer, Download, Edit2, Copy, Search, CreditCard, X } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { generateReceiptPDF } from '../utils/pdfGenerator';
import { numberToWordsFrench } from '../utils/numberToWords';
import Logo from '../components/Logo';
import Modal from '../components/Modal';
import { createNotification } from '../services/NotificationService';

const AdminReceipts: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const location = useLocation();
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [newReceipt, setNewReceipt] = useState({ 
    clientName: '', 
    amount: 0, 
    amountInWords: '',
    date: new Date().toISOString().split('T')[0], 
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    paymentMethodId: 'Especes', 
    reference: '',
    prestations: 0,
    timbre: 0,
    periodLabel: 'un mois',
    propertyAddress: '',
    status: 'En attente'
  });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [reportToProcess, setReportToProcess] = useState<any>(null);
  const [selectedReportItems, setSelectedReportItems] = useState<number[]>([]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchReceipts();
      fetchContracts();
      fetchPayments();
    }
  }, [user, isAdmin]);

  const fetchContracts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'contracts'));
      setContracts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setContractsLoaded(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'contracts');
      setContractsLoaded(true);
    }
  };

  useEffect(() => {
    // Check if we came from a monthly report
    if (location.state && location.state.fromReport && location.state.reportData && contractsLoaded) {
      const report = location.state.reportData;
      // Clear state immediately to prevent multiple triggers
      navigate(location.pathname, { replace: true, state: {} });
      setReportToProcess(report);
      setSelectedReportItems(report.items.map((_: any, i: number) => i)); // Select all by default
    }
  }, [location.state, contractsLoaded]);

  const handleBulkReceipts = async () => {
    if (!reportToProcess || selectedReportItems.length === 0) return;

    const confirmBulk = window.confirm(`Voulez-vous enregistrer les ${selectedReportItems.length} quittances sélectionnées ?`);
    if (!confirmBulk) return;

    const months: { [key: string]: number } = {
      'Janvier': 0, 'Février': 1, 'Mars': 2, 'Avril': 3, 'Mai': 4, 'Juin': 5,
      'Juillet': 6, 'Août': 7, 'Septembre': 8, 'Octobre': 9, 'Novembre': 10, 'Décembre': 11
    };

    let start = '';
    let end = '';
    const monthName = Object.keys(months).find(m => reportToProcess.mois?.includes(m));
    if (monthName !== undefined) {
      const year = new Date().getFullYear();
      const monthIndex = months[monthName];
      start = new Date(year, monthIndex, 1).toISOString().split('T')[0];
      end = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];
    }

    try {
      const selectedItems = reportToProcess.items.filter((_: any, i: number) => selectedReportItems.includes(i));
      
      const batchPromises = selectedItems.map((item: any) => {
        const amount = Number(item.montantPaye) || 0;
        const clientName = `${item.prenoms || ''} ${item.nom || ''}`.trim();
        
        // Find associated contract if possible
        const contract = contracts.find(c => 
          c.clientName?.toLowerCase().includes((item.nom || '').toLowerCase()) ||
          (item.nom || '').toLowerCase().includes(c.clientName?.toLowerCase())
        );

        return addDoc(collection(db, 'receipts'), {
          clientName: clientName,
          amount: amount,
          amountInWords: numberToWordsFrench(amount),
          date: reportToProcess.date || new Date().toISOString().split('T')[0],
          periodStart: start,
          periodEnd: end,
          contractId: contract?.id || '',
          paymentMethodId: 'Especes',
          reference: '',
          prestations: 0,
          timbre: 0,
          periodLabel: `un mois de ${reportToProcess.mois.split(' ')[0]}`,
          propertyAddress: `Cité BATA chez ${reportToProcess.chez}`,
          status: 'En attente',
          createdByUID: user?.uid,
          createdByName: user?.displayName || user?.email,
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(batchPromises);

      await createNotification({
        title: 'Quittances groupées',
        message: `${selectedItems.length} quittances ont été générées pour le bilan de ${reportToProcess.mois}`,
        type: 'payment',
        link: '/admin/quittances'
      });

      alert(`${selectedItems.length} quittances ont été générées avec succès !`);
      setReportToProcess(null);
      setSelectedReportItems([]);
      fetchReceipts();
    } catch (error) {
      console.error('Error generating bulk receipts:', error);
      alert('Erreur lors de la génération groupée des quittances.');
    }
  };

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

        await createNotification({
          title: 'Nouvelle quittance',
          message: `Une quittance de ${formatAmount(newReceipt.amount)} FCFA a été générée pour ${newReceipt.clientName}`,
          type: 'payment',
          link: '/admin/quittances'
        });

        alert('Quittance enregistrée avec succès !');
      }
      setNewReceipt({ 
        clientName: '', 
        amount: 0, 
        amountInWords: '',
        date: new Date().toISOString().split('T')[0], 
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        paymentMethodId: 'Especes', 
        reference: '',
        prestations: 0,
        timbre: 0,
        periodLabel: 'un mois',
        propertyAddress: '',
        status: 'En attente'
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
      reference: receipt.reference || '',
      prestations: receipt.prestations || 0,
      timbre: receipt.timbre || 0,
      periodLabel: receipt.periodLabel || 'un mois',
      propertyAddress: receipt.propertyAddress || '',
      status: receipt.status || 'En attente'
    });
    setEditingId(receipt.id);
    setIsAdding(true);
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
      reference: '',
      prestations: receipt.prestations || 0,
      timbre: receipt.timbre || 0,
      periodLabel: receipt.periodLabel || 'un mois',
      propertyAddress: receipt.propertyAddress || '',
      status: 'En attente'
    });
    setEditingId(null);
    setIsAdding(true);
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

  const filteredReceipts = receipts.filter(receipt => 
    (receipt.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (receipt.propertyAddress || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (receipt.date || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRemoveDuplicates = async () => {
    if (!window.confirm('Voulez-vous vraiment supprimer les quittances en double (même client, même montant, même période) ?')) return;
    
    const seen = new Set();
    const duplicates = [];
    
    for (const receipt of receipts) {
      // Use a more comprehensive key to identify real duplicates
      const key = `${receipt.clientName}-${receipt.amount}-${receipt.periodStart}-${receipt.periodEnd}-${receipt.periodLabel}`;
      if (seen.has(key)) {
        duplicates.push(receipt.id);
      } else {
        seen.add(key);
      }
    }
    
    if (duplicates.length === 0) {
      alert('Aucun doublon trouvé.');
      return;
    }
    
    if (window.confirm(`${duplicates.length} doublon(s) trouvé(s). Supprimer ?`)) {
      try {
        await Promise.all(duplicates.map(id => deleteDoc(doc(db, 'receipts', id))));
        alert('Doublons supprimés avec succès.');
        fetchReceipts();
      } catch (error) {
        console.error('Error removing duplicates:', error);
        alert('Erreur lors de la suppression des doublons.');
      }
    }
  };

  const handlePayReceipt = async (receipt: any) => {
    if (!window.confirm(`Confirmer le paiement en espèces de ${formatAmount(receipt.amount)} FCFA pour ${receipt.clientName} (${receipt.periodLabel || 'ce mois'}) ?`)) return;

    try {
      // 1. Update receipt status
      await updateDoc(doc(db, 'receipts', receipt.id), { 
        status: 'Payé',
        paymentMethodId: 'Especes',
        paidAt: new Date().toISOString()
      });

      // 2. Update contract status if exists
      if (receipt.contractId) {
        await updateDoc(doc(db, 'contracts', receipt.contractId), { status: 'Payé' });
      }

      await createNotification({
        title: 'Paiement reçu',
        message: `Paiement de ${formatAmount(receipt.amount)} FCFA reçu pour ${receipt.clientName}`,
        type: 'payment',
        link: '/admin/quittances'
      });

      alert('Quittance marquée comme payée !');
      fetchReceipts();
      fetchContracts();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `receipts/${receipt.id}`);
    }
  };

  const handlePeriodLabelChange = (label: string) => {
    const months: { [key: string]: number } = {
      'Janvier': 0, 'Février': 1, 'Mars': 2, 'Avril': 3, 'Mai': 4, 'Juin': 5,
      'Juillet': 6, 'Août': 7, 'Septembre': 8, 'Octobre': 9, 'Novembre': 10, 'Décembre': 11
    };

    let start = '';
    let end = '';

    const monthName = Object.keys(months).find(m => label.includes(m));
    
    if (monthName !== undefined) {
      const year = new Date().getFullYear();
      const monthIndex = months[monthName];
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0);
      
      // Format as YYYY-MM-DD for input type="date"
      start = startDate.toISOString().split('T')[0];
      end = endDate.toISOString().split('T')[0];
    } else if (label === 'un mois') {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = startDate.toISOString().split('T')[0];
      end = endDate.toISOString().split('T')[0];
    }

    setNewReceipt(prev => ({
      ...prev,
      periodLabel: label,
      periodStart: start || prev.periodStart,
      periodEnd: end || prev.periodEnd
    }));
  };

  const totalTenantsCount = Array.from(new Set(receipts.map(r => r.clientName))).filter(Boolean).length;
  const totalReceiptsCount = receipts.length;

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
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Quittances</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                  <p className="text-blue-700 font-bold text-sm">{totalTenantsCount} Locataires</p>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full">
                  <p className="text-gray-600 font-bold text-sm">{totalReceiptsCount} Quittances</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleRemoveDuplicates}
              className="bg-red-100 text-red-600 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-200 transition-all"
            >
              <Trash2 size={20} />
              Supprimer Doublons
            </button>
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
                    reference: '',
                    propertyAddress: ''
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
        </div>

        {reportToProcess && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-blue-100 mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Générer les quittances</h3>
                <p className="text-gray-500">Sélectionnez les locataires pour le bilan de {reportToProcess.mois}</p>
              </div>
              <button 
                onClick={() => {
                  setReportToProcess(null);
                  setSelectedReportItems([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto mb-8 pr-2 custom-scrollbar">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-2">
                <input
                  type="checkbox"
                  id="select-all"
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedReportItems.length === reportToProcess.items.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedReportItems(reportToProcess.items.map((_: any, i: number) => i));
                    } else {
                      setSelectedReportItems([]);
                    }
                  }}
                />
                <label htmlFor="select-all" className="font-bold text-gray-700 cursor-pointer">Tout sélectionner</label>
              </div>

              {reportToProcess.items.map((item: any, index: number) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    selectedReportItems.includes(index) 
                      ? 'border-blue-200 bg-blue-50/50' 
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      id={`item-${index}`}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedReportItems.includes(index)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReportItems([...selectedReportItems, index]);
                        } else {
                          setSelectedReportItems(selectedReportItems.filter(i => i !== index));
                        }
                      }}
                    />
                    <label htmlFor={`item-${index}`} className="cursor-pointer">
                      <div className="font-bold text-gray-900">{item.prenoms} {item.nom}</div>
                      <div className="text-sm text-gray-500">{formatAmount(item.montantPaye)} FCFA</div>
                    </label>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      Number(item.montantPaye) > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {Number(item.montantPaye) > 0 ? 'Payé' : 'Non payé'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleBulkReceipts}
                disabled={selectedReportItems.length === 0}
                className="flex-1 bg-blue-900 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Receipt size={20} />
                Générer {selectedReportItems.length} quittance(s)
              </button>
              <button
                onClick={() => {
                  setReportToProcess(null);
                  setSelectedReportItems([]);
                }}
                className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-8 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
          <input
            type="text"
            placeholder="Rechercher un locataire, une adresse ou une date..."
            className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-[2rem] shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Modal
          isOpen={isAdding}
          onClose={() => {
            setIsAdding(false);
            setEditingId(null);
            setNewReceipt({ 
              clientName: '', 
              amount: 0, 
              amountInWords: '',
              date: new Date().toISOString().split('T')[0], 
              periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
              periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
              contractId: '', 
              paymentMethodId: 'Especes', 
              reference: '',
              prestations: 0,
              timbre: 0,
              periodLabel: 'un mois',
              propertyAddress: '',
              status: 'En attente'
            });
          }}
          title={editingId ? 'Modifier la Quittance' : 'Nouvelle Quittance'}
        >
          <form onSubmit={handleAddReceipt} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Nom du Client (Locataire)</label>
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
              <label className="text-sm font-bold text-gray-700 ml-1">Maison située à (Adresse)</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Adresse de la maison"
                value={newReceipt.propertyAddress}
                onChange={(e) => setNewReceipt({ ...newReceipt, propertyAddress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Période (Mois)</label>
              <select
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                value={newReceipt.periodLabel}
                onChange={(e) => handlePeriodLabelChange(e.target.value)}
              >
                <option value="un mois">un mois</option>
                <option value="un mois de Janvier">un mois de Janvier</option>
                <option value="un mois de Février">un mois de Février</option>
                <option value="un mois de Mars">un mois de Mars</option>
                <option value="un mois de Avril">un mois de Avril</option>
                <option value="un mois de Mai">un mois de Mai</option>
                <option value="un mois de Juin">un mois de Juin</option>
                <option value="un mois de Juillet">un mois de Juillet</option>
                <option value="un mois de Août">un mois de Août</option>
                <option value="un mois de Septembre">un mois de Septembre</option>
                <option value="un mois de Octobre">un mois de Octobre</option>
                <option value="un mois de Novembre">un mois de Novembre</option>
                <option value="un mois de Décembre">un mois de Décembre</option>
                <option value="un trimestre">un trimestre</option>
                <option value="un semestre">un semestre</option>
                <option value="une année">une année</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Prestations (FCFA)</label>
              <input
                type="number"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newReceipt.prestations}
                onChange={(e) => setNewReceipt({ ...newReceipt, prestations: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Timbre (FCFA)</label>
              <input
                type="number"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newReceipt.timbre}
                onChange={(e) => setNewReceipt({ ...newReceipt, timbre: parseInt(e.target.value) || 0 })}
              />
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
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Statut de la Quittance</label>
              <select
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                value={newReceipt.status}
                onChange={(e) => setNewReceipt({ ...newReceipt, status: e.target.value })}
              >
                <option value="Payé">Payé (Déjà réglé)</option>
                <option value="En attente">En attente (À payer plus tard)</option>
              </select>
            </div>
            <div className="flex gap-4 md:col-span-2 pt-4">
              <button type="submit" className="flex-1 bg-blue-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg">
                {editingId ? 'Mettre à jour' : 'Générer'}
              </button>
              <button type="button" onClick={() => {
                setIsAdding(false);
                setEditingId(null);
                setNewReceipt({ 
                  clientName: '', 
                  amount: 0, 
                  amountInWords: '',
                  date: new Date().toISOString().split('T')[0], 
                  periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                  periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
                  contractId: '', 
                  paymentMethodId: 'Especes', 
                  reference: '',
                  prestations: 0,
                  timbre: 0,
                  periodLabel: 'un mois',
                  propertyAddress: '',
                  status: 'En attente'
                });
              }} className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all">
                Annuler
              </button>
            </div>
          </form>
        </Modal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredReceipts.map((receipt) => (
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
                <div className="flex justify-between items-center mb-4">
                  <p className="text-green-600 font-bold text-lg">{formatAmount(receipt.amount)} FCFA</p>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                    receipt.status === 'Payé' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {receipt.status || 'Payé'}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-500">
                  <p className="font-bold text-blue-600">{receipt.periodLabel}</p>
                  <p>Date: {receipt.date}</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-50 flex flex-col gap-3">
                {receipt.status === 'En attente' ? (
                  <button
                    onClick={() => handlePayReceipt(receipt)}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition-all"
                  >
                    <CreditCard size={18} /> Payer (Espèces)
                  </button>
                ) : (
                  <button
                    onClick={() => handleDownloadPDF(receipt)}
                    className="w-full text-blue-600 font-bold text-sm flex items-center justify-center gap-2 hover:gap-3 transition-all"
                  >
                    Télécharger PDF <Download size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminReceipts;
