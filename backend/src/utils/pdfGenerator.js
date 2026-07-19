// backend/src/utils/pdfGenerator.js
// Générateur de PDF - Version imprimable fidèle du rapport ReportViewer

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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES - Palette fidèle au CSS de ReportViewer
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  primary: '#007bff',
  primaryDark: '#0056b3',
  text: '#333333',
  textSecondary: '#666666',
  border: '#dee2e6',
  background: '#f8f9fa',
  white: '#ffffff',
  danger: '#dc3545',
  dangerBg: '#f8d7da',
  dangerText: '#721c24',
  warning: '#856404',
  warningBg: '#fff3cd',
  chartColors: [
    'rgb(255, 99, 132)',
    'rgb(54, 162, 235)',
    'rgb(255, 206, 86)',
    'rgb(75, 192, 192)',
    'rgb(153, 102, 255)',
    'rgb(255, 159, 64)',
  ]
};

const FONTS = {
  pageTitle: 28,
  sectionTitle: 22,
  chartTitle: 18,
  kpiValue: 32,
  kpiLabel: 14,
  tableHeader: 14,
  tableCell: 14,
  body: 14,
  meta: 14,
};

const DIMENSIONS = {
  margin: 50,
  pageWidth: 595.28, // A4
  pageHeight: 841.89, // A4
  cardPadding: 20,
  sectionPadding: 25,
  chartHeight: 300,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function ensureReportsDir() {
  try {
    await fs.access(REPORTS_DIR);
  } catch {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  }
}

export async function generateChartImage(chartConfig, width = 600, height = 300) {
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

function drawReportHeader(doc, report) {
  // Titre
  const typeLabel = report.report_type === 'monthly' ? 'Rapport Mensuel' : 
                    report.report_type === 'weekly' ? 'Rapport Hebdomadaire' : 
                    'Rapport Personnalisé';
  
  doc.fontSize(FONTS.pageTitle)
     .font('Helvetica-Bold')
     .fillColor(COLORS.text)
     .text(`${typeLabel}`, { align: 'center' })
     .moveDown(0.3);

  // Métadonnées
  doc.fontSize(FONTS.meta)
     .font('Helvetica')
     .fillColor(COLORS.textSecondary)
     .text(`Période: ${report.period_start} - ${report.period_end}`, { align: 'center' })
     .moveDown(0.2);
  
  doc.text(`Généré le: ${new Date(report.generated_at).toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, { align: 'center' })
     .moveDown(1);

  // Ligne de séparation
  doc.rect(50, doc.y, doc.page.width - 100, 2).fill(COLORS.primary);
  doc.moveDown(1.5);
}

function drawSectionTitle(doc, title) {
  doc.fontSize(FONTS.sectionTitle)
     .font('Helvetica-Bold')
     .fillColor(COLORS.text)
     .text(title)
     .moveDown(0.2);
  
  // Border-bottom comme dans le CSS
  const titleWidth = doc.widthOfString(title);
  doc.rect(50, doc.y, titleWidth, 2).fill(COLORS.primary);
  doc.moveDown(1);
}

function drawKPICard(doc, x, y, width, height, label, value) {
  const padding = DIMENSIONS.cardPadding;
  
  // Background
  doc.rect(x, y, width, height)
     .fill(COLORS.background)
     .stroke(COLORS.border)
     .lineWidth(1);
  
  // Label
  doc.fontSize(FONTS.kpiLabel)
     .font('Helvetica')
     .fillColor(COLORS.textSecondary)
     .text(label.toUpperCase(), x + padding, y + padding, { 
       width: width - (padding * 2),
       align: 'center'
     });
  
  // Value
  doc.fontSize(FONTS.kpiValue)
     .font('Helvetica-Bold')
     .fillColor(COLORS.primary)
     .text(String(value), x + padding, y + padding + 20, { 
       width: width - (padding * 2),
       align: 'center'
     });
}

function drawKPIGrid(doc, kpis) {
  if (!kpis || kpis.length === 0) return;

  const cardWidth = (doc.page.width - (DIMENSIONS.margin * 2) - 40) / 3;
  const cardHeight = 100;
  const gap = 20;
  const startY = doc.y;

  kpis.forEach((kpi, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = DIMENSIONS.margin + col * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap);
    
    drawKPICard(doc, x, y, cardWidth, cardHeight, kpi.label, kpi.value);
  });

  const totalRows = Math.ceil(kpis.length / 3);
  doc.y = startY + (totalRows * (cardHeight + gap)) + 20;
}

async function drawChart(doc, chartConfig, width = 600, height = 280) {
  try {
    const chartImage = await generateChartImage(chartConfig, width, height);
    const chartWidth = doc.page.width - (DIMENSIONS.margin * 2);
    const chartHeight = (height / width) * chartWidth;

    // Background comme dans le CSS
    doc.rect(DIMENSIONS.margin, doc.y, chartWidth, chartHeight)
       .fill(COLORS.background)
       .stroke(COLORS.border)
       .lineWidth(1);

    doc.image(chartImage, DIMENSIONS.margin + 2, doc.y + 2, { 
      width: chartWidth - 4, 
      height: chartHeight - 4 
    });
    
    doc.y += chartHeight + 20;
  } catch (err) {
    console.error('Error drawing chart:', err);
    doc.fontSize(10)
       .fillColor('gray')
       .text('[Graphique non disponible]', DIMENSIONS.margin, doc.y)
       .moveDown(1);
  }
}

function drawTable(doc, title, headers, rows) {
  if (!rows || rows.length === 0) return;

  const startY = doc.y;
  const tableWidth = doc.page.width - (DIMENSIONS.margin * 2);
  const colWidth = tableWidth / headers.length;
  const rowHeight = 40;
  const padding = 15;

  // Titre du tableau
  doc.fontSize(FONTS.chartTitle)
     .font('Helvetica-Bold')
     .fillColor(COLORS.text)
     .text(title)
     .moveDown(0.3);

  const headerY = doc.y;

  // Header avec style du CSS
  doc.rect(DIMENSIONS.margin, headerY, tableWidth, rowHeight)
     .fill(COLORS.primary);

  doc.fillColor(COLORS.white)
     .font('Helvetica-Bold')
     .fontSize(FONTS.tableHeader);

  headers.forEach((header, i) => {
    doc.text(header, DIMENSIONS.margin + padding + (i * colWidth), headerY + 12, { 
      width: colWidth - (padding * 2) 
    });
  });

  // Rows
  doc.fillColor(COLORS.text)
     .font('Helvetica')
     .fontSize(FONTS.tableCell);

  rows.slice(0, 10).forEach((row, rowIndex) => {
    const y = headerY + ((rowIndex + 1) * rowHeight);
    const bgColor = rowIndex % 2 === 0 ? COLORS.white : COLORS.background;

    doc.rect(DIMENSIONS.margin, y, tableWidth, rowHeight)
       .fill(bgColor)
       .stroke(COLORS.border)
       .lineWidth(1);

    row.forEach((cell, i) => {
      doc.text(String(cell), DIMENSIONS.margin + padding + (i * colWidth), y + 13, { 
        width: colWidth - (padding * 2) 
      });
    });
  });

  doc.y = headerY + ((Math.min(rows.length, 10) + 1) * rowHeight) + 20;
}

function drawAlert(doc, type, title, content) {
  const startY = doc.y;
  const padding = 20;
  const tableWidth = doc.page.width - (DIMENSIONS.margin * 2);

  // Background
  const bgColor = type === 'danger' ? COLORS.dangerBg : COLORS.warningBg;
  const borderColor = type === 'danger' ? COLORS.danger : COLORS.warning;
  const textColor = type === 'danger' ? COLORS.dangerText : COLORS.warning;

  doc.rect(DIMENSIONS.margin, startY, tableWidth, padding * 2)
     .fill(bgColor)
     .stroke(borderColor)
     .lineWidth(4);

  // Title
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor(textColor)
     .text(title, DIMENSIONS.margin + padding, startY + padding, { 
       width: tableWidth - (padding * 2) 
     })
     .moveDown(0.3);

  // Content
  if (content) {
    doc.fontSize(14)
       .font('Helvetica')
       .fillColor(textColor)
       .text(content, DIMENSIONS.margin + padding, doc.y, { 
         width: tableWidth - (padding * 2) 
       });
  }

  doc.y = startY + (padding * 2) + 20;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES - Une fonction par section du ReportViewer
// ═══════════════════════════════════════════════════════════════════════════════

async function drawCoverPage(doc, report) {
  // Espacement
  doc.moveDown(3);

  // Logo
  try {
    await fs.access(LOGO_PATH);
    doc.image(LOGO_PATH, { 
      fit: [120, 120], 
      align: 'center' 
    });
    doc.moveDown(2);
  } catch {
    console.warn('Logo not found, skipping');
  }

  // Titre
  doc.fontSize(32)
     .font('Helvetica-Bold')
     .fillColor(COLORS.text)
     .text('ITSM Platform', { align: 'center' })
     .moveDown(0.5);

  doc.fontSize(24)
     .text('Rapport d\'Analyse IT', { align: 'center' })
     .moveDown(2);

  // Badge
  const typeLabel = report.report_type === 'monthly' ? 'Rapport Mensuel' : 
                    report.report_type === 'weekly' ? 'Rapport Hebdomadaire' : 
                    'Rapport Personnalisé';
  
  const badgeWidth = 200;
  const badgeHeight = 40;
  const badgeX = (doc.page.width - badgeWidth) / 2;
  
  doc.roundedRect(badgeX, doc.y, badgeWidth, badgeHeight, 8)
     .fill(COLORS.primary);
  
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor(COLORS.white)
     .text(typeLabel, badgeX, doc.y + 12, { width: badgeWidth, align: 'center' })
     .moveDown(2);

  // Métadonnées
  doc.fontSize(14)
     .font('Helvetica')
     .fillColor(COLORS.textSecondary)
     .text(`Période: ${report.period_start} au ${report.period_end}`, { align: 'center' })
     .moveDown(0.3);

  doc.text(`Généré le: ${new Date(report.generated_at).toLocaleDateString('fr-FR', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, { align: 'center' })
     .moveDown(0.3);

  if (report.generated_by) {
    doc.text(`Généré par: ${report.generated_by}`, { align: 'center' });
  }
}

async function drawExecutiveSummary(doc, report) {
  if (!report.executiveSummary) return;

  drawSectionTitle(doc, 'Résumé Exécutif');

  // Box avec fond gradient simulé (violet/bleu comme dans le CSS)
  const boxY = doc.y;
  const boxHeight = 100;
  const tableWidth = doc.page.width - (DIMENSIONS.margin * 2);

  doc.rect(DIMENSIONS.margin, boxY, tableWidth, boxHeight)
     .fill('rgb(102, 126, 234)')
     .fill('rgb(118, 75, 162)');

  doc.fontSize(16)
     .font('Helvetica')
     .fillColor(COLORS.white)
     .text(report.executiveSummary, DIMENSIONS.margin + 25, boxY + 25, { 
       width: tableWidth - 50,
       align: 'justify'
     });

  doc.y = boxY + boxHeight + 30;
}

async function drawAssetsSection(doc, stats) {
  if (!stats.assets) return;

  drawSectionTitle(doc, '1. Parc Informatique');

  // 6 KPIs
  const assetKPIs = [
    { label: 'Total', value: stats.assets.total },
    { label: 'En service', value: stats.assets.enService },
    { label: 'En panne', value: stats.assets.enPanne },
    { label: 'Disponibilité', value: `${stats.assets.availability}%` },
    { label: 'Sous garantie', value: stats.assets.sousGarantie },
    { label: 'Garantie expirée', value: stats.assets.garantieExpiree }
  ];
  drawKPIGrid(doc, assetKPIs);

  // 2 graphiques côte à côte
  if (stats.assets.byType && stats.assets.byType.length > 0) {
    const typeChart = {
      type: 'doughnut',
      data: {
        labels: stats.assets.byType.map(t => t.type),
        datasets: [{
          data: stats.assets.byType.map(t => t.count),
          backgroundColor: COLORS.chartColors,
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Répartition par Type', font: { size: FONTS.chartTitle } },
          legend: { position: 'right', font: { size: 11 } }
        }
      }
    };
    await drawChart(doc, typeChart, 500, 250);
  }

  if (stats.assets.byStatus && stats.assets.byStatus.length > 0) {
    const statusChart = {
      type: 'pie',
      data: {
        labels: stats.assets.byStatus.map(s => s.status),
        datasets: [{
          data: stats.assets.byStatus.map(s => s.count),
          backgroundColor: COLORS.chartColors,
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Répartition par Statut', font: { size: FONTS.chartTitle } },
          legend: { position: 'right', font: { size: 11 } }
        }
      }
    };
    await drawChart(doc, statusChart, 500, 250);
  }

  // Tableau Top 10 Marques
  if (stats.assets.byBrand && stats.assets.byBrand.length > 0) {
    drawTable(doc, 'Top 10 Marques', 
      ['Marque', 'Quantité'],
      stats.assets.byBrand.slice(0, 10).map(b => [b.brand, b.count])
    );
  }

  // Alerte Équipements Critiques
  if (stats.assets.criticalAssets && stats.assets.criticalAssets.length > 0) {
    drawAlert(doc, 'danger', 
      `⚠️ Équipements Critiques (${stats.assets.criticalAssets.length})`,
      `${stats.assets.criticalAssets.length} équipements nécessitent une attention immédiate:`
    );
    
    drawTable(doc, '', 
      ['Tag', 'Type', 'Marque', 'Score', 'Niveau'],
      stats.assets.criticalAssets.slice(0, 10).map(a => [
        a.asset_tag,
        a.type || 'N/A',
        a.brand || 'N/A',
        `${a.risk_score}/100`,
        a.risk_level
      ])
    );
  }

  doc.moveDown(20);
}

async function drawUsersSection(doc, stats) {
  if (!stats.users) return;

  drawSectionTitle(doc, '2. Utilisateurs');

  // 6 KPIs
  const userKPIs = [
    { label: 'Total', value: stats.users.total },
    { label: 'Actifs', value: stats.users.actifs },
    { label: 'Inactifs', value: stats.users.inactifs },
    { label: 'En attente', value: stats.users.enAttente },
    { label: 'Sans équipement', value: stats.users.withoutAssets },
    { label: 'Moy. équip./utilisateur', value: stats.users.avgAssetsPerUser.toFixed(2) }
  ];
  drawKPIGrid(doc, userKPIs);

  // Graphique by Role
  if (stats.users.byRole && stats.users.byRole.length > 0) {
    const roleChart = {
      type: 'bar',
      data: {
        labels: stats.users.byRole.map(r => r.role),
        datasets: [{
          label: 'Utilisateurs',
          data: stats.users.byRole.map(r => r.count),
          backgroundColor: COLORS.primary,
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Répartition par Rôle', font: { size: FONTS.chartTitle } }
        }
      }
    };
    await drawChart(doc, roleChart, 600, 280);
  }

  // Tableau by Direction
  if (stats.users.byDirection && stats.users.byDirection.length > 0) {
    drawTable(doc, 'Répartition par Direction',
      ['Direction', 'Nombre'],
      stats.users.byDirection.map(d => [d.direction, d.count])
    );
  }

  // Tableau Dernières Connexions
  if (stats.users.lastLogins && stats.users.lastLogins.length > 0) {
    drawTable(doc, 'Dernières Connexions',
      ['Utilisateur', 'Email', 'Direction', 'Dernière Connexion'],
      stats.users.lastLogins.slice(0, 10).map(l => [
        l.username,
        l.email,
        l.direction || 'N/A',
        l.last_login ? new Date(l.last_login).toLocaleString('fr-FR') : 'Jamais'
      ])
    );
  }

  doc.moveDown(20);
}

async function drawTicketsSection(doc, stats) {
  if (!stats.tickets) return;

  drawSectionTitle(doc, '3. Tickets');

  // 6 KPIs
  const ticketKPIs = [
    { label: 'Total', value: stats.tickets.total },
    { label: 'Ouverts', value: stats.tickets.nouveau + stats.tickets.assigne + stats.tickets.enCours },
    { label: 'Résolus', value: stats.tickets.resolu + stats.tickets.cloture },
    { label: 'SLA', value: `${stats.tickets.slaCompliance}%` },
    { label: 'Temps moyen résolution', value: `${stats.tickets.avgResolutionTime}h` },
    { label: 'Backlog', value: stats.tickets.backlog }
  ];
  drawKPIGrid(doc, ticketKPIs);

  // Graphique by Priority
  if (stats.tickets.byPriority && stats.tickets.byPriority.length > 0) {
    const priorityChart = {
      type: 'doughnut',
      data: {
        labels: stats.tickets.byPriority.map(p => p.priority),
        datasets: [{
          data: stats.tickets.byPriority.map(p => p.count),
          backgroundColor: COLORS.chartColors,
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Répartition par Priorité', font: { size: FONTS.chartTitle } },
          legend: { position: 'right', font: { size: 11 } }
        }
      }
    };
    await drawChart(doc, priorityChart, 500, 250);
  }

  // Graphique Evolution
  if (stats.tickets.evolution && stats.tickets.evolution.length > 0) {
    const evolutionChart = {
      type: 'line',
      data: {
        labels: stats.tickets.evolution.map(e => e.date),
        datasets: [{
          label: 'Tickets créés',
          data: stats.tickets.evolution.map(e => e.count),
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          tension: 0.4,
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Évolution Temporelle', font: { size: FONTS.chartTitle } }
        }
      }
    };
    await drawChart(doc, evolutionChart, 500, 250);
  }

  // Tableau by Category
  if (stats.tickets.byCategory && stats.tickets.byCategory.length > 0) {
    drawTable(doc, 'Répartition par Catégorie',
      ['Catégorie', 'Nombre'],
      stats.tickets.byCategory.map(c => [c.category, c.count])
    );
  }

  // Tableau by Technician
  if (stats.tickets.byTechnician && stats.tickets.byTechnician.length > 0) {
    drawTable(doc, 'Tickets par Technicien',
      ['Technicien', 'Tickets Assignés'],
      stats.tickets.byTechnician.slice(0, 10).map(t => [t.technician, t.count])
    );
  }

  doc.moveDown(20);
}

async function drawSecuritySection(doc, stats) {
  if (!stats.security) return;

  drawSectionTitle(doc, '4. Sécurité');

  // 5 KPIs
  const securityKPIs = [
    { label: 'Total incidents', value: stats.security.total },
    { label: 'Critiques', value: stats.security.critical },
    { label: 'Élevés', value: stats.security.high },
    { label: 'Ouverts', value: stats.security.open },
    { label: 'Résolus', value: stats.security.resolved }
  ];
  drawKPIGrid(doc, securityKPIs);

  // Graphique by Type
  if (stats.security.byType && stats.security.byType.length > 0) {
    const typeChart = {
      type: 'bar',
      data: {
        labels: stats.security.byType.map(t => t.type),
        datasets: [{
          label: 'Incidents',
          data: stats.security.byType.map(t => t.count),
          backgroundColor: 'rgb(255, 99, 132)',
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Répartition par Type', font: { size: FONTS.chartTitle } }
        }
      }
    };
    await drawChart(doc, typeChart, 600, 280);
  }

  // Alerte Équipements à Risque
  if (stats.security.highRiskAssets && stats.security.highRiskAssets.length > 0) {
    drawAlert(doc, 'warning',
      `⚠️ Équipements à Risque Élevé (${stats.security.highRiskAssets.length})`,
      `${stats.security.highRiskAssets.length} équipements nécessitent une attention:`
    );

    drawTable(doc, '',
      ['Tag', 'Type', 'Marque', 'Score', 'Niveau'],
      stats.security.highRiskAssets.slice(0, 10).map(a => [
        a.asset_tag,
        a.type || 'N/A',
        a.brand || 'N/A',
        `${a.risk_score}/100`,
        a.risk_level
      ])
    );
  }

  doc.moveDown(20);
}

async function drawNetworkSection(doc, stats) {
  if (!stats.network) return;

  drawSectionTitle(doc, '5. Découverte Réseau');

  // 5 KPIs
  const networkKPIs = [
    { label: 'Total détectés', value: stats.network.total },
    { label: 'Non résolus', value: stats.network.unresolved },
    { label: 'Résolus', value: stats.network.resolved },
    { label: 'Nouveaux', value: stats.network.newDevices },
    { label: 'Hors ligne', value: stats.network.offlineDevices }
  ];
  drawKPIGrid(doc, networkKPIs);

  doc.moveDown(20);
}

async function drawAISection(doc, stats) {
  if (!stats.ai) return;

  drawSectionTitle(doc, '6. Assistant IA');

  // 5 KPIs
  const aiKPIs = [
    { label: 'Sessions', value: stats.ai.totalSessions },
    { label: 'Messages', value: stats.ai.totalMessages },
    { label: 'Utilisateurs uniques', value: stats.ai.uniqueUsers },
    { label: 'Tickets auto-créés', value: stats.ai.autoTicketsCreated },
    { label: 'Taux résolution auto', value: `${stats.ai.autoResolutionRate}%` }
  ];
  drawKPIGrid(doc, aiKPIs);

  // Tableau Intentions
  if (stats.ai.intents && stats.ai.intents.length > 0) {
    drawTable(doc, 'Intentions Détectées',
      ['Intention', 'Nombre'],
      stats.ai.intents.map(i => [i.intent, i.count])
    );
  }

  doc.moveDown(20);
}

async function drawPlatformSection(doc, stats) {
  if (!stats.platform) return;

  drawSectionTitle(doc, '7. Activité Plateforme');

  // 1 KPI
  const platformKPIs = [
    { label: 'Total Connexions', value: stats.platform.totalLogins }
  ];
  drawKPIGrid(doc, platformKPIs);

  // Tableau Top 10 Utilisateurs Actifs
  if (stats.platform.activityByUser && stats.platform.activityByUser.length > 0) {
    drawTable(doc, 'Top 10 Utilisateurs Actifs',
      ['Utilisateur', 'Email', 'Direction', 'Actions', 'Dernière Action'],
      stats.platform.activityByUser.slice(0, 10).map(u => [
        u.username,
        u.email,
        u.direction || 'N/A',
        u.action_count,
        u.last_action ? new Date(u.last_action).toLocaleString('fr-FR') : 'N/A'
      ])
    );
  }

  doc.moveDown(20);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateReportPDF(reportData) {
  await ensureReportsDir();

  const filename = `report_${reportData.type}_${Date.now()}.pdf`;
  const filepath = path.join(REPORTS_DIR, filename);

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: DIMENSIONS.margin,
        info: {
          Title: 'Rapport ITSM',
          Author: 'ITSM Platform',
          Creator: 'ITSM Platform'
        }
      });
      const stream = createWriteStream(filepath);
      doc.pipe(stream);

      const stats = reportData.stats || {};

      // Page 1: Couverture
      await drawCoverPage(doc, reportData);
      doc.addPage();

      // En-tête du rapport (titre + métadonnées)
      drawReportHeader(doc, reportData);

      // Section 1: Résumé Exécutif (si existe)
      await drawExecutiveSummary(doc, reportData);

      // Section 2: Parc Informatique
      await drawAssetsSection(doc, stats);

      // Section 3: Utilisateurs
      await drawUsersSection(doc, stats);

      // Section 4: Tickets
      await drawTicketsSection(doc, stats);

      // Section 5: Sécurité
      await drawSecuritySection(doc, stats);

      // Section 6: Réseau
      await drawNetworkSection(doc, stats);

      // Section 7: Assistant IA
      await drawAISection(doc, stats);

      // Section 8: Activité Plateforme
      await drawPlatformSection(doc, stats);

      // Numérotation des pages
      addPageNumbers(doc);

      // Finaliser PDF
      doc.end();

      stream.on('finish', () => {
        resolve(filepath);
      });

      stream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
}