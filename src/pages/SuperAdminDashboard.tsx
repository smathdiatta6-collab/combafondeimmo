import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { 
  ShieldCheck, ArrowLeft, Users, Receipt, TrendingUp, Calendar, Clock, 
  CheckCircle2, AlertCircle, Building, User, ArrowRight, Search, ChevronDown, Filter, X 
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Modal from '../components/Modal';
import { numberToWordsFrench } from '../utils/numberToWords';

const SuperAdminDashboard: React.FC = () => {
  const { user, isSuperAdmin, loading } = useFirebase();
  const [users, setUsers] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<any[]>([]);
  const [filter, setFilter] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [stats, setStats] = useState<any[]>([]);

  // Modern tracking tab states
  const [activeTab, setActiveTab] = useState<'activite' | 'suivi'>('activite');
  const [suiviMonth, setSuiviMonth] = useState<string>(
    ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][new Date().getMonth()]
  );
  const [suiviYear, setSuiviYear] = useState<string>(`${new Date().getFullYear()}`);
  const [suiviBailleur, setSuiviBailleur] = useState<string>('all');
  const [suiviSearch, setSuiviSearch] = useState<string>('');
  const [suiviStatusFilter, setSuiviStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

  // Quick Payment Editor Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedTenantPayment, setSelectedTenantPayment] = useState<{
    reportId: string;
    itemIndex: number;
    tenantName: string;
    bailleurName: string;
    mois: string;
    loyer: number;
    paye: number;
    nonPaye: number;
    currency: string;
  } | null>(null);

  // Yearly view states
  const [suiviSubTab, setSuiviSubTab] = useState<'mensuel' | 'annuel'>('mensuel');
  const [selectedTenantHistory, setSelectedTenantHistory] = useState<string>('');

  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const years = Array.from({ length: 11 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

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
      const reportsSnap = await getDocs(collection(db, 'monthlyReports'));

      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const contractsList = contractsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const receiptsList = receiptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const reportsList = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setUsers(usersList);
      setContracts(contractsList);
      setReceipts(receiptsList);
      setReports(reportsList);

      calculateStats(receiptsList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'all');
    }
  };

  const calculateStats = (receiptsList: any[]) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = receiptsList.filter(r => {
      if (filter === 'all') return true;
      const date = new Date(r.createdAt);
      if (filter === 'day') return date >= startOfDay;
      if (filter === 'week') return date >= startOfWeek;
      if (filter === 'month') return date >= startOfMonth;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredReceipts(filtered);
  };

  const formatAmount = (val: any) => {
    if (val === undefined || val === null) return "0";
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Helper to get numeric value safely from any input
  const getSafeNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val || val === '') return 0;
    
    let cleaned = String(val).replace(/\s/g, '');
    cleaned = cleaned.replace(/[,.](?=\d{3}(?!\d))/g, '');
    cleaned = cleaned.replace(',', '.');
    
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const evaluateFormula = (formula: string, item: any) => {
    try {
      let expression = formula;
      const keys = Object.keys(item).sort((a, b) => b.length - a.length);
      keys.forEach(key => {
        const val = getSafeNum(item[key]);
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expression = expression.replace(regex, val.toString());
      });
      
      if (!/^[0-9\s\+\-\*\/\.\(\)]+$/.test(expression)) {
        return 0;
      }
      
      // eslint-disable-next-line no-eval
      const result = eval(expression);
      return isNaN(result) ? 0 : result;
    } catch (e) {
      return 0;
    }
  };

  const updateReportTotals = (report: any) => {
    // Ensure 'nonPaye' never automatically gets computed by a formula (from existing stored reports)
    const sanitizedColumns = (report.columns || []).map((col: any) => {
      if (col.id === 'nonPaye' && col.formula) {
        const { formula, ...rest } = col;
        return rest;
      }
      return col;
    });

    const updatedItems = (report.items || []).map((item: any) => {
      let newItem = { ...item };
      sanitizedColumns.forEach((col: any) => {
        if (col.formula && col.type === 'number' && col.id !== 'nonPaye') {
          if (!newItem[`_manual_${col.id}`]) {
            newItem[col.id] = evaluateFormula(col.formula, newItem);
          }
        }
      });
      return newItem;
    });

    const payeCol = sanitizedColumns.find((c: any) => c.id === 'paye' || c.label?.toLowerCase() === 'payé' || c.label?.toLowerCase() === 'paye');
    const payeId = payeCol ? payeCol.id : 'paye';
    
    const totalPaye = updatedItems.reduce((sum: number, item: any) => sum + getSafeNum(item[payeId]), 0);
    const commission = Math.round(totalPaye * ((report.commissionPercentage || 0) / 100));
    const totalCustom = (report.customRows || []).reduce((sum: number, row: any) => sum + getSafeNum(row.value), 0);
    
    const effectiveCommission = report.hideCommission ? 0 : (report.isManualCommission ? report.totalCommission : commission);
    const calculatedTotalRemettre = totalPaye - effectiveCommission - totalCustom;
    
    return {
      ...report,
      columns: sanitizedColumns,
      items: updatedItems,
      totalPaye,
      totalCommission: report.isManualCommission ? report.totalCommission : commission,
      totalRemettre: report.isManualTotalRemettre ? report.totalRemettre : calculatedTotalRemettre
    };
  };

  const handleQuickPaymentSave = async (reportId: string, itemIndex: number, newPayeAmount: number) => {
    try {
      const reportToUpdate = reports.find(r => r.id === reportId);
      if (!reportToUpdate) return;

      const updatedItems = [...reportToUpdate.items];
      const parsedPaye = Number(newPayeAmount) || 0;
      const originalItem = updatedItems[itemIndex];
      const rent = getSafeNum(originalItem.loyer);
      
      const updatedItem = {
        ...originalItem,
        paye: parsedPaye,
        nonPaye: rent - parsedPaye > 0 ? rent - parsedPaye : 0
      };
      
      delete updatedItem[`_manual_nonPaye`];
      
      updatedItems[itemIndex] = updatedItem;

      const calculatedReport = updateReportTotals({
        ...reportToUpdate,
        items: updatedItems
      });

      const total = calculatedReport.totalRemettre || 0;
      const words = numberToWordsFrench(total);
      const formatted = total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      const currency = (calculatedReport.reportCurrency || 'FCFA').trim();
      const arreteVal = `${words} ${currency} (${formatted})`;

      const reportRef = doc(db, 'monthlyReports', reportId);
      await updateDoc(reportRef, {
        items: calculatedReport.items,
        totalPaye: calculatedReport.totalPaye,
        totalCommission: calculatedReport.totalCommission,
        totalRemettre: calculatedReport.totalRemettre,
        arreteSomme: arreteVal,
        updatedAt: new Date().toISOString(),
        updatedByName: user?.displayName || user?.email
      });

      setReports(prev => prev.map(r => r.id === reportId ? {
        ...r,
        items: calculatedReport.items,
        totalPaye: calculatedReport.totalPaye,
        totalCommission: calculatedReport.totalCommission,
        totalRemettre: calculatedReport.totalRemettre,
        arreteSomme: arreteVal
      } : r));

      setPaymentModalOpen(false);
      setSelectedTenantPayment(null);
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la mise à jour du paiement');
    }
  };

  // Accumulate all tenant payment items matching our filters
  const accumulatedPayments = React.useMemo(() => {
    const list: any[] = [];
    
    reports.forEach(report => {
      const reportMonth = report.mois || '';
      const exactMonthMatch = reportMonth.toLowerCase().trim() === `${suiviMonth} ${suiviYear}`.toLowerCase().trim();
      
      if (!exactMonthMatch) return;
      if (suiviBailleur !== 'all' && report.chez !== suiviBailleur) return;
      
      (report.items || []).forEach((item: any, idx: number) => {
        const first = item.prenoms || '';
        const last = item.nom || '';
        const fullName = `${first} ${last}`.trim();
        
        if (suiviSearch && !fullName.toLowerCase().includes(suiviSearch.toLowerCase().trim())) {
          return;
        }
        
        const rent = getSafeNum(item.loyer);
        const paid = getSafeNum(item.paye);
        const unpaid = getSafeNum(item.nonPaye) > 0 ? getSafeNum(item.nonPaye) : Math.max(0, rent - paid);
        
        let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
        if (paid >= rent && rent > 0) {
          status = 'paid';
        } else if (paid > 0 && paid < rent) {
          status = 'partial';
        } else {
          status = 'unpaid';
        }
        
        // Final status filter check
        if (suiviStatusFilter !== 'all' && status !== suiviStatusFilter) {
          return;
        }

        list.push({
          reportId: report.id,
          itemIndex: idx,
          prenoms: item.prenoms || '',
          nom: item.nom || '',
          fullName,
          bailleurName: report.chez,
          mois: report.mois,
          loyer: rent,
          paye: paid,
          nonPaye: unpaid,
          status,
          currency: report.reportCurrency || ' FCFA',
          villaNumber: report.villaNumber || item.villaNumber || item.villa || ''
        });
      });
    });
    
    return list;
  }, [reports, suiviMonth, suiviYear, suiviBailleur, suiviSearch, suiviStatusFilter]);

  const trackingMetrics = React.useMemo(() => {
    let totalLoyer = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let countPaid = 0;
    let countPartial = 0;
    let countUnpaid = 0;
    let totalCount = 0;
    
    reports.forEach(report => {
      const reportMonth = report.mois || '';
      const exactMonthMatch = reportMonth.toLowerCase().trim() === `${suiviMonth} ${suiviYear}`.toLowerCase().trim();
      
      if (!exactMonthMatch) return;
      if (suiviBailleur !== 'all' && report.chez !== suiviBailleur) return;
      
      (report.items || []).forEach((item: any) => {
        const rent = getSafeNum(item.loyer);
        const paid = getSafeNum(item.paye);
        const unpaid = getSafeNum(item.nonPaye) > 0 ? getSafeNum(item.nonPaye) : Math.max(0, rent - paid);
        
        totalLoyer += rent;
        totalPaid += paid;
        totalUnpaid += unpaid;
        totalCount++;
        
        if (paid >= rent && rent > 0) {
          countPaid++;
        } else if (paid > 0 && paid < rent) {
          countPartial++;
        } else {
          countUnpaid++;
        }
      });
    });
    
    const recoveryRate = totalLoyer > 0 ? Math.round((totalPaid / totalLoyer) * 100) : 0;
    
    return {
      totalLoyer,
      totalPaid,
      totalUnpaid,
      totalCount,
      countPaid,
      countPartial,
      countUnpaid,
      recoveryRate
    };
  }, [reports, suiviMonth, suiviYear, suiviBailleur]);

  // Compute unique tenant names across all history
  const allUniqueTenantsList = React.useMemo(() => {
    const names = new Set<string>();
    reports.forEach(report => {
      (report.items || []).forEach((item: any) => {
        const name = `${item.prenoms || ''} ${item.nom || ''}`.trim();
        if (name) names.add(name);
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [reports]);

  // If there's no selected tenant history yet, select the first one in the list automatically
  useEffect(() => {
    if (!selectedTenantHistory && allUniqueTenantsList.length > 0) {
      setSelectedTenantHistory(allUniqueTenantsList[0]);
    }
  }, [allUniqueTenantsList, selectedTenantHistory]);

  // Aggregate payment status month by month for the chosen tenant in the chosen year
  const tenantYearlyHistory = React.useMemo(() => {
    if (!selectedTenantHistory) return [];
    
    const yearlyList = months.map(m => {
      let loyer = 0;
      let paye = 0;
      let nonPaye = 0;
      let found = false;
      let bailleur = '';
      
      reports.forEach(report => {
        if ((report.mois || '').toLowerCase().trim() === `${m} ${suiviYear}`.toLowerCase().trim()) {
          (report.items || []).forEach((item: any) => {
            const name = `${item.prenoms || ''} ${item.nom || ''}`.trim();
            if (name.toLowerCase() === selectedTenantHistory.toLowerCase()) {
              loyer = getSafeNum(item.loyer);
              paye = getSafeNum(item.paye);
              nonPaye = getSafeNum(item.nonPaye) > 0 ? getSafeNum(item.nonPaye) : Math.max(0, loyer - paye);
              found = true;
              bailleur = report.chez;
            }
          });
        }
      });
      
      let status: 'paid' | 'partial' | 'unpaid' | 'no_data' = 'no_data';
      if (found) {
        if (paye >= loyer && loyer > 0) status = 'paid';
        else if (paye > 0) status = 'partial';
        else status = 'unpaid';
      }
      
      return {
        monthName: m,
        loyer,
        paye,
        nonPaye,
        found,
        status,
        bailleur
      };
    });
    
    return yearlyList;
  }, [reports, selectedTenantHistory, suiviYear]);

  if (loading) return <div className="pt-32 text-center">Chargement...</div>;
  if (!user || !isSuperAdmin) return <Navigate to="/" />;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/admin" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium mb-8 transition-colors group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Retour au Dashboard
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
          <div className="flex items-center gap-6">
            <Logo className="h-16" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900 font-sans">Contrôle Activité</h1>
              <p className="text-gray-600">Suivi des performances de l'équipe</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              to="/admin/users"
              className="bg-blue-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-800 transition-all shadow-lg"
            >
              <Users size={20} />
              Gérer les Utilisateurs
            </Link>
          </div>
        </div>

        {/* Modern navigation Tab Switcher */}
        <div className="flex bg-gray-200/50 p-1.5 rounded-2xl max-w-md mb-12 gap-1 border border-gray-100/50">
          <button
            onClick={() => setActiveTab('activite')}
            type="button"
            className={`flex-1 py-3 text-center font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'activite'
                ? 'bg-white text-blue-950 shadow-sm font-black'
                : 'text-gray-500 hover:text-gray-950 hover:bg-white/40'
            }`}
          >
            <Clock size={18} />
            Activité Équipe
          </button>
          <button
            onClick={() => setActiveTab('suivi')}
            type="button"
            className={`flex-1 py-3 text-center font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'suivi'
                ? 'bg-white text-blue-950 shadow-sm font-black'
                : 'text-gray-500 hover:text-gray-950 hover:bg-white/40'
            }`}
          >
            <CheckCircle2 size={18} className={activeTab === 'suivi' ? 'text-green-600' : ''} />
            Suivi des Paiements
          </button>
        </div>

        {activeTab === 'activite' && (
          <>
            {/* Period filter control for Activity */}
            <div className="flex justify-end mb-6">
              <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                {[
                  { id: 'all', label: 'Tout' },
                  { id: 'day', label: 'Jour' },
                  { id: 'week', label: 'Semaine' },
                  { id: 'month', label: 'Mois' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                  <Receipt size={24} />
                </div>
                <p className="text-gray-500 font-medium">Paiements Enregistrés</p>
                <h3 className="text-3xl font-bold text-gray-900">{filteredReceipts.length}</h3>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                  <TrendingUp size={24} />
                </div>
                <p className="text-gray-500 font-medium">Total Encaissé</p>
                <h3 className="text-3xl font-bold text-gray-900">
                  {formatAmount(filteredReceipts.reduce((sum, r) => sum + (r.amount || 0), 0))} FCFA
                </h3>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Receipt className="text-blue-900" />
                  Détails des Paiements
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left border-b border-gray-100">
                      <th className="px-8 py-5 text-sm font-bold text-gray-600">Utilisateur</th>
                      <th className="px-8 py-5 text-sm font-bold text-gray-600">Demandé par</th>
                      <th className="px-8 py-5 text-sm font-bold text-gray-600">Client</th>
                      <th className="px-8 py-5 text-sm font-bold text-gray-600">Montant</th>
                      <th className="px-8 py-5 text-sm font-bold text-gray-600">Date</th>
                      <th className="px-8 py-5 text-sm font-bold text-gray-600">Heure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredReceipts.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold">
                              {r.createdByName?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{r.createdByName || 'Inconnu'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          {r.requestedBy ? (
                            <span className={`px-4 py-2 rounded-xl text-xs font-bold ${
                              r.requestedBy === 'OMAR' 
                                ? 'bg-amber-100 text-amber-700' 
                                : r.requestedBy === 'AMY' 
                                ? 'bg-pink-100 text-pink-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {r.requestedBy}
                            </span>
                          ) : (
                            <span className="text-gray-300 italic text-xs">Non spécifié</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <span className="font-medium text-gray-900">{r.clientName}</span>
                        </td>
                        <td className="px-8 py-6">
                          <span className="font-bold text-green-600">{formatAmount(r.amount)} FCFA</span>
                        </td>
                        <td className="px-8 py-6 text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock size={14} />
                            {new Date(r.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredReceipts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-8 py-12 text-center text-gray-500">
                          Aucun paiement enregistré pour cette période.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* --- SUIVI DES PAYEMENTS WORKSPACE --- */}
        {activeTab === 'suivi' && (
          <div className="space-y-8">
            {/* Sub-tab choice: Mensuel vs Annuel Heatmap */}
            <div className="flex gap-4 border-b border-gray-200 pb-2">
              <button
                type="button"
                onClick={() => setSuiviSubTab('mensuel')}
                className={`pb-2 px-4 text-sm font-bold transition-all relative ${
                  suiviSubTab === 'mensuel' 
                    ? 'text-blue-900 border-b-2 border-blue-950 font-black' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Tableau de Bord Mensuel
              </button>
              <button
                type="button"
                onClick={() => setSuiviSubTab('annuel')}
                className={`pb-2 px-4 text-sm font-bold transition-all relative ${
                  suiviSubTab === 'annuel' 
                    ? 'text-blue-900 border-b-2 border-blue-950 font-black' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Historique par Locataire
              </button>
            </div>

            {suiviSubTab === 'mensuel' ? (
              <>
                {/* 1. FILTERS & CONTROLS FOR SUIVI MENSUEL */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col gap-6">
                  <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-800 font-bold">
                      <Filter size={18} className="text-blue-900" />
                      <span>Filtres de Suivi</span>
                    </div>
                    {/* Reset Filters button */}
                    {(suiviSearch || suiviBailleur !== 'all' || suiviStatusFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSuiviSearch('');
                          setSuiviBailleur('all');
                          setSuiviStatusFilter('all');
                        }}
                        className="text-xs text-blue-600 hover:underline font-bold"
                      >
                        Réinitialiser tous les filtres
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search Field */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        placeholder="Rechercher locataire..."
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all text-gray-700"
                        value={suiviSearch}
                        onChange={(e) => setSuiviSearch(e.target.value)}
                      />
                    </div>

                    {/* Bailleur Dropdown */}
                    <div className="relative">
                      <select
                        className="w-full pl-4 pr-8 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold text-gray-700 appearance-none"
                        value={suiviBailleur}
                        onChange={(e) => setSuiviBailleur(e.target.value)}
                      >
                        <option value="all">Tous les Bailleurs</option>
                        {Array.from(new Set(reports.map(r => r.chez).filter(Boolean))).map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>

                    {/* Month Dropdown */}
                    <div className="relative">
                      <select
                        className="w-full pl-4 pr-8 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-blue-900 appearance-none bg-blue-50/50 mr-2"
                        value={suiviMonth}
                        onChange={(e) => setSuiviMonth(e.target.value)}
                      >
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900 pointer-events-none" size={16} />
                    </div>

                    {/* Year Dropdown */}
                    <div className="relative">
                      <select
                        className="w-full pl-4 pr-8 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-blue-900 appearance-none bg-blue-50/50 mr-2"
                        value={suiviYear}
                        onChange={(e) => setSuiviYear(e.target.value)}
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>

                {/* 2. STATS SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Card 1: Taux Recouvrement */}
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Taux de Recouvrement</p>
                      <p className="text-3xl font-black text-blue-900">{trackingMetrics.recoveryRate}%</p>
                      <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${trackingMetrics.recoveryRate}%` }} />
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <TrendingUp size={24} />
                    </div>
                  </div>

                  {/* Card 2: Total Loyer Attendu */}
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Attendu</p>
                      <p className="text-2xl font-black text-gray-900">{formatAmount(trackingMetrics.totalLoyer)} <span className="text-xs text-gray-400 font-bold">FCFA</span></p>
                      <p className="text-xs text-gray-450">{trackingMetrics.totalCount} locataires inscrits</p>
                    </div>
                    <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-2xl flex items-center justify-center">
                      <Building size={24} />
                    </div>
                  </div>

                  {/* Card 3: Total Encaissé */}
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Encaissé</p>
                      <p className="text-2xl font-black text-green-700">{formatAmount(trackingMetrics.totalPaid)} <span className="text-xs text-green-500 font-bold">FCFA</span></p>
                      <p className="text-xs text-green-600 font-semibold">{trackingMetrics.countPaid} règlements complets</p>
                    </div>
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                  </div>

                  {/* Card 4: Total Restant Dû */}
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Reste à Recouvrer</p>
                      <p className="text-2xl font-black text-red-600">{formatAmount(trackingMetrics.totalUnpaid)} <span className="text-xs text-red-400 font-bold">FCFA</span></p>
                      <p className="text-xs text-red-500 font-semibold">{trackingMetrics.countUnpaid + trackingMetrics.countPartial} restant d'impôt/dette</p>
                    </div>
                    <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                      <AlertCircle size={24} />
                    </div>
                  </div>
                </div>

                {/* Status Segment Filters */}
                <div className="flex gap-2 bg-gray-200 p-1.5 rounded-2xl max-w-lg">
                  <button
                    onClick={() => setSuiviStatusFilter('all')}
                    type="button"
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                      suiviStatusFilter === 'all' 
                        ? 'bg-white text-blue-900 shadow-sm' 
                        : 'text-gray-505 hover:text-gray-800'
                    }`}
                  >
                    Tous ({trackingMetrics.totalCount})
                  </button>
                  <button
                    onClick={() => setSuiviStatusFilter('paid')}
                    type="button"
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                      suiviStatusFilter === 'paid' 
                        ? 'bg-green-600 text-white shadow-sm' 
                        : 'text-gray-505 hover:text-green-600'
                    }`}
                  >
                    Payés ({trackingMetrics.countPaid})
                  </button>
                  <button
                    onClick={() => setSuiviStatusFilter('partial')}
                    type="button"
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                      suiviStatusFilter === 'partial' 
                        ? 'bg-amber-500 text-white shadow-sm' 
                        : 'text-gray-505 hover:text-amber-600'
                    }`}
                  >
                    Partiels ({trackingMetrics.countPartial})
                  </button>
                  <button
                    onClick={() => setSuiviStatusFilter('unpaid')}
                    type="button"
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                      suiviStatusFilter === 'unpaid' 
                        ? 'bg-red-500 text-white shadow-sm' 
                        : 'text-gray-505 hover:text-red-600'
                    }`}
                  >
                    Non Payés ({trackingMetrics.countUnpaid})
                  </button>
                </div>

                {/* 3. PAYMENTS TABLE */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 font-sans">Suivi des règlements d'honoraires</h4>
                      <p className="text-xs text-gray-400 mt-1">Saisissez les règlements pour ajuster en direct le bilan du bailleur lié.</p>
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-full font-bold">
                      {accumulatedPayments.length} locataire{accumulatedPayments.length > 1 ? 's' : ''} indexé{accumulatedPayments.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {accumulatedPayments.length === 0 ? (
                    <div className="p-16 text-center text-gray-400 font-medium">
                      <Users size={48} className="mx-auto text-gray-200 mb-4" />
                      Aucun règlement ou locataire trouvé pour les filtres actifs.
                    </div>
                  ) : (
                    <div className="overflow-x-auto font-sans">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-wider border-b border-gray-100">
                            <th className="px-8 py-5 col-span-2">Locataire & Propriété</th>
                            <th className="px-8 py-5">Bailleur lié</th>
                            <th className="px-8 py-5 text-right">Loyer Attendu</th>
                            <th className="px-8 py-5 text-right">Montant Réglé</th>
                            <th className="px-8 py-5 text-right">Solde Restante</th>
                            <th className="px-8 py-5 text-center">Progression</th>
                            <th className="px-8 py-5 text-center">Statut</th>
                            <th className="px-8 py-5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                          {accumulatedPayments.map((p, idx) => {
                            const pct = p.loyer > 0 ? Math.min(100, Math.round((p.paye / p.loyer) * 100)) : 0;
                            return (
                              <tr key={`${p.reportId}_${p.itemIndex}_${idx}`} className="hover:bg-blue-50/10 transition-colors">
                                <td className="px-8 py-5">
                                  <div className="font-bold text-gray-900">{p.fullName}</div>
                                  <div className="text-xs text-gray-400 font-semibold flex items-center gap-1.5 mt-0.5 font-mono">
                                    <Building size={12} />
                                    {p.villaNumber ? `Villa ${p.villaNumber}` : 'Local non spécifié'}
                                  </div>
                                </td>
                                <td className="px-8 py-5 font-bold text-gray-600">
                                  Chez {p.bailleurName}
                                </td>
                                <td className="px-8 py-5 text-right font-mono font-bold text-gray-700">
                                  {formatAmount(p.loyer)} {p.currency.trim()}
                                </td>
                                <td className="px-8 py-5 text-right font-mono font-bold text-green-700 bg-green-50/10">
                                  {formatAmount(p.paye)} {p.currency.trim()}
                                </td>
                                <td className="px-8 py-5 text-right font-mono font-bold text-red-600 bg-red-50/10">
                                  {formatAmount(p.nonPaye)} {p.currency.trim()}
                                </td>
                                <td className="px-8 py-5 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] font-mono font-bold text-gray-500">{pct}%</span>
                                    <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all ${
                                          p.status === 'paid' ? 'bg-green-500' : p.status === 'partial' ? 'bg-amber-400' : 'bg-red-500'
                                        }`} 
                                        style={{ width: `${pct}%` }} 
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-center">
                                  {p.status === 'paid' && (
                                    <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                      Payé
                                    </span>
                                  )}
                                  {p.status === 'partial' && (
                                    <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      Partiel
                                    </span>
                                  )}
                                  {p.status === 'unpaid' && (
                                    <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                      Non payé
                                    </span>
                                  )}
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <button
                                    onClick={() => {
                                      setSelectedTenantPayment({
                                        reportId: p.reportId,
                                        itemIndex: p.itemIndex,
                                        tenantName: p.fullName,
                                        bailleurName: p.bailleurName,
                                        mois: p.mois,
                                        loyer: p.loyer,
                                        paye: p.paye,
                                        nonPaye: p.nonPaye,
                                        currency: p.currency
                                      });
                                      setPaymentModalOpen(true);
                                    }}
                                    className="bg-blue-900/10 text-blue-950 hover:bg-blue-900 hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                                  >
                                    Enregistrer
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ANNUAL HEATMAP SECTION */
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-900 rounded-2xl flex items-center justify-center">
                      <User size={24} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold font-sans text-gray-900">Suivi Annuel par Locataire</h4>
                      <p className="text-xs text-gray-500">Choisissez un locataire pour obtenir un relevé d'activité complet.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 w-full md:w-auto">
                    {/* Tenant Selector */}
                    <div className="relative flex-1 md:w-64">
                      <select
                        className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold text-gray-700 appearance-none pr-8"
                        value={selectedTenantHistory}
                        onChange={(e) => setSelectedTenantHistory(e.target.value)}
                      >
                        <option value="">-- Choisir un Locataire --</option>
                        {allUniqueTenantsList.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>

                    {/* Year Selector */}
                    <div className="relative w-28 bg-blue-50/20 rounded-xl">
                      <select
                        className="w-full px-4 py-3 bg-transparent border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-blue-900 appearance-none pr-8"
                        value={suiviYear}
                        onChange={(e) => setSuiviYear(e.target.value)}
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>

                {selectedTenantHistory ? (
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <h5 className="text-2xl font-black text-gray-900 flex items-center gap-2 font-sans">
                        <span>{selectedTenantHistory}</span>
                        <ArrowRight size={18} className="text-gray-400" />
                        <span className="text-blue-900 font-bold">{suiviYear}</span>
                      </h5>
                    </div>

                    {/* 12 Months Status Blocks Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 font-sans">
                      {tenantYearlyHistory.map(th => (
                        <div 
                          key={th.monthName} 
                          className={`p-6 rounded-3xl border flex flex-col justify-between h-44 transition-all ${
                            th.status === 'paid' 
                              ? 'bg-green-50/50 border-green-200 hover:bg-green-50 shadow-sm shadow-green-100/30' 
                              : th.status === 'partial'
                              ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50 shadow-sm shadow-amber-100/30'
                              : th.status === 'unpaid'
                              ? 'bg-red-50/50 border-red-200 hover:bg-red-50 border-dashed shadow-sm shadow-red-100/20'
                              : 'bg-gray-50/50 border-gray-200 opacity-60'
                          }`}
                        >
                          <div>
                            <p className="font-extrabold text-lg text-gray-950">{th.monthName}</p>
                            {th.found && (
                              <p className="text-[10px] text-gray-400 font-bold mt-0.5 truncate">Chez {th.bailleur}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            {th.found ? (
                              <>
                                <div className="space-y-0.5">
                                  <p className="text-[10px] text-gray-400 font-semibold uppercase">Payé / Loyer</p>
                                  <p className="text-xs font-mono font-black text-gray-700">
                                    {formatAmount(th.paye)} / {formatAmount(th.loyer)}
                                  </p>
                                </div>
                                
                                {th.status === 'paid' && (
                                  <span className="inline-flex self-start items-center gap-1 bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-black">
                                    Réglé
                                  </span>
                                )}
                                {th.status === 'partial' && (
                                  <span className="inline-flex self-start items-center bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-black">
                                    Dû: {formatAmount(th.nonPaye)}
                                  </span>
                                )}
                                {th.status === 'unpaid' && (
                                  <span className="inline-flex self-start items-center bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded-full font-black">
                                    Non Payé
                                  </span>
                                )}
                              </>
                            ) : (
                              <div className="space-y-0.5">
                                <p className="text-xs text-gray-400 italic">Aucune fiche</p>
                                <span className="inline-flex items-center bg-gray-100 text-gray-500 text-[9px] px-2 py-0.5 rounded-full font-bold">
                                  Inactif
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 text-center text-gray-400 font-medium h-48 flex flex-col items-center justify-center">
                    Veuillez choisir un locataire dans la liste ci-dessus pour inspecter ses records annuels.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal-like inline form to Record Quick Payments from Suivi list */}
        {paymentModalOpen && selectedTenantPayment && (
          <Modal
            isOpen={paymentModalOpen}
            onClose={() => {
              setPaymentModalOpen(false);
              setSelectedTenantPayment(null);
            }}
            title={`Enregistrer un Paiement - ${selectedTenantPayment.tenantName}`}
          >
            <form onSubmit={(e) => {
              e.preventDefault();
              handleQuickPaymentSave(selectedTenantPayment.reportId, selectedTenantPayment.itemIndex, selectedTenantPayment.paye);
            }} className="space-y-6 font-sans">
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Locataire</span>
                    <p className="font-extrabold text-blue-950 text-base">{selectedTenantPayment.tenantName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Bailleur</span>
                    <p className="font-extrabold text-blue-950 text-base">Chez {selectedTenantPayment.bailleurName}</p>
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Mois</span>
                    <p className="font-extrabold text-blue-950 text-base">{selectedTenantPayment.mois}</p>
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Loyer Attendu</span>
                    <p className="font-black text-gray-950 text-base">
                      {formatAmount(selectedTenantPayment.loyer)} {selectedTenantPayment.currency.trim()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 block">Saisir le Montant Payé ({selectedTenantPayment.currency.trim()})</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 font-black text-blue-950 text-lg">💰</span>
                    <input
                      type="number"
                      required
                      min="0"
                      className="w-full pl-11 pr-5 py-4 bg-gray-100 border border-transparent hover:border-blue-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-2xl outline-none transition-all font-bold text-lg text-blue-950"
                      value={selectedTenantPayment.paye === 0 ? '' : selectedTenantPayment.paye}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSelectedTenantPayment({
                          ...selectedTenantPayment,
                          paye: val,
                          nonPaye: selectedTenantPayment.loyer - val > 0 ? selectedTenantPayment.loyer - val : 0
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/50 flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Reste dû calculé après enregistrement:</span>
                  <span className={`font-black tracking-wide text-sm ${selectedTenantPayment.nonPaye > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {formatAmount(selectedTenantPayment.nonPaye)} {selectedTenantPayment.currency.trim()}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalOpen(false);
                    setSelectedTenantPayment(null);
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Enregistrer le paiement
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
