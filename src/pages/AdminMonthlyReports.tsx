import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType, cleanFirestoreData } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { 
  FileBarChart, Trash2, Plus, Minus, ArrowLeft, Download, UserPlus, X, Edit2, Search, Copy, Settings, 
  ChevronUp, ChevronDown, Receipt, FileText, RotateCcw, CheckCircle2, AlertCircle, AlertTriangle, 
  Calendar, Building, DollarSign, TrendingUp, Filter, Users, User, ArrowRight 
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { generateMonthlyReportPDF } from '../utils/pdfGenerator';
import { generateMonthlyReportWord } from '../utils/wordGenerator';
import { numberToWordsFrench } from '../utils/numberToWords';
import Logo from '../components/Logo';
import Modal from '../components/Modal';

interface Column {
  id: string;
  label: string;
  type: 'text' | 'number';
  suffix?: string;
  formula?: string;
}

const AdminMonthlyReports: React.FC = () => {
  const { user, isAdmin, loading } = useFirebase();
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [lastReportForBailleur, setLastReportForBailleur] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showCustomRowForm, setShowCustomRowForm] = useState(false);
  const [customRowData, setCustomRowData] = useState({ label: '', value: 0, suffix: ' FCFA' });
  const [editingCustomRowIndex, setEditingCustomRowIndex] = useState<number | null>(null);
  const [showUnpaidDetails, setShowUnpaidDetails] = useState<{ isOpen: boolean, report: any }>({ isOpen: false, report: null });
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Selection-based Merge System
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [mergeStart, setMergeStart] = useState<{ row: number, colIdx: number } | null>(null);
  const [mergeEnd, setMergeEnd] = useState<{ row: number, colIdx: number } | null>(null);

  // Modern tracking tab states
  const [activeTab, setActiveTab ] = useState<'bilans' | 'suivi'>('bilans');
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

  const defaultColumns: Column[] = [
    { id: 'prenoms', label: 'Prénoms', type: 'text' },
    { id: 'nom', label: 'Nom', type: 'text' },
    { id: 'loyer', label: 'Loyer', type: 'number' },
    { id: 'paye', label: 'Payé', type: 'number' },
    { id: 'nonPaye', label: 'Non Payé', type: 'number' },
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
    customRows: [] as { label: string, value: number, suffix?: string }[],
    hideTotalPaye: false,
    hideCommission: false,
    reportCurrency: ' FCFA',
    title: 'BILAN MENSUEL',
    isManualTotalRemettre: false,
    isManualCommission: false,
    commissionInWords: false,
    commissionWords: '',
    forceOnePage: false,
    hideTotalRemettre: false,
    hideSignatures: false,
    hideArrete: false,
    hideFooter: false,
    centerText: false,
    tableFontSize: 'medium',
    managerTitle: 'La Gérante',
    bailleurLabel: 'Le BAILLEUR'
  });

  useEffect(() => {
    if (user && isAdmin) {
      fetchReports();
      fetchReceipts();
      
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
    const total = newReport.totalRemettre || 0;
    const words = numberToWordsFrench(total);
    const formatted = total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const currency = newReport.reportCurrency?.trim() || 'FCFA';
    const newArrete = `${words} ${currency} (${formatted})`;
    
    if (newReport.arreteSomme !== newArrete) {
      setNewReport(prev => ({
        ...prev,
        arreteSomme: newArrete
      }));
    }
  }, [newReport.totalRemettre, newReport.reportCurrency]);

  const calculateTotals = () => {
    setNewReport(prev => {
      // Force manual flags to false then let updateReportTotals calculate everything
      const reportWithFlagsReset = {
        ...prev,
        isManualTotalRemettre: false,
        isManualCommission: false
      };
      const updated = updateReportTotals(reportWithFlagsReset);
      
      // Also update arreteSomme immediately to be consistent
      const total = updated.totalRemettre || 0;
      const words = numberToWordsFrench(total);
      const formatted = total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      const currency = updated.reportCurrency?.trim() || 'FCFA';
      
      return {
        ...updated,
        arreteSomme: `${words} ${currency} (${formatted})`
      };
    });
  };

  const evaluateFormula = (formula: string, item: any) => {
    try {
      let expression = formula;
      // Sort keys by length descending to avoid partial replacements (e.g. 'amount' replacing 'amount_total')
      const keys = Object.keys(item).sort((a, b) => b.length - a.length);
      keys.forEach(key => {
        const val = getSafeNum(item[key]);
        // Use regex with word boundaries if it's alphanumeric, or literal replace
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expression = expression.replace(regex, val.toString());
      });
      
      // Basic safety check: only allow numbers and operators
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

  const updateReportTotals = (report: typeof newReport) => {
    // Ensure 'nonPaye' never automatically gets computed by a formula (from existing stored reports)
    const sanitizedColumns = (report.columns || []).map(col => {
      if (col.id === 'nonPaye' && col.formula) {
        const { formula, ...rest } = col;
        return rest;
      }
      return col;
    });

    // First, update any formula columns in items (unless manually overridden)
    const updatedItems = report.items.map(item => {
      let newItem = { ...item };
      sanitizedColumns.forEach(col => {
        if (col.formula && col.type === 'number' && col.id !== 'nonPaye') {
          // Pass current item values to evaluateFormula only if not manual override
          if (!newItem[`_manual_${col.id}`]) {
            newItem[col.id] = evaluateFormula(col.formula, newItem);
          }
        }
      });
      return newItem;
    });

    // Dynamically find the column to use for paye (defaulting to 'paye' ID)
    const payeCol = sanitizedColumns.find(c => c.id === 'paye' || c.label.toLowerCase() === 'payé' || c.label.toLowerCase() === 'paye');
    const payeId = payeCol ? payeCol.id : 'paye';
    
    const totalPaye = updatedItems.reduce((sum, item) => sum + getSafeNum(item[payeId]), 0);
    const commission = Math.round(totalPaye * (report.commissionPercentage / 100));
    const totalCustom = (report.customRows || []).reduce((sum, row) => sum + getSafeNum(row.value), 0);
    
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

  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const years = Array.from({ length: 11 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());
  
  // Helper to get numeric value safely from any input
  const getSafeNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val || val === '') return 0;
    
    // Standardize decimals and remove thousands separators
    // Handle spaces, dots as thousands, and commas as decimal or thousands
    let cleaned = String(val).replace(/\s/g, '');
    
    // Heuristic: if there's a comma and it's followed by 3 digits, it's likely a thousands separator (EN style)
    // If it's a French app, dot is often thousand, comma is decimal.
    // 1.000 -> 1000
    // 1.000.000 -> 1000000
    // 1,500 -> 1.5 (if comma is decimal) or 1500 (if comma is thousand)
    
    // We'll treat both dots and commas as thousands separators IF they are followed by exactly 3 digits
    cleaned = cleaned.replace(/[,.](?=\d{3}(?!\d))/g, '');
    
    // Remaining commas are treated as decimal points
    cleaned = cleaned.replace(',', '.');
    
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const formatAmount = (val: any) => {
    if (val === undefined || val === null) return "0";
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const getUnpaidTenants = (report: any) => {
    const unpaid = (report.items || []).filter((item: any) => {
      const nonPaye = Number(item.nonPaye) || 0;
      const paye = Number(item.paye) || 0;
      const loyer = Number(item.loyer) || 0;
      // Consider unpaid if there's a nonPaye amount OR if Loyers > Paye (in case loyer column exists)
      return nonPaye > 0 || (loyer > 0 && paye < loyer);
    });
    
    const totalDebt = unpaid.reduce((sum: number, item: any) => {
      const loyer = Number(item.loyer) || 0;
      const paye = Number(item.paye) || 0;
      const nonPaye = Number(item.nonPaye) || 0;
      
      // If nonPaye is explicitly set, use it. Otherwise calculate LOYER - PAYE if available.
      if (nonPaye > 0) return sum + nonPaye;
      if (loyer > 0) return sum + Math.max(0, loyer - paye);
      return sum;
    }, 0);

    return { unpaid, totalDebt };
  };

  const fetchReports = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'monthlyReports'));
      setReports(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'monthlyReports');
    }
  };

  const fetchReceipts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'receipts'));
      setReceipts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching receipts:", error);
    }
  };

  const handleSyncReceipts = async () => {
    if (newReport.items.length === 0) {
      alert("Ajoutez d'abord des locataires au tableau.");
      return;
    }

    if (!window.confirm("Voulez-vous synchroniser les paiements avec les quittances existantes ? Cela mettra à jour la colonne 'Payé' pour les locataires ayant une quittance ce mois-ci.")) {
      return;
    }

    setIsSyncing(true);
    
    try {
      // 1. Fetch latest receipts before syncing
      const querySnapshot = await getDocs(collection(db, 'receipts'));
      const latestReceipts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setReceipts(latestReceipts);

      if (latestReceipts.length === 0) {
        alert("Aucune quittance trouvée dans la base de données.");
        setIsSyncing(false);
        return;
      }

      // Extract month from "Mois Année" (e.g., "Janvier 2026" -> "Janvier")
      const reportMonthMatch = newReport.mois.split(' ')[0];
      let matchCount = 0;
      
      const updatedItems = newReport.items.map(item => {
        const tenantPrenom = (item.prenoms || '').trim().toLowerCase();
        const tenantNom = (item.nom || '').trim().toLowerCase();
        const tenantFullName = `${tenantPrenom} ${tenantNom}`.trim();
        
        // Default to current paye value (don't zero it out if not found, to be safe)
        // Actually, user said "only those with receipts paid", so let's keep it as is but maybe alert.
        let payeAmount = Number(item.paye) || 0;

        if (tenantFullName || tenantNom) {
          // Find a matching receipt
          const matchingReceipt = latestReceipts.find(r => {
            const receiptClient = (r.clientName || '').trim().toLowerCase();
            
            // Name matching strategies:
            const exactMatch = receiptClient === tenantFullName;
            const containsMatch = receiptClient.includes(tenantFullName) || tenantFullName.includes(receiptClient);
            const lastNameMatch = tenantNom && tenantNom.length > 2 && receiptClient.includes(tenantNom);

            const nameMatch = exactMatch || containsMatch || lastNameMatch;
            
            if (!nameMatch) return false;

            // Period matching: check if receipt label or period dates overlap with report month
            const rPeriod = (r.periodLabel || '').toLowerCase();
            const periodMatch = rPeriod.includes(reportMonthMatch.toLowerCase());
            
            return nameMatch && periodMatch;
          });

          if (matchingReceipt) {
            payeAmount = Number(matchingReceipt.amount) || 0;
            matchCount++;
          } else {
            // Option to zero out or keep? User said "only those with receipts paid".
            // Let's set to 0 if no receipt found for this month, as per user's specific request logic.
            payeAmount = 0;
          }
        }

        return {
          ...item,
          paye: payeAmount
        };
      });

      setNewReport(prev => updateReportTotals({
        ...prev,
        items: updatedItems
      }));
      
      alert(`Synchronisation terminée ! ${matchCount} locataires mis à jour d'après les quittances de ${reportMonthMatch}.`);
    } catch (error) {
      console.error("Error during sync:", error);
      alert("Une erreur est survenue lors de la synchronisation.");
    } finally {
      setIsSyncing(false);
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
    setNewReport(prev => updateReportTotals({
      ...prev,
      items: [...prev.items, initialItem]
    }));
  };

  const handleDuplicateRow = (index: number) => {
    const itemToDuplicate = { ...newReport.items[index] };
    setNewReport(prev => updateReportTotals({
      ...prev,
      items: [...prev.items, itemToDuplicate]
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (window.confirm("Voulez-vous supprimer cette ligne ?")) {
      setNewReport(prev => {
        const updatedItems = [...prev.items];
        updatedItems.splice(index, 1);
        return updateReportTotals({ ...prev, items: updatedItems });
      });
    }
  };

  const handleSetSpan = (rowIdx: number, colId: string, rowSpan: number, colSpan: number) => {
    const updatedItems = [...newReport.items];
    const item = { ...updatedItems[rowIdx] };
    const spanKey = `_span_${colId}`;
    
    if (rowSpan === 1 && colSpan === 1) {
      delete item[spanKey];
    } else {
      item[spanKey] = { rowSpan, colSpan };
    }
    
    updatedItems[rowIdx] = item;
    setNewReport({ ...newReport, items: updatedItems });
  };

  const handleCellClickForMerge = (rowIdx: number, colIdx: number) => {
    if (!isMergeMode) return;

    if (!mergeStart) {
      setMergeStart({ row: rowIdx, colIdx });
      setMergeEnd({ row: rowIdx, colIdx });
    } else {
      // Perform the merge
      const startRow = Math.min(mergeStart.row, rowIdx);
      const endRow = Math.max(mergeStart.row, rowIdx);
      const startCol = Math.min(mergeStart.colIdx, colIdx);
      const endCol = Math.max(mergeStart.colIdx, colIdx);

      const rowSpan = endRow - startRow + 1;
      const colSpan = endCol - startCol + 1;

      const updatedItems = [...newReport.items];
      
      // 1. Clear any existing spans in the entire range
      for (let r = startRow; r <= endRow; r++) {
        const item = { ...updatedItems[r] };
        for (let c = startCol; c <= endCol; c++) {
          const colId = newReport.columns[c].id;
          delete item[`_span_${colId}`];
        }
        updatedItems[r] = item;
      }

      // 2. Set the span on the top-left cell
      const topLeftColId = newReport.columns[startCol].id;
      updatedItems[startRow] = {
        ...updatedItems[startRow],
        [`_span_${topLeftColId}`]: { rowSpan, colSpan }
      };

      setNewReport({ ...newReport, items: updatedItems });
      
      // Cleanup
      setMergeStart(null);
      setMergeEnd(null);
      setIsMergeMode(false);
    }
  };

  const isCellSelected = (rowIdx: number, colIdx: number) => {
    if (!mergeStart || !mergeEnd) return false;
    const startRow = Math.min(mergeStart.row, mergeEnd.row);
    const endRow = Math.max(mergeStart.row, mergeEnd.row);
    const startCol = Math.min(mergeStart.colIdx, mergeEnd.colIdx);
    const endCol = Math.max(mergeStart.colIdx, mergeEnd.colIdx);

    return rowIdx >= startRow && rowIdx <= endRow && colIdx >= startCol && colIdx <= endCol;
  };

  const handleRemoveColumn = (colId: string) => {
    if (newReport.columns.length <= 1) {
      alert("Vous ne pouvez pas supprimer la dernière colonne.");
      return;
    }
    if (window.confirm("Voulez-vous supprimer cette colonne ? Toutes les données associées à cette colonne seront perdues (uniquement pour ce bilan).")) {
      setNewReport(prev => {
        const updatedColumns = prev.columns.filter(c => c.id !== colId);
        const updatedItems = prev.items.map(item => {
          const newItem = { ...item };
          delete newItem[colId];
          delete newItem[`_span_${colId}`];
          return newItem;
        });
        return updateReportTotals({ 
          ...prev, 
          columns: updatedColumns, 
          items: updatedItems 
        });
      });
    }
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

    setNewReport(updateReportTotals({
      ...newReport,
      customRows: updatedCustomRows
    }));
    setCustomRowData({ label: '', value: 0, suffix: ' FCFA' });
    setEditingCustomRowIndex(null);
    setShowCustomRowForm(false);
  };

  const handleEditCustomRow = (index: number) => {
    const row = newReport.customRows[index];
    setCustomRowData({ label: row.label, value: row.value, suffix: row.suffix || ' FCFA' });
    setEditingCustomRowIndex(index);
    setShowCustomRowForm(true);
  };

  const handleRemoveCustomRow = (index: number) => {
    setNewReport(prev => {
      const updated = [...(prev.customRows || [])];
      updated.splice(index, 1);
      return updateReportTotals({ ...prev, customRows: updated });
    });
    if (editingCustomRowIndex === index) {
      setEditingCustomRowIndex(null);
      setCustomRowData({ label: '', value: 0, suffix: ' FCFA' });
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
      const reportToSave = cleanFirestoreData({ ...newReport });

      if (editingId) {
        await updateDoc(doc(db, 'monthlyReports', editingId), {
          ...reportToSave,
          updatedByUID: user?.uid || null,
          updatedByName: user?.displayName || user?.email || 'Gérant',
          updatedAt: new Date().toISOString()
        });
        alert('Bilan mis à jour avec succès !');
      } else {
        await addDoc(collection(db, 'monthlyReports'), {
          ...reportToSave,
          createdByUID: user?.uid || null,
          createdByName: user?.displayName || user?.email || 'Gérant',
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
        customRows: [],
        hideTotalPaye: false,
        hideCommission: false,
        title: 'BILAN MENSUEL',
        isManualTotalRemettre: false,
        isManualCommission: false,
        commissionInWords: false,
        commissionWords: '',
        forceOnePage: false,
        hideTotalRemettre: false,
        hideSignatures: false,
        hideArrete: false,
        hideFooter: false,
        managerTitle: 'La Gérante',
        bailleurLabel: 'Le BAILLEUR'
      });
      setIsAdding(false);
      setEditingId(null);
      localStorage.removeItem('draft_monthly_report');
      fetchReports();
    } catch (error) {
      console.error('Error saving report:', error);
      try {
        handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'monthlyReports');
      } catch (err) {
        // Suppress re-throw to avoid unhandled promise rejection crashing the React rendering tree/UI
      }
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
      customRows: report.customRows || [],
      hideTotalPaye: !!report.hideTotalPaye,
      hideCommission: !!report.hideCommission,
      reportCurrency: report.reportCurrency || ' FCFA',
      title: report.title || 'BILAN MENSUEL',
      isManualTotalRemettre: !!report.isManualTotalRemettre,
      isManualCommission: !!report.isManualCommission,
      commissionInWords: !!report.commissionInWords,
      commissionWords: report.commissionWords || '',
      forceOnePage: !!report.forceOnePage,
      hideTotalRemettre: !!report.hideTotalRemettre,
      hideSignatures: !!report.hideSignatures,
      hideArrete: !!report.hideArrete,
      hideFooter: !!report.hideFooter,
      centerText: !!report.centerText,
      tableFontSize: report.tableFontSize || 'medium',
      managerTitle: report.managerTitle || 'La Gérante',
      bailleurLabel: report.bailleurLabel || 'Le BAILLEUR'
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
      customRows: report.customRows || [],
      hideTotalPaye: !!report.hideTotalPaye,
      hideCommission: !!report.hideCommission,
      reportCurrency: report.reportCurrency || ' FCFA',
      title: report.title || 'BILAN MENSUEL',
      isManualTotalRemettre: !!report.isManualTotalRemettre,
      isManualCommission: !!report.isManualCommission,
      commissionInWords: !!report.commissionInWords,
      commissionWords: report.commissionWords || '',
      forceOnePage: !!report.forceOnePage,
      hideTotalRemettre: !!report.hideTotalRemettre,
      hideSignatures: !!report.hideSignatures,
      hideArrete: !!report.hideArrete,
      hideFooter: !!report.hideFooter,
      centerText: !!report.centerText,
      tableFontSize: report.tableFontSize || 'medium',
      managerTitle: report.managerTitle || 'La Gérante',
      bailleurLabel: report.bailleurLabel || 'Le BAILLEUR'
    });
    setEditingId(null);
    setIsAdding(true);
  };

  const handleDeleteReport = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce bilan définitivement ?')) {
      // Functional update to local state for immediate feedback
      setReports(prev => prev.filter(r => r.id !== id));
      
      try {
        await deleteDoc(doc(db, 'monthlyReports', id));
        // Optionally re-fetch to ensure sync, but optimistic delete is better UI
        // fetchReports(); 
      } catch (error) {
        console.error("Error deleting report:", error);
        // Revert on error
        fetchReports();
        handleFirestoreError(error, OperationType.DELETE, `monthlyReports/${id}`);
      }
    }
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
      
      // If there's a custom manual overridden formula on nonPaye, mark or clear it to keep totals clean
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

      const isReceiptMatchingMonth = (r: any, targetMois: string) => {
        if (!r || !targetMois) return false;
        const partsMois = targetMois.split(' ');
        if (partsMois.length < 2) return false;
        const targetMonthName = partsMois[0].toLowerCase().trim();
        const targetYear = parseInt(partsMois[1]);
        const targetMonthIndex = monthsMap[targetMonthName] !== undefined ? monthsMap[targetMonthName] : -1;

        if (isNaN(targetMonthIndex) || isNaN(targetYear)) return false;

        if (r.periodStart && typeof r.periodStart === 'string') {
          const parts = r.periodStart.split('-');
          if (parts.length === 3) {
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            if (y === targetYear && m === targetMonthIndex) return true;
          }
        }
        if (r.createdAt && typeof r.createdAt === 'string') {
          const parts = r.createdAt.split('T')[0].split('-');
          if (parts.length === 3) {
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            if (y === targetYear && m === targetMonthIndex) return true;
          }
        }
        if (r.periodLabel) {
          const label = r.periodLabel.toLowerCase();
          if (label.includes(mName.toLowerCase()) && label.includes(yStr)) return true;
        }
        return false;
      };

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
        const contractsSnap = await getDocs(collection(db, 'contracts'));
        const contractsList = contractsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        const matchingContract = contractsList.find(c => 
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

      // Refresh any local receipts if needed
      fetchReceipts();

      // Update local state without waiting for re-fetch to feel extremely snappy!
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

  const filteredReports = reports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    const reportMonth = report.mois || '';
    
    // Search in basic report fields (Owner or Month)
    const basicMatch = 
      report.chez?.toLowerCase().includes(searchLower) ||
      reportMonth.toLowerCase().includes(searchLower);
      
    // Month/Year Filtres
    const monthMatch = !filterMonth || reportMonth.toLowerCase().includes(filterMonth.toLowerCase());
    const yearMatch = !filterYear || reportMonth.includes(filterYear);

    if (!monthMatch || !yearMatch) return false;
    if (searchTerm === '') return true;

    if (basicMatch) return true;
    
    // Search in all items (Tenants) within the report
    return (report.items || []).some((item: any) => 
      Object.values(item).some(val => 
        val && String(val).toLowerCase().includes(searchLower)
      )
    );
  });

  const handleGenerateReceipts = (report: any) => {
    // We'll pass the data via state to the receipts page where the user can select items
    navigate('/admin/quittances', { 
      state: { 
        fromReport: true,
        reportData: report
      } 
    });
  };

  // Accumulate all tenant payment items matching our filters
  const accumulatedPayments = React.useMemo(() => {
    const list: any[] = [];
    
    reports.forEach(report => {
      const reportMonth = report.mois || '';
      // Exclude copies or other unrelated entries if desired, but general month match is correct
      const exactMonthMatch = reportMonth.toLowerCase().trim() === `${suiviMonth} ${suiviYear}`.toLowerCase().trim();
      
      if (!exactMonthMatch) return;
      if (suiviBailleur !== 'all' && report.chez !== suiviBailleur) return;
      
      (report.items || []).forEach((item: any, idx: number) => {
        const first = item.prenoms || '';
        const last = item.nom || '';
        const fullName = `${first} ${last}`.trim();
        
        // Search filter matching first or last name
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
                  columns: defaultColumns,
                  items: [],
                  totalPaye: 0,
                  totalCommission: 0,
                  totalRemettre: 0,
                  commissionPercentage: 10,
                  arreteSomme: '',
                  date: new Date().toISOString().split('T')[0],
                  villaNumber: '',
                  customRows: [],
                  hideTotalPaye: false,
                  hideCommission: false,
                  reportCurrency: ' FCFA',
                  title: 'BILAN MENSUEL',
                  isManualTotalRemettre: false,
                  isManualCommission: false,
                  commissionInWords: false,
                  commissionWords: '',
                  forceOnePage: false,
                  hideTotalRemettre: false,
                  hideSignatures: false,
                  hideArrete: false,
                  hideFooter: false,
                  centerText: false,
                  tableFontSize: 'medium',
                  managerTitle: 'La Gérante',
                  bailleurLabel: 'Le BAILLEUR'
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

        {/* Modern navigation Tab Switcher */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl max-w-md mb-12 gap-1 shadow-inner border border-gray-150">
          <button
            onClick={() => setActiveTab('bilans')}
            type="button"
            className={`flex-1 py-3 text-center font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'bilans'
                ? 'bg-white text-blue-950 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
            }`}
          >
            <FileBarChart size={18} />
            Bilans & Factures
          </button>
          <button
            onClick={() => setActiveTab('suivi')}
            type="button"
            className={`flex-1 py-3 text-center font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'suivi'
                ? 'bg-white text-blue-950 shadow-sm font-black'
                : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
            }`}
          >
            <CheckCircle2 size={18} className={activeTab === 'suivi' ? 'text-green-600' : ''} />
            Suivi des Paiements
          </button>
        </div>
        {activeTab === 'bilans' && (
          <div className="mb-12 space-y-4">
            <div className="relative max-w-4xl mx-auto flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Rechercher par bailleur, locataire..."
                  className="w-full pl-14 pr-6 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex gap-4 w-full md:w-auto">
                <select
                  className="flex-1 md:w-40 px-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option value="">Tous les mois</option>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                
                <select
                  className="flex-1 md:w-32 px-4 py-4 bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  <option value="">Toutes les années</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                
                {(filterMonth || filterYear || searchTerm) && (
                  <button
                    onClick={() => {
                      setFilterMonth('');
                      setFilterYear('');
                      setSearchTerm('');
                    }}
                    className="px-6 py-4 bg-gray-200 text-gray-600 rounded-2xl hover:bg-gray-300 transition-all font-bold"
                    title="Réinitialiser les filtres"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

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
              customRows: [],
              hideTotalPaye: false,
              hideCommission: false,
              reportCurrency: ' FCFA',
              title: 'BILAN MENSUEL',
              isManualTotalRemettre: false,
              isManualCommission: false,
              commissionInWords: false,
              commissionWords: '',
              forceOnePage: false,
              hideTotalRemettre: false,
              hideSignatures: false,
              hideArrete: false,
              hideFooter: false,
              managerTitle: 'La Gérante',
              bailleurLabel: 'Le BAILLEUR'
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Titre du document (ex: BILAN MENSUEL, FACTURE, etc.)</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-white border-2 border-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-blue-900 text-xl uppercase"
                    placeholder="BILAN MENSUEL"
                    value={newReport.title}
                    onChange={(e) => setNewReport({ ...newReport, title: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Titre Gérant(e)</label>
                    <input
                      type="text"
                      className="w-full px-5 py-2 bg-white border-2 border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                      placeholder="La Gérante"
                      value={newReport.managerTitle}
                      onChange={(e) => setNewReport({ ...newReport, managerTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Libellé Bailleur (Signature)</label>
                    <input
                      type="text"
                      className="w-full px-5 py-2 bg-white border-2 border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                      placeholder="Le BAILLEUR"
                      value={newReport.bailleurLabel}
                      onChange={(e) => setNewReport({ ...newReport, bailleurLabel: e.target.value })}
                    />
                  </div>
                </div>
              </div>

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
                    <div className="bg-white/60 p-4 rounded-2xl text-xs text-blue-800 space-y-2 mb-2">
                      <p className="font-bold">✨ Fonctionnalités Excel :</p>
                      <ul className="list-disc ml-4 space-y-1">
                        <li><strong>Formules :</strong> Ajoutez une formule dans une colonne (ex: <code className="bg-blue-100 px-1 rounded">loyer - paye</code>).</li>
                        <li><strong>Calcul rapide :</strong> Dans le tableau, tapez un calcul (ex: <code className="bg-blue-100 px-1 rounded">5000+2500</code>) puis sortez de la case.</li>
                        <li><strong>Identifiants :</strong> Utilisez l'ID (ex: <code className="bg-blue-100 px-1 rounded">paye</code>) pour vos formules.</li>
                      </ul>
                    </div>
                    <p className="text-[10px] text-blue-600 italic">* La colonne avec l'ID "paye" est utilisée pour le calcul de la commission et du total à remettre.</p>
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
                          {col.type === 'number' && (
                            <input
                              type="text"
                              className="w-16 bg-gray-50 border-none rounded-lg text-xs px-2 py-1"
                              value={col.suffix !== undefined ? col.suffix : ' FCFA'}
                              placeholder="Unité"
                              onChange={(e) => {
                                const updated = [...newReport.columns];
                                updated[index].suffix = e.target.value;
                                setNewReport({ ...newReport, columns: updated });
                              }}
                            />
                          )}
                          {col.type === 'number' && (
                            <input
                              type="text"
                              className="w-24 bg-gray-50 border-none rounded-lg text-xs px-2 py-1"
                              value={col.formula || ''}
                              placeholder="Formule (ex: col_id + 50)"
                              onChange={(e) => {
                                const updated = [...newReport.columns];
                                updated[index].formula = e.target.value;
                                setNewReport({ ...newReport, columns: updated });
                              }}
                            />
                          )}
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
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-sm font-bold text-gray-700">Chez (Bailleur)</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        const search = prompt("Entrez le nom du bailleur (ex: Sy) :");
                        if (search) {
                          const previous = reports.filter(r => 
                            r.chez?.toLowerCase().includes(search.toLowerCase())
                          ).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                          
                          if (previous.length > 0) {
                            const latest = previous[0];
                            if (window.confirm(`Importer les locataires de ${latest.chez} (${latest.mois}) ?`)) {
                              const importedItems = latest.items.map((item: any) => ({
                                ...item,
                                paye: 0,
                                nonPaye: Number(item.loyer) || 0
                              }));
                              setNewReport(prev => updateReportTotals({
                                ...prev,
                                items: importedItems,
                                chez: latest.chez,
                                columns: latest.columns || prev.columns
                              }));
                            }
                          } else {
                            alert("Aucun bilan trouvé pour ce nom.");
                          }
                        }
                      }}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Importer une liste existante
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={newReport.chez}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewReport({ ...newReport, chez: val });
                        
                        // Check if we have a previous report for this bailleur to offer import
                        if (val.length >= 2) {
                          const lastOne = reports.find(r => 
                            r.chez?.toLowerCase().includes(val.toLowerCase().trim())
                          );
                          setLastReportForBailleur(lastOne || null);
                        } else {
                          setLastReportForBailleur(null);
                        }
                      }}
                    />
                    {lastReportForBailleur && newReport.items.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Voulez-vous importer les ${lastReportForBailleur.items.length} locataires du bilan "${lastReportForBailleur.mois}" pour ${lastReportForBailleur.chez} ?`)) {
                            // Clone items but reset 'paye' and 'nonPaye'
                            const importedItems = lastReportForBailleur.items.map((item: any) => {
                              const base = { ...item };
                              // Reset transient fields
                              base.paye = 0;
                              base.nonPaye = Number(item.loyer) || 0;
                              return base;
                            });
                            setNewReport(prev => updateReportTotals({
                              ...prev,
                              items: importedItems,
                              columns: lastReportForBailleur.columns || prev.columns 
                            }));
                            setLastReportForBailleur(null);
                          }
                        }}
                        className="absolute right-2 top-2 bottom-2 px-4 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition-all flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-right-4"
                      >
                        <Plus size={14} /> Importer locataires de {lastReportForBailleur.mois}
                      </button>
                    )}
                  </div>
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
                  <div className="overflow-x-auto rounded-xl border border-blue-900/10">
                    <table className="w-full text-left">
                      <thead>
                        <tr className={`font-bold bg-blue-900 text-white uppercase tracking-wider ${
                          newReport.tableFontSize === 'small' ? 'text-[9px]' : 
                          newReport.tableFontSize === 'large' ? 'text-xs' : 'text-[10px]'
                        }`}>
                          {newReport.columns.map(col => (
                            <th key={col.id} className={`px-4 py-3 group/header border-r border-white/10 ${newReport.centerText ? 'text-center' : ''}`}>
                              <div className={`flex flex-col gap-1 ${newReport.centerText ? 'items-center' : ''}`}>
                                <span>{col.label}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveColumn(col.id)}
                                  className="hidden group-hover/header:flex items-center justify-center text-red-400 hover:text-red-600 self-start transition-all"
                                  title="Supprimer la colonne"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {newReport.items.map((item, idx) => {
                          const { unpaid } = getUnpaidTenants({ items: [item], columns: newReport.columns });
                          const isUnpaid = unpaid.length > 0;
                          
                          return (
                            <tr key={idx} className={`hover:bg-gray-50 transition-colors ${
                              isUnpaid ? 'bg-red-50/30' : ''
                            } ${
                              newReport.tableFontSize === 'small' ? 'text-xs' : 
                              newReport.tableFontSize === 'large' ? 'text-base' : 'text-sm'
                            }`}>
                            {newReport.columns.map((col, colIdx) => {
                              // Check if this cell is covered by a span from another cell
                              // 1. Check RowSpan from above
                              for (let prevRowIdx = 0; prevRowIdx < idx; prevRowIdx++) {
                                const prevItem = newReport.items[prevRowIdx];
                                const span = prevItem[`_span_${col.id}`];
                                if (span && span.rowSpan > 1 && idx < prevRowIdx + span.rowSpan) {
                                  return null; // Don't render this cell
                                }
                              }
                              
                              // 2. Check ColSpan from the left in the same row
                              for (let prevColIdx = 0; prevColIdx < colIdx; prevColIdx++) {
                                const prevCol = newReport.columns[prevColIdx];
                                const span = item[`_span_${prevCol.id}`];
                                if (span && span.colSpan > 1 && colIdx < prevColIdx + span.colSpan) {
                                  return null; // Don't render this cell
                                }
                              }

                              const currentSpan = item[`_span_${col.id}`] || { rowSpan: 1, colSpan: 1 };

                              return (
                                <td 
                                  key={col.id} 
                                  className={`px-4 py-2 relative group/cell transition-all cursor-pointer ${
                                    isMergeMode ? 'hover:bg-indigo-50 ring-1 ring-transparent hover:ring-indigo-300' : ''
                                  } ${isCellSelected(idx, colIdx) ? 'bg-indigo-100 ring-2 ring-indigo-500 z-10' : ''}`}
                                  rowSpan={currentSpan.rowSpan}
                                  colSpan={currentSpan.colSpan}
                                  onClick={() => handleCellClickForMerge(idx, colIdx)}
                                  onMouseEnter={() => {
                                    if (isMergeMode && mergeStart) {
                                      setMergeEnd({ row: idx, colIdx });
                                    }
                                  }}
                                >
                                  <div className="relative group/input flex items-center justify-end w-full">
                                    <input
                                      type="text"
                                      className={`w-full border border-transparent hover:border-blue-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-xl px-3 py-2 transition-all ${
                                        isMergeMode ? 'pointer-events-none' : ''
                                      } ${
                                        col.type === 'number' && !newReport.centerText ? 'text-right' : 
                                        newReport.centerText ? 'text-center' : 'text-left'
                                      } ${col.type === 'number' ? 'font-mono font-bold text-blue-900' : 'text-gray-700'} ${
                                        col.formula 
                                          ? item[`_manual_${col.id}`]
                                            ? 'bg-amber-50/70 border-amber-200 text-amber-900 focus:bg-white font-bold' 
                                            : 'bg-blue-50/40 text-blue-900 border-dashed border-blue-100 font-bold hover:bg-blue-50/70' 
                                          : 'bg-white/50'
                                      } ${
                                        newReport.tableFontSize === 'small' ? 'text-xs px-2 py-1' : 
                                        newReport.tableFontSize === 'large' ? 'text-base py-3' : 'text-sm'
                                      } ${col.formula && item[`_manual_${col.id}`] ? 'pr-8' : ''}`}
                                      value={item[col.id] ?? (col.type === 'number' ? 0 : '')}
                                      readOnly={isMergeMode}
                                      placeholder={col.formula ? `[Auto]` : ''}
                                      title={col.formula ? (item[`_manual_${col.id}`] ? "Saisie manuelle pour remplacer la formule. Effacez ou cliquez sur réinitialiser pour revenir au calcul automatique." : `Calcul automatique: ${col.formula}. Modifiez pour forcer manuellement.`) : ""}
                                      onChange={(e) => {
                                        const updatedItems = [...newReport.items];
                                        const rawVal = e.target.value;
                                        updatedItems[idx] = { 
                                          ...updatedItems[idx], 
                                          [col.id]: rawVal
                                        };
                                        if (col.formula) {
                                          if (rawVal === '') {
                                            delete updatedItems[idx][`_manual_${col.id}`];
                                          } else {
                                            updatedItems[idx][`_manual_${col.id}`] = true;
                                          }
                                        }
                                        setNewReport(prev => ({ ...prev, items: updatedItems }));
                                      }}
                                      onBlur={(e) => {
                                        if (col.type === 'number') {
                                          const rawVal = e.target.value;
                                          let finalVal: any = rawVal;
                                          
                                          if (col.formula && rawVal.trim() === '') {
                                            setNewReport(prev => {
                                              const updatedItems = [...prev.items];
                                              const updatedItem = { ...updatedItems[idx], [col.id]: '' };
                                              delete updatedItem[`_manual_${col.id}`];
                                              updatedItems[idx] = updatedItem;
                                              return updateReportTotals({ ...prev, items: updatedItems });
                                            });
                                            return;
                                          }
                                          
                                          if (rawVal && (rawVal.includes('+') || rawVal.includes('-') || rawVal.includes('*') || rawVal.includes('/'))) {
                                            finalVal = evaluateFormula(rawVal, {});
                                          } else {
                                            finalVal = rawVal === '' ? '' : getSafeNum(rawVal);
                                          }
                                          
                                          setNewReport(prev => {
                                            const updatedItems = [...prev.items];
                                            const updatedItem = { ...updatedItems[idx], [col.id]: finalVal };
                                            if (col.formula) {
                                              updatedItem[`_manual_${col.id}`] = true;
                                            }
                                            updatedItems[idx] = updatedItem;
                                            return updateReportTotals({ ...prev, items: updatedItems });
                                          });
                                        } else {
                                          setNewReport(prev => updateReportTotals(prev));
                                        }
                                      }}
                                    />

                                    {/* Manual mode indicator with Reset button */}
                                    {col.formula && item[`_manual_${col.id}`] && !isMergeMode && (
                                      <button
                                        type="button"
                                        title="Réinitialiser en calcul de formule automatique"
                                        onClick={() => {
                                          setNewReport(prev => {
                                            const updatedItems = [...prev.items];
                                            const updatedItem = { ...updatedItems[idx], [col.id]: '' };
                                            delete updatedItem[`_manual_${col.id}`];
                                            updatedItems[idx] = updatedItem;
                                            return updateReportTotals({ ...prev, items: updatedItems });
                                          });
                                        }}
                                        className="absolute right-2 text-amber-500 hover:text-amber-700 bg-amber-100 hover:bg-amber-200 p-1 rounded-md transition-all z-10"
                                      >
                                        <RotateCcw size={12} />
                                      </button>
                                    )}
                                    
                                    {/* Quick Unmerge (Shown on cell group hover only if merged) */}
                                    {(currentSpan.rowSpan > 1 || currentSpan.colSpan > 1) && !isMergeMode && (
                                      <div className="absolute -top-4 -right-4 hidden group-hover/cell:flex items-center gap-1 bg-white shadow-lg border border-red-100 rounded-full p-1 z-20">
                                        <button
                                          type="button"
                                          title="Annuler les fusions"
                                          onClick={() => handleSetSpan(idx, col.id, 1, 1)}
                                          className="p-1 hover:bg-red-50 text-red-600 rounded-full transition-colors"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-4 py-2 text-right sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.1)] z-10">
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
                                  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all shadow-sm bg-red-50/50"
                                  title="Supprimer cette ligne"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white/50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium">Aucun locataire ajouté. Utilisez le bouton "Ajouter une ligne" ci-dessous.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsMergeMode(!isMergeMode);
                    setMergeStart(null);
                    setMergeEnd(null);
                  }}
                  className={`h-[60px] px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md group ${
                    isMergeMode 
                      ? 'bg-indigo-600 text-white animate-pulse' 
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  <Settings className={`${isMergeMode ? 'animate-spin' : ''}`} size={20} />
                  {isMergeMode ? (mergeStart ? 'Cliquez sur la cellule de fin' : 'Selectionnez la 1ère cellule') : 'Mode Fusion (Word-style)'}
                  {isMergeMode && <X size={16} onClick={(e) => { e.stopPropagation(); setIsMergeMode(false); }} className="ml-2 hover:scale-125" />}
                </button>

                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-xl hover:bg-gray-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.hideTotalPaye}
                    onChange={(e) => setNewReport(prev => ({ ...prev, hideTotalPaye: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Masquer Total Payé</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-xl hover:bg-gray-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.hideCommission}
                    onChange={(e) => {
                      const hidden = e.target.checked;
                      setNewReport(prev => updateReportTotals({ ...prev, hideCommission: hidden }));
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Masquer Commission</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-green-50 px-4 py-2 rounded-xl hover:bg-green-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.isManualTotalRemettre}
                    onChange={(e) => setNewReport(prev => ({ ...prev, isManualTotalRemettre: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-green-700 font-bold">Saisie manuelle Total à Remettre</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.isManualCommission}
                    onChange={(e) => setNewReport(prev => ({ ...prev, isManualCommission: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-blue-700 font-bold">Saisie manuelle Commission</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.commissionInWords}
                    onChange={(e) => setNewReport(prev => ({ ...prev, commissionInWords: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-indigo-700 font-bold">Commission en toutes lettres</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-orange-50 px-4 py-2 rounded-xl hover:bg-orange-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.forceOnePage}
                    onChange={(e) => setNewReport(prev => ({ ...prev, forceOnePage: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-orange-700 font-bold italic">Forcer une seule page</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.hideTotalRemettre}
                    onChange={(e) => setNewReport(prev => ({ ...prev, hideTotalRemettre: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-red-700 font-bold">Masquer Total à Remettre</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-gray-100 px-4 py-2 rounded-xl hover:bg-gray-200 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.hideSignatures}
                    onChange={(e) => setNewReport(prev => ({ ...prev, hideSignatures: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                  />
                  <span className="text-sm font-medium text-gray-700 font-bold">Masquer Signatures</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-amber-50 px-4 py-2 rounded-xl hover:bg-amber-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.hideArrete}
                    onChange={(e) => setNewReport(prev => ({ ...prev, hideArrete: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium text-amber-700 font-bold">Masquer Arrêté à la somme</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.hideFooter}
                    onChange={(e) => setNewReport(prev => ({ ...prev, hideFooter: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-slate-600 focus:ring-slate-500"
                  />
                  <span className="text-sm font-medium text-slate-700 font-bold">Masquer Pied de page</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-cyan-50 px-4 py-2 rounded-xl hover:bg-cyan-100 transition-all">
                  <input
                    type="checkbox"
                    checked={newReport.centerText}
                    onChange={(e) => setNewReport(prev => ({ ...prev, centerText: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm font-medium text-cyan-700 font-bold">Centrer le texte du tableau</span>
                </label>
                <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-xl">
                  <span className="text-sm font-medium text-purple-700 font-bold">Taille texte :</span>
                  <select
                    className="bg-white border-none rounded-lg text-sm px-2 py-1 focus:ring-2 focus:ring-purple-500 outline-none"
                    value={newReport.tableFontSize}
                    onChange={(e) => setNewReport({ ...newReport, tableFontSize: e.target.value as any })}
                  >
                    <option value="small">Petit</option>
                    <option value="medium">Moyen</option>
                    <option value="large">Grand</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">Devise :</span>
                  <input
                    type="text"
                    className="w-20 bg-white border-none rounded-lg text-sm px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newReport.reportCurrency}
                    onChange={(e) => setNewReport({ ...newReport, reportCurrency: e.target.value })}
                  />
                </div>
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
                    onClick={handleSyncReceipts}
                    disabled={isSyncing}
                    className="w-full h-[60px] bg-green-100 text-green-700 font-bold rounded-2xl hover:bg-green-200 transition-all flex items-center justify-center gap-2 shadow-sm group"
                    title="Remplit automatiquement la colonne 'Payé' d'après les quittances générées"
                  >
                    {isSyncing ? (
                      <div className="w-5 h-5 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Receipt size={20} className="group-hover:rotate-12 transition-transform" />
                    )}
                    Sync Quittances
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
                    onChange={(e) => {
                      const pct = parseInt(e.target.value);
                      setNewReport(updateReportTotals({ ...newReport, commissionPercentage: pct }));
                    }}
                  >
                    {Array.from({ length: 101 }, (_, i) => (
                      <option key={i} value={i}>{i}%</option>
                    ))}
                  </select>
                </div>
                {!newReport.hideTotalPaye && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">TOTAL (Somme des Payés)</label>
                    <input
                      type="number"
                      className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-900"
                      value={newReport.totalPaye || 0}
                      onChange={(e) => {
                        const val = getSafeNum(e.target.value);
                        const commission = Math.round(val * (newReport.commissionPercentage / 100));
                        const totalCustom = (newReport.customRows || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0);
                        const effectiveCommission = newReport.hideCommission ? 0 : commission;
                        setNewReport({ 
                          ...newReport, 
                          totalPaye: val,
                          totalCommission: commission,
                          totalRemettre: val - effectiveCommission - totalCustom
                        });
                      }}
                    />
                  </div>
                )}
                {!newReport.hideCommission && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Commission ({newReport.commissionPercentage}%)</label>
                    <div className="relative">
                      {newReport.commissionInWords ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            className="w-full px-5 py-4 bg-indigo-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-indigo-700 ring-2 ring-indigo-100"
                            value={newReport.commissionWords || ''}
                            placeholder="Entrez la commission en lettres (ex: OFFERT, Dix pour cent...)"
                            onChange={(e) => {
                              setNewReport({ ...newReport, commissionWords: e.target.value });
                            }}
                          />
                          {newReport.isManualCommission && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs font-bold text-gray-500">Valeur numérique pour calcul :</span>
                              <input
                                type="number"
                                className="w-32 px-3 py-1 bg-blue-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-blue-700 text-sm"
                                value={newReport.totalCommission || 0}
                                onChange={(e) => {
                                  const val = getSafeNum(e.target.value);
                                  const totalPaye = newReport.totalPaye || 0;
                                  const totalCustom = (newReport.customRows || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0);
                                  const currentManualTotalRemettre = newReport.isManualTotalRemettre;
                                  setNewReport({ 
                                    ...newReport, 
                                    totalCommission: val,
                                    totalRemettre: currentManualTotalRemettre ? newReport.totalRemettre : totalPaye - val - totalCustom
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="number"
                          className={`w-full px-5 py-4 border-none rounded-2xl focus:ring-2 outline-none transition-all font-bold text-blue-700 ${
                            newReport.isManualCommission 
                            ? 'bg-blue-50 focus:ring-blue-500 ring-2 ring-blue-100' 
                            : 'bg-gray-50 focus:ring-blue-500'
                          }`}
                          value={newReport.totalCommission || 0}
                          onChange={(e) => {
                            const val = getSafeNum(e.target.value);
                            const totalPaye = newReport.totalPaye || 0;
                            const totalCustom = (newReport.customRows || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0);
                            const currentManualTotalRemettre = newReport.isManualTotalRemettre;
                            setNewReport({ 
                              ...newReport, 
                              totalCommission: val,
                              totalRemettre: currentManualTotalRemettre ? newReport.totalRemettre : totalPaye - val - totalCustom
                            });
                          }}
                        />
                      )}
                      {!newReport.commissionInWords && newReport.isManualCommission && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] bg-blue-200 text-blue-800 px-2 py-1 rounded-lg uppercase font-black">Manuel</span>
                      )}
                      {newReport.commissionInWords && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] bg-indigo-200 text-indigo-800 px-2 py-1 rounded-lg uppercase font-black">Lettres</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Total à Remettre</label>
                  <div className="relative">
                    <input
                      type="number"
                      className={`w-full px-5 py-4 border-none rounded-2xl focus:ring-2 outline-none transition-all font-bold ${
                        newReport.isManualTotalRemettre 
                        ? 'bg-green-50 text-green-700 focus:ring-green-500 ring-2 ring-green-200' 
                        : 'bg-gray-50 text-green-700 focus:ring-green-500'
                      }`}
                      value={newReport.totalRemettre || 0}
                      onChange={(e) => setNewReport({ ...newReport, totalRemettre: getSafeNum(e.target.value) })}
                    />
                    {newReport.isManualTotalRemettre && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] bg-green-200 text-green-800 px-2 py-1 rounded-lg uppercase font-black">Manuel</span>
                    )}
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
                      <label className="text-xs font-bold text-orange-400 ml-1 uppercase">Montant</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          className="flex-1 px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                          value={customRowData.value}
                          onChange={(e) => setCustomRowData({ ...customRowData, value: getSafeNum(e.target.value) })}
                        />
                        <input
                          type="text"
                          placeholder="Unité"
                          className="w-20 px-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                          value={customRowData.suffix}
                          onChange={(e) => setCustomRowData({ ...customRowData, suffix: e.target.value })}
                        />
                      </div>
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
                          <span className="text-blue-900 font-mono font-bold">{formatAmount(row.value)}{row.suffix || ' FCFA'}</span>
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
                
                {editingId && (
                  <button 
                    type="button"
                    onClick={async () => {
                      if (window.confirm("Voulez-vous vraiment supprimer ce bilan définitivement ? Cette action est irréversible.")) {
                        try {
                          await handleDeleteReport(editingId);
                          setIsAdding(false);
                          setEditingId(null);
                        } catch (e) {
                          console.error(e);
                        }
                      }
                    }}
                    className="bg-red-100 text-red-700 px-8 py-4 rounded-2xl font-bold hover:bg-red-200 transition-all flex items-center gap-2"
                  >
                    <Trash2 size={20} />
                    Supprimer le Bilan
                  </button>
                )}

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
                      columns: defaultColumns,
                      items: [],
                      totalPaye: 0,
                      totalCommission: 0,
                      totalRemettre: 0,
                      commissionPercentage: 10,
                      arreteSomme: '',
                      date: new Date().toISOString().split('T')[0],
                      villaNumber: '',
                      customRows: [],
                      hideTotalPaye: false,
                      hideCommission: false,
                      title: 'BILAN MENSUEL',
                      isManualTotalRemettre: false,
                      isManualCommission: false,
                      commissionInWords: false,
                      commissionWords: '',
                      forceOnePage: false,
                      hideTotalRemettre: false,
                      hideSignatures: false,
                      hideArrete: false,
                      hideFooter: false,
                      centerText: false,
                      tableFontSize: 'medium',
                      managerTitle: 'La Gérante',
                      bailleurLabel: 'Le BAILLEUR'
                    });
                  }
                }} className="bg-gray-200 text-gray-700 px-8 py-4 rounded-2xl font-bold hover:bg-gray-300 transition-all">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {activeTab === 'bilans' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredReports.map((report) => (
              <div key={report.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-xl transition-all">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center relative">
                      <FileBarChart size={28} />
                      {getUnpaidTenants(report).unpaid.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm" title={`${getUnpaidTenants(report).unpaid.length} locataires n'ont pas encore payé`}>
                          {getUnpaidTenants(report).unpaid.length}
                        </span>
                      )}
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
                        onClick={() => generateMonthlyReportWord(report)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Télécharger Word"
                      >
                        <FileText size={20} />
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
                  
                  {/* Payment Summary Badge */}
                  {(() => {
                    const { unpaid, totalDebt } = getUnpaidTenants(report);
                    if (unpaid.length === 0) {
                      return (
                        <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold mb-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Tout payé
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2 mb-4">
                        <div className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          {unpaid.length} Impayé{unpaid.length > 1 ? 's' : ''}
                        </div>
                        <p className="text-xs font-bold text-red-600">Total dû : {formatAmount(totalDebt)} FCFA</p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowUnpaidDetails({ isOpen: true, report });
                          }}
                          className="text-[10px] font-bold text-red-700 underline hover:text-red-900 transition-colors"
                        >
                          Voir qui n'a pas payé ({unpaid.length})
                        </button>
                      </div>
                    );
                  })()}

                  <div className="space-y-2 text-sm text-gray-500">
                    <p>Commission: {report.commissionInWords ? <span className="text-indigo-600 font-bold italic">"{report.commissionWords}"</span> : `${formatAmount(report.totalCommission)} FCFA`}</p>
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
                    onClick={() => generateMonthlyReportWord(report)}
                    className="w-full text-blue-800 font-bold text-sm flex items-center justify-center gap-2 hover:gap-3 transition-all"
                  >
                    Télécharger Bilan Word <FileText size={16} />
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
                <div className="flex gap-2 bg-gray-150 p-1.5 rounded-2xl max-w-lg">
                  <button
                    onClick={() => setSuiviStatusFilter('all')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                      suiviStatusFilter === 'all' 
                        ? 'bg-white text-blue-900 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Tous ({trackingMetrics.totalCount})
                  </button>
                  <button
                    onClick={() => setSuiviStatusFilter('paid')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                      suiviStatusFilter === 'paid' 
                        ? 'bg-green-600 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-green-600'
                    }`}
                  >
                    Payés ({trackingMetrics.countPaid})
                  </button>
                  <button
                    onClick={() => setSuiviStatusFilter('partial')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                      suiviStatusFilter === 'partial' 
                        ? 'bg-amber-500 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-amber-600'
                    }`}
                  >
                    Partiels ({trackingMetrics.countPartial})
                  </button>
                  <button
                    onClick={() => setSuiviStatusFilter('unpaid')}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                      suiviStatusFilter === 'unpaid' 
                        ? 'bg-red-500 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-red-600'
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
                            <th className="px-8 py-5">Locataire & Propriété</th>
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
                                          p.status === 'paid' ? 'bg-green-500' : p.status === 'partial' ? 'bg-amber-400' : 'bg-red-450'
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
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-450 pointer-events-none" size={16} />
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
                    <p className="font-extrabold text-blue-150 text-base">{selectedTenantPayment.mois}</p>
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
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all font-bold"
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

        {/* Modal for Unpaid Details */}
        <Modal
          isOpen={showUnpaidDetails.isOpen}
          onClose={() => setShowUnpaidDetails({ isOpen: false, report: null })}
          title={`Détails des Impayés - ${showUnpaidDetails.report?.chez} (${showUnpaidDetails.report?.mois})`}
        >
          <div className="space-y-6">
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-red-900 font-bold flex items-center gap-2">
                  <X className="bg-red-500 text-white rounded-full p-1" size={24} />
                  Locataires n'ayant pas payé
                </h4>
                <div className="text-right">
                  <p className="text-xs text-red-600 uppercase font-bold tracking-wider">Total restant dû</p>
                  <p className="text-2xl font-black text-red-700">
                    {showUnpaidDetails.report ? formatAmount(getUnpaidTenants(showUnpaidDetails.report).totalDebt) : 0} FCFA
                  </p>
                </div>
              </div>
              
              <div className="overflow-hidden rounded-2xl border border-red-200">
                <table className="w-full text-left">
                  <thead className="bg-red-100 text-red-800 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Locataire</th>
                      <th className="px-4 py-3 text-right">Loyer Total</th>
                      <th className="px-4 py-3 text-right">Montant Payé</th>
                      <th className="px-4 py-3 text-right">Reste à Payer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {showUnpaidDetails.report && getUnpaidTenants(showUnpaidDetails.report).unpaid.map((item: any, idx: number) => {
                      const loyer = Number(item.loyer) || 0;
                      const paye = Number(item.paye) || 0;
                      const nonPaye = Number(item.nonPaye) || 0;
                      const debt = nonPaye > 0 ? nonPaye : Math.max(0, loyer - paye);
                      
                      return (
                        <tr key={idx} className="hover:bg-red-50 transition-colors">
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {item.prenoms} {item.nom}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">
                            {formatAmount(loyer)} FCFA
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-green-600 font-bold">
                            {formatAmount(paye)} FCFA
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-red-600 font-black bg-red-50/30">
                            {formatAmount(debt)} FCFA
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowUnpaidDetails({ isOpen: false, report: null })}
                className="px-8 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  handleEditClick(showUnpaidDetails.report);
                  setShowUnpaidDetails({ isOpen: false, report: null });
                }}
                className="px-8 py-3 bg-blue-900 text-white rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg"
              >
                Aller au tableau pour modifier
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AdminMonthlyReports;
