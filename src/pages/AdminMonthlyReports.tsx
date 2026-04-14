import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { FileBarChart, Trash2, Plus, ArrowLeft, Download, UserPlus, X, Edit2, Search, Copy, Settings, ChevronUp, ChevronDown, Receipt } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { generateMonthlyReportPDF } from '../utils/pdfGenerator';
import { numberToWordsFrench } from '../utils/numberToWords';
import Logo from '../components/Logo';
import Modal from '../components/Modal';

interface Column {
  id: string;
  label: string;
  type: 'text' | 'number';
}

const AdminMonthlyReports: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showCustomRowForm, setShowCustomRowForm] = useState(false);
  const [customRowData, setCustomRowData] = useState({ label: '', value: 0 });
  const [editingCustomRowIndex, setEditingCustomRowIndex] = useState<number | null>(null);
  
  const defaultColumns: Column[] = [
    { id: 'prenoms', label: 'Prénoms', type: 'text' },
    { id: 'nom', label: 'Nom', type: 'text' },
    { id: 'montantLoyer', label: 'Loyer', type: 'number' },
    { id: 'montantPaye', label: 'Payé', type: 'number' },
    { id: 'montantNonPaye', label: 'Non Payé', type: 'number' },
  ];

  const [newReport, setNewReport] = useState({
    chez: '',
    mois: `${['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][new Date().getMonth()]} ${new Date().getFullYear()}`,
    columns: defaultColumns,
    items: [] as any[],
    totalPaye: 0,
    totalCommission: 0,
    totalRemettre: 0,
    commissionPercentage: 10,
    arreteSomme: '',
    date: new Date().toISOString().split('T')[0],
    villaNumber: '',
    customRows: [] as { label: string, value: number }[]
  });

  useEffect(() => {
    if (user && isAdmin) {
      fetchReports();
      
      // Load auto-saved data
      const savedReport = localStorage.getItem('draft_monthly_report');
      if (savedReport) {
        try {
          const parsed = JSON.parse(savedReport);
          setNewReport(prev => ({
            ...prev,
            ...parsed,
            columns: parsed.columns || prev.columns,
            items: parsed.items || prev.items
          }));
          setIsAdding(true);
          setHasRestored(true);
          // Clear the "restored" message after 5 seconds
          setTimeout(() => setHasRestored(false), 5000);
        } catch (e) {
          console.error('Error parsing saved report', e);
        }
      }
    }
  }, [user, isAdmin]);

  // Auto-save to localStorage
  useEffect(() => {
    if (isAdding && !editingId) {
      localStorage.setItem('draft_monthly_report', JSON.stringify(newReport));
    }
  }, [newReport, isAdding, editingId]);

  useEffect(() => {
    const words = numberToWordsFrench(newReport.totalRemettre);
    const formatted = newReport.totalRemettre.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    setNewReport(prev => ({
      ...prev,
      arreteSomme: `${words} FRANCS CFA (${formatted})`
    }));
  }, [newReport.totalRemettre]);

  const calculateTotals = () => {
    const totalPaye = newReport.items.reduce((sum, item) => sum + (Number(item.montantPaye) || 0), 0);
    const commission = Math.round(totalPaye * (newReport.commissionPercentage / 100));
    const totalCustom = (newReport.customRows || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0);
    const aRemettre = totalPaye - commission - totalCustom;
    
    setNewReport(prev => ({
      ...prev,
      totalPaye: totalPaye,
      totalCommission: commission,
      totalRemettre: aRemettre
    }));
  };

  // Auto-calculate totals when items or commission change
  useEffect(() => {
    calculateTotals();
  }, [newReport.items, newReport.commissionPercentage, newReport.customRows]);

  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const years = Array.from({ length: 11 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

  const formatAmount = (val: number) => {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const fetchReports = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'monthlyReports'));
      setReports(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'monthlyReports');
    }
  };

  const handleAddRow = () => {
    const firstCol = newReport.columns[0];
    let firstVal = '';
    if (firstCol && firstCol.type === 'text') {
      const input = prompt(`Entrez ${firstCol.label} :`);
      if (input === null) return; // Annulé
      firstVal = input;
    }

    const initialItem: any = {};
    newReport.columns.forEach((col, idx) => {
      if (idx === 0) {
        initialItem[col.id] = firstVal;
      } else {
        initialItem[col.id] = col.type === 'number' ? 0 : '';
      }
    });
    setNewReport({
      ...newReport,
      items: [...newReport.items, initialItem]
    });
  };

  const handleDuplicateRow = (index: number) => {
    const itemToDuplicate = { ...newReport.items[index] };
    setNewReport({
      ...newReport,
      items: [...newReport.items, itemToDuplicate]
    });
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...newReport.items];
    updatedItems.splice(index, 1);
    setNewReport({ ...newReport, items: updatedItems });
  };

  const handleAddCustomRow = () => {
    if (!customRowData.label) {
      alert('Veuillez entrer un libellé.');
      return;
    }
    
    const updatedCustomRows = [...(newReport.customRows || [])];
    if (editingCustomRowIndex !== null) {
      updatedCustomRows[editingCustomRowIndex] = { ...customRowData };
    } else {
      updatedCustomRows.push({ ...customRowData });
    }

    setNewReport({
      ...newReport,
      customRows: updatedCustomRows
    });
    setCustomRowData({ label: '', value: 0 });
    setEditingCustomRowIndex(null);
    setShowCustomRowForm(false);
  };

  const handleEditCustomRow = (index: number) => {
    const row = newReport.customRows[index];
    setCustomRowData({ label: row.label, value: row.value });
    setEditingCustomRowIndex(index);
    setShowCustomRowForm(true);
  };

  const handleRemoveCustomRow = (index: number) => {
    const updated = [...(newReport.customRows || [])];
    updated.splice(index, 1);
    setNewReport({ ...newReport, customRows: updated });
    if (editingCustomRowIndex === index) {
      setEditingCustomRowIndex(null);
      setCustomRowData({ label: '', value: 0 });
    }
  };

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newReport.items.length === 0) {
      alert('Veuillez ajouter au moins un locataire au bilan.');
      return;
    }
    
    setIsSaving(true);
    try {
      const reportToSave = { ...newReport };

      if (editingId) {
        await updateDoc(doc(db, 'monthlyReports', editingId), {
          ...reportToSave,
          updatedByUID: user?.uid,
          updatedByName: user?.displayName || user?.email,
          updatedAt: new Date().toISOString()
        });
        alert('Bilan mis à jour avec succès !');
      } else {
        await addDoc(collection(db, 'monthlyReports'), {
          ...reportToSave,
          createdByUID: user?.uid,
          createdByName: user?.displayName || user?.email,
          createdAt: new Date().toISOString()
        });
        alert('Bilan enregistré avec succès !');
      }
      setNewReport({
        chez: '',
        mois: `${months[new Date().getMonth()]} ${new Date().getFullYear()}`,
        columns: defaultColumns,
        items: [],
        totalPaye: 0,
        totalCommission: 0,
        totalRemettre: 0,
        commissionPercentage: 10,
        arreteSomme: '',
        date: new Date().toISOString().split('T')[0],
        villaNumber: '',
        customRows: []
      });
      setIsAdding(false);
      setEditingId(null);
      localStorage.removeItem('draft_monthly_report');
      fetchReports();
    } catch (error) {
      console.error('Error saving report:', error);
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'monthlyReports');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (report: any) => {
    setNewReport({
      chez: report.chez || '',
      mois: report.mois || '',
      columns: report.columns || defaultColumns,
      items: report.items || [],
      totalPaye: report.totalPaye || 0,
      totalCommission: report.totalCommission || 0,
      totalRemettre: report.totalRemettre || 0,
      commissionPercentage: report.commissionPercentage || 10,
      arreteSomme: report.arreteSomme || '',
      date: report.date || new Date().toISOString().split('T')[0],
      villaNumber: report.villaNumber || '',
      customRows: report.customRows || []
    });
    setEditingId(report.id);
    setIsAdding(true);
  };

  const handleDuplicate = (report: any) => {
    setNewReport({
      chez: `${report.chez} (Copie)`,
      mois: report.mois || '',
      columns: report.columns || defaultColumns,
      items: report.items || [],
      totalPaye: report.totalPaye || 0,
      totalCommission: report.totalCommission || 0,
      totalRemettre: report.totalRemettre || 0,
      commissionPercentage: report.commissionPercentage || 10,
      arreteSomme: report.arreteSomme || '',
      date: new Date().toISOString().split('T')[0],
      villaNumber: report.villaNumber || '',
      customRows: report.customRows || []
    });
    setEditingId(null);
    setIsAdding(true);
  };

  const handleDeleteReport = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce bilan ?')) {
      try {
        await deleteDoc(doc(db, 'monthlyReports', id));
        fetchReports();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `monthlyReports/${id}`);
      }
    }
  };

  const filteredReports = reports.filter(report => 
    report.chez?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.mois?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateReceipts = (report: any) => {
    // We'll pass the data via state to the receipts page where the user can select items
    navigate('/admin/quittances', { 
      state: { 
        fromReport: true,
        reportData: report
      } 
    });
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
            <h1 className="text-4xl font-bold text-gray-900">Bilans Mensuels</h1>
          </div>
          <button
            onClick={() => {
              if (isAdding && editingId) {
                setEditingId(null);
                setNewReport({
                  chez: '',
                  mois: `${months[new Date().getMonth()]} ${new Date().getFullYear()}`,
                  items: [],
                  totalCommission: 0,
                  totalRemettre: 0,
                  commissionPercentage: 10,
                  arreteSomme: '',
                  date: new Date().toISOString().split('T')[0],
                  villaNumber: ''
                });
              }
              setIsAdding(!isAdding);
            }}
            className="bg-blue-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-800 transition-all shadow-lg"
          >
            <Plus size={20} />
            {isAdding && editingId ? 'Annuler l\'édition' : 'Créer un bilan'}
          </button>
        </div>

        <div className="mb-12">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher par nom de bailleur ou par mois..."
              className="w-full pl-14 pr-6 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Modal
          isOpen={isAdding}
          onClose={() => {
            setIsAdding(false);
            setEditingId(null);
            setEditingCustomRowIndex(null);
            setCustomRowData({ label: '', value: 0 });
            setNewReport({
              chez: '',
              mois: `${months[new Date().getMonth()]} ${new Date().getFullYear()}`,
              columns: defaultColumns,
              items: [],
              totalPaye: 0,
              totalCommission: 0,
              totalRemettre: 0,
              commissionPercentage: 10,
              arreteSomme: '',
              date: new Date().toISOString().split('T')[0],
              villaNumber: '',
              customRows: []
            });
            localStorage.removeItem('draft_monthly_report');
          }}
          title={editingId ? 'Modifier le Bilan' : 'Nouveau Bilan Mensuel'}
        >
          <div className="space-y-8">
            {hasRestored && (
              <div className="bg-green-50 text-green-700 px-6 py-4 rounded-2xl flex items-center justify-between animate-pulse">
                <span className="font-medium">Brouillon restauré automatiquement ! Vous pouvez continuer votre saisie.</span>
                <button onClick={() => setHasRestored(false)} className="text-green-900 hover:text-green-700">
                  <X size={20} />
                </button>
              </div>
            )}

            <form onSubmit={handleAddReport} className="space-y-8">
              {/* Column Management */}
              <div className="mb-8">
                <button
                  type="button"
                  onClick={() => setShowColumnManager(!showColumnManager)}
                  className="flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition-colors"
                >
                  <Settings size={20} />
                  Gérer les colonnes (Ajouter/Modifier/Supprimer)
                </button>
                
                {showColumnManager && (
                  <div className="mt-4 p-6 bg-blue-50 rounded-3xl border border-blue-100 space-y-4">
                    <h4 className="font-bold text-blue-900">Configuration des colonnes</h4>
                    <p className="text-xs text-blue-600 mb-4 italic">* La colonne avec l'ID "montantPaye" est utilisée pour le calcul de la commission.</p>
                    <div className="space-y-2">
                      {newReport.columns.map((col, index) => (
                        <div key={col.id} className="flex items-center gap-2 bg-white p-3 rounded-xl shadow-sm">
                          <div className="text-xs font-mono text-gray-400 w-20 truncate" title={`ID: ${col.id}`}>ID: {col.id}</div>
                          <input
                            type="text"
                            className="flex-1 bg-transparent border-none focus:ring-0 font-medium"
                            value={col.label}
                            placeholder="Nom de la colonne"
                            onChange={(e) => {
                              const updated = [...newReport.columns];
                              updated[index].label = e.target.value;
                              setNewReport({ ...newReport, columns: updated });
                            }}
                          />
                          <select
                            className="bg-gray-50 border-none rounded-lg text-sm px-2 py-1"
                            value={col.type}
                            onChange={(e) => {
                              const updated = [...newReport.columns];
                              updated[index].type = e.target.value as 'text' | 'number';
                              setNewReport({ ...newReport, columns: updated });
                            }}
                          >
                            <option value="text">Texte</option>
                            <option value="number">Nombre</option>
                          </select>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const updated = [...newReport.columns];
                                [updated[index-1], updated[index]] = [updated[index], updated[index-1]];
                                setNewReport({ ...newReport, columns: updated });
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                            >
                              <ChevronUp size={18} />
                            </button>
                            <button
                              type="button"
                              disabled={index === newReport.columns.length - 1}
                              onClick={() => {
                                const updated = [...newReport.columns];
                                [updated[index], updated[index+1]] = [updated[index+1], updated[index]];
                                setNewReport({ ...newReport, columns: updated });
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                            >
                              <ChevronDown size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Supprimer cette colonne ? Toutes les données de cette colonne seront perdues pour ce bilan.')) {
                                  const updated = newReport.columns.filter((_, i) => i !== index);
                                  setNewReport({ ...newReport, columns: updated });
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const label = prompt('Nom de la nouvelle colonne ?');
                        if (label) {
                          const id = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
                          setNewReport({
                            ...newReport,
                            columns: [...newReport.columns, { id, label, type: 'text' }]
                          });
                        }
                      }}
                      className="flex items-center gap-2 text-sm font-bold text-blue-700 bg-blue-100 px-4 py-2 rounded-xl hover:bg-blue-200 transition-all"
                    >
                      <Plus size={16} /> Ajouter une colonne
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Chez (Bailleur)</label>
                  <input
                    type="text"
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newReport.chez}
                    onChange={(e) => setNewReport({ ...newReport, chez: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Mois & Année</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                      value={newReport.mois.split(' ')[0]}
                      onChange={(e) => {
                        const year = newReport.mois.split(' ')[1] || new Date().getFullYear().toString();
                        setNewReport({ ...newReport, mois: `${e.target.value} ${year}` });
                      }}
                    >
                      <option value="">Mois</option>
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                      value={newReport.mois.split(' ')[1]}
                      onChange={(e) => {
                        const month = newReport.mois.split(' ')[0] || months[new Date().getMonth()];
                        setNewReport({ ...newReport, mois: `${month} ${e.target.value}` });
                      }}
                    >
                      <option value="">Année</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                <h4 className="font-bold mb-4 flex items-center gap-2">
                  <UserPlus size={20} /> Liste des locataires
                </h4>
                
                {newReport.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          {newReport.columns.map(col => (
                            <th key={col.id} className="px-4 py-2">{col.label}</th>
                          ))}
                          <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {newReport.items.map((item, idx) => (
                          <tr key={idx} className="text-sm hover:bg-gray-50 transition-colors">
                            {newReport.columns.map(col => (
                              <td key={col.id} className="px-4 py-2">
                                <input
                                  type={col.type === 'number' ? 'number' : 'text'}
                                  className={`w-full bg-white/50 border border-transparent hover:border-blue-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-xl px-3 py-2 transition-all ${col.type === 'number' ? 'text-right font-mono font-bold text-blue-900' : 'text-gray-700'}`}
                                  value={item[col.id] ?? (col.type === 'number' ? 0 : '')}
                                  onChange={(e) => {
                                    const updatedItems = [...newReport.items];
                                    const val = col.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value;
                                    updatedItems[idx] = { 
                                      ...updatedItems[idx], 
                                      [col.id]: val
                                    };
                                    setNewReport({ ...newReport, items: updatedItems });
                                  }}
                                />
                              </td>
                            ))}
                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <button 
                                  type="button"
                                  onClick={() => handleDuplicateRow(idx)} 
                                  className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Dupliquer cette ligne"
                                >
                                  <Copy size={16} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)} 
                                  className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                                  title="Supprimer cette ligne"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white/50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium">Aucun locataire ajouté. Utilisez le bouton "Ajouter une ligne" ci-dessous.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full h-[60px] bg-blue-100 text-blue-700 font-bold rounded-2xl hover:bg-blue-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Plus size={20} /> Ajouter un locataire
                  </button>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomRowForm(!showCustomRowForm)}
                    className={`w-full h-[60px] font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm ${
                      showCustomRowForm ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                  >
                    <Plus size={20} /> {showCustomRowForm ? 'Annuler' : 'Ligne Personnalisée'}
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Pourcentage Commission (%)</label>
                  <select
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                    value={newReport.commissionPercentage}
                    onChange={(e) => setNewReport({ ...newReport, commissionPercentage: parseInt(e.target.value) })}
                  >
                    {Array.from({ length: 101 }, (_, i) => (
                      <option key={i} value={i}>{i}%</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">TOTAL (Somme des Payés)</label>
                  <input
                    type="number"
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-900"
                    value={newReport.totalPaye || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const commission = Math.round(val * (newReport.commissionPercentage / 100));
                      const totalCustom = (newReport.customRows || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0);
                      setNewReport({ 
                        ...newReport, 
                        totalPaye: val,
                        totalCommission: commission,
                        totalRemettre: val - commission - totalCustom
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Commission ({newReport.commissionPercentage}%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-blue-700"
                      value={newReport.totalCommission || 0}
                      onChange={(e) => setNewReport({ ...newReport, totalCommission: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Total à Remettre</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold text-green-700"
                      value={newReport.totalRemettre || 0}
                      onChange={(e) => setNewReport({ ...newReport, totalRemettre: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2 flex items-end">
                  <button
                    type="button"
                    onClick={calculateTotals}
                    className="w-full h-[60px] bg-blue-100 text-blue-700 font-bold rounded-2xl hover:bg-blue-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                    title="Calculer automatiquement basé sur le pourcentage et les loyers payés"
                  >
                    <Settings size={20} /> Calculer Auto.
                  </button>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Arrêté à la somme de</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
                    value={newReport.arreteSomme}
                    onChange={(e) => setNewReport({ ...newReport, arreteSomme: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newReport.date}
                    onChange={(e) => setNewReport({ ...newReport, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Villa N° (Footer)</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newReport.villaNumber}
                    onChange={(e) => setNewReport({ ...newReport, villaNumber: e.target.value })}
                  />
                </div>
              </div>

              {/* Custom Row Inline Form */}
              {showCustomRowForm && (
                <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 animate-in fade-in slide-in-from-top-4 duration-300 mb-6">
                  <h4 className="font-bold mb-4 text-orange-800 flex items-center gap-2">
                    <Settings size={18} /> {editingCustomRowIndex !== null ? 'Modifier la ligne' : 'Nouvelle ligne personnalisée'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-orange-400 ml-1 uppercase">Libellé</label>
                      <input
                        type="text"
                        placeholder="Ex: TOTAL, DEPENSES, etc."
                        className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                        value={customRowData.label}
                        onChange={(e) => setCustomRowData({ ...customRowData, label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-orange-400 ml-1 uppercase">Montant (FCFA)</label>
                      <input
                        type="number"
                        className="w-full px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                        value={customRowData.value}
                        onChange={(e) => setCustomRowData({ ...customRowData, value: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddCustomRow}
                        className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-all shadow-md"
                      >
                        {editingCustomRowIndex !== null ? 'Mettre à jour' : 'Ajouter au résumé'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Rows Display */}
              {newReport.customRows && newReport.customRows.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                  <h4 className="font-bold mb-4 text-gray-700">Lignes de Résumé Personnalisées</h4>
                  <div className="space-y-3">
                    {newReport.customRows.map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-gray-700">{row.label}</span>
                          <span className="text-blue-900 font-mono font-bold">{formatAmount(row.value)} FCFA</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditCustomRow(idx)}
                            className="text-orange-400 hover:text-orange-600 p-2 hover:bg-orange-50 rounded-xl transition-all"
                            title="Modifier"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomRow(idx)}
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all"
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className={`bg-blue-900 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-800'}`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Enregistrement...
                    </>
                  ) : (
                    editingId ? 'Mettre à jour' : 'Enregistrer le Bilan'
                  )}
                </button>
                <button type="button" onClick={() => {
                  if (window.confirm('Voulez-vous vraiment annuler ? Toutes les données non enregistrées seront perdues.')) {
                    setIsAdding(false);
                    setEditingId(null);
                    setEditingCustomRowIndex(null);
                    setCustomRowData({ label: '', value: 0 });
                    localStorage.removeItem('draft_monthly_report');
                    setNewReport({
                      chez: '',
                      mois: `${months[new Date().getMonth()]} ${new Date().getFullYear()}`,
                      items: [],
                      totalPaye: 0,
                      totalCommission: 0,
                      totalRemettre: 0,
                      commissionPercentage: 10,
                      arreteSomme: '',
                      date: new Date().toISOString().split('T')[0],
                      villaNumber: ''
                    });
                  }
                }} className="bg-gray-200 text-gray-700 px-8 py-4 rounded-2xl font-bold hover:bg-gray-300 transition-all">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </Modal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredReports.map((report) => (
            <div key={report.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-xl transition-all">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                    <FileBarChart size={28} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDuplicate(report)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Dupliquer le bilan"
                    >
                      <Copy size={20} />
                    </button>
                    <button
                      onClick={() => handleEditClick(report)}
                      className="text-gray-400 hover:text-orange-600 transition-colors"
                      title="Modifier le bilan"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button
                      onClick={() => generateMonthlyReportPDF(report)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Télécharger PDF"
                    >
                      <Download size={20} />
                    </button>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Chez {report.chez}</h3>
                <p className="text-orange-600 font-bold text-sm mb-4">{report.mois}</p>
                <div className="space-y-2 text-sm text-gray-500">
                  <p>Commission: {formatAmount(report.totalCommission)} FCFA</p>
                  <p>À remettre: {formatAmount(report.totalRemettre)} FCFA</p>
                  <p>Date: {report.date}</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-50 space-y-3">
                <button
                  onClick={() => generateMonthlyReportPDF(report)}
                  className="w-full text-blue-600 font-bold text-sm flex items-center justify-center gap-2 hover:gap-3 transition-all"
                >
                  Télécharger Bilan PDF <Download size={16} />
                </button>
                <button
                  onClick={() => handleGenerateReceipts(report)}
                  className="w-full text-orange-600 font-bold text-sm flex items-center justify-center gap-2 hover:gap-3 transition-all"
                >
                  Générer les Quittances <Receipt size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminMonthlyReports;
