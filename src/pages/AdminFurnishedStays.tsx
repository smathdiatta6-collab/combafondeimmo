import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { KeyRound, Plus, ArrowLeft, Download, Edit2, Trash2, Search, CheckCircle2, Clock, Info, ShieldAlert, Sparkles, Building2, Calendar, User, Phone, FileBadge, DollarSign } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { generateFurnishedStayPDF } from '../utils/pdfGenerator';
import Logo from '../components/Logo';
import Modal from '../components/Modal';
import { FurnishedStay } from '../types';

const initialFormState: FurnishedStay = {
  contractNumber: '',
  clientName: '',
  clientPhone: '',
  clientIdentity: '',
  stayDuration: '3 JOURS',
  customDuration: '',
  housingType: 'APPARTEMENT',
  propertyName: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  acceptTerms: true,
  notes: ''
};

const AdminFurnishedStays: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const [stays, setStays] = useState<FurnishedStay[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<FurnishedStay>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      fetchStays();
    }
  }, [user, isAdmin]);

  // Auto-generate contract number
  useEffect(() => {
    if (!editingId && isAdding) {
      const year = new Date().getFullYear();
      const count = stays.length + 1;
      const autoNum = `MEUBLE-${year}-${String(count).padStart(4, '0')}`;
      setFormData(prev => ({
        ...prev,
        contractNumber: autoNum
      }));
    }
  }, [isAdding, editingId, stays.length]);

  const fetchStays = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'furnishedStays'));
      const allStays = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FurnishedStay[];
      
      const currentUserEmail = user?.email?.toLowerCase();
      const filtered = allStays.filter(s => {
        const itemCreatedBy = (s.createdBy || '').toLowerCase();
        if (currentUserEmail === 'elhadjisillyndiaye@icloud.com') {
          return itemCreatedBy === 'elhadjisillyndiaye@icloud.com';
        } else {
          return itemCreatedBy === '' || itemCreatedBy === 'smathdiatta6@gmail.com';
        }
      });

      filtered.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setStays(filtered);
    } catch (error) {
      console.error('Error fetching furnished stays:', error);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsAdding(true);
  };

  const handleOpenEdit = (stay: FurnishedStay) => {
    setEditingId(stay.id || null);
    setFormData(stay);
    setIsAdding(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName || !formData.amount) {
      alert('Veuillez remplir au moins le nom du client et le montant.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        createdBy: user?.email?.toLowerCase() || '',
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'furnishedStays', editingId), payload);
      } else {
        await addDoc(collection(db, 'furnishedStays'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      await fetchStays();
      setIsAdding(false);
      setEditingId(null);
      setFormData(initialFormState);
    } catch (error) {
      console.error('Error saving furnished stay:', error);
      alert('Erreur lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette fiche de séjour ?')) return;
    try {
      await deleteDoc(doc(db, 'furnishedStays', id));
      await fetchStays();
    } catch (error) {
      console.error('Error deleting furnished stay:', error);
      alert('Erreur lors de la suppression.');
    }
  };

  const filteredStays = stays.filter(s =>
    (s.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contractNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.clientPhone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.propertyName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const safeToLocaleString = (val: any) => {
    if (val === undefined || val === null || val === '') return '0';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  if (loading) return <div className="pt-32 text-center text-gray-500 font-medium">Chargement...</div>;
  if (!user || !isAdmin) return <Navigate to="/" />;

  return (
    <div className="pt-28 pb-24 min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/admin"
              className="p-3 bg-white hover:bg-gray-100 rounded-2xl border border-gray-200 transition-colors shadow-sm text-gray-700 flex items-center justify-center"
              title="Retour au Tableau de Bord"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={14} className="text-amber-700" />
                  Spécial Appartements Meublés
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 mt-1 font-sans">
                Contrats & Fiches de Séjour
              </h1>
              <p className="text-sm text-gray-500">
                Générez des contrats personnalisés pour la location d'appartements meublés avec règles de nuitée.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm cursor-pointer"
          >
            <Plus size={18} />
            Nouvelle Fiche de Séjour
          </button>
        </div>

        {/* NOTA BENE BANNER INFORMATION */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-5 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-2xl shrink-0 mt-0.5 shadow">
              <Info size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-amber-950 flex items-center gap-2">
                Clause Nota Bene Intégrée
              </h3>
              <p className="text-xs text-amber-900 font-medium leading-relaxed mt-0.5">
                Chaque contrat généré pour appartement meublé comporte automatiquement la mention expresse :{' '}
                <strong className="underline decoration-amber-400 font-black">"NB : Une nuitée s'arrête à 12h."</strong>
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold bg-amber-200 text-amber-950 px-3 py-1.5 rounded-xl whitespace-nowrap self-start md:self-center">
            Coumba Fonde Immo
          </span>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-6 flex items-center gap-3">
          <Search size={20} className="text-gray-400 ml-2 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom de client, numéro de contrat, téléphone ou logement..."
            className="w-full bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
          />
        </div>

        {/* List Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {filteredStays.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Réf. Contrat</th>
                    <th className="py-4 px-6">Client</th>
                    <th className="py-4 px-6">Durée Séjour</th>
                    <th className="py-4 px-6">Type Logement</th>
                    <th className="py-4 px-6">Montant Payé</th>
                    <th className="py-4 px-6">Date Entrée</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredStays.map((stay) => (
                    <tr key={stay.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="py-4 px-6 font-mono font-bold text-blue-900">
                        {stay.contractNumber || 'MEUBLE-...'}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-gray-900">{stay.clientName}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          {stay.clientPhone && <span>Tél: {stay.clientPhone}</span>}
                          {stay.clientIdentity && <span>• CNI: {stay.clientIdentity}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-xl text-xs font-extrabold border border-purple-100/50">
                          {stay.stayDuration}
                        </span>
                        {stay.customDuration && (
                          <div className="text-[11px] text-gray-500 italic mt-0.5">{stay.customDuration}</div>
                        )}
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-800">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold">
                          {stay.housingType || 'APPARTEMENT'}
                        </span>
                        {stay.propertyName && (
                          <div className="text-xs text-blue-700 font-semibold mt-0.5">{stay.propertyName}</div>
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono font-black text-green-700">
                        {safeToLocaleString(stay.amount)} <span className="text-xs font-sans font-bold">FCFA</span>
                      </td>
                      <td className="py-4 px-6 text-xs text-gray-500 font-mono">
                        {stay.date ? new Date(stay.date).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => generateFurnishedStayPDF(stay)}
                          className="p-2 text-blue-900 hover:bg-blue-50 rounded-xl transition-colors font-bold text-xs inline-flex items-center gap-1 bg-blue-50/60 border border-blue-100"
                          title="Télécharger le contrat PDF"
                        >
                          <Download size={15} />
                          PDF
                        </button>
                        <button
                          onClick={() => handleOpenEdit(stay)}
                          className="p-2 text-gray-600 hover:text-blue-900 hover:bg-gray-100 rounded-xl transition-colors inline-flex"
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => stay.id && handleDelete(stay.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors inline-flex"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center">
                <KeyRound size={28} />
              </div>
              <p className="font-semibold text-gray-600 text-base">Aucune fiche de séjour meublé enregistrée</p>
              <p className="text-xs text-gray-400 max-w-sm">
                Cliquez sur "Nouvelle Fiche de Séjour" pour créer votre premier contrat pour appartement meublé.
              </p>
            </div>
          )}
        </div>

        {/* ADD / EDIT MODAL FORM */}
        <Modal
          isOpen={isAdding}
          onClose={() => {
            setIsAdding(false);
            setEditingId(null);
          }}
          title={editingId ? "Modifier la Fiche de Séjour" : "Nouvelle Fiche de Séjour - Appartement Meublé"}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Header info */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-800 font-bold uppercase tracking-wider block">
                  Référence du Contrat
                </span>
                <input
                  type="text"
                  required
                  value={formData.contractNumber}
                  onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                  className="mt-1 font-mono font-black text-blue-900 text-lg bg-white px-3 py-1 rounded-xl border border-blue-200 focus:outline-none"
                />
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">
                  Date d'Entrée
                </span>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-mono text-gray-800"
                />
              </div>
            </div>

            {/* Client Details Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={15} className="text-blue-900" />
                1. Informations du Client
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Nom Complet du Client *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Babacar Ndiaye"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Numéro de Téléphone
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: +221 77 123 45 67"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Numéro CNI ou Passeport
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1 757 1990 01234 OU N° Passeport"
                    value={formData.clientIdentity}
                    onChange={(e) => setFormData({ ...formData, clientIdentity: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Stay & Apartment Details Section */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={15} className="text-purple-600" />
                2. Détails du Séjour & Logement
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Durée du Séjour
                  </label>
                  <select
                    value={formData.stayDuration}
                    onChange={(e) => setFormData({ ...formData, stayDuration: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium"
                  >
                    <option value="3 JOURS">3 JOURS</option>
                    <option value="1 SEMAINE">1 SEMAINE</option>
                    <option value="2 SEMAINES">2 SEMAINES</option>
                    <option value="1 MOIS">1 MOIS</option>
                    <option value="AUTRE">AUTRE (À préciser)</option>
                  </select>
                </div>

                {formData.stayDuration === 'AUTRE' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">
                      Préciser la durée
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 5 nuitées"
                      value={formData.customDuration}
                      onChange={(e) => setFormData({ ...formData, customDuration: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Type de Logement
                  </label>
                  <select
                    value={formData.housingType}
                    onChange={(e) => setFormData({ ...formData, housingType: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium"
                  >
                    <option value="APPARTEMENT">APPARTEMENT</option>
                    <option value="STUDIO">STUDIO</option>
                    <option value="APPARTEMENT MEUBLÉ DE LUXE">APPARTEMENT MEUBLÉ DE LUXE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Nom / Adresse de l'Appartement
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Appt A3 Cité Gabon"
                    value={formData.propertyName}
                    onChange={(e) => setFormData({ ...formData, propertyName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Montant du Paiement (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 150000"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-green-50/50 border border-green-200 rounded-xl text-lg font-mono font-black text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* NOTA BENE PREVIEW */}
            <div className="bg-amber-100/70 border border-amber-300 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-black text-amber-900 uppercase tracking-wider block">
                Clause Nota Bene sur le Contrat :
              </span>
              <p className="text-sm font-bold text-amber-950">
                • Une nuitée s'arrête à 12h (Midi).
              </p>
              <p className="text-xs text-amber-800 italic">
                Cette clause figure obligatoirement en haut du bloc de signature de la fiche de séjour PDF.
              </p>
            </div>

            {/* Accept terms checkbox */}
            <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <input
                type="checkbox"
                id="acceptTerms"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                className="w-5 h-5 text-blue-900 rounded focus:ring-blue-500"
              />
              <label htmlFor="acceptTerms" className="text-xs font-bold text-gray-800 cursor-pointer">
                Le client accepte et signe les 9 règles de location de l'appartement meublé.
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-100 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? 'Enregistrement...' : (editingId ? 'Enregistrer les modifications' : 'Créer & Enregistrer')}
              </button>
            </div>

          </form>
        </Modal>

      </div>
    </div>
  );
};

export default AdminFurnishedStays;
