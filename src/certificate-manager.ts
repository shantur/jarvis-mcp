import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export class CertificateManager {
  private certDir: string;
  private certPath: string;
  private keyPath: string;

  constructor() {
    // Store certificates in user's home directory
    this.certDir = path.join(os.homedir(), '.mcp-browser-voice', 'certs');
    this.certPath = path.join(this.certDir, 'cert.pem');
    this.keyPath = path.join(this.certDir, 'key.pem');
  }

  async getCertificates(): Promise<{ cert: string; key: string }> {
    // Check if certificates exist and are valid
    if (await this.certificatesExistAndValid()) {
      console.error('[Certs] Using existing certificates');
      const [cert, key] = await Promise.all([
        fs.readFile(this.certPath, 'utf8'),
        fs.readFile(this.keyPath, 'utf8')
      ]);
      return { cert, key };
    }

    // Generate new certificates
    console.error('[Certs] Generating new self-signed certificates...');
    await this.generateCertificates();
    
    const [cert, key] = await Promise.all([
      fs.readFile(this.certPath, 'utf8'),
      fs.readFile(this.keyPath, 'utf8')
    ]);
    
    console.error('[Certs] Self-signed certificates generated successfully');
    return { cert, key };
  }

  private async certificatesExistAndValid(): Promise<boolean> {
    try {
      const [certStats, keyStats] = await Promise.all([
        fs.stat(this.certPath),
        fs.stat(this.keyPath)
      ]);

      // Check if files exist and are not too old (valid for 365 days, regenerate after 330)
      const now = new Date();
      const certAge = now.getTime() - certStats.mtime.getTime();
      const maxAge = 330 * 24 * 60 * 60 * 1000; // 330 days in milliseconds

      return certAge < maxAge;
    } catch (error) {
      return false;
    }
  }

  private async generateCertificates(): Promise<void> {
    // Ensure certificate directory exists
    await fs.mkdir(this.certDir, { recursive: true });

    // Generate private key
    await execAsync(`openssl genrsa -out "${this.keyPath}" 2048`);

    // Create certificate configuration
    const configContent = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
`;

    const configPath = path.join(this.certDir, 'cert.conf');
    await fs.writeFile(configPath, configContent.trim());

    // Generate certificate
    await execAsync(`openssl req -new -x509 -key "${this.keyPath}" -out "${this.certPath}" -days 365 -config "${configPath}"`);

    // Clean up config file
    await fs.unlink(configPath);

    console.error('[Certs] Certificate files created:');
    console.error(`[Certs] - Certificate: ${this.certPath}`);
    console.error(`[Certs] - Private Key: ${this.keyPath}`);
  }

  async deleteCertificates(): Promise<void> {
    try {
      await Promise.all([
        fs.unlink(this.certPath).catch(() => {}),
        fs.unlink(this.keyPath).catch(() => {})
      ]);
      console.error('[Certs] Certificates deleted');
    } catch (error) {
      console.error('[Certs] Error deleting certificates:', error);
    }
  }

  getCertificatePaths(): { cert: string; key: string; dir: string } {
    return {
      cert: this.certPath,
      key: this.keyPath,
      dir: this.certDir
    };
  }
}