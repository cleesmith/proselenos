// lib/secure-storage.ts
// SERVER-SIDE ONLY - Never expose this to client routes
import * as crypto from 'crypto';
import { drive_v3 } from 'googleapis';

interface EncryptedData {
  iv: string;
  data: string;
}

interface StorageConfig {
  [keyName: string]: EncryptedData | string;
}

export class InternalSecureStorage {
  private drive: drive_v3.Drive;
  private userId: string;
  private configFileName: string = 'storygrind-settings.json';
  private appSecret: string;

  constructor(googleDriveClient: drive_v3.Drive, userId: string) {
    this.drive = googleDriveClient;
    this.userId = userId;
    
    // App-only secret - users can never decrypt this
    this.appSecret = process.env.APP_ENCRYPTION_SECRET || '';
    if (!this.appSecret) {
      throw new Error('APP_ENCRYPTION_SECRET environment variable required');
    }
  }

  // Generate encryption key that ONLY your app can create
  private getAppOnlyKey(): Buffer {
    // Combine user ID with app secret that only your server knows
    const combined = this.userId + this.appSecret + 'storygrind-keys';
    return crypto.createHash('sha256').update(combined).digest();
  }

  // Encrypt - only your app can do this
  private _encrypt(plaintext: string): EncryptedData {
    const key = this.getAppOnlyKey().slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  // Decrypt - only your app can do this
  private _decrypt(encryptedData: EncryptedData | any): string {
    const key = this.getAppOnlyKey().slice(0, 32);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Find config file in user's storygrind_projects folder on Google Drive
  private async findOrCreateProjectsFolder(): Promise<string> {
    try {
      // First check if storygrind_projects folder exists
      const folderQuery = await this.drive.files.list({
        q: "name='storygrind_projects' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)',
      });

      if (folderQuery.data.files && folderQuery.data.files.length > 0) {
        return folderQuery.data.files[0].id!;
      }

      // Create the folder if it doesn't exist
      const folderResponse = await this.drive.files.create({
        requestBody: {
          name: 'storygrind_projects',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });

      return folderResponse.data.id!;
    } catch (error) {
      console.error('Error finding/creating storygrind_projects folder:', error);
      throw error;
    }
  }

  // Find config file in user's Google Drive
  private async findConfigFile(): Promise<drive_v3.Schema$File | null> {
    try {
      const folderId = await this.findOrCreateProjectsFolder();
      
      const response = await this.drive.files.list({
        q: `name='${this.configFileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
      });
      
      return response.data.files && response.data.files.length > 0 
        ? response.data.files[0] 
        : null;
    } catch (error) {
      console.error('Error finding config file:', error);
      return null;
    }
  }

  // Load encrypted config from Google Drive
  private async loadConfig(): Promise<StorageConfig> {
    try {
      const configFile = await this.findConfigFile();
      if (!configFile || !configFile.id) return {};

      const response = await this.drive.files.get({
        fileId: configFile.id,
        alt: 'media',
      });

      const data = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
        
      return JSON.parse(data) as StorageConfig;
    } catch (error) {
      console.error('Error loading config:', error);
      return {};
    }
  }

  // Save encrypted config to Google Drive
  private async saveConfig(config: StorageConfig): Promise<void> {
    try {
      const configFile = await this.findConfigFile();
      const configData = JSON.stringify(config, null, 2);

      if (configFile && configFile.id) {
        await this.drive.files.update({
          fileId: configFile.id,
          media: {
            mimeType: 'application/json',
            body: configData,
          },
        });
      } else {
        const folderId = await this.findOrCreateProjectsFolder();
        await this.drive.files.create({
          requestBody: {
            name: this.configFileName,
            parents: [folderId],
          },
          media: {
            mimeType: 'application/json',
            body: configData,
          },
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  // Store API key (encrypted, only your app can decrypt)
  async storeApiKey(keyName: string, apiKey: string): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      const encrypted = this._encrypt(apiKey);
      
      config[keyName] = encrypted;
      config.last_updated = new Date().toISOString();
      
      await this.saveConfig(config);
      return true;
    } catch (error) {
      console.error('Error storing API key:', error);
      return false;
    }
  }

  // Get API key (only your app can decrypt)
  async getApiKey(keyName: string): Promise<string | null> {
    try {
      const config = await this.loadConfig();
      const encryptedData = config[keyName];
      
      if (!encryptedData || typeof encryptedData === 'string') return null;
      
      return this._decrypt(encryptedData as EncryptedData);
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  // Remove API key
  async removeApiKey(keyName: string): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      delete config[keyName];
      config.last_updated = new Date().toISOString();
      
      await this.saveConfig(config);
      return true;
    } catch (error) {
      console.error('Error removing API key:', error);
      return false;
    }
  }

  // Check if key exists (not the key itself)
  async hasApiKey(keyName: string): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      return keyName in config && keyName !== 'last_updated';
    } catch (error) {
      console.error('Error checking for API key:', error);
      return false;
    }
  }

  // Get all data in single config load
  async getBatchData(provider: string): Promise<{hasKey: boolean, apiKey: string | null}> {
    const config = await this.loadConfig(); // Load ONCE
    const hasKey = provider in config && provider !== 'last_updated';
    const encryptedData = config[provider];
    const apiKey = encryptedData && typeof encryptedData !== 'string' 
      ? this._decrypt(encryptedData as EncryptedData) 
      : null;
    return { hasKey, apiKey };
  }
}

export default InternalSecureStorage;