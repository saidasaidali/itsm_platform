// backend/src/utils/pdfGenerator.js
import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';
import { Chart } from 'chart.js';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR = path.join(process.cwd(), 'reports');
const LOGO_PATH = path.join(process.cwd(), 'public', 'logo.png');

// Ensure reports directory exists
async function ensureReportsDir() {
  try {
    await fs.access(REPORTS_DIR);
  } catch {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  }
}

// Generate chart as PNG buffer
export async function generateChartImage(chartConfig, width = 800, height = 400) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      new Chart(ctx, {
        ...chartConfig,
        type: chartConfig.type,
        data: chartConfig.data,
        options: {
          ...chartConfig.options,
          responsive: false,
          maintainAspectRatio: false,
        }
      });

      const buffer = canvas.toBuffer('image/png');
      resolve(buffer);
    } catch (err) {
      reject(err);
    }
  });
}

// Add page numbers to PDF
function addPageNumbers(doc) {
  const totalPages = doc.bufferedPageRange().start + doc.bufferedPageRange().length;

  for (let i = 1; i <= totalPages; i++) {
    doc.switchToPage(i - 1);
    doc.fontSize(9)
       .fillColor('gray')
       .text(`Page ${i} / ${totalPages}`, doc.page.width - 100, doc.page.height - 30, {
         width: 80,
         align: 'center'
       });
  }
}

// Main PDF generation function
export async function generateReportPDF(reportData) {
  await ensureReportsDir();

  const filename = `report_${reportData.type}_${Date.now()}.pdf`;
  const filepath = path.join(REPORTS_DIR, filename);

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(filepath);
      doc.pipe(stream);

      // ── Cover Page ─────────────────────────────────────────────────────────
      doc.fontSize(28)
         .font('Helvetica-Bold')
         .text('ITSM Platform', { align: 'center' });

      doc.fontSize(22)
         .text('Rapport d\'Analyse', { align: 'center' })
         .moveDown();

      doc.fontSize(16)
         .font('Helvetica')
         .text(`${reportData.type === 'monthly' ? 'Mensuel' : reportData.type === 'weekly' ? 'Hebdomadaire' : 'Personnalisé'}`, { align: 'center' })
         .moveDown();

      doc.fontSize(12)
         .fillColor('gray')
         .text(`Période: ${reportData.period_start} au ${reportData.period_end}`, { align: 'center' })
         .text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' })
         .moveDown(3);

      // Add logo if exists
      if (reportData.logo) {
        try {
          doc.image(reportData.logo, { fit: [150, 150], align: 'center' });
        } catch (err) {
          console.warn('Logo not found, skipping');
        }
      }

      doc.addPage();

      // ── Executive Summary ──────────────────────────────────────────────────
      if (reportData.executiveSummary) {
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('Résumé Exécutif', { underline: true })
           .moveDown();

        doc.fontSize(11)
           .font('Helvetica')
           .text(reportData.executiveSummary, { align: 'justify' })
           .moveDown(2);

        doc.addPage();
      }

      // ── Ticket Analytics ───────────────────────────────────────────────────
      if (reportData.tickets) {
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('Analytique des Tickets', { underline: true })
           .moveDown();

        // Summary table
        doc.fontSize(12).font('Helvetica-Bold');
        const ticketStats = [
          ['Total Tickets', reportData.tickets.total.toString()],
          ['Tickets Ouverts', reportData.tickets.open.toString()],
          ['Tickets Fermés', reportData.tickets.closed.toString()],
          ['Temps Moyen de Résolution', `${reportData.tickets.avgResolutionTime}h`],
          ['Taux de Conformité SLA', `${reportData.tickets.slaCompliance}%`],
        ];

        drawTable(doc, ticketStats, 200);
        doc.moveDown(2);

        // Ticket evolution indicator (percentage change)
        if (reportData.tickets.evolution !== undefined) {
          doc.fontSize(14).text('Évolution des Tickets', { underline: true }).moveDown();
          const evolutionText = reportData.tickets.evolution > 0
            ? `+${reportData.tickets.evolution}%`
            : `${reportData.tickets.evolution}%`;
          const evolutionColor = reportData.tickets.evolution > 0 ? 'red' : 'green';
          doc.fontSize(12)
             .fillColor(evolutionColor)
             .text(`Évolution vs période précédente: ${evolutionText}`, { align: 'center' })
             .fillColor('black');
          doc.moveDown(2);
        }

        // Tickets by category
        if (reportData.tickets.byCategory && reportData.tickets.byCategory.length > 0) {
          doc.fontSize(14).text('Tickets par Catégorie', { underline: true }).moveDown();
          try {
            const categoryBuffer = await generateChartImage({
              type: 'doughnut',
              data: {
                labels: reportData.tickets.byCategory.map(c => c.category),
                datasets: [{
                  data: reportData.tickets.byCategory.map(c => c.count),
                  backgroundColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 206, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)',
                  ]
                }]
              }
            }, 450, 250);
            doc.image(categoryBuffer, { fit: [450, 250], align: 'center' });
          } catch (err) {
            console.warn('Failed to generate category chart:', err.message);
          }
          doc.moveDown(2);
        }

        doc.addPage();
      }

      // ── Asset Analytics ────────────────────────────────────────────────────
      if (reportData.assets) {
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('Analytique des Équipements', { underline: true })
           .moveDown();

        const assetStats = [
          ['Total Équipements', reportData.assets.total.toString()],
          ['Équipements en Service', reportData.assets.inService.toString()],
          ['Équipements en Panne', reportData.assets.broken.toString()],
          ['Taux de Disponibilité', `${reportData.assets.availability}%`],
        ];

        drawTable(doc, assetStats, 200);
        doc.moveDown(2);

        // Assets by type chart
        if (reportData.assets.byType && reportData.assets.byType.length > 0) {
          doc.fontSize(14).text('Équipements par Type', { underline: true }).moveDown();
          try {
            const typeBuffer = await generateChartImage({
              type: 'pie',
              data: {
                labels: reportData.assets.byType.map(t => t.type),
                datasets: [{
                  data: reportData.assets.byType.map(t => t.count),
                  backgroundColor: [
                    'rgb(255, 99, 132)',
                    'rgb(54, 162, 235)',
                    'rgb(255, 206, 86)',
                    'rgb(75, 192, 192)',
                  ]
                }]
              }
            }, 450, 250);
            doc.image(typeBuffer, { fit: [450, 250], align: 'center' });
          } catch (err) {
            console.warn('Failed to generate type chart:', err.message);
          }
          doc.moveDown(2);
        }

        // High-risk assets
        if (reportData.assets.highRisk && reportData.assets.highRisk.length > 0) {
          doc.fontSize(14).text('Équipements à Haut Risque', { underline: true }).moveDown();
          doc.fontSize(11).text('Équipements nécessitant une attention immédiate:', { fillColor: 'red' }).moveDown();

          const riskTable = reportData.assets.highRisk.map(asset => [
            asset.asset_tag,
            asset.type,
            asset.risk_level,
            `${asset.risk_score}/100`
          ]);
          drawTable(doc, [['Tag', 'Type', 'Niveau', 'Score'], ...riskTable], 400);
          doc.moveDown(2);
        }

        doc.addPage();
      }

      // ── Technician Performance ─────────────────────────────────────────────
      if (reportData.technicians) {
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('Performance des Techniciens', { underline: true })
           .moveDown();

        if (reportData.technicians.length > 0) {
          const techTable = reportData.technicians.map(tech => [
            tech.username,
            tech.assigned.toString(),
            tech.resolved.toString(),
            `${tech.avgResolutionTime}h`,
            `${tech.workload}%`
          ]);
          drawTable(doc, [['Technicien', 'Assignés', 'Résolus', 'Temps Moyen', 'Charge'], ...techTable], 450);
        }
        doc.moveDown(2);

        // Technician workload chart
        if (reportData.technicians.length > 0) {
          doc.fontSize(14).text('Charge de Travail', { underline: true }).moveDown();
          try {
            const workloadBuffer = await generateChartImage({
              type: 'bar',
              data: {
                labels: reportData.technicians.map(t => t.username),
                datasets: [{
                  label: 'Tickets Assignés',
                  data: reportData.technicians.map(t => t.assigned),
                  backgroundColor: 'rgb(54, 162, 235)'
                }]
              }
            }, 500, 250);
            doc.image(workloadBuffer, { fit: [500, 250], align: 'center' });
          } catch (err) {
            console.warn('Failed to generate workload chart:', err.message);
          }
        }
        doc.addPage();
      }

      // ── AI Analytics ───────────────────────────────────────────────────────
      if (reportData.ai) {
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('Analytique IA', { underline: true })
           .moveDown();

        // Sentiment distribution
        if (reportData.ai.sentiment) {
          doc.fontSize(14).text('Distribution des Sentiments', { underline: true }).moveDown();
          try {
            const sentimentBuffer = await generateChartImage({
              type: 'pie',
              data: {
                labels: ['Positif', 'Neutre', 'Négatif', 'Critique'],
                datasets: [{
                  data: [
                    reportData.ai.sentiment.positive || 0,
                    reportData.ai.sentiment.neutral || 0,
                    reportData.ai.sentiment.negative || 0,
                    reportData.ai.sentiment.critical || 0
                  ],
                  backgroundColor: [
                    'rgb(75, 192, 192)',
                    'rgb(201, 203, 207)',
                    'rgb(255, 99, 132)',
                    'rgb(153, 102, 255)'
                  ]
                }]
              }
            }, 450, 250);
            doc.image(sentimentBuffer, { fit: [450, 250], align: 'center' });
          } catch (err) {
            console.warn('Failed to generate sentiment chart:', err.message);
          }
          doc.moveDown(2);
        }

        // AI Stats table
        if (reportData.ai.stats) {
          const aiStats = [
            ['Prédictions Maintenance', reportData.ai.stats.predictiveMaintenance.toString()],
            ['Actifs à Haut Risque', reportData.ai.stats.highRiskAssets.toString()],
            ['Incidents Sécurité', reportData.ai.stats.securityIncidents.toString()],
            ['Utilisation Chatbot', reportData.ai.stats.chatbotUsage.toString()],
            ['Articles KB Consultés', reportData.ai.stats.kbUsage.toString()],
          ];
          drawTable(doc, aiStats, 250);
        }
        doc.addPage();
      }

      // ── Footer ─────────────────────────────────────────────────────────────
      addPageNumbers(doc);

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        resolve(filepath);
      });

      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

// Helper function to draw tables
function drawTable(doc, rows, rowHeight = 30) {
  const tableTop = doc.y;
  const colWidth = doc.page.width - 100;
  const colCount = rows[0].length;
  const cellWidth = colWidth / colCount;

  // Header
  doc.rect(50, tableTop, colWidth, rowHeight).fill('rgb(54, 162, 235)');
  doc.fillColor('white').font('Helvetica-Bold');

  rows[0].forEach((cell, i) => {
    doc.text(cell, 55 + (i * cellWidth), tableTop + 8, { width: cellWidth - 10 });
  });

  // Rows
  doc.fillColor('black').font('Helvetica');
  rows.slice(1).forEach((row, rowIndex) => {
    const y = tableTop + ((rowIndex + 1) * rowHeight);
    const bgColor = rowIndex % 2 === 0 ? 'white' : 'rgb(240, 240, 240)';

    doc.rect(50, y, colWidth, rowHeight).fill(bgColor);

    row.forEach((cell, i) => {
      doc.text(cell, 55 + (i * cellWidth), y + 8, { width: cellWidth - 10 });
    });
  });

  doc.y = tableTop + (rows.length * rowHeight) + 10;
}