import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { FileText, Trash2, Plus, ArrowLeft, CheckCircle2, XCircle, Clock, CreditCard, Download, Edit2, Copy, Search } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { generateContractPDF } from '../utils/pdfGenerator';
import Logo from '../components/Logo';
import Modal from '../components/Modal';
import { createNotification } from '../services/NotificationService';

const AdminContracts: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [newContract, setNewContract] = useState({
    clientName: '',
    clientCNI: '',
    clientPhone: '',
    bailleurName: 'Mariama BA',
    propertyDesignation: '',
    propertyAddress: 'Cité BATA',
    nbNote: '',
    type: 'Location',
    price: 0,
    priceInWords: '',
    startDate: '',
    endDate: '',
    duration: '',
    villaNumber: '',
    status: 'Actif'
  });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user && isAdmin) {
      fetchContracts();
      fetchPayments();
      fetchReceipts();
    }
  }, [user, isAdmin]);

  const fetchReceipts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'receipts'));
      setReceipts(querySnapshot.docs.map(doc => doc.data()));
    } catch (error) {
      console.error('Error fetching receipts:', error);
    }
  };

  const existingBailleurNames = Array.from(new Set(contracts.map(c => c.bailleurName))).filter(Boolean).sort();

  const formatAmount = (val: number) => {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const fetchContracts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'contracts'));
      const fetchedContracts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Sort alphabetically by bailleur name
      fetchedContracts.sort((a, b) => (a.bailleurName || '').localeCompare(b.bailleurName || ''));
      setContracts(fetchedContracts);
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

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'contracts', editingId), {
          ...newContract,
          updatedByUID: user?.uid,
          updatedByName: user?.displayName || user?.email,
          updatedAt: new Date().toISOString()
        });
        alert('Contrat mis à jour avec succès !');
      } else {
        await addDoc(collection(db, 'contracts'), {
          ...newContract,
          createdByUID: user?.uid,
          createdByName: user?.displayName || user?.email,
          createdAt: new Date().toISOString()
        });

        await createNotification({
          title: 'Nouveau contrat',
          message: `Un nouveau contrat de ${newContract.type} a été créé pour ${newContract.clientName} (Bailleur: ${newContract.bailleurName})`,
          type: 'contract',
          link: '/admin/contrats'
        });

        alert('Contrat enregistré avec succès !');
      }
      setNewContract({
        clientName: '',
        clientCNI: '',
        clientPhone: '',
        bailleurName: 'Mariama BA',
        propertyDesignation: '',
        propertyAddress: 'Cité BATA',
        nbNote: '',
        type: 'Location',
        price: 0,
        priceInWords: '',
        startDate: '',
        endDate: '',
        duration: '',
        villaNumber: '',
        status: 'Actif'
      });
      setIsAdding(false);
      setEditingId(null);
      fetchContracts();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'contracts');
    }
  };

  const handleEditClick = (contract: any) => {
    setNewContract({
      clientName: contract.clientName || '',
      clientCNI: contract.clientCNI || '',
      clientPhone: contract.clientPhone || '',
      bailleurName: contract.bailleurName || 'Mariama BA',
      propertyDesignation: contract.propertyDesignation || '',
      propertyAddress: contract.propertyAddress || 'Cité BATA',
      nbNote: contract.nbNote || '',
      type: contract.type || 'Location',
      price: contract.price || 0,
      priceInWords: contract.priceInWords || '',
      startDate: contract.startDate || '',
      endDate: contract.endDate || '',
      duration: contract.duration || '',
      villaNumber: contract.villaNumber || '',
      status: contract.status || 'Actif'
    });
    setEditingId(contract.id);
    setIsAdding(true);
  };

  const handleDeleteContract = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce contrat ?')) {
      try {
        await deleteDoc(doc(db, 'contracts', id));
        fetchContracts();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `contracts/${id}`);
      }
    }
  };

  const handleDuplicate = (contract: any) => {
    setNewContract({
      clientName: `${contract.clientName} (Copie)`,
      clientCNI: contract.clientCNI || '',
      clientPhone: contract.clientPhone || '',
      bailleurName: contract.bailleurName || 'Mariama BA',
      propertyDesignation: contract.propertyDesignation || '',
      propertyAddress: contract.propertyAddress || 'Cité BATA',
      nbNote: contract.nbNote || '',
      type: contract.type || 'Location',
      price: contract.price || 0,
      priceInWords: contract.priceInWords || '',
      startDate: contract.startDate || '',
      endDate: contract.endDate || '',
      duration: contract.duration || '',
      villaNumber: contract.villaNumber || '',
      status: 'Actif'
    });
    setEditingId(null);
    setIsAdding(true);
  };

  const filteredContracts = contracts.filter(contract => 
    (contract.bailleurName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contract.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contract.propertyDesignation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contract.villaNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRemoveDuplicates = async () => {
    if (!window.confirm('Voulez-vous vraiment supprimer les contrats en double (même bailleur, même locataire, même montant) ?')) return;
    
    const seen = new Set();
    const duplicates = [];
    
    for (const contract of contracts) {
      const key = `${contract.bailleurName}-${contract.clientName}-${contract.price}-${contract.propertyDesignation}`;
      if (seen.has(key)) {
        duplicates.push(contract.id);
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
        await Promise.all(duplicates.map(id => deleteDoc(doc(db, 'contracts', id))));
        alert('Doublons supprimés avec succès.');
        fetchContracts();
      } catch (error) {
        console.error('Error removing duplicates:', error);
        alert('Erreur lors de la suppression des doublons.');
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

        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-6">
            <Logo className="h-16" />
            <h1 className="text-4xl font-bold text-gray-900">Contrats</h1>
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
                  setNewContract({
                    clientName: '',
                    clientCNI: '',
                    clientPhone: '',
                    bailleurName: 'Mariama BA',
                    propertyDesignation: '',
                    propertyAddress: 'Cité BATA',
                    nbNote: '',
                    type: 'Location',
                    price: 0,
                    priceInWords: '',
                    startDate: '',
                    endDate: '',
                    duration: '',
                    villaNumber: '',
                    status: 'Actif'
                  });
                }
                setIsAdding(!isAdding);
              }}
              className="bg-blue-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-800 transition-all shadow-lg"
            >
              <Plus size={20} />
              {isAdding && editingId ? 'Annuler l\'édition' : 'Ajouter un contrat'}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
          <input
            type="text"
            placeholder="Rechercher un bailleur, un locataire, un bien..."
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
            setNewContract({
              clientName: '',
              clientCNI: '',
              clientPhone: '',
              bailleurName: 'Mariama BA',
              propertyDesignation: '',
              propertyAddress: 'Cité BATA',
              nbNote: '',
              type: 'Location',
              price: 0,
              priceInWords: '',
              startDate: '',
              endDate: '',
              duration: '',
              villaNumber: '',
              status: 'Actif'
            });
          }}
          title={editingId ? 'Modifier le Contrat' : 'Nouveau Contrat'}
        >
          <form onSubmit={handleAddContract} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Client Info */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Nom du Client (Locataire)</label>
              <input
                type="text"
                required
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.clientName}
                onChange={(e) => setNewContract({ ...newContract, clientName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">CNI du Client</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.clientCNI}
                onChange={(e) => setNewContract({ ...newContract, clientCNI: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Téléphone du Client</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.clientPhone}
                onChange={(e) => setNewContract({ ...newContract, clientPhone: e.target.value })}
              />
            </div>

            {/* Bailleur Info */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Nom du Bailleur</label>
              <input
                type="text"
                required
                list="bailleur-names"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.bailleurName}
                onChange={(e) => setNewContract({ ...newContract, bailleurName: e.target.value })}
              />
              <datalist id="bailleur-names">
                {existingBailleurNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {/* Property Info */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Désignation de l'appartement</label>
              <textarea
                required
                placeholder="ex: 2 Chambres + Salon + Cuisine + Toilette"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px] resize-none"
                value={newContract.propertyDesignation}
                onChange={(e) => setNewContract({ ...newContract, propertyDesignation: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Adresse du Bien</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.propertyAddress}
                onChange={(e) => setNewContract({ ...newContract, propertyAddress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Note NB</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.nbNote}
                onChange={(e) => setNewContract({ ...newContract, nbNote: e.target.value })}
              />
            </div>

            {/* Contract Details */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Type</label>
              <select
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                value={newContract.type}
                onChange={(e) => setNewContract({ ...newContract, type: e.target.value })}
              >
                <option value="Location">Location</option>
                <option value="Vente">Vente</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Prix (FCFA)</label>
              <input
                type="number"
                required
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.price}
                onChange={(e) => setNewContract({ ...newContract, price: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Prix en toutes lettres</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.priceInWords}
                onChange={(e) => setNewContract({ ...newContract, priceInWords: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Date de début</label>
              <input
                type="date"
                required
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.startDate}
                onChange={(e) => setNewContract({ ...newContract, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Date de fin</label>
              <input
                type="text"
                placeholder="ex: Décembre 2024"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.endDate}
                onChange={(e) => setNewContract({ ...newContract, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Durée (ex: 1 an)</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.duration}
                onChange={(e) => setNewContract({ ...newContract, duration: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Villa N° (Footer)</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newContract.villaNumber}
                onChange={(e) => setNewContract({ ...newContract, villaNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">Statut du Contrat</label>
              <select
                className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                value={newContract.status}
                onChange={(e) => setNewContract({ ...newContract, status: e.target.value })}
              >
                <option value="Actif">Actif (En attente de paiement)</option>
                <option value="Payé">Payé</option>
                <option value="Terminé">Terminé</option>
                <option value="Annulé">Annulé</option>
              </select>
            </div>
            <div className="flex gap-4 md:col-span-2 lg:col-span-3 pt-4">
              <button type="submit" className="flex-1 bg-blue-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg">
                {editingId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => {
                setIsAdding(false);
                setEditingId(null);
                setNewContract({
                  clientName: '',
                  clientCNI: '',
                  clientPhone: '',
                  bailleurName: 'Mariama BA',
                  propertyDesignation: '',
                  propertyAddress: 'Cité BATA',
                  nbNote: '',
                  type: 'Location',
                  price: 0,
                  priceInWords: '',
                  startDate: '',
                  endDate: '',
                  duration: '',
                  villaNumber: '',
                  status: 'Actif'
                });
              }} className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all">
                Annuler
              </button>
            </div>
          </form>
        </Modal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredContracts.map((contract) => (
            <div key={contract.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-xl transition-all">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                    <FileText size={28} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDuplicate(contract)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Dupliquer"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => handleEditClick(contract)}
                      className="text-gray-400 hover:text-orange-600 transition-colors"
                      title="Modifier le contrat"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button
                      onClick={() => generateContractPDF(contract)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Télécharger le contrat"
                    >
                      <Download size={20} />
                    </button>
                    <button
                      onClick={() => handleDeleteContract(contract.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{contract.bailleurName}</h3>
                <p className="text-purple-600 font-bold text-sm mb-4">Locataire: {contract.clientName}</p>
                <p className="text-gray-500 text-xs mb-4">{contract.type} - {contract.propertyDesignation}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    {contract.startDate}
                  </div>
                  <div className="font-bold text-green-600">
                    {formatAmount(contract.price)} FCFA
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                <span className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                  contract.status === 'Actif' ? 'bg-blue-100 text-blue-700' : 
                  contract.status === 'Payé' ? 'bg-green-100 text-green-700' : 
                  contract.status === 'Terminé' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
                }`}>
                  {contract.status === 'Actif' ? <Clock size={14} /> : 
                   contract.status === 'Payé' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {contract.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminContracts;
