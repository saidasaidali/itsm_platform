import { spawn, exec as execCb } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const exec = promisify(execCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class WhisperService {
  constructor() {
    // Les chemins sont résolus dynamiquement dans checkAvailability()
    this.whisperPath = null;
    this.modelPath = null;
  }

  // Vérifie que le .exe ET le modèle existent vraiment sur le disque
  async checkAvailability() {
    // Recalculer les chemins depuis les settings à chaque vérification
    const { getSettings } = await import('./settingsService.js');
    const s = getSettings();
    this.whisperPath = s.whisper_cpp_path || 'whisper-cli';
    const rawModel = s.whisper_model_path || './models/ggml-base.bin';
    this.modelPath = path.isAbsolute(rawModel) ? rawModel : path.resolve(process.cwd(), rawModel);

    try {
      await fs.access(this.whisperPath);
    } catch {
      throw new Error(
        `Whisper executable introuvable : ${this.whisperPath}\n` +
        `Vérifiez WHISPER_CPP_PATH dans votre configuration`)
    }
    try {
      await fs.access(this.modelPath);
    } catch {
      throw new Error(
        `Modèle Whisper introuvable : ${this.modelPath}\n` +
        `Téléchargez ggml-small.bin dans le dossier models/ du backend`)
    }
  }

  // Convertit webm/ogg/mp4 → wav via ffmpeg (requis par whisper-cli)
  async convertToWav(inputPath, outputPath) {
    try {
      await exec(`ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`);
    } catch (err) {
      throw new Error(
        `Conversion audio échouée. ffmpeg est-il installé ?\n` +
        `Installez-le : https://ffmpeg.org/download.html\n` +
        `Détail : ${err.message}`
      );
    }
  }

  async transcribeWithFallback(audioBuffer, language = 'fr') {
    // 1. Vérifier que tout est en place
    await this.checkAvailability();

    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const ts = Date.now();
    const rawPath = path.join(tempDir, `audio-raw-${ts}.webm`);
    const wavPath = path.join(tempDir, `audio-${ts}.wav`);
    const outBase = path.join(tempDir, `transcript-${ts}`);
    const outTxt  = outBase + '.txt';

    try {
      // 2. Sauvegarder le buffer brut
      await fs.writeFile(rawPath, audioBuffer);

      // 3. Convertir en WAV 16kHz mono (format attendu par whisper)
      await this.convertToWav(rawPath, wavPath);

      // 4. Lancer whisper-cli
      const transcript = await this.runWhisper(wavPath, outBase, language);

      return transcript;
    } finally {
      // 5. Nettoyage des fichiers temporaires
      for (const f of [rawPath, wavPath, outTxt]) {
        try { await fs.unlink(f); } catch { /* ignore */ }
      }
    }
  }

  runWhisper(wavPath, outBase, language) {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', this.modelPath,
        '-f', wavPath,
        '-l', language,
        '-otxt',
        '-of', outBase,
        '--no-timestamps'
      ];

      console.log('[Whisper] Commande:', this.whisperPath, args.join(' '));

      const proc = spawn(this.whisperPath, args, { windowsHide: true });
      let stderr = '';

      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.stdout.on('data', d => { /* whisper écrit dans le fichier, pas stdout */ });

      proc.on('close', async (code) => {
        if (code === 0) {
          try {
            const text = await fs.readFile(outBase + '.txt', 'utf-8');
            resolve(text.trim());
          } catch {
            reject(new Error('Fichier de transcription introuvable après whisper'));
          }
        } else {
          console.error('[Whisper] stderr:', stderr);
          reject(new Error(`whisper-cli a retourné le code ${code}. Détail: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Impossible de lancer whisper-cli: ${err.message}`));
      });
    });
  }
}

export default new WhisperService();