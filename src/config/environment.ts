// Environment configuration with proper environment variable support
export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  apiEndpoint: string;
  features: {
    realTimeSync: boolean;
    mockData: boolean;
    proxyAPIs: boolean;
  };
  security: {
    enableRateLimit: boolean;
    enableHelmet: boolean;
    jwtExpiresIn: string;
  };
}

// Get environment from various sources
const getEnvironment = (): 'development' | 'staging' | 'production' => {
  // Check Vite environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteEnv = import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE;
    if (viteEnv === 'development' || viteEnv === 'staging' || viteEnv === 'production') {
      return viteEnv;
    }
  }
  
  // Check process environment (for Node.js)
  if (typeof process !== 'undefined' && process.env) {
    const nodeEnv = process.env.NODE_ENV || process.env.ENVIRONMENT;
    if (nodeEnv === 'development' || nodeEnv === 'staging' || nodeEnv === 'production') {
      return nodeEnv;
    }
  }
  
  // Default to development
  return 'development';
};

// Get API endpoint based on environment
const getApiEndpoint = (): string => {
  // Check for explicit API endpoint override
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_ENDPOINT) {
    return import.meta.env.VITE_API_ENDPOINT;
  }
  
  if (typeof process !== 'undefined' && process.env?.API_ENDPOINT) {
    return process.env.API_ENDPOINT;
  }
  
  const env = getEnvironment();
  
  // Default endpoints per environment
  switch (env) {
    case 'development':
      return 'http://localhost:3000/api';
    case 'staging':
      return 'https://staging-api.yourdomain.com/api';
    case 'production':
      return 'https://api.yourdomain.com/api';
    default:
      return 'http://localhost:3000/api';
  }
};

export const CONFIG: EnvironmentConfig = {
  environment: getEnvironment(),
  apiEndpoint: getApiEndpoint(),
  
  features: {
    realTimeSync: getEnvironment() === 'production',
    mockData: getEnvironment() === 'development',
    proxyAPIs: getEnvironment() !== 'production'
  },
  
  security: {
    enableRateLimit: getEnvironment() === 'production',
    enableHelmet: true,
    jwtExpiresIn: getEnvironment() === 'development' ? '24h' : '8h'
  }
};

export const getEnvironmentMessage = () => {
  const env = CONFIG.environment;
  
  switch (env) {
    case 'development':
      return {
        type: 'info' as const,
        title: 'Development Environment',
        message: `Connected to development server: ${CONFIG.apiEndpoint}`
      };
    case 'staging':
      return {
        type: 'warning' as const,
        title: 'Staging Environment',
        message: `Connected to staging server: ${CONFIG.apiEndpoint}`
      };
    case 'production':
      return {
        type: 'success' as const,
        title: 'Production Environment',
        message: `Connected to production server: ${CONFIG.apiEndpoint}`
      };
    default:
      return {
        type: 'error' as const,
        title: 'Unknown Environment',
        message: 'Environment configuration error'
      };
  }
};

// Utility function to check if we're in development
export const isDevelopment = () => CONFIG.environment === 'development';
export const isProduction = () => CONFIG.environment === 'production';
export const isStaging = () => CONFIG.environment === 'staging';