import React, { useState, useEffect } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { FileBarChart, Trash2, Plus, Minus, ArrowLeft, Download, UserPlus, X, Edit2, Search, Copy, Settings, ChevronUp, ChevronDown, Receipt, FileText } from 'lucide-react';
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

  const defaultColumns: Column[] = [
    { id: 'prenoms', label: 'Prénoms', type: 'text' },
    { id: 'nom', label: 'Nom', type: 'text' },
    { id: 'loyer', label: 'Loyer', type: 'number' },
    { id: 'paye', label: 'Payé', type: 'number' },
    { id: 'nonPaye', label: 'Non Payé', type: 'number', formula: 'loyer - paye' },
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
    const words = numberToWordsFrench(newReport.totalRemettre);
    const formatted = newReport.totalRemettre.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
      const words = numberToWordsFrench(updated.totalRemettre);
      const formatted = updated.totalRemettre.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      const currency = updated.reportCurrency?.trim() || 'FCFA';
      
      return {
        ...updated,
        arreteSomme: `${words} ${currency} (${formatted})`
      };
    });
    alert("Calcul automatique effectué pour les loyers, commissions et totaux.");
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
    // First, update any formula columns in items
    const updatedItems = report.items.map(item => {
      let newItem = { ...item };
      report.columns.forEach(col => {
        if (col.formula && col.type === 'number') {
          // Pass current item values to evaluateFormula
          newItem[col.id] = evaluateFormula(col.formula, newItem);
        }
      });
      return newItem;
    });

    // Dynamically find the column to use for paye (defaulting to 'paye' ID)
    const payeCol = report.columns.find(c => c.id === 'paye' || c.label.toLowerCase() === 'payé' || c.label.toLowerCase() === 'paye');
    const payeId = payeCol ? payeCol.id : 'paye';
    
    const totalPaye = updatedItems.reduce((sum, item) => sum + getSafeNum(item[payeId]), 0);
    const commission = Math.round(totalPaye * (report.commissionPercentage / 100));
    const totalCustom = (report.customRows || []).reduce((sum, row) => sum + getSafeNum(row.value), 0);
    
    const effectiveCommission = report.hideCommission ? 0 : (report.isManualCommission ? report.totalCommission : commission);
    const calculatedTotalRemettre = totalPaye - effectiveCommission - totalCustom;
    
    return {
      ...report,
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

  const formatAmount = (val: number) => {
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
                                  <div className="relative">
                                    <input
                                      type="text"
                                      className={`w-full border border-transparent hover:border-blue-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-xl px-3 py-2 transition-all ${
                                        isMergeMode ? 'pointer-events-none' : ''
                                      } ${
                                        col.type === 'number' && !newReport.centerText ? 'text-right' : 
                                        newReport.centerText ? 'text-center' : 'text-left'
                                      } ${col.type === 'number' ? 'font-mono font-bold text-blue-900' : 'text-gray-700'} ${
                                        col.formula ? 'bg-gray-100 cursor-not-allowed opacity-80' : 'bg-white/50'
                                      } ${
                                        newReport.tableFontSize === 'small' ? 'text-xs px-2 py-1' : 
                                        newReport.tableFontSize === 'large' ? 'text-base py-3' : 'text-sm'
                                      }`}
                                      value={item[col.id] ?? (col.type === 'number' ? 0 : '')}
                                      readOnly={!!col.formula || isMergeMode}
                                      placeholder={col.formula ? `[Calculé]` : ''}
                                      onChange={(e) => {
                                        const updatedItems = [...newReport.items];
                                        const rawVal = e.target.value;
                                        updatedItems[idx] = { 
                                          ...updatedItems[idx], 
                                          [col.id]: rawVal
                                        };
                                        setNewReport(prev => ({ ...prev, items: updatedItems }));
                                      }}
                                      onBlur={(e) => {
                                        if (col.type === 'number' && !col.formula) {
                                          const rawVal = e.target.value;
                                          let finalVal: any = rawVal;
                                          
                                          // If it contains math operators, evaluate it
                                          if (rawVal && (rawVal.includes('+') || rawVal.includes('-') || rawVal.includes('*') || rawVal.includes('/'))) {
                                            finalVal = evaluateFormula(rawVal, {});
                                          } else {
                                            finalVal = rawVal === '' ? '' : getSafeNum(rawVal);
                                          }
                                          
                                          setNewReport(prev => {
                                            const updatedItems = [...prev.items];
                                            updatedItems[idx] = { ...updatedItems[idx], [col.id]: finalVal };
                                            return updateReportTotals({ ...prev, items: updatedItems });
                                          });
                                        } else {
                                          setNewReport(prev => updateReportTotals(prev));
                                        }
                                      }}
                                    />
                                    
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
