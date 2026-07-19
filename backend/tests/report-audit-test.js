#!/usr/bin/env node
/**
 * Script d'audit dynamique du module de rapports
 * Ce script teste tous les endpoints et vérifie les données
 */

import pool from '../src/db.js';
import { 
  getAssetParkStats,
  getUserStats,
  getTicketStats,
  getSecurityStats,
  getNetworkDiscoveryStats,
  getAIAssistantStats,
  getPlatformActivityStats,
  getAllReportStats,
  getAvailableFilters
} from '../src/services/reportStatsService.js';

// Configuration
const TEST_PERIOD_START = '2024-01-01';
const TEST_PERIOD_END = '2024-12-31';
const TEST_FILTERS = {};

// Couleurs pour le terminal
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'blue');
  console.log('='.repeat(80));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Tests
async function testDatabaseConnection() {
  logSection('TEST 1: CONNEXION À LA BASE DE DONNÉES');
  
  try {
    const result = await pool.query('SELECT NOW() as now, version() as version');
    logSuccess('Connexion PostgreSQL établie');
    logInfo(`Version: ${result.rows[0].version.split(',')[0]}`);
    logInfo(`Date serveur: ${result.rows[0].now}`);
    return true;
  } catch (err) {
    logError(`Échec de connexion: ${err.message}`);
    return false;
  }
}

async function testAssetStats() {
  logSection('TEST 2: STATISTIQUES PARC INFORMATIQUE');
  
  try {
    const stats = await getAssetParkStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    
    if (!stats) {
      logWarning('Aucune statistique de parc informatique disponible');
      return false;
    }

    logSuccess('Statistiques récupérées avec succès');
    logInfo(`Total équipements: ${stats.total}`);
    logInfo(`En service: ${stats.enService}`);
    logInfo(`En panne: ${stats.enPanne}`);
    logInfo(`Disponibilité: ${stats.availability}%`);
    logInfo(`Sous garantie: ${stats.sousGarantie}`);
    logInfo(`Garantie expirée: ${stats.garantieExpiree}`);
    
    if (stats.byType && stats.byType.length > 0) {
      logInfo(`Types d'équipements: ${stats.byType.length}`);
      stats.byType.slice(0, 3).forEach(t => {
        logInfo(`  - ${t.type}: ${t.count}`);
      });
    }
    
    if (stats.byBrand && stats.byBrand.length > 0) {
      logInfo(`Marques: ${stats.byBrand.length}`);
      stats.byBrand.slice(0, 3).forEach(b => {
        logInfo(`  - ${b.brand}: ${b.count}`);
      });
    }
    
    if (stats.criticalAssets && stats.criticalAssets.length > 0) {
      logWarning(`${stats.criticalAssets.length} équipements critiques détectés`);
      stats.criticalAssets.slice(0, 3).forEach(a => {
        logInfo(`  - ${a.asset_tag}: ${a.risk_level} (${a.risk_score}/100)`);
      });
    } else {
      logInfo('Aucun équipement critique');
    }
    
    return stats.total > 0;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testUserStats() {
  logSection('TEST 3: STATISTIQUES UTILISATEURS');
  
  try {
    const stats = await getUserStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    
    if (!stats) {
      logWarning('Aucune statistique utilisateur disponible');
      return false;
    }

    logSuccess('Statistiques récupérées avec succès');
    logInfo(`Total utilisateurs: ${stats.total}`);
    logInfo(`Actifs: ${stats.actifs}`);
    logInfo(`Inactifs: ${stats.inactifs}`);
    logInfo(`En attente: ${stats.enAttente}`);
    logInfo(`Sans équipement: ${stats.withoutAssets}`);
    logInfo(`Moy. équip./utilisateur: ${stats.avgAssetsPerUser}`);
    
    if (stats.byRole && stats.byRole.length > 0) {
      logInfo('Répartition par rôle:');
      stats.byRole.forEach(r => {
        logInfo(`  - ${r.role}: ${r.count}`);
      });
    }
    
    if (stats.byDirection && stats.byDirection.length > 0) {
      logInfo('Répartition par direction:');
      stats.byDirection.slice(0, 5).forEach(d => {
        logInfo(`  - ${d.direction}: ${d.count}`);
      });
    }
    
    return stats.total > 0;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testTicketStats() {
  logSection('TEST 4: STATISTIQUES TICKETS');
  
  try {
    const stats = await getTicketStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    
    if (!stats) {
      logWarning('Aucune statistique de ticket disponible');
      return false;
    }

    logSuccess('Statistiques récupérées avec succès');
    logInfo(`Total tickets: ${stats.total}`);
    logInfo(`Nouveaux: ${stats.nouveau}`);
    logInfo(`Assignés: ${stats.assigne}`);
    logInfo(`En cours: ${stats.enCours}`);
    logInfo(`Résolus: ${stats.resolu}`);
    logInfo(`Clôturés: ${stats.cloture}`);
    logInfo(`Temps moyen résolution: ${stats.avgResolutionTime}h`);
    logInfo(`Conformité SLA: ${stats.slaCompliance}%`);
    logInfo(`Taux résolution: ${stats.resolutionRate}%`);
    logInfo(`Backlog: ${stats.backlog}`);
    
    if (stats.byPriority && stats.byPriority.length > 0) {
      logInfo('Répartition par priorité:');
      stats.byPriority.forEach(p => {
        logInfo(`  - ${p.priority}: ${p.count}`);
      });
    }
    
    if (stats.byCategory && stats.byCategory.length > 0) {
      logInfo('Top catégories:');
      stats.byCategory.slice(0, 5).forEach(c => {
        logInfo(`  - ${c.category}: ${c.count}`);
      });
    }
    
    if (stats.byTechnician && stats.byTechnician.length > 0) {
      logInfo('Tickets par technicien:');
      stats.byTechnician.slice(0, 5).forEach(t => {
        logInfo(`  - ${t.technician}: ${t.count}`);
      });
    }
    
    if (stats.evolution && stats.evolution.length > 0) {
      logInfo(`Évolution temporelle: ${stats.evolution.length} points`);
      logInfo(`  Premier: ${stats.evolution[0].date} (${stats.evolution[0].count} tickets)`);
      logInfo(`  Dernier: ${stats.evolution[stats.evolution.length - 1].date} (${stats.evolution[stats.evolution.length - 1].count} tickets)`);
    }
    
    // Le test est réussi si les statistiques sont retournées (même si 0 tickets)
    return true;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testSecurityStats() {
  logSection('TEST 5: STATISTIQUES SÉCURITÉ');
  
  try {
    const stats = await getSecurityStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    
    if (!stats) {
      logWarning('Aucune statistique de sécurité disponible');
      return false;
    }

    logSuccess('Statistiques récupérées avec succès');
    logInfo(`Total incidents: ${stats.total}`);
    logInfo(`Critiques: ${stats.critical}`);
    logInfo(`Élevés: ${stats.high}`);
    logInfo(`Ouverts: ${stats.open}`);
    logInfo(`En investigation: ${stats.investigating}`);
    logInfo(`Résolus: ${stats.resolved}`);
    logInfo(`Fermés: ${stats.closed}`);
    
    if (stats.byType && stats.byType.length > 0) {
      logInfo('Répartition par type:');
      stats.byType.forEach(t => {
        logInfo(`  - ${t.type}: ${t.count}`);
      });
    }
    
    if (stats.highRiskAssets && stats.highRiskAssets.length > 0) {
      logWarning(`${stats.highRiskAssets.length} équipements à risque élevé`);
      stats.highRiskAssets.slice(0, 3).forEach(a => {
        logInfo(`  - ${a.asset_tag}: ${a.risk_level} (${a.risk_score}/100)`);
      });
    } else {
      logInfo('Aucun équipement à risque élevé');
    }
    
    return true;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testNetworkStats() {
  logSection('TEST 6: STATISTIQUES DÉCOUVERTE RÉSEAU');
  
  try {
    const stats = await getNetworkDiscoveryStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    
    if (!stats) {
      logWarning('Aucune statistique de découverte réseau disponible');
      return false;
    }

    logSuccess('Statistiques récupérées avec succès');
    logInfo(`Total détectés: ${stats.total}`);
    logInfo(`Non résolus: ${stats.unresolved}`);
    logInfo(`Résolus: ${stats.resolved}`);
    logInfo(`Ignorés: ${stats.ignored}`);
    logInfo(`Nouveaux appareils: ${stats.newDevices}`);
    logInfo(`Hors ligne: ${stats.offlineDevices}`);
    
    return true;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testAIStats() {
  logSection('TEST 7: STATISTIQUES ASSISTANT IA');
  
  try {
    const stats = await getAIAssistantStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    
    if (!stats) {
      logWarning('Aucune statistique d\'assistant IA disponible');
      return false;
    }

    logSuccess('Statistiques récupérées avec succès');
    logInfo(`Sessions totales: ${stats.totalSessions}`);
    logInfo(`Messages totaux: ${stats.totalMessages}`);
    logInfo(`Utilisateurs uniques: ${stats.uniqueUsers}`);
    logInfo(`Tickets auto-créés: ${stats.autoTicketsCreated}`);
    logInfo(`Temps moyen traitement: ${stats.avgProcessingTime}s`);
    logInfo(`Taux résolution auto: ${stats.autoResolutionRate}%`);
    
    if (stats.intents && stats.intents.length > 0) {
      logInfo('Intentions détectées:');
      stats.intents.slice(0, 5).forEach(i => {
        logInfo(`  - ${i.intent}: ${i.count}`);
      });
    }
    
    return true;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testPlatformStats() {
  logSection('TEST 8: STATISTIQUES ACTIVITÉ PLATEFORME');
  
  try {
    const stats = await getPlatformActivityStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    
    if (!stats) {
      logWarning('Aucune statistique d\'activité disponible');
      return false;
    }

    logSuccess('Statistiques récupérées avec succès');
    logInfo(`Total connexions: ${stats.totalLogins}`);
    
    if (stats.activityByUser && stats.activityByUser.length > 0) {
      logInfo('Top utilisateurs actifs:');
      stats.activityByUser.slice(0, 5).forEach(u => {
        logInfo(`  - ${u.username}: ${u.action_count} actions`);
      });
    }
    
    return true;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testAllStats() {
  logSection('TEST 9: TOUTES LES STATISTIQUES (EN PARALLÈLE)');
  
  try {
    const startTime = Date.now();
    const stats = await getAllReportStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    const duration = Date.now() - startTime;
    
    if (!stats) {
      logError('Aucune statistique globale disponible');
      return false;
    }

    logSuccess(`Statistiques globales récupérées en ${duration}ms`);
    logInfo(`Assets: ${stats.assets ? '✅' : '❌'}`);
    logInfo(`Users: ${stats.users ? '✅' : '❌'}`);
    logInfo(`Tickets: ${stats.tickets ? '✅' : '❌'}`);
    logInfo(`Security: ${stats.security ? '✅' : '❌'}`);
    logInfo(`Network: ${stats.network ? '✅' : '❌'}`);
    logInfo(`AI: ${stats.ai ? '✅' : '❌'}`);
    logInfo(`Platform: ${stats.platform ? '✅' : '❌'}`);
    
    const availableCount = [stats.assets, stats.users, stats.tickets, stats.security, stats.network, stats.ai, stats.platform]
      .filter(Boolean).length;
    
    logInfo(`${availableCount}/7 sections disponibles`);
    
    if (duration > 5000) {
      logWarning(`Temps de génération élevé: ${duration}ms (> 5s)`);
    } else {
      logSuccess(`Performance acceptable: ${duration}ms`);
    }
    
    return availableCount > 0;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testAvailableFilters() {
  logSection('TEST 10: FILTRES DISPONIBLES');
  
  try {
    const filters = await getAvailableFilters();
    
    if (!filters) {
      logWarning('Aucun filtre disponible');
      return false;
    }

    logSuccess('Filtres récupérés avec succès');
    logInfo(`Départements: ${filters.departments?.length || 0}`);
    logInfo(`Services: ${filters.services?.length || 0}`);
    logInfo(`Types d'équipements: ${filters.assetTypes?.length || 0}`);
    logInfo(`Statuts: ${filters.assetStatuses?.length || 0}`);
    logInfo(`Priorités: ${filters.priorities?.length || 0}`);
    logInfo(`Catégories: ${filters.categories?.length || 0}`);
    
    return true;
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

async function testDataConsistency() {
  logSection('TEST 11: COHÉRENCE DES DONNÉES');
  
  try {
    const stats = await getAllReportStats(TEST_PERIOD_START, TEST_PERIOD_END, TEST_FILTERS);
    
    if (!stats) {
      logError('Impossible de vérifier la cohérence');
      return false;
    }

    let issues = [];
    
    // Vérifier les tickets
    if (stats.tickets) {
      const totalStatus = stats.tickets.nouveau + stats.tickets.assigne + stats.tickets.enCours + 
                         stats.tickets.enAttente + stats.tickets.resolu + stats.tickets.cloture + 
                         stats.tickets.rouvert + stats.tickets.annule;
      
      if (totalStatus !== stats.tickets.total) {
        issues.push(`Tickets: total (${stats.tickets.total}) ≠ somme des statuts (${totalStatus})`);
      }
      
      // Vérifier le taux de résolution (avec protection division par zéro)
      const closed = stats.tickets.resolu + stats.tickets.cloture;
      let expectedRate = 0;
      if (stats.tickets.total > 0) {
        expectedRate = Math.round((closed / stats.tickets.total) * 100);
      }
      if (stats.tickets.resolutionRate !== expectedRate) {
        issues.push(`Tickets: taux de résolution incohérent (calculé: ${stats.tickets.resolutionRate}%, attendu: ${expectedRate}%)`);
      }
    }
    
    // Vérifier les équipements
    if (stats.assets) {
      const totalStatus = stats.assets.enService + stats.assets.enPanne + stats.assets.horsService + 
                         stats.assets.enStock + stats.assets.enMaintenance + stats.assets.retire;
      
      if (totalStatus !== stats.assets.total) {
        issues.push(`Équipements: total (${stats.assets.total}) ≠ somme des statuts (${totalStatus})`);
      }
      
      const totalAssign = stats.assets.affectes + stats.assets.nonAffectes;
      if (totalAssign !== stats.assets.total) {
        issues.push(`Équipements: affectés + non affectés ≠ total`);
      }
    }
    
    // Vérifier les utilisateurs
    if (stats.users) {
      const totalStatus = stats.users.actifs + stats.users.inactifs + stats.users.enAttente;
      if (totalStatus !== stats.users.total) {
        issues.push(`Utilisateurs: total (${stats.users.total}) ≠ somme des statuts (${totalStatus})`);
      }
    }
    
    if (issues.length === 0) {
      logSuccess('Aucune incohérence détectée dans les données');
      return true;
    } else {
      issues.forEach(issue => logError(issue));
      return false;
    }
  } catch (err) {
    logError(`Erreur: ${err.message}`);
    return false;
  }
}

// Fonction principale
async function runAudit() {
  console.log('\n' + '█'.repeat(80));
  log('  AUDIT DYNAMIQUE DU MODULE DE RAPPORTS ITSM', 'blue');
  console.log('█'.repeat(80) + '\n');
  
  const results = {
    database: false,
    assets: false,
    users: false,
    tickets: false,
    security: false,
    network: false,
    ai: false,
    platform: false,
    allStats: false,
    filters: false,
    consistency: false
  };
  
  try {
    // Test 1: Connexion DB
    results.database = await testDatabaseConnection();
    
    if (!results.database) {
      logError('Impossible de continuer sans connexion à la base de données');
      return;
    }
    
    // Tests 2-8: Statistiques individuelles
    results.assets = await testAssetStats();
    results.users = await testUserStats();
    results.tickets = await testTicketStats();
    results.security = await testSecurityStats();
    results.network = await testNetworkStats();
    results.ai = await testAIStats();
    results.platform = await testPlatformStats();
    
    // Test 9: Toutes les statistiques
    results.allStats = await testAllStats();
    
    // Test 10: Filtres
    results.filters = await testAvailableFilters();
    
    // Test 11: Cohérence
    results.consistency = await testDataConsistency();
    
    // Résumé final
    logSection('RÉSUMÉ DE L\'AUDIT');
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(r => r).length;
    const failedTests = totalTests - passedTests;
    
    log(`\nTests réussis: ${passedTests}/${totalTests}\n`, passedTests === totalTests ? 'green' : 'yellow');
    
    Object.entries(results).forEach(([test, result]) => {
      const status = result ? '✅' : '❌';
      const testName = test.charAt(0).toUpperCase() + test.slice(1);
      log(`${status} ${testName}`, result ? 'green' : 'red');
    });
    
    if (failedTests === 0) {
      log('\n🎉 TOUS LES TESTS SONT RÉUSSIS !', 'green');
    } else {
      log(`\n⚠️  ${failedTests} test(s) échoué(s)`, 'yellow');
    }
    
    console.log('\n' + '█'.repeat(80) + '\n');
    
  } catch (err) {
    logError(`Erreur fatale: ${err.message}`);
    console.error(err);
  } finally {
    await pool.end();
  }
}

// Exécuter l'audit
runAudit().catch(err => {
  console.error('Erreur lors de l\'audit:', err);
  process.exit(1);
});