import { CONFIG } from '../config/environment';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = CONFIG.apiEndpoint;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      requiresAuth = true
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
      ...(requiresAuth ? this.getAuthHeaders() : {})
    };

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        ...(body && { body: JSON.stringify(body) })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
  }

  // Authentication endpoints
  async login(username: string, password: string): Promise<ApiResponse<{ user: any; token: string }>> {
    return this.makeRequest('/auth/login', {
      method: 'POST',
      body: { username, password },
      requiresAuth: false
    });
  }

  // User endpoints
  async getUsers(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('/users');
  }

  async createUser(userData: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/users', {
      method: 'POST',
      body: userData
    });
  }

  async updateUser(userId: string, userData: any): Promise<ApiResponse<any>> {
    return this.makeRequest(`/users/${userId}`, {
      method: 'PUT',
      body: userData
    });
  }

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    return this.makeRequest(`/users/${userId}`, {
      method: 'DELETE'
    });
  }

  // Category endpoints
  async getCategories(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('/categories');
  }

  async createCategory(categoryData: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/categories', {
      method: 'POST',
      body: categoryData
    });
  }

  async deleteCategory(categoryId: string, migrateTo?: string): Promise<ApiResponse<void>> {
    const endpoint = migrateTo 
      ? `/categories/${categoryId}?migrateTo=${migrateTo}`
      : `/categories/${categoryId}`;
    
    return this.makeRequest(endpoint, {
      method: 'DELETE'
    });
  }

  // IP entries endpoints
  async getIPEntries(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('/ip-entries');
  }

  async createIPEntry(ipData: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/ip-entries', {
      method: 'POST',
      body: ipData
    });
  }

  async deleteIPEntry(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest(`/ip-entries/${id}`, {
      method: 'DELETE'
    });
  }

  async checkIPReputation(ip: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/ip-entries/check/${ip}`);
  }

  async extractFromSources(extractData: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/ip-entries/extract', {
      method: 'POST',
      body: extractData
    });
  }

  async bulkExtractFromSources(extractData: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/ip-entries/bulk-extract', {
      method: 'POST',
      body: extractData
    });
  }

  // Whitelist endpoints
  async getWhitelist(): Promise<ApiResponse<any[]>> {
    return this.makeRequest('/whitelist');
  }

  async addToWhitelist(whitelistData: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/whitelist', {
      method: 'POST',
      body: whitelistData
    });
  }

  async removeFromWhitelist(id: string): Promise<ApiResponse<void>> {
    return this.makeRequest(`/whitelist/${id}`, {
      method: 'DELETE'
    });
  }

  // EDL endpoints
  async getEDL(category: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/edl/${category}`);
  }

  // Sync endpoints
  async syncAbuseIPDB(): Promise<ApiResponse<any>> {
    return this.makeRequest('/sync/abuseipdb', {
      method: 'POST'
    });
  }

  async syncVirusTotal(): Promise<ApiResponse<any>> {
    return this.makeRequest('/sync/virustotal', {
      method: 'POST'
    });
  }
}

export const apiService = new ApiService();