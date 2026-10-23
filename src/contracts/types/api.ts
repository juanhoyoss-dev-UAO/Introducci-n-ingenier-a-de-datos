export interface SuccessResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

