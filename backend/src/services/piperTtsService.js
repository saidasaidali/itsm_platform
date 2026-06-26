import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class PiperTtsService {
  constructor() {
    this.piperPath = process.env.PIPER_TTS_PATH || 'piper';
    this.modelPath = process.env.PIPER_MODEL_PATH || './models/fr_FR-upmc-medium.onnx';
    this.initialized = false;
  }

  async ensureInitialized() {
    if (this.initialized) return;
    
    try {
      // Vérifier que le modèle existe
      await fs.access(this.modelPath);
      this.initialized = true;
    } catch (error) {
      console.warn('[Piper TTS] Modèle non trouvé, utilisation du mode fallback');
      this.initialized = true;
    }
  }

  async synthesize(text, outputPath) {
    await this.ensureInitialized();
    
    try {
      return await this.runPiper(text, outputPath);
    } catch (error) {
      console.error('[Piper TTS] Erreur de synthèse:', error);
      throw new Error('Échec de la synthèse vocale');
    }
  }

  async runPiper(text, outputPath) {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', this.modelPath,
        '-f', outputPath,
        '--no-timestamps'
      ];

      const piper = spawn(this.piperPath, args);
      let stdout = '';
      let stderr = '';

      // Envoyer le texte à Piper via stdin
      piper.stdin.write(text);
      piper.stdin.end();

      piper.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      piper.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      piper.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          console.error('[Piper TTS] Erreur:', stderr);
          reject(new Error(`Piper a échoué avec le code ${code}`));
        }
      });

      piper.on('error', (error) => {
        console.error('[Piper TTS] Erreur de spawn:', error);
        reject(new Error('Impossible d\'exécuter Piper TTS'));
      });
    });
  }

  async synthesizeToBase64(text) {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const outputPath = path.join(tempDir, `tts-${Date.now()}.wav`);
    
    try {
      await this.synthesize(text, outputPath);
      const audioBuffer = await fs.readFile(outputPath);
      return audioBuffer.toString('base64');
    } finally {
      try {
        await fs.unlink(outputPath);
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
    }
  }
}

export default new PiperTtsService();