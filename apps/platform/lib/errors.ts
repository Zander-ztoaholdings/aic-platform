import { NextResponse } from 'next/server';
import { AICErrorCode, AICErrorResponse } from '@aic/types';

export function createErrorResponse(
  code: AICErrorCode,
  message: string,
  status: number = 500,
  detail?: any
) {
  const response: AICErrorResponse = {
    code,
    message,
    detail,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status });
}

export const ErrorFactory = {
  unauthorized: (message = 'Authentication required') => 
    createErrorResponse(AICErrorCode.UNAUTHORIZED, message, 401),
    
  forbidden: (message = 'Insufficient permissions') => 
    createErrorResponse(AICErrorCode.FORBIDDEN, message, 403),
    
  notFound: (message = 'Resource not found') => 
    createErrorResponse(AICErrorCode.NOT_FOUND, message, 404),
    
  badRequest: (message = 'Invalid request parameters', detail?: any) => 
    createErrorResponse(AICErrorCode.INVALID_INPUT, message, 400, detail),
    
  internal: (message = 'An unexpected error occurred') => 
    createErrorResponse(AICErrorCode.INTERNAL_SERVER_ERROR, message, 500),
};
