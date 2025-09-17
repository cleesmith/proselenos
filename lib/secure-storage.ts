// lib/secure-storage.ts

// SERVER-SIDE ONLY - Never expose this to client routes

import * as crypto from 'crypto';
import { drive_v3 } from 'googleapis';
import { findRootFolderByProperty } from '@/lib/googleDrive';

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
  private configFileName: string = 'proselenos-settings.json';
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
    const combined = this.userId + this.appSecret + 'proselenos-keys';
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

  // Find config file in user's proselenos_projects folder on Google Drive
  private async findOrCreateProjectsFolder(): Promise<string> {
    // Use appProperties only
    const folderByProp = await findRootFolderByProperty(this.drive);
    if (folderByProp?.id) {
      // console.log('InternalSecureStorage: root folder by appProperties', {
      //   id: folderByProp.id,
      //   name: folderByProp.name,
      //   appProperties: folderByProp.appProperties,
      // });
      return folderByProp.id!;
    }

    // Create the folder and tag it
    const folderResponse = await this.drive.files.create({
      requestBody: {
        name: 'proselenos_projects',
        mimeType: 'application/vnd.google-apps.folder',
        appProperties: { proselenosRoot: 'true' },
      },
      fields: 'id, name, appProperties',
    });
    // console.log('InternalSecureStorage: created root with appProperties', {
    //   id: folderResponse.data.id,
    //   name: folderResponse.data.name,
    //   appProperties: (folderResponse.data as any).appProperties,
    // });
    return folderResponse.data.id!;
  }

  // Find config file in user's Google Drive
  private async findConfigFile(): Promise<drive_v3.Schema$File | null> {
    try {
      const folderId = await this.findOrCreateProjectsFolder();
      
      const response = await this.drive.files.list({
        q: `appProperties has { key='type' and value='proselenos-settings' } and trashed=false and '${folderId}' in parents`,
        fields: 'files(id, name, appProperties)',
      });
      const file = response.data.files && response.data.files.length > 0 
        ? response.data.files[0] 
        : null;
      // if (file) {
      //   console.log('InternalSecureStorage: found settings by appProperties', {
      //     id: file.id,
      //     name: file.name,
      //     appProperties: (file as any).appProperties,
      //   });
      // }
      return file;
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
        const created = await this.drive.files.create({
          requestBody: {
            name: this.configFileName,
            parents: [folderId],
            appProperties: { type: 'proselenos-settings' },
          },
          media: {
            mimeType: 'application/json',
            body: configData,
          },
          fields: 'id, name, appProperties',
        });
        // console.log('InternalSecureStorage: created settings with appProperties', {
        //   id: created.data.id,
        //   name: created.data.name,
        //   appProperties: (created.data as any).appProperties,
        // });
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
