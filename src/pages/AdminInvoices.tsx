import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { FileText, Trash2, Plus, ArrowLeft, CheckCircle2, XCircle, Clock, CreditCard, Download, Edit2, Search, PlusCircle, MinusCircle, FileSpreadsheet } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import Logo from '../components/Logo';
import Modal from '../components/Modal';
import { createNotification } from '../services/NotificationService';

interface InvoiceItem {
  quantity: number;
  designation: string;
  unitPrice: number;
  totalPrice: number;
}

interface InvoiceFormData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  status: 'Brouillon' | 'Envoyé' | 'Payé' | 'Annulé';
  taxRate: number;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string;
  items: InvoiceItem[];
}

const initialFormState: InvoiceFormData = {
  invoiceNumber: '',
  date: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  clientName: '',
  clientAddress: '',
  clientPhone: '',
  clientEmail: '',
  status: 'Payé',
  taxRate: 0,
  subTotal: 0,
  taxAmount: 0,
  totalAmount: 0,
  notes: "Merci de régler cette facture sous 15 jours. Modalités de règlement : Espèces, Chèque ou Virement bancaire.",
  items: [
    { quantity: 1, designation: '', unitPrice: 0, totalPrice: 0 }
  ]
};

const AdminInvoices: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newInvoice, setNewInvoice] = useState<InvoiceFormData>(initialFormState);

  useEffect(() => {
    if (user && isAdmin) {
      fetchInvoices();
    }
  }, [user, isAdmin]);

  // Recalculate invoice sequential number when listing invoices
  useEffect(() => {
    if (!editingId && isAdding) {
      const year = new Date().getFullYear();
      const count = invoices.length + 1;
      const autoNum = `FAC-${year}-${String(count).padStart(4, '0')}`;
      setNewInvoice(prev => ({
        ...prev,
        invoiceNumber: autoNum
      }));
    }
  }, [isAdding, editingId, invoices.length]);

  const fetchInvoices = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'agencyInvoices'));
      const allInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      const currentUserEmail = user?.email?.toLowerCase();
      const filteredInvoices = allInvoices.filter(inv => {
        const itemCreatedBy = (inv.createdBy || '').toLowerCase();
        if (currentUserEmail === 'elhadjisillyndiaye@icloud.com') {
          return itemCreatedBy === 'elhadjisillyndiaye@icloud.com';
        } else {
          return itemCreatedBy === '' || itemCreatedBy === 'smathdiatta6@gmail.com';
        }
      });

      // Sort by date (descending) and invoiceNumber (descending)
      filteredInvoices.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
      });

      setInvoices(filteredInvoices);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'agencyInvoices');
    }
  };

  const formatAmount = (val: number) => {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleAddItemRow = () => {
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { quantity: 1, designation: '', unitPrice: 0, totalPrice: 0 }]
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    if (newInvoice.items.length <= 1) return;
    const updatedItems = newInvoice.items.filter((_, i) => i !== index);
    
    // Recalculate totals
    const subTotal = updatedItems.reduce((acc, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unitPrice) || 0;
      return acc + (q * p);
    }, 0);
    const taxAmount = Math.round(subTotal * (Number(newInvoice.taxRate) || 0) / 100);
    const totalAmount = subTotal + taxAmount;

    setNewInvoice(prev => ({
      ...prev,
      items: updatedItems,
      subTotal,
      taxAmount,
      totalAmount
    }));
  };

  const updateItemField = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...newInvoice.items];
    const currentItem = { ...updatedItems[index] };

    if (field === 'quantity') {
      currentItem.quantity = Number(value) || 0;
    } else if (field === 'unitPrice') {
      currentItem.unitPrice = Number(value) || 0;
    } else if (field === 'designation') {
      currentItem.designation = String(value);
    }

    currentItem.totalPrice = currentItem.quantity * currentItem.unitPrice;
    updatedItems[index] = currentItem;

    // Recalculate totals
    const subTotal = updatedItems.reduce((acc, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unitPrice) || 0;
      return acc + (q * p);
    }, 0);
    const taxAmount = Math.round(subTotal * (Number(newInvoice.taxRate) || 0) / 100);
    const totalAmount = subTotal + taxAmount;

    setNewInvoice(prev => ({
      ...prev,
      items: updatedItems,
      subTotal,
      taxAmount,
      totalAmount
    }));
  };

  const handleTaxRateChange = (rate: number) => {
    const subTotal = newInvoice.subTotal;
    const taxAmount = Math.round(subTotal * rate / 100);
    const totalAmount = subTotal + taxAmount;
    setNewInvoice(prev => ({
      ...prev,
      taxRate: rate,
      taxAmount,
      totalAmount
    }));
  };

  const handleOpenAdd = () => {
    setNewInvoice({
      ...initialFormState,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ quantity: 1, designation: '', unitPrice: 0, totalPrice: 0 }]
    });
    setEditingId(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (invoice: any) => {
    setNewInvoice({
      invoiceNumber: invoice.invoiceNumber || '',
      date: invoice.date || '',
      dueDate: invoice.dueDate || '',
      clientName: invoice.clientName || '',
      clientAddress: invoice.clientAddress || '',
      clientPhone: invoice.clientPhone || '',
      clientEmail: invoice.clientEmail || '',
      status: invoice.status || 'Payé',
      taxRate: Number(invoice.taxRate) || 0,
      subTotal: Number(invoice.subTotal) || 0,
      taxAmount: Number(invoice.taxAmount) || 0,
      totalAmount: Number(invoice.totalAmount) || 0,
      notes: invoice.notes || '',
      items: (invoice.items || []).map((it: any) => ({
        quantity: Number(it.quantity) || 1,
        designation: it.description || it.designation || '',
        unitPrice: Number(it.unitPrice) || 0,
        totalPrice: Number(it.totalPrice) || 0
      }))
    });
    setEditingId(invoice.id);
    setIsAdding(true);
  };

  const handleClose = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.clientName.trim()) {
      alert('Veuillez renseigner le nom du client.');
      return;
    }

    if (newInvoice.items.some(it => !it.designation.trim() || it.unitPrice <= 0 || it.quantity <= 0)) {
      alert('Veuillez renseigner correctement tous les articles (Désignation, quantité et prix unitaires valides).');
      return;
    }

    try {
      const dataToSave = {
        ...newInvoice,
        subTotal: Number(newInvoice.subTotal),
        taxRate: Number(newInvoice.taxRate),
        taxAmount: Number(newInvoice.taxAmount),
        totalAmount: Number(newInvoice.totalAmount),
        items: newInvoice.items.map(it => ({
          quantity: Number(it.quantity),
          designation: it.designation.trim(),
          unitPrice: Number(it.unitPrice),
          totalPrice: Number(it.totalPrice)
        }))
      };

      if (editingId) {
        await updateDoc(doc(db, 'agencyInvoices', editingId), {
          ...dataToSave,
          updatedByUID: user?.uid || '',
          updatedByName: user?.displayName || user?.email || '',
          updatedAt: new Date().toISOString()
        });
        
        await createNotification({
          title: 'Facture Modifiée',
          message: `La facture ${newInvoice.invoiceNumber} pour ${newInvoice.clientName} a été modifiée.`,
          type: 'system',
          link: '/admin/factures'
        });

        alert('Facture mise à jour avec succès !');
      } else {
        await addDoc(collection(db, 'agencyInvoices'), {
          ...dataToSave,
          createdByUID: user?.uid || '',
          createdBy: user?.email?.toLowerCase() || '',
          createdByName: user?.displayName || user?.email || '',
          createdAt: new Date().toISOString()
        });

        await createNotification({
          title: 'Nouvelle Facture Créée',
          message: `La facture ${newInvoice.invoiceNumber} pour ${newInvoice.clientName} d'un montant de ${formatAmount(newInvoice.totalAmount)} FCFA a été créée.`,
          type: 'system',
          link: '/admin/factures'
        });

        alert('Facture créée avec succès !');
      }

      setIsAdding(false);
      fetchInvoices();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'agencyInvoices');
    }
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer la facture ${invoiceNumber} ?`)) return;

    try {
      await deleteDoc(doc(db, 'agencyInvoices', id));
      
      await createNotification({
        title: 'Facture Supprimée',
        message: `La facture ${invoiceNumber} a été supprimée par ${user?.email}.`,
        type: 'system',
        link: '/admin/factures'
      });

      alert('Facture supprimée avec succès.');
      fetchInvoices();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `agencyInvoices/${id}`);
    }
  };

  const handleDownloadPDF = (invoice: any) => {
    generateInvoicePDF(invoice);
  };

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isAdmin) return <Navigate to="/" />;

  const filteredList = invoices.filter(inv => 
    (inv.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-2">
              <ArrowLeft size={16} />
              Retour au tableau de bord
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Factures de l'Agence</h1>
            <p className="text-sm text-gray-500 mt-1">Générez et gérez les factures officielles de Coumba Fonde Immo.</p>
          </div>
          
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={20} />
            Créer une Facture
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            <Search size={20} />
          </div>
          <input
            type="text"
            placeholder="Rechercher par client ou numéro de facture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
          />
        </div>

        {/* Invoices List Grid */}
        {filteredList.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-3xl shadow-sm">
            <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-900">Aucune facture trouvée</h3>
            <p className="text-gray-500 mt-1">Créez votre première facture officielle en cliquant sur le bouton ci-dessus.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredList.map((invoice) => {
              const formattedDate = invoice.date ? new Date(invoice.date).toLocaleDateString('fr-FR') : '';
              return (
                <div key={invoice.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    {/* Badge & Number */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                        {invoice.invoiceNumber}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        invoice.status === 'Payé' ? 'bg-green-50 text-green-700' :
                        invoice.status === 'Envoyé' ? 'bg-blue-50 text-blue-700' :
                        invoice.status === 'Brouillon' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>

                    {/* Client Name */}
                    <h3 className="text-lg font-bold text-gray-900 truncate mb-1">
                      {invoice.clientName}
                    </h3>
                    <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                      Émis le {formattedDate}
                    </p>

                    {/* Amount */}
                    <div className="bg-gray-50 p-4 rounded-2xl mb-6">
                      <span className="block text-xs text-gray-400 font-medium">Montant Total TTC</span>
                      <span className="text-2xl font-black text-gray-900">
                        {formatAmount(invoice.totalAmount)} <span className="text-sm font-bold text-gray-500">FCFA</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-2">
                    <button
                      onClick={() => handleDownloadPDF(invoice)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                    >
                      <Download size={14} />
                      PDF
                    </button>
                    
                    <button
                      onClick={() => handleOpenEdit(invoice)}
                      className="inline-flex items-center justify-center p-2.5 bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 rounded-xl transition-colors border border-gray-200"
                      title="Modifier"
                    >
                      <Edit2 size={15} />
                    </button>

                    <button
                      onClick={() => handleDelete(invoice.id, invoice.invoiceNumber)}
                      className="inline-flex items-center justify-center p-2.5 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-xl transition-colors border border-gray-200"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Invoice Modal */}
        <Modal
          isOpen={isAdding}
          onClose={handleClose}
          title={editingId ? `Modifier la Facture ${newInvoice.invoiceNumber}` : "Créer une nouvelle Facture Agence"}
          maxWidth="max-w-5xl"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
              
              {/* Left Column: Client Details */}
              <div className="space-y-4">
                <h4 className="text-md font-bold text-gray-900 pb-2 border-b border-gray-100">DÉTAILS DU CLIENT</h4>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nom du Client *</label>
                  <input
                    type="text"
                    required
                    value={newInvoice.clientName}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, clientName: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                    placeholder="Ex: Babacar DIOP"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Adresse du Client</label>
                  <input
                    type="text"
                    value={newInvoice.clientAddress}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, clientAddress: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                    placeholder="Ex: Villa 45, Dakar Plateau"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Téléphone</label>
                    <input
                      type="text"
                      value={newInvoice.clientPhone}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, clientPhone: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                      placeholder="Ex: +221 77..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                    <input
                      type="email"
                      value={newInvoice.clientEmail}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, clientEmail: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                      placeholder="client@mail.com"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Invoice Meta */}
              <div className="space-y-4">
                <h4 className="text-md font-bold text-gray-900 pb-2 border-b border-gray-100">MÉTADONNÉES DE LA FACTURE</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">N° de Facture *</label>
                    <input
                      type="text"
                      required
                      value={newInvoice.invoiceNumber}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-mono font-bold text-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Statut de Paiement</label>
                    <select
                      value={newInvoice.status}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-semibold"
                    >
                      <option value="Brouillon">Brouillon</option>
                      <option value="Envoyé">Envoyé</option>
                      <option value="Payé">Payé</option>
                      <option value="Annulé">Annulé</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Date d'émission</label>
                    <input
                      type="date"
                      required
                      value={newInvoice.date}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Date d'échéance</label>
                    <input
                      type="date"
                      required
                      value={newInvoice.dueDate}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Taux TVA (%)</label>
                  <select
                    value={newInvoice.taxRate}
                    onChange={(e) => handleTaxRateChange(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
                  >
                    <option value="0">0% (Sans TVA)</option>
                    <option value="18">18% (TVA Standard Sénégal)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dynamic Items Table */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <h4 className="text-lg font-bold text-gray-900">Articles / Prestations</h4>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <PlusCircle size={14} />
                  Ajouter un article
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-16 text-center">Quantité</th>
                      <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Désignation *</th>
                      <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-48 text-right">Prix Unitaire (FCFA) *</th>
                      <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-48 text-right">Prix Total (FCFA)</th>
                      <th className="py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {newInvoice.items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-gray-50/40">
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                            className="w-full text-center py-2 bg-transparent border-b border-transparent group-hover:border-gray-200 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-gray-900"
                          />
                        </td>
                        <td className="py-3">
                          <input
                            type="text"
                            required
                            placeholder="Ex: Honoraires de gestion de patrimoine"
                            value={item.designation}
                            onChange={(e) => updateItemField(idx, 'designation', e.target.value)}
                            className="w-full py-2 bg-transparent border-b border-transparent group-hover:border-gray-200 focus:border-indigo-500 outline-none transition-all text-sm font-medium"
                          />
                        </td>
                        <td className="py-3">
                          <input
                            type="number"
                            min="0"
                            required
                            value={item.unitPrice}
                            onChange={(e) => updateItemField(idx, 'unitPrice', e.target.value)}
                            className="w-full text-right py-2 bg-transparent border-b border-transparent group-hover:border-gray-200 focus:border-indigo-500 outline-none transition-all text-sm font-mono font-semibold"
                          />
                        </td>
                        <td className="py-3 text-right text-sm font-mono font-bold text-gray-900">
                          {formatAmount(item.totalPrice)}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            type="button"
                            disabled={newInvoice.items.length <= 1}
                            onClick={() => handleRemoveItemRow(idx)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              newInvoice.items.length <= 1 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                            }`}
                          >
                            <MinusCircle size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total and Notes Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4 border-t border-gray-100">
              
              {/* Left - Notes / Terms */}
              <div className="md:col-span-7">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes & Conditions de Règlement</label>
                <textarea
                  rows={4}
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  placeholder="Notes, coordonnées bancaires, ou conditions de paiement..."
                />
              </div>

              {/* Right - Totals display */}
              <div className="md:col-span-5 bg-gray-50 p-6 rounded-3xl space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Sous-Total HT</span>
                  <span className="font-mono font-bold text-gray-900">{formatAmount(newInvoice.subTotal)} FCFA</span>
                </div>
                
                {newInvoice.taxRate > 0 && (
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>TVA ({newInvoice.taxRate}%)</span>
                    <span className="font-mono font-medium">{formatAmount(newInvoice.taxAmount)} FCFA</span>
                  </div>
                )}

                <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-gray-900 font-extrabold">Montant TTC</span>
                  <span className="text-2xl font-black text-indigo-700 font-mono">
                    {formatAmount(newInvoice.totalAmount)} <span className="text-xs font-bold text-gray-500">FCFA</span>
                  </span>
                </div>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="flex justify-end items-center gap-4 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition-all"
              >
                Annuler
              </button>
              
              <button
                type="submit"
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/10 transition-all"
              >
                {editingId ? "Enregistrer les modifications" : "Enregistrer la Facture"}
              </button>
            </div>

          </form>
        </Modal>

      </div>
    </div>
  );
};

export default AdminInvoices;
