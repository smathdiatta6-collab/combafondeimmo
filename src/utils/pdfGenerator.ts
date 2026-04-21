import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWordsFrench } from './numberToWords';

const addFooter = (doc: jsPDF, villaNumber: string = '...') => {
  try {
    const pageCount = (doc as any).internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const isA6 = pageWidth < 110; // A6 is 105mm wide
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(isA6 ? 6 : 8);
      doc.setTextColor(100);
      doc.setFont('helvetica', 'normal');
      
      if (isA6) {
        const line1 = `CITE GABON RUFISQUE / VILLA N0 ${villaNumber || '...'} BP733 Rufisque`;
        const line2 = `coumbafonde@gmail.com / RCCM : SN-DKR.2014-19303 / NINEA : 005265071`;
        doc.text(line1, pageWidth / 2, pageHeight - 7, { align: 'center' });
        doc.text(line2, pageWidth / 2, pageHeight - 4, { align: 'center' });
      } else {
        const footerText = `CITE GABON RUFISQUE / VILLA N0 ${villaNumber || '...'} BP733 Rufisque / coumbafonde@gmail.com / RCCM : SN-DKR.2014-19303 / NINEA : 005265071`;
        doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });
      }
    }
  } catch (error) {
    console.error('Error adding footer:', error);
  }
};

const drawLogo = (doc: jsPDF, x: number, y: number, scale: number = 1) => {
  const orange = [249, 115, 22]; // #F97316
  const blue = [0, 33, 94];    // #00215E

  // Roof
  doc.setDrawColor(orange[0], orange[1], orange[2]);
  doc.setLineWidth(1.8 * scale);
  doc.line(x + (2 * scale), y + (10 * scale), x + (12 * scale), y + (2 * scale));
  doc.line(x + (12 * scale), y + (2 * scale), x + (22 * scale), y + (10 * scale));
  
  // Chimney
  doc.line(x + (17 * scale), y + (4.5 * scale), x + (17 * scale), y + (6.5 * scale));

  // C Shape and Bottom Line
  doc.setDrawColor(blue[0], blue[1], blue[2]);
  doc.setLineWidth(2.0 * scale);
  // Simplified C shape using lines and arcs
  doc.ellipse(x + (10 * scale), y + (13.5 * scale), 6 * scale, 5 * scale, 'S');
  doc.line(x + (16 * scale), y + (18.5 * scale), x + (33 * scale), y + (18.5 * scale));

  // Window
  doc.setFillColor(blue[0], blue[1], blue[2]);
  doc.rect(x + (8 * scale), y + (11 * scale), 2.2 * scale, 2.2 * scale, 'F');
  doc.rect(x + (10.8 * scale), y + (11 * scale), 2.2 * scale, 2.2 * scale, 'F');
  doc.rect(x + (8 * scale), y + (13.8 * scale), 2.2 * scale, 2.2 * scale, 'F');
  doc.rect(x + (10.8 * scale), y + (13.8 * scale), 2.2 * scale, 2.2 * scale, 'F');

  // Text
  doc.setTextColor(blue[0], blue[1], blue[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14 * scale);
  doc.text('COUMBA FONDE', x + (15 * scale), y + (16.5 * scale));
  doc.setFontSize(8 * scale);
  doc.text('IMMO', x + (33.5 * scale), y + (22.5 * scale));
};

const safeToLocaleString = (val: any) => {
  const num = Number(val);
  if (isNaN(num)) return '0';
  // Use dots as thousand separators
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const generateReceiptPDF = (receipt: any, contract?: any, paymentMethod?: any) => {
  try {
    // A5 format: 148 x 210 mm (Portrait)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    
    // Draw Outer Border
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2));
    
    // --- MAIN CONTENT AREA ---
    const mainX = margin + 10;
    const mainContentWidth = pageWidth - (margin * 2) - 10;
    let currentY = margin + 5;
    
    // Logo and Agency Info (Centered)
    const logoScale = 0.35;
    const logoWidth = 60 * logoScale;
    drawLogo(doc, (pageWidth - logoWidth) / 2, currentY, logoScale);
    
    currentY += 12;
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(0, 33, 94);
    doc.text('Tél : 77 551 96 83', pageWidth / 2, currentY, { align: 'center' });
    doc.setTextColor(0);

    // Total Amount (Clearly separated)
    const totalAmount = (receipt.amount || 0) + (receipt.prestations || 0) + (receipt.timbre || 0);
    currentY += 15;
    doc.setFontSize(12);
    doc.setFont('times', 'bold');
    doc.text(`MONTANT : ${safeToLocaleString(totalAmount)} FCFA`, pageWidth - margin - 10, currentY, { align: 'right' });
    
    currentY += 12;
    
    // Title
    doc.setFontSize(16);
    doc.setFont('times', 'bold');
    doc.text('QUITTANCE DE LOYER', pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 15;
    doc.setFontSize(12);
    doc.setFont('times', 'normal');
    const lineSpacing = 12;

    // Reçu de M.
    doc.text(`Reçu de M.`, mainX, currentY);
    doc.setFont('times', 'bold');
    doc.text(receipt.clientName || '................................................', mainX + 25, currentY);
    
    currentY += lineSpacing;
    
    // La somme de
    doc.setFont('times', 'normal');
    doc.text(`la somme de`, mainX, currentY);
    doc.setFont('times', 'italic');
    const amountWords = receipt.amountInWords || numberToWordsFrench(totalAmount);
    const splitWords = doc.splitTextToSize(amountWords, mainContentWidth - 30);
    doc.text(splitWords, mainX + 30, currentY);
    
    const wordsLines = splitWords.length;
    currentY += (wordsLines * 6);
    doc.setFont('times', 'normal');
    doc.text(`de loyer des locaux qu'il occupe`, mainX, currentY);
    
    currentY += lineSpacing;
    
    // Période
    doc.text(`pour la période de :`, mainX, currentY);
    doc.setFont('times', 'bold');
    doc.text(receipt.periodLabel || 'un mois', mainX + 35, currentY);
    
    currentY += lineSpacing;
    
    // Locaux
    const address = receipt.propertyAddress || contract?.propertyAddress || '................................................';
    doc.text(`dans la maison située à :`, mainX, currentY);
    currentY += 7;
    doc.setFont('times', 'bold');
    doc.text(address, mainX, currentY);
    
    currentY += lineSpacing;
    
    // Period
    const pStart = receipt.periodStart ? new Date(receipt.periodStart).toLocaleDateString('fr-FR') : '.......';
    const pEnd = receipt.periodEnd ? new Date(receipt.periodEnd).toLocaleDateString('fr-FR') : '.......';
    doc.setFont('times', 'normal');
    doc.text(`le dit commençant le ${pStart}`, mainX, currentY);
    currentY += 7;
    doc.text(`et finissant le ${pEnd}`, mainX, currentY);
    
    currentY += 15;
    
    // Bottom section
    doc.setFont('times', 'bold');
    doc.text('DONT QUITTANCE', pageWidth / 2, currentY, { align: 'center' });
    
    const formattedDate = receipt.date ? new Date(receipt.date).toLocaleDateString('fr-FR') : '...... / ...... / 20......';
    doc.setFont('times', 'normal');
    currentY += 10;
    doc.text(`Fait à Rufisque, le ${formattedDate}`, pageWidth - margin - 10, currentY, { align: 'right' });
    
    doc.save(`Quittance_${receipt.clientName || 'Client'}_${receipt.date || 'Date'}.pdf`);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    alert('Erreur lors de la génération de la quittance PDF.');
  }
};

export const generateContractPDF = (contract: any) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let y = 15;

    // Header - Agency Logo
    const logoScale = 0.5;
    const logoWidth = 60 * logoScale;
    drawLogo(doc, (pageWidth - logoWidth) / 2, y, logoScale);
    y += 18;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 33, 94);
    doc.text('Tél : 77 551 96 83', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Agency Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Agence Immobilière - Gestion Locative - Vente - Conseil', pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Contract Title Box
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentWidth, 12);
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(`CONTRAT DE ${contract.type?.toUpperCase() || 'LOCATION'}`, pageWidth / 2, y + 8, { align: 'center' });
    y += 25;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');

    const addText = (text: string, isBold: boolean = false, spacing: number = 8) => {
      if (y > 270) {
        addFooter(doc, contract.villaNumber);
        doc.addPage();
        y = 25;
      }
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(14);
      const splitText = doc.splitTextToSize(text, contentWidth);
      
      // Use justified alignment for longer paragraphs
      if (splitText.length > 1 && !isBold) {
        doc.text(splitText, margin, y, { align: 'justify', maxWidth: contentWidth });
      } else {
        doc.text(splitText, margin, y);
      }
      
      y += (splitText.length * spacing);
    };

    const addSectionTitle = (title: string) => {
      y += 6;
      doc.setDrawColor(200);
      doc.setLineWidth(0.1);
      doc.line(margin, y + 1, margin + 40, y + 1);
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text(title, margin, y);
      y += 8;
      doc.setTextColor(0);
      doc.setFontSize(14);
    };

    // Parties
    addSectionTitle('ENTRE LES SOUSSIGNÉS :');
    addText(`D'une part : ${contract.bailleurName || '(Prénom et nom du Bailleur)'}`, true);
    addText(`Représenté par Madame Mariama BA, la gérante de CFI (COUMBA FODE IMMO) CIN N° 2 286 1992 06207, demeurant à la cité Gabon Rufisque, Villa N° 137.`);
    y += 4;
    addText(`D'autre part :`, true);
    addText(`Le Preneur : ${contract.clientName || '................................'}`, true);
    addText(`CNI N° : ${contract.clientCNI || '................................'}`);
    addText(`TEL : ${contract.clientPhone || '................................'}`);
    y += 8;

    // Objet
    addSectionTitle('OBJET ET DURÉE :');
    addText(`Le preneur s'engage à prendre en location les locaux à usage D'HABITATION dont la désignation est : ${contract.propertyDesignation || '................................'} sise à ${contract.propertyAddress || 'la cité BATA'}.`);
    if (contract.nbNote) addText(`NB : ${contract.nbNote}`, true);
    y += 4;

    addText(`Cette location qui prend effet à partir du ${contract.startDate || '................'} se termine en ${contract.endDate || '................'}.`);
    addText(`Le présent contrat à durée déterminée de ${contract.duration || '................'} est renouvelable par tacite reconduction.`);
    y += 4;

    // Price
    addSectionTitle('LOYER ET CONDITIONS DE PAIEMENT :');
    addText(`La location est consentie au prix de ${contract.priceInWords || '................'} (${safeToLocaleString(contract.price)} FCFA) par mois, payable par terme mensuel et d'avance au plus tard le 05 de chaque mois.`);
    addText(`Tout mois commencé est dû dans son intégralité par le locataire.`);
    addText(`Le loyer est portable et non quérable dans les bureaux de l'agence immobilière :`);
    addText(`Sis à Cité BATA Rufisque en face AVISEN.`, true);
    addText(`TOUT locataire qui dépasse la date limite du paiement sera tenu de payer une amende de trois mille francs (3000 FCFA) représentant les frais de déplacement des agents.`);
    y += 4;

    // Etat des lieux
    addSectionTitle('ÉTAT DES LIEUX :');
    addText(`Le preneur reconnaît par la présente prendre les lieux loués en bon état de réparations locatives et s'engage en conséquence à les rendre, au moment de son départ, en parfait état d'entretien, conformément à l'état des lieux dressé contradictoirement entre les parties.`);
    y += 4;

    // Engagements
    addSectionTitle('ENGAGEMENTS DU PRENEUR :');
    addText(`Il s'engage formellement à acquitter exactement, pendant toute la durée de son occupation, les factures d'eau, d'électricité, les ordures ménagères et la vidange des fosses septiques de manière à ce qu'aucun recours ne puisse être exercé à cet égard contre l'agence immobilière ou le propriétaire.`);
    addText(`Il s'engage à satisfaire toutes les charges de voirie, de police et d'hygiène qui lui incombent afin qu'aucun recours ne puisse être exercé à cet égard contre l'agence immobilière ou le propriétaire.`);
    addText(`L'enregistrement du présent bail est à la charge du locataire.`);
    y += 4;

    // Caution
    addSectionTitle('CAUTION :');
    addText(`Le preneur verse à titre de caution une avance de 300 000 FRANCS CFA (TROIS CENT MILLE FRANCS CFA) équivalent à deux mois de loyer.`);
    addText(`Cette somme, non productive d'intérêts, ne sera remboursée qu'après :`);
    const cautionPoints = [
      "Avoir restitué les lieux loués en parfait état locatif (notamment la révision de l'installation de plomberie, de l'électricité, la réfection des peintures et dans tous les cas la remise des clefs).",
      "Avoir obtenu de la Sen'Eau un quitus attestant le paiement des factures pendant la période d'occupation et jusqu'au jour du constat de départ.",
      "Avoir rapporté la preuve de la résiliation de son contrat d'électricité.",
      "Avoir payé son loyer jusqu'à la date échue du préavis ou du mois de la remise des clefs si celle-ci est postérieure au préavis.",
      "Avoir repris la peinture (l'appartement que vous venez de louer a été entièrement repeint)."
    ];
    cautionPoints.forEach(p => addText(`- ${p}`, false, 5));
    addText(`À défaut, il sera prélevé sur ladite caution les sommes correspondantes aux frais de remise en état des lieux ainsi que le montant des factures d'eau, d'électricité et de téléphone non réglées.`);
    addText(`Il demeure bien entendu que ces formalités de remise en état et la réalisation des travaux devront être effectuées pendant la période du préavis.`);
    y += 4;

    addText(`L'attention du ou des preneurs a été particulièrement attirée sur la teneur des articles ci-dessous cités :`, true);
    y += 4;

    // Articles
    const articles = [
      { t: 'ARTICLE 1 :', c: 'Le prix du loyer du présent contrat de location a été revu à la baisse en référence à la nouvelle loi relative à la réduction du prix du loyer.' },
      { t: 'ARTICLE 2 :', c: 'Le preneur est tenu à quatre (04) obligations principales :\n- D\'user de la chose louée en bon locataire suivant la destination qui lui a été donnée par le bail ou suivant celle présumée d\'après les circonstances à défaut de convention.\n- De payer le loyer aux termes convenus.\n- De veiller à ne pas troubler la jouissance paisible des voisins par le bruit, la fumée ou tout autre agissement de son fait ou du fait de tous occupants de son chef.\n- La participation au nettoyage des parties communes.' },
      { t: 'ARTICLE 3 :', c: 'S\'il n\'a pas été fait d\'état des lieux, le preneur est présumé les avoir reçus en bon état de réparations locatives et devra les rendre tels qu\'il les a trouvés au moment de la prise des clés, sauf preuve du contraire.' },
      { t: 'ARTICLE 4 :', c: 'Le preneur répond de l\'incendie à moins qu\'il ne prouve que l\'incendie soit arrivé par cas fortuit ou force majeure ou par vice de construction.' },
      { t: 'ARTICLE 5 :', c: 'Le preneur répond des dégradations qui surviennent pendant sa jouissance des lieux à moins qu\'il ne prouve qu\'elles ne sont pas de son fait. En conséquence des articles ci-dessus, le preneur accepte que toutes les détériorations, quelles qu\'elles soient, et notamment les carreaux cassés, les clefs perdues, les murs tachés, les grillages moustiquaires cassés ou déchirés, etc., soient à sa charge. Un état des lieux sera dressé avant son départ. Il devra verser une provision suffisante pour couvrir les réparations qui seront jugées nécessaires et qui lui seront imputables.\nIl est rappelé que les frais de débouchage de toutes les canalisations, notamment celles du tout-à-l\'égout, sont toujours à la charge du locataire.\nPour garantir le recours du propriétaire en cas d\'incendie, le preneur s\'engage à assurer ses risques locatifs ainsi que les objets garnissant les lieux loués auprès d\'une Compagnie d\'Assurance notoirement solvable au moment de son entrée en jouissance.\nLe preneur s\'interdit de sous-louer ou de céder son droit au présent contrat sans en référer au propriétaire ou à son représentant suivant les dispositions de la loi n° 66-70 du 13 juillet 1966.' },
      { t: 'ARTICLE 6 :', c: 'Chacune des deux parties a la faculté de dénoncer le présent engagement à tout moment par lettre recommandée six (6) mois à l\'avance pour le bailleur ou par exploit d\'huissier, et deux (2) mois pour le preneur.\nLorsque le preneur aura reçu ou donné congé, le bailleur pourra faire mettre un écriteau à l\'emplacement de son choix indiquant que les lieux sont à louer. Le preneur devra laisser visiter les lieux les jours ouvrables sans rendez-vous au moins 3 fois par semaine. Il en serait de même en cas de mise en vente des locaux.' },
      { t: 'ARTICLE 7 :', c: 'Le bailleur aura la faculté de faire expulser le locataire avec l\'appui d\'un huissier de justice en cas de non-respect des clauses du contrat.\nLe bailleur peut rompre le présent contrat à tout moment si le locataire ne respecte pas ses obligations : troubles de voisinage, travaux de transformation effectués sans autorisation, défaut d\'entretien du logement.' }
    ];

    articles.forEach(art => {
      addText(art.t, true, 5);
      addText(art.c, false, 5);
      y += 2;
    });

    // Clause Resolutoire
    addSectionTitle('CLAUSE RÉSOLUTOIRE :');
    addText(`À défaut de paiement à son échéance d'un seul terme de loyer ou d'inexécution de l'une des conditions qui précèdent, le présent contrat sera résilié de plein droit trente jours après un simple commandement de paiement ou de mise en demeure resté sans effet, sans qu'il soit besoin de remplir d'autres formalités judiciaires. Une simple ordonnance de référé autorisant l'expulsion, et nonobstant toutes offres ou consignations ultérieures, attribution de juridiction est donnée au président du tribunal statuant en référé pour ordonner dans ce cas l'expulsion du locataire.`);
    addText(`Le locataire s'engage à payer sa consommation d'eau après un partage proportionnel de la consommation totale. Tout locataire qui occasionne une coupure en ne payant pas à temps sa part de facture sera tenu de payer les frais de rétablissement. En cas de procédure, les frais de celle-ci et les honoraires de l'avocat sont à la charge du locataire.`);
    y += 15;

    // Signatures
    if (y > 240) {
      addFooter(doc, contract.villaNumber);
      doc.addPage();
      y = 30;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('LA GÉRANTE', margin + 20, y);
    doc.text('LE PRENEUR', pageWidth - margin - 50, y);
    
    y += 25;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    const contractDate = contract.date ? new Date(contract.date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    doc.text(`Fait à RUFISQUE, le ${contractDate}`, pageWidth - margin, y, { align: 'right' });

    addFooter(doc, contract.villaNumber);
    
    doc.save(`Contrat_${contract.clientName || 'Client'}_${contract.type || 'Type'}.pdf`);
  } catch (error) {
    console.error('Error generating contract PDF:', error);
    alert('Erreur lors de la génération du contrat PDF.');
  }
};

export const generateMonthlyReportPDF = (report: any) => {
  try {
    const doc = new jsPDF();
    
    // Header with Logo
    const logoScale = 0.5;
    const logoWidth = 60 * logoScale;
    drawLogo(doc, (210 - logoWidth) / 2, 10, logoScale);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 33, 94);
    doc.text('Tél : 77 551 96 83', 105, 32, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Chez : ${report.chez || '...'}`, 20, 48);
    doc.text(`Mois : ${report.mois || '...'}`, 150, 48);
    
    doc.setFontSize(16);
    doc.text('BILAN MENSUEL', 105, 63, { align: 'center' });
    
    // Table
    const columns = report.columns || [
      { id: 'prenoms', label: 'Prénoms', type: 'text' },
      { id: 'nom', label: 'Nom', type: 'text' },
      { id: 'montantLoyer', label: 'Loyer', type: 'number' },
      { id: 'montantPaye', label: 'Payé', type: 'number' },
      { id: 'montantNonPaye', label: 'Non Payé', type: 'number' },
    ];

    const tableHead = [columns.map((col: any) => col.label)];
    const tableBody = (report.items || []).map((item: any) => 
      columns.map((col: any) => {
        const val = item[col.id];
        return col.type === 'number' ? `${safeToLocaleString(val)} FCFA` : (val || '');
      })
    );

    // Add totals as rows in the table
    const totalPaye = report.totalPaye !== undefined ? report.totalPaye : (report.items || []).reduce((sum: number, item: any) => sum + (Number(item.montantPaye) || 0), 0);
    const colSpan = Math.max(1, columns.length - 2);
    
    if (!report.hideTotalPaye) {
      tableBody.push([
        { content: 'TOTAL', colSpan: colSpan, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `${safeToLocaleString(totalPaye)} FCFA`, colSpan: columns.length - colSpan, styles: { fontStyle: 'bold' } }
      ]);
    }

    if (!report.hideCommission) {
      tableBody.push([
        { content: 'Commission', colSpan: colSpan, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `${safeToLocaleString(report.totalCommission)} FCFA`, colSpan: columns.length - colSpan, styles: { fontStyle: 'bold' } }
      ]);
    }

    // Add custom rows if any
    if (report.customRows && Array.isArray(report.customRows) && report.customRows.length > 0) {
      report.customRows.forEach((row: any) => {
        if (row && row.label) {
          tableBody.push([
            { content: row.label, colSpan: colSpan, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: `${safeToLocaleString(row.value)} FCFA`, colSpan: columns.length - colSpan, styles: { fontStyle: 'bold' } }
          ]);
        }
      });
    }

    tableBody.push([
      { content: 'Total à remettre', colSpan: colSpan, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: `${safeToLocaleString(report.totalRemettre)} FCFA`, colSpan: columns.length - colSpan, styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: 65,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 58, 138], 
        halign: 'center', 
        fontStyle: 'bold',
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      styles: { 
        fontSize: 10, 
        cellPadding: 3,
        lineWidth: 0.5,
        lineColor: [0, 0, 0]
      },
      columnStyles: columns.reduce((acc: any, col: any, idx: number) => {
        if (col.type === 'number') {
          acc[idx] = { halign: 'right' };
        }
        return acc;
      }, {})
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const arreteText = `ARRETE A LA SOMME DE : ${report.arreteSomme || '...'}`;
    const splitArrete = doc.splitTextToSize(arreteText, 170);
    doc.text(splitArrete, 20, finalY + 15);
    
    doc.setFont('helvetica', 'normal');
    const pageWidth = doc.internal.pageSize.getWidth();
    const formattedReportDate = report.date ? new Date(report.date).toLocaleDateString('fr-FR') : '...';
    doc.text(`Fait à Rufisque, le ${formattedReportDate}`, pageWidth - 20, finalY + 30, { align: 'right' });
    
    doc.text('La Gérante', 40, finalY + 45);
    doc.text('Le BAILLEUR', 140, finalY + 45);
    
    addFooter(doc, report.villaNumber);
    
    doc.save(`Bilan_${report.chez || 'Bailleur'}_${report.mois || 'Mois'}.pdf`);
  } catch (error) {
    console.error('Error generating monthly report PDF:', error);
    alert('Erreur lors de la génération du bilan PDF.');
  }
};
