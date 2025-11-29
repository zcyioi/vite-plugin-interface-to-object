import {useMemo} from 'react';

export interface GuardResult<T> {
  value: T;
  valid: boolean;
  reason?: string;
}

/**
 * Placeholder helper: wraps a raw value into a guard result shape.
 * Replace with real guarder validation logic when available.
 */
export function toGuardResult<T>(value: T, reason?: string): GuardResult<T> {
  return {
    value,
    valid: reason == null,
    reason,
  };
}

/**
 * Placeholder memoized guard helper.
 */
export function useGuardResult<T>(
  value: T,
  reason?: string,
): GuardResult<T> {
  return useMemo(() => toGuardResult(value, reason), [value, reason]);
}

export default toGuardResult;
