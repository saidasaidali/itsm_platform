// backend/src/services/startMLService.js
// Lance automatiquement le service ML Python (FastAPI) en tant que processus enfant
// Ce fichier permet au ML de se lancer automatiquement sans commande terminal manuelle

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ML_DIR = join(__dirname, '..', '..', 'ml');
const ML_PORT = process.env.ML_SERVICE_PORT || 8001;
const RETRY_INTERVAL_MS = 2000;
const MAX_RETRIES = 3; // Réduit pour éviter le spam de logs

let mlProcess = null;
let isStarting = false;
let isReady = false;

// Vérifier si le service ML répond
function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${ML_PORT}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

// Installer les dépendances Python si requirements.txt existe
async function installPythonDeps() {
  const reqFile = join(ML_DIR, 'requirements.txt');
  if (!fs.existsSync(reqFile)) {
    console.log('[ML-Launcher] Aucun requirements.txt trouvé, skip installation.');
    return true;
  }

  return new Promise((resolve) => {
    console.log('[ML-Launcher] Installation des dépendances Python...');
    const pip = spawn(
      process.platform === 'win32' ? 'pip' : 'pip3',
      ['install', '-r', reqFile],
      { cwd: ML_DIR, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let output = '';
    pip.stdout.on('data', (d) => { output += d.toString(); });
    pip.stderr.on('data', (d) => { output += d.toString(); });

    pip.on('close', (code) => {
      if (code === 0) {
        console.log('[ML-Launcher] Dépendances Python installées avec succès.');
        resolve(true);
      } else {
        console.warn(`[ML-Launcher] Échec installation pip (code ${code}):`, output.slice(-200));
        resolve(false);
      }
    });
    pip.on('error', (err) => {
      console.warn('[ML-Launcher] pip non disponible, installation ignorée:', err.message);
      resolve(false);
    });
  });
}

// Démarrer le processus Python
export async function startMLService() {
  if (isStarting || isReady) return;
  isStarting = true;

  // Étape 1 : Vérifier que Python est disponible
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pythonAvailable = await checkPythonAvailable(pythonCmd);
  
  if (!pythonAvailable) {
    console.warn('[ML-Launcher] Python non disponible, service ML désactivé (mode dégradé)');
    isStarting = false;
    return;
  }

  // Étape 2 : Installer les dépendances Python
  await installPythonDeps();

  // Étape 3 : Lancer le serveur FastAPI
  const appPath = join(ML_DIR, 'app.py');

  if (!fs.existsSync(appPath)) {
    console.warn(`[ML-Launcher] Fichier app.py introuvable: ${appPath}`);
    isStarting = false;
    return;
  }

  console.log(`[ML-Launcher] Démarrage du service ML Python sur le port ${ML_PORT}...`);
  
  mlProcess = spawn(pythonCmd, [appPath, '--port', String(ML_PORT)], {
    cwd: ML_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  mlProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[ML] ${msg}`);
  });

  mlProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[ML] ${msg}`);
  });

  mlProcess.on('exit', (code, signal) => {
    console.log(`[ML-Launcher] Processus ML arrêté (code: ${code}, signal: ${signal})`);
    mlProcess = null;
    isReady = false;
    isStarting = false;

    // Tentative de redémarrage automatique après 5 secondes seulement si pas d'erreur de commande introuvable
    if (code !== 0 && code !== null && code !== 9009) {
      console.log('[ML-Launcher] Redémarrage automatique dans 5 secondes...');
      setTimeout(() => startMLService(), 5000);
    }
  });

  mlProcess.on('error', (err) => {
    console.error('[ML-Launcher] Erreur lancement Python:', err.message);
    mlProcess = null;
    isReady = false;
    isStarting = false;
  });

  // Étape 4 : Attendre que le service soit prêt
  await waitForReady();
}

// Vérifier si Python est disponible
async function checkPythonAvailable(pythonCmd) {
  return new Promise((resolve) => {
    const check = spawn(pythonCmd, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    
    check.stdout.on('data', () => resolve(true));
    check.stderr.on('data', () => resolve(true));
    
    check.on('error', () => resolve(false));
    
    check.on('exit', (code) => {
      resolve(code === 0);
    });
    
    // Timeout après 2 secondes
    setTimeout(() => {
      check.kill();
      resolve(false);
    }, 2000);
  });
}

// Attendre que le health check passe
async function waitForReady() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const ok = await checkHealth();
    if (ok) {
      isReady = true;
      isStarting = false;
      console.log('[ML-Launcher] ✅ Service ML prêt sur http://localhost:' + ML_PORT);
      return;
    }
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
  }
  console.warn(`[ML-Launcher] ⚠️ Service ML non disponible après ${MAX_RETRIES} tentatives (utilise le fallback heuristique)`);
  isReady = false;
  isStarting = false;
}

// MAX_RETRIES déjà défini en haut du fichier

// Arrêter proprement le service ML
export function stopMLService() {
  if (mlProcess) {
    console.log('[ML-Launcher] Arrêt du service ML...');
    mlProcess.kill('SIGTERM');
    // Force kill après 5 secondes
    setTimeout(() => {
      if (mlProcess) {
        mlProcess.kill('SIGKILL');
        mlProcess = null;
      }
    }, 5000);
  }
}

export function isMLServiceReady() {
  return isReady;
}

export default { startMLService, stopMLService, isMLServiceReady };