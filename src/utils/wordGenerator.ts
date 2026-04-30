import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, AlignmentType, VerticalAlign, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export const generateMonthlyReportWord = async (report: any) => {
  const reportCurrency = report.reportCurrency || ' FCFA';

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "IMMOBILIER SERVICE",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "CITE GABON RUFISQUE / BP 733 RUFISQUE",
                bold: true,
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Tél : 77 551 96 83 - Cité Bata - Rufisque",
                bold: true,
                size: 20,
                color: "00215E",
              }),
            ],
          }),
          new Paragraph({
             text: "",
             spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Chez : ${report.chez || '...'}`,
                bold: true,
                size: 24,
              }),
              new TextRun({
                text: `\t\t\t\t\tMois : ${report.mois || '...'}`,
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
            children: [
              new TextRun({
                text: report.title || 'BILAN MENSUEL',
                bold: true,
                size: 32,
                underline: {},
              }),
            ],
          }),
          
          // Table
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: [
              // Header Row
              new TableRow({
                children: (report.columns || []).map((col: any) => 
                  new TableCell({
                    children: [new Paragraph({ 
                      children: [new TextRun({ text: col.label, bold: true })], 
                      alignment: AlignmentType.CENTER 
                    })],
                    verticalAlign: VerticalAlign.CENTER,
                  })
                ),
              }),
              // Data Rows
              ...(report.items || []).map((item: any) => 
                new TableRow({
                  children: (report.columns || []).map((col: any) => 
                    new TableCell({
                      children: [new Paragraph({ 
                        text: String(item[col.id] || ''), 
                        alignment: col.type === 'number' ? AlignmentType.CENTER : AlignmentType.LEFT 
                      })],
                    })
                  ),
                })
              ),
              // Totals
              ...(report.hideTotalPaye ? [] : [
                new TableRow({
                  children: [
                    new TableCell({
                      columnSpan: Math.max(1, (report.columns || []).length - 1),
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: "TOTAL PAYE", bold: true })], 
                        alignment: AlignmentType.RIGHT 
                      })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: `${report.totalPaye}${reportCurrency}`, bold: true })], 
                        alignment: AlignmentType.CENTER 
                      })],
                    }),
                  ],
                })
              ]),
              ...(report.customRows || []).map((row: any) => 
                new TableRow({
                  children: [
                    new TableCell({
                      columnSpan: Math.max(1, (report.columns || []).length - 1),
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: row.label, bold: true })], 
                        alignment: AlignmentType.RIGHT 
                      })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: `${row.value}${row.suffix || reportCurrency}`, bold: true })], 
                        alignment: AlignmentType.CENTER 
                      })],
                    }),
                  ],
                })
              ),
              ...(report.hideCommission ? [] : [
                new TableRow({
                  children: [
                    new TableCell({
                      columnSpan: Math.max(1, (report.columns || []).length - 1),
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: "Commission", bold: true })], 
                        alignment: AlignmentType.RIGHT 
                      })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ 
                        children: [new TextRun({ 
                          text: report.commissionInWords ? (report.commissionWords || '') : `${report.totalCommission}${reportCurrency}`, 
                          bold: true 
                        })], 
                        alignment: AlignmentType.CENTER 
                      })],
                    }),
                  ],
                })
              ]),
              ...(report.hideTotalRemettre ? [] : [
                new TableRow({
                  children: [
                    new TableCell({
                      columnSpan: Math.max(1, (report.columns || []).length - 1),
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: "Total à remettre", bold: true })], 
                        alignment: AlignmentType.RIGHT 
                      })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: `${report.totalRemettre}${reportCurrency}`, bold: true })], 
                        alignment: AlignmentType.CENTER 
                      })],
                    }),
                  ],
                })
              ]),
            ],
          }),

          new Paragraph({ text: "", spacing: { before: 400 } }),
          
          ...(report.hideArrete ? [] : [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `ARRETE A LA SOMME DE : ${report.arreteSomme || '...'}`,
                  bold: true,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({ text: "", spacing: { before: 400 } }),
          ]),
          
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `Fait à Rufisque, le ${report.date ? new Date(report.date).toLocaleDateString('fr-FR') : '...'}`,
                size: 20,
              }),
            ],
          }),

          ...(report.hideSignatures ? [] : [
            new Paragraph({ text: "", spacing: { before: 400 } }),
            new Paragraph({
              children: [
                new TextRun({
                  text: report.managerTitle || 'La Gérante',
                  bold: true,
                  size: 20,
                }),
                new TextRun({
                  text: `\t\t\t\t\t\t\t${report.bailleurLabel || 'Le BAILLEUR'}`,
                  bold: true,
                  size: 20,
                }),
              ],
            }),
          ]),
          
          ...(report.hideFooter ? [] : [
            new Paragraph({ text: "", spacing: { before: 800 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "CITE GABON RUFISQUE / VILLA N0 137 BP733 Rufisque / coumbafonde@gmail.com / RCCM : SN-DKR.2014-19303 / NINEA : 005265071",
                  size: 16,
                  color: "666666",
                }),
              ],
            }),
          ]),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Bilan_${report.chez}_${report.mois}.docx`);
};
