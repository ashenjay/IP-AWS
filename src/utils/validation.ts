import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Common validation schemas
export const schemas = {
  // User validation
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).required()
  }),

  createUser: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      }),
    email: Joi.string().email().required(),
    role: Joi.string().valid('admin', 'user', 'readonly').default('user'),
    assignedCategories: Joi.array().items(Joi.string()).default([])
  }),

  updateUser: Joi.object({
    username: Joi.string().alphanum().min(3).max(30),
    email: Joi.string().email(),
    role: Joi.string().valid('admin', 'user', 'readonly'),
    isActive: Joi.boolean(),
    assignedCategories: Joi.array().items(Joi.string())
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      })
  }),

  // IP validation
  ipEntry: Joi.object({
    ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).required(),
    description: Joi.string().max(500).required(),
    category: Joi.string().required(),
    source: Joi.string().max(100).default('manual'),
    confidence: Joi.number().min(0).max(100).default(100)
  }),

  // Category validation
  category: Joi.object({
    name: Joi.string().min(1).max(50).required(),
    description: Joi.string().max(200).required(),
    color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#3B82F6')
  }),

  // Whitelist validation
  whitelist: Joi.object({
    ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).required(),
    description: Joi.string().max(500).required(),
    expiresAt: Joi.date().greater('now').optional()
  }),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'ip', 'category').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
};

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessage
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Query parameter validation middleware
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return res.status(400).json({
        error: 'Query validation failed',
        details: errorMessage
      });
    }

    req.query = value;
    next();
  };
};

// IP address validation utility
export const isValidIP = (ip: string): boolean => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// Sanitize user input
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, 1000); // Limit length
};

// Rate limiting key generator
export const generateRateLimitKey = (req: Request): string => {
  // Use IP address and user ID if available
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = (req as any).user?.userId || 'anonymous';
  return `${ip}:${userId}`;
};