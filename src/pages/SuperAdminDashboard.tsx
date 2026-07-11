import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { 
  ShieldCheck, ArrowLeft, Users, Receipt, TrendingUp, Calendar, Clock, 
  CheckCircle2, AlertCircle, Building, User, ArrowRight, Search, ChevronDown, Filter, X,
  RefreshCw, Coins, Ban
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
  const [filter, setFilter] = useState<'day' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [stats, setStats] = useState<any[]>([]);
  const [activityMonths, setActivityMonths] = useState<string[]>([
    ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][new Date().getMonth()]
  ]);
  const [activityYear, setActivityYear] = useState<string>(`${new Date().getFullYear()}`);

  // Modern tracking tab states
  const [activeTab, setActiveTab] = useState<'activite' | 'suivi'>('activite');
  const [suiviMonths, setSuiviMonths] = useState<string[]>([
    ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][new Date().getMonth()]
  ]);
  const [suiviYear, setSuiviYear] = useState<string>(`${new Date().getFullYear()}`);
  const [suiviBailleur, setSuiviBailleur] = useState<string>('all');
  const [suiviSearch, setSuiviSearch] = useState<string>('');
  const [suiviStatusFilter, setSuiviStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [suiviPeriodScope, setSuiviPeriodScope] = useState<'selected' | 'onwards'>('selected');

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
      if (receipts.length === 0) {
        fetchData();
      } else {
        calculateStats(receipts);
      }
    }
  }, [user, isSuperAdmin, filter, activityMonths, activityYear, receipts]);

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
      const dateVal = r.createdAt || r.date;
      if (!dateVal) return false;
      const date = new Date(dateVal);
      
      if (filter === 'custom') {
        const rYear = date.getFullYear().toString();
        const rMonthName = months[date.getMonth()];
        const yearMatch = rYear === activityYear;
        const monthMatch = activityMonths.includes(rMonthName);
        return yearMatch && monthMatch;
      }
      
      if (filter === 'all') return true;
      if (filter === 'day') return date >= startOfDay;
      if (filter === 'week') return date >= startOfWeek;
      if (filter === 'month') return date >= startOfMonth;
      return true;
    }).sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

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

      // AUTOMATION: Synchronize this specific payment with the receipts collection
      const tenantFullName = `${originalItem.prenoms || ''} ${originalItem.nom || ''}`.trim();
      const bailleurName = (reportToUpdate.chez || '').trim();
      const reportMois = (reportToUpdate.mois || '').trim();
      const villaNumber = reportToUpdate.villaNumber || originalItem.villaNumber || originalItem.villa || '';

      const monthsMap: { [key: string]: number } = {
        'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
        'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
      };

      const [mName, yStr] = reportMois.split(' ');
      const mIndex = monthsMap[mName.toLowerCase().trim()] !== undefined ? monthsMap[mName.toLowerCase().trim()] : 0;
      const yearNum = parseInt(yStr) || new Date().getFullYear();
      
      const pad = (n: number) => String(n).padStart(2, '0');
      const start = `${yearNum}-${pad(mIndex + 1)}-01`;
      const endDay = new Date(yearNum, mIndex + 1, 0).getDate();
      const end = `${yearNum}-${pad(mIndex + 1)}-${pad(endDay)}`;

      // Fetch latest receipts from Firestore to check if one exists
      const receiptsSnap = await getDocs(collection(db, 'receipts'));
      const currentReceipts = receiptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      const matchingReceipt = currentReceipts.find((r: any) => {
        const clientNameMatch = r.clientName?.toLowerCase().trim() === tenantFullName.toLowerCase().trim();
        const bailleurNameMatch = r.bailleurName?.toLowerCase().trim() === bailleurName.toLowerCase().trim();
        if (!clientNameMatch || !bailleurNameMatch) return false;
        return isReceiptMatchingMonth(r, reportMois);
      });

      const receiptStatus = parsedPaye >= rent ? 'Payé' : (parsedPaye > 0 ? 'Partiel' : 'En attente');

      if (matchingReceipt) {
        // Update existing receipt
        const rRef = doc(db, 'receipts', matchingReceipt.id);
        await updateDoc(rRef, {
          amount: parsedPaye,
          amountInWords: numberToWordsFrench(parsedPaye),
          status: receiptStatus,
          updatedAt: new Date().toISOString(),
          updatedByName: user?.displayName || user?.email || 'Admin'
        });
      } else if (parsedPaye > 0) {
        // Create new receipt if payment is greater than 0
        const matchingContract = contracts.find(c => 
          c.clientName?.toLowerCase().includes((originalItem.nom || '').toLowerCase()) ||
          (originalItem.nom || '').toLowerCase().includes(c.clientName?.toLowerCase())
        );

        await addDoc(collection(db, 'receipts'), {
          clientName: tenantFullName,
          bailleurName: bailleurName,
          amount: parsedPaye,
          amountInWords: numberToWordsFrench(parsedPaye),
          date: new Date().toISOString().split('T')[0],
          periodStart: start,
          periodEnd: end,
          periodLabel: reportMois,
          contractId: matchingContract?.id || '',
          paymentMethodId: 'Especes',
          reference: '',
          prestations: 0,
          timbre: 0,
          caution: 0,
          cautionLabel: '',
          indexInitial: 0,
          indexFinal: 0,
          waterCons: 0,
          waterAmount: 0,
          electricityCons: 0,
          electricityAmount: 0,
          status: receiptStatus,
          currency: reportToUpdate.reportCurrency || ' FCFA',
          issuePlace: 'Dakar',
          createdAt: new Date().toISOString(),
          createdByUID: user?.uid || '',
          createdByName: user?.displayName || user?.email || 'Admin',
          villaNumber: villaNumber,
        });
      }

      // Refresh all receipts state to immediately reflect change in stats and list!
      const finalReceiptsSnap = await getDocs(collection(db, 'receipts'));
      const finalReceiptsList = finalReceiptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReceipts(finalReceiptsList);

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
      
      let isMonthMatch = false;
      if (suiviPeriodScope === 'selected') {
        isMonthMatch = suiviMonths.some(m => 
          reportMonth.toLowerCase().trim() === `${m} ${suiviYear}`.toLowerCase().trim()
        );
      } else {
        // 'onwards': Find minimum selected month index. Match any month equal or greater than that in the same year, or any month in a greater year.
        const monthsLower = months.map(m => m.toLowerCase());
        const selectedIndices = suiviMonths.map(m => monthsLower.indexOf(m.toLowerCase().trim())).filter(idx => idx !== -1);
        const minSelectedIdx = selectedIndices.length > 0 ? Math.min(...selectedIndices) : 0;
        
        const reportParts = reportMonth.split(' ');
        if (reportParts.length >= 2) {
          const rMName = reportParts[0].toLowerCase().trim();
          const rYear = parseInt(reportParts[1]);
          const rMIndex = monthsLower.indexOf(rMName);
          const sYear = parseInt(suiviYear);
          
          if (!isNaN(rYear) && rMIndex !== -1 && !isNaN(sYear)) {
            if (rYear > sYear) {
              isMonthMatch = true;
            } else if (rYear === sYear && rMIndex >= minSelectedIdx) {
              isMonthMatch = true;
            }
          }
        }
      }
      
      if (!isMonthMatch) return;
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
  }, [reports, suiviMonths, suiviYear, suiviBailleur, suiviSearch, suiviStatusFilter, suiviPeriodScope]);

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
      const exactMonthMatch = suiviMonths.some(m => 
        reportMonth.toLowerCase().trim() === `${m} ${suiviYear}`.toLowerCase().trim()
      );
      
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
  }, [reports, suiviMonths, suiviYear, suiviBailleur]);

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

  // Group accumulated payments by month for elegant, unmixed display
  const accumulatedPaymentsByMonth = React.useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    accumulatedPayments.forEach(p => {
      const m = p.mois || 'Mois indéfini';
      if (!groups[m]) {
        groups[m] = [];
      }
      groups[m].push(p);
    });
    return groups;
  }, [accumulatedPayments]);

  // Syncing quittances states
  const [syncingReceipts, setSyncingReceipts] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; created: number; total: number } | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncSetupOpen, setSyncSetupOpen] = useState(false);
  const [syncScope, setSyncScope] = useState<'filtered' | 'current' | 'june' | 'allYear'>('current');
  const [syncBailleurScope, setSyncBailleurScope] = useState<'all' | 'selected'>('all');

  // Compute target payments matching the selected sync scope
  const targetPaymentsToSync = React.useMemo(() => {
    const list: any[] = [];
    
    reports.forEach(report => {
      const reportMonth = report.mois || '';
      const parts = reportMonth.split(' ');
      if (parts.length < 2) return;
      const rMName = parts[0];
      const rYStr = parts[1];
      
      // Determine if month matches selected scope
      let isMonthMatch = false;
      if (syncScope === 'filtered') {
        isMonthMatch = suiviMonths.some(m => 
          reportMonth.toLowerCase().trim() === `${m} ${suiviYear}`.toLowerCase().trim()
        );
      } else if (syncScope === 'current') {
        const curMonthName = months[new Date().getMonth()];
        const curYear = new Date().getFullYear().toString();
        isMonthMatch = reportMonth.toLowerCase().trim() === `${curMonthName} ${curYear}`.toLowerCase().trim();
      } else if (syncScope === 'june') {
        isMonthMatch = rMName.toLowerCase() === 'juin' && rYStr === suiviYear;
      } else if (syncScope === 'allYear') {
        isMonthMatch = rYStr === suiviYear;
      }
      
      if (!isMonthMatch) return;
      
      // Determine if bailleur matches selected scope
      let isBailleurMatch = false;
      if (syncBailleurScope === 'all') {
        isBailleurMatch = true;
      } else {
        isBailleurMatch = suiviBailleur !== 'all' ? report.chez === suiviBailleur : true;
      }
      
      if (!isBailleurMatch) return;
      
      (report.items || []).forEach((item: any, idx: number) => {
        const first = item.prenoms || '';
        const last = item.nom || '';
        const fullName = `${first} ${last}`.trim();
        
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
  }, [reports, syncScope, syncBailleurScope, suiviMonths, suiviYear, suiviBailleur]);

  // Helper to determine if a receipt matches a target month/year
  const isReceiptMatchingMonth = (r: any, targetMois: string) => {
    const [mName, yStr] = targetMois.split(' ');
    const monthsMap: { [key: string]: number } = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
      'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
    };
    const targetMonthIndex = monthsMap[mName.toLowerCase().trim()];
    const targetYear = parseInt(yStr);

    if (isNaN(targetMonthIndex) || isNaN(targetYear)) return false;

    // Timezone-safe date matching via string split analysis
    if (r.periodStart && typeof r.periodStart === 'string') {
      const parts = r.periodStart.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        if (y === targetYear && m === targetMonthIndex) {
          return true;
        }
      }
    }
    if (r.date && typeof r.date === 'string') {
      const parts = r.date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        if (y === targetYear && m === targetMonthIndex) {
          return true;
        }
      }
    }
    if (r.createdAt && typeof r.createdAt === 'string') {
      const parts = r.createdAt.split('T')[0].split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        if (y === targetYear && m === targetMonthIndex) {
          return true;
        }
      }
    }
    if (r.periodLabel) {
      const label = r.periodLabel.toLowerCase();
      if (label.includes(mName.toLowerCase()) && label.includes(yStr)) {
        return true;
      }
    }
    return false;
  };

  const handleSyncReceipts = async () => {
    const activePayments = targetPaymentsToSync.filter(p => p.paye > 0);
    if (activePayments.length === 0) {
      alert("Aucun règlement (paiement enregistré > 0) trouvé pour le périmètre de synchronisation sélectionné.");
      return;
    }

    setSyncSetupOpen(false);
    setSyncingReceipts(true);
    let created = 0;
    let updated = 0;
    let total = 0;

    const monthsMap: { [key: string]: number } = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
      'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
    };

    try {
      // Refresh receipts first to get the absolute latest state from Firestore
      const receiptsSnap = await getDocs(collection(db, 'receipts'));
      const currentReceipts = receiptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setReceipts(currentReceipts);

      for (const p of activePayments) {
        total++;

        // Find match in currentReceipts
        const matchingReceipt = currentReceipts.find((r: any) => {
          const clientNameMatch = r.clientName?.toLowerCase().trim() === p.fullName.toLowerCase().trim();
          const bailleurNameMatch = r.bailleurName?.toLowerCase().trim() === p.bailleurName.toLowerCase().trim();
          
          if (!clientNameMatch || !bailleurNameMatch) return false;
          return isReceiptMatchingMonth(r, p.mois);
        });

        const [mName, yStr] = p.mois.split(' ');
        const mIndex = monthsMap[mName.toLowerCase().trim()] !== undefined ? monthsMap[mName.toLowerCase().trim()] : 0;
        const yearNum = parseInt(yStr) || new Date().getFullYear();
        
        // Timezone-safe ISO calendar date strings
        const pad = (n: number) => String(n).padStart(2, '0');
        const start = `${yearNum}-${pad(mIndex + 1)}-01`;
        const endDay = new Date(yearNum, mIndex + 1, 0).getDate();
        const end = `${yearNum}-${pad(mIndex + 1)}-${pad(endDay)}`;

        if (matchingReceipt) {
          // If amount is different or not Paid, update
          if (getSafeNum(matchingReceipt.amount) !== p.paye || matchingReceipt.status !== 'Payé') {
            const rRef = doc(db, 'receipts', matchingReceipt.id);
            await updateDoc(rRef, {
              amount: p.paye,
              amountInWords: numberToWordsFrench(p.paye),
              status: 'Payé',
              updatedAt: new Date().toISOString(),
              updatedByName: user?.displayName || user?.email || 'Admin'
            });
            updated++;
          }
        } else {
          // Create new receipt
          const matchingContract = contracts.find(c => 
            c.clientName?.toLowerCase().includes(p.nom.toLowerCase()) ||
            p.nom.toLowerCase().includes(c.clientName?.toLowerCase())
          );

          await addDoc(collection(db, 'receipts'), {
            clientName: p.fullName,
            bailleurName: p.bailleurName,
            amount: p.paye,
            amountInWords: numberToWordsFrench(p.paye),
            date: new Date().toISOString().split('T')[0],
            periodStart: start,
            periodEnd: end,
            contractId: matchingContract?.id || '',
            paymentMethodId: 'Especes',
            reference: '',
            prestations: 0,
            timbre: 0,
            caution: 0,
            cautionLabel: '',
            cautionMonths: 0,
            periodLabel: `un mois de ${mName.toLowerCase()}`,
            propertyAddress: `Cité BATA chez ${p.bailleurName}`,
            status: 'Payé',
            createdByUID: user?.uid || '',
            createdByName: user?.displayName || user?.email || 'Admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          created++;
        }
      }

      setSyncResult({ updated, created, total });
      setSyncModalOpen(true);

      // Auto-update team activity months filter to match sync months so they see them immediately!
      if (activePayments.length > 0) {
        const syncedMonths = Array.from(new Set(activePayments.map(p => {
          const parts = p.mois.split(' ');
          return parts[0];
        })));
        if (syncedMonths.length > 0) {
          setFilter('custom');
          setActivityMonths(syncedMonths);
          const firstYear = activePayments[0].mois.split(' ')[1];
          if (firstYear) {
            setActivityYear(firstYear);
          }
        }
      }

      await fetchData(); // Reload all data to keep stats fresh
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la synchronisation des quittances.");
    } finally {
      setSyncingReceipts(false);
    }
  };

  // Group unpaid or partial payments by bailleur for detailed reporting
  const unpaidByBailleur = React.useMemo(() => {
    const groups: { [bailleur: string]: { items: any[]; totalUnpaid: number; totalLoyer: number } } = {};
    
    accumulatedPayments.forEach(p => {
      if (p.status === 'unpaid' || p.status === 'partial') {
        const b = p.bailleurName || 'Bailleur non spécifié';
        if (!groups[b]) {
          groups[b] = { items: [], totalUnpaid: 0, totalLoyer: 0 };
        }
        groups[b].items.push(p);
        groups[b].totalUnpaid += p.nonPaye;
        groups[b].totalLoyer += p.loyer;
      }
    });
    
    return groups;
  }, [accumulatedPayments]);

  // Group receipts by month for team activity display
  const receiptsByMonth = React.useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredReceipts.forEach(r => {
      const dateVal = r.createdAt || r.date;
      if (!dateVal) return;
      const date = new Date(dateVal);
      const monthName = months[date.getMonth()];
      const year = date.getFullYear();
      const groupKey = `${monthName} ${year}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(r);
    });
    return groups;
  }, [filteredReceipts]);

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
            <Logo className="h-16" variant="dark" />
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
              <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex-wrap">
                {[
                  { id: 'all', label: 'Tout' },
                  { id: 'day', label: 'Jour' },
                  { id: 'week', label: 'Semaine' },
                  { id: 'month', label: 'Mois' },
                  { id: 'custom', label: 'Mois Spécifiques 📅' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id as any)}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                      filter === f.id ? 'bg-blue-900 text-white shadow-md font-black' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filter === 'custom' && (
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col gap-6 mb-8">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-800 font-bold">
                    <Calendar size={18} className="text-blue-900" />
                    <span>Sélectionner les mois et l'année pour l'Activité Équipe</span>
                  </div>
                  {/* Reset button */}
                  {(activityMonths.length !== 1 || activityMonths[0] !== months[new Date().getMonth()] || activityYear !== `${new Date().getFullYear()}`) && (
                    <button
                      onClick={() => {
                        setActivityMonths([months[new Date().getMonth()]]);
                        setActivityYear(`${new Date().getFullYear()}`);
                      }}
                      className="text-xs text-blue-600 hover:underline font-bold"
                    >
                      Réinitialiser la période
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Year Dropdown */}
                  <div className="relative">
                    <span className="block text-xs font-bold text-gray-500 mb-2">Année de recherche</span>
                    <div className="relative">
                      <select
                        className="w-full pl-4 pr-8 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-blue-900 appearance-none bg-blue-50/50"
                        value={activityYear}
                        onChange={(e) => setActivityYear(e.target.value)}
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>

                {/* Multi-month selection */}
                <div className="space-y-3 border-t border-gray-100 pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-sm font-extrabold text-blue-900 flex items-center gap-1.5">
                      <Calendar size={16} />
                      Choisissez les mois d'activité (Sélection multiple) :
                    </span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setActivityMonths(months)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        Tous les mois
                      </button>
                      <span className="text-gray-300 text-xs">|</span>
                      <button
                        type="button"
                        onClick={() => setActivityMonths([])}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        Aucun
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 bg-gray-50 p-4 rounded-2xl">
                    {months.map((m) => {
                      const isSelected = activityMonths.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setActivityMonths(prev => prev.filter(x => x !== m));
                            } else {
                              setActivityMonths(prev => [...prev, m]);
                            }
                          }}
                          className={`py-2 px-1 rounded-xl text-xs font-extrabold border transition-all text-center ${
                            isSelected
                              ? 'bg-blue-900 text-white border-blue-900 shadow-md scale-102 font-black'
                              : 'bg-white text-gray-700 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

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
                    {Object.keys(receiptsByMonth).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-12 text-center text-gray-500">
                          Aucun paiement enregistré pour cette période.
                        </td>
                      </tr>
                    ) : (
                      (Object.entries(receiptsByMonth) as [string, any[]][]).map(([monthYear, items]) => (
                        <React.Fragment key={monthYear}>
                          <tr className="bg-blue-50/40 border-y border-blue-100/30">
                            <td colSpan={6} className="px-8 py-3 text-xs font-black text-blue-900 uppercase tracking-wider font-mono bg-blue-50/20">
                              <span className="flex items-center gap-2">
                                <Calendar size={14} className="text-blue-900" />
                                {monthYear} — ({items.length} règlement{items.length > 1 ? 's' : ''})
                              </span>
                            </td>
                          </tr>
                          {items.map((r) => (
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
                        </React.Fragment>
                      ))
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
                    {(suiviSearch || suiviBailleur !== 'all' || suiviStatusFilter !== 'all' || suiviPeriodScope !== 'selected' || suiviMonths.length !== 1 || suiviMonths[0] !== months[new Date().getMonth()]) && (
                      <button
                        onClick={() => {
                          setSuiviSearch('');
                          setSuiviBailleur('all');
                          setSuiviStatusFilter('all');
                          setSuiviPeriodScope('selected');
                          setSuiviMonths([months[new Date().getMonth()]]);
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

                    {/* Year Dropdown */}
                    <div className="relative">
                      <select
                        className="w-full pl-4 pr-8 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-blue-900 appearance-none bg-blue-50/50"
                        value={suiviYear}
                        onChange={(e) => setSuiviYear(e.target.value)}
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900 pointer-events-none" size={16} />
                    </div>

                    {/* Scope Selector */}
                    <div className="relative">
                      <select
                        className="w-full pl-4 pr-8 py-3 bg-indigo-50/50 border border-transparent rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-indigo-900 appearance-none"
                        value={suiviPeriodScope}
                        onChange={(e) => setSuiviPeriodScope(e.target.value as 'selected' | 'onwards')}
                      >
                        <option value="selected">Mois sélectionnés uniquement</option>
                        <option value="onwards">Ce mois et mois suivants ➔</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-900 pointer-events-none" size={16} />
                    </div>
                  </div>

                  {/* Multi-month selection */}
                  <div className="space-y-3 border-t border-gray-100 pt-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <span className="text-sm font-extrabold text-blue-900 flex items-center gap-1.5">
                        <Calendar size={16} />
                        Choisissez les mois à afficher (Sélection multiple) :
                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setSuiviMonths(months)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          Tous les mois
                        </button>
                        <span className="text-gray-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={() => setSuiviMonths([])}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          Aucun
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 bg-gray-50 p-4 rounded-2xl">
                      {months.map((m) => {
                        const isSelected = suiviMonths.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSuiviMonths(prev => prev.filter(x => x !== m));
                              } else {
                                setSuiviMonths(prev => [...prev, m]);
                              }
                            }}
                            className={`py-2 px-1 rounded-xl text-xs font-extrabold border transition-all text-center ${
                              isSelected
                                ? 'bg-blue-900 text-white border-blue-900 shadow-md scale-102 font-black'
                                : 'bg-white text-gray-700 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
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

                {/* STATE OF UNPAID/LATE TENANTS GROUPED BY LANDLORD */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100/50 pb-5">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 font-sans flex items-center gap-2">
                        <AlertCircle className="text-red-500 animate-pulse" size={22} />
                        État des Impayés par Bailleur (Qui n'a pas payé ?)
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">
                        Savoir qui n'a pas payé au niveau de chaque bailleur pour les mois et filtres sélectionnés.
                      </p>
                    </div>
                    <span className="text-xs bg-red-50 text-red-700 px-3.5 py-2 rounded-2xl font-black font-sans">
                      {Object.keys(unpaidByBailleur).length} Bailleur{Object.keys(unpaidByBailleur).length > 1 ? 's' : ''} en attente
                    </span>
                  </div>

                  {Object.keys(unpaidByBailleur).length === 0 ? (
                    <div className="py-12 text-center text-emerald-600 bg-emerald-50/50 rounded-3xl flex flex-col items-center justify-center gap-2 border border-emerald-100">
                      <CheckCircle2 size={40} className="text-emerald-500" />
                      <p className="font-extrabold text-sm">Félicitations ! Tous les locataires sont à jour pour les bailleurs et mois sélectionnés.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {Object.entries(unpaidByBailleur).map(([bailleur, data]: [string, any]) => (
                        <div key={bailleur} className="border border-red-100 rounded-[2rem] overflow-hidden bg-red-50/5 flex flex-col shadow-sm">
                          {/* Bailleur Header */}
                          <div className="bg-red-50/20 px-6 py-4.5 border-b border-red-100/50 flex items-center justify-between">
                            <span className="font-black text-gray-900 text-sm tracking-wide">
                              Bailleur : {bailleur}
                            </span>
                            <span className="text-xs bg-red-100/80 text-red-800 font-black px-3 py-1.5 rounded-xl font-mono">
                              Impayé : {formatAmount(data.totalUnpaid)} FCFA
                            </span>
                          </div>
                          
                          {/* Tenants list */}
                          <div className="divide-y divide-red-100/40 px-6 py-2 flex-1">
                            {data.items.map((p: any) => {
                              const remainingPercent = p.loyer > 0 ? Math.round((p.nonPaye / p.loyer) * 100) : 0;
                              return (
                                <div key={`${p.reportId}_${p.itemIndex}`} className="py-4.5 flex items-center justify-between gap-4">
                                  <div className="space-y-1 min-w-0">
                                    <p className="font-bold text-gray-950 text-sm truncate">{p.fullName}</p>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 font-bold font-mono">
                                      <span>Villa {p.villaNumber || 'N/A'}</span>
                                      <span>•</span>
                                      <span className="text-blue-900 bg-blue-50/50 px-1.5 py-0.5 rounded">{p.mois}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right space-y-0.5">
                                      <p className="font-extrabold text-red-600 text-sm font-mono">+{formatAmount(p.nonPaye)} {p.currency.trim()}</p>
                                      <p className="text-[10px] text-gray-400 font-bold">
                                        Sur {formatAmount(p.loyer)} Loyer (Reste {remainingPercent}%)
                                      </p>
                                    </div>
                                    
                                    <button
                                      type="button"
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
                                      className="p-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-all shadow-sm"
                                      title="Enregistrer règlement"
                                    >
                                      <Coins size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. PAYMENTS TABLE */}
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 font-sans">Suivi des règlements d'honoraires</h4>
                      <p className="text-xs text-gray-400 mt-1">Saisissez les règlements pour ajuster en direct le bilan du bailleur lié.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => setSyncSetupOpen(true)}
                        disabled={syncingReceipts || reports.length === 0}
                        className={`bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold text-xs px-4 py-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 ${syncingReceipts ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        <Receipt size={14} className={syncingReceipts ? 'animate-spin' : ''} />
                        {syncingReceipts ? 'Mise à jour en cours...' : 'Mettre à jour les Quittances'}
                      </button>
                      <span className="text-xs bg-blue-50 text-blue-800 px-3.5 py-2 rounded-2xl font-bold">
                        {accumulatedPayments.length} locataire{accumulatedPayments.length > 1 ? 's' : ''} indexé{accumulatedPayments.length > 1 ? 's' : ''}
                      </span>
                    </div>
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
                          {(Object.entries(accumulatedPaymentsByMonth) as [string, any[]][]).map(([monthYear, items]) => (
                            <React.Fragment key={monthYear}>
                              <tr className="bg-blue-50/40 border-y border-blue-100/30">
                                <td colSpan={8} className="px-8 py-3 text-xs font-black text-blue-900 uppercase tracking-wider font-mono bg-blue-50/20">
                                  <span className="flex items-center gap-2">
                                    <Calendar size={14} className="text-blue-900" />
                                    {monthYear} — ({items.length} locataire{items.length > 1 ? 's' : ''} indexé{items.length > 1 ? 's' : ''})
                                  </span>
                                </td>
                              </tr>
                              {items.map((p, idx) => {
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
                            </React.Fragment>
                          ))}
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

        {syncSetupOpen && (
          <Modal
            isOpen={syncSetupOpen}
            onClose={() => setSyncSetupOpen(false)}
            title="Automatisation & Synchronisation"
          >
            <div className="space-y-6 font-sans">
              <div className="bg-indigo-50/50 p-4 rounded-3xl border border-indigo-100 flex gap-4 items-start">
                <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl shrink-0">
                  <Receipt size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-indigo-950">Génération automatique des Quittances</h4>
                  <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                    Ce module synchronise les règlements d'honoraires et crée/met à jour automatiquement les quittances correspondantes au statut <strong className="font-black text-emerald-600">"Payé"</strong>.
                  </p>
                </div>
              </div>

              {/* 1. PERIOD SELECTION */}
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider block">
                  1. Période à synchroniser
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSyncScope('current')}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      syncScope === 'current'
                        ? 'bg-blue-50/50 border-blue-900 ring-2 ring-blue-900/10'
                        : 'bg-white hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        syncScope === 'current' ? 'border-blue-900' : 'border-gray-300'
                      }`}>
                        {syncScope === 'current' && <div className="w-2 h-2 rounded-full bg-blue-900" />}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-sm text-gray-950 block">Mois en cours uniquement</span>
                      <span className="text-xs text-gray-500 font-semibold">
                        Génère pour le mois de {months[new Date().getMonth()]} {new Date().getFullYear()}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncScope('june')}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      syncScope === 'june'
                        ? 'bg-blue-50/50 border-blue-900 ring-2 ring-blue-900/10'
                        : 'bg-white hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        syncScope === 'june' ? 'border-blue-900' : 'border-gray-300'
                      }`}>
                        {syncScope === 'june' && <div className="w-2 h-2 rounded-full bg-blue-900" />}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-sm text-gray-950 block">Mois de Juin {suiviYear} uniquement</span>
                      <span className="text-xs text-gray-500 font-semibold">
                        Génère et synchronise spécifiquement pour le mois de Juin {suiviYear} (Option recommandée)
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncScope('filtered')}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      syncScope === 'filtered'
                        ? 'bg-blue-50/50 border-blue-900 ring-2 ring-blue-900/10'
                        : 'bg-white hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        syncScope === 'filtered' ? 'border-blue-900' : 'border-gray-300'
                      }`}>
                        {syncScope === 'filtered' && <div className="w-2 h-2 rounded-full bg-blue-900" />}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-sm text-gray-950 block">Mois sélectionnés dans le filtre</span>
                      <span className="text-xs text-gray-500 font-semibold leading-relaxed">
                        Filtre actif : {suiviMonths.join(', ')} {suiviYear}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncScope('allYear')}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      syncScope === 'allYear'
                        ? 'bg-blue-50/50 border-blue-900 ring-2 ring-blue-900/10'
                        : 'bg-white hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        syncScope === 'allYear' ? 'border-blue-900' : 'border-gray-300'
                      }`}>
                        {syncScope === 'allYear' && <div className="w-2 h-2 rounded-full bg-blue-900" />}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-sm text-gray-950 block">Tous les mois à jour (Année {suiviYear})</span>
                      <span className="text-xs text-gray-500 font-semibold">
                        Parcourir et synchroniser tous les rapports de l'année {suiviYear}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. BAILLEUR SELECTION */}
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider block">
                  2. Bailleurs concernés
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSyncBailleurScope('all')}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      syncBailleurScope === 'all'
                        ? 'bg-blue-50/50 border-blue-900 ring-2 ring-blue-900/10'
                        : 'bg-white hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        syncBailleurScope === 'all' ? 'border-blue-900' : 'border-gray-300'
                      }`}>
                        {syncBailleurScope === 'all' && <div className="w-2 h-2 rounded-full bg-blue-900" />}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-sm text-gray-950 block">Tous</span>
                      <span className="text-[10px] text-gray-500 font-bold">Tous les bailleurs</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={suiviBailleur === 'all'}
                    onClick={() => setSyncBailleurScope('selected')}
                    className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      syncBailleurScope === 'selected'
                        ? 'bg-blue-50/50 border-blue-900 ring-2 ring-blue-900/10'
                        : 'bg-white hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        syncBailleurScope === 'selected' ? 'border-blue-900' : 'border-gray-300'
                      }`}>
                        {syncBailleurScope === 'selected' && <div className="w-2 h-2 rounded-full bg-blue-900" />}
                      </div>
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-extrabold text-sm text-gray-950 block truncate">Filtre actif</span>
                      <span className="text-[10px] text-gray-500 font-bold block truncate" title={suiviBailleur}>
                        {suiviBailleur === 'all' ? 'Aucun sélectionné' : suiviBailleur}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* DYNAMIC ANALYSIS BOX */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1 text-center">
                <div className="text-xs text-gray-400 font-extrabold uppercase">Estimation de la synchronisation</div>
                <div className="text-2xl font-black text-gray-950 font-mono">
                  {targetPaymentsToSync.filter(p => p.paye > 0).length} <span className="text-xs text-gray-400 font-extrabold font-sans">règlements enregistrés</span>
                </div>
                <p className="text-[10px] text-gray-400 font-bold">
                  Sera analysé et injecté sous forme de quittances au statut "Payé".
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSyncSetupOpen(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all text-xs"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={syncingReceipts || targetPaymentsToSync.filter(p => p.paye > 0).length === 0}
                  onClick={handleSyncReceipts}
                  className="px-6 py-3 bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 text-xs"
                >
                  <RefreshCw size={14} className={syncingReceipts ? 'animate-spin' : ''} />
                  Lancer la synchronisation
                </button>
              </div>
            </div>
          </Modal>
        )}

        {syncModalOpen && syncResult && (
          <Modal
            isOpen={syncModalOpen}
            onClose={() => {
              setSyncModalOpen(false);
              setSyncResult(null);
            }}
            title="Synchronisation des Quittances"
          >
            <div className="space-y-6 text-center font-sans p-2">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-black text-gray-950">Synchronisation réussie !</h3>
              
              <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-100 text-left space-y-3.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-505 font-bold">Total locataires traités :</span>
                  <span className="font-extrabold text-gray-900 font-mono">{syncResult.total}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Quittances créées :
                  </span>
                  <span className="font-extrabold text-emerald-700 font-mono">+{syncResult.created}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-600 font-bold flex items-center gap-1.5">
                    <RefreshCw size={16} /> Quittances mises à jour :
                  </span>
                  <span className="font-extrabold text-blue-700 font-mono">+{syncResult.updated}</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 font-semibold leading-relaxed">
                Les quittances ont été mises à jour ou générées en statut <strong className="text-emerald-600 font-black">"Payé"</strong> avec les montants corrects. Les locataires et bailleurs disposent maintenant de reçus parfaitement alignés avec vos rapports.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSyncModalOpen(false);
                  setSyncResult(null);
                }}
                className="w-full py-4 bg-gray-900 hover:bg-black text-white font-black text-sm rounded-2xl transition-all shadow-md mt-6"
              >
                Fermer la fenêtre
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
