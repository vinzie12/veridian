/**
 * useApi Hook
 * React hook for API calls with loading, error, and data state
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ApiError } from '../services/apiClient';

/**
 * Hook for making API calls with automatic state management
 * 
 * @param {Function} apiFunction - The API service function to call
 * @param {Object} options - Hook options
 * @param {boolean} options.immediate - Execute immediately on mount
 * @param {Function} options.onSuccess - Callback on success
 * @param {Function} options.onError - Callback on error
 * @param {*} options.initialData - Initial data value
 */
export const useApi = (apiFunction, options = {}) => {
  const {
    immediate = false,
    onSuccess = null,
    onError = null,
    initialData = null,
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  // Track if component is mounted
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction(...args);
      
      if (mountedRef.current) {
        setData(result?.data ?? result);
        
        if (onSuccess) {
          onSuccess(result);
        }
      }
      
      return { success: true, data: result };
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError(err.message, 'UNKNOWN_ERROR');
      
      if (mountedRef.current) {
        setError(apiError);
        
        if (onError) {
          onError(apiError);
        }
      }
      
      return { success: false, error: apiError };
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  const retry = useCallback(() => {
    execute();
  }, [execute]);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate]); // Don't include execute to prevent loops

  return {
    data,
    loading,
    error,
    execute,
    reset,
    retry,
    isFetching: loading,
    hasError: !!error,
    isEmpty: !loading && !error && !data,
  };
};

/**
 * Hook for paginated API calls
 * 
 * @param {Function} apiFunction - The API service function
 * @param {Object} options - Hook options
 */
export const usePaginatedApi = (apiFunction, options = {}) => {
  const {
    pageSize = 20,
    immediate = true,
    onSuccess = null,
    onError = null,
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPage = useCallback(async (pageNum, params = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction({
        page: pageNum,
        limit: pageSize,
        ...params,
      });

      if (!mountedRef.current) return { success: false };

      const items = result?.data || [];
      const meta = result?.meta?.pagination || {};

      if (pageNum === 1) {
        setData(items);
      } else {
        setData(prev => [...prev, ...items]);
      }

      setPage(meta.page || pageNum);
      setTotal(meta.total || 0);
      setHasMore(meta.hasNext || (items.length === pageSize));

      if (onSuccess) {
        onSuccess(result);
      }

      return { success: true, data: items };
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError(err.message, 'UNKNOWN_ERROR');
      
      if (mountedRef.current) {
        setError(apiError);
        
        if (onError) {
          onError(apiError);
        }
      }
      
      return { success: false, error: apiError };
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, pageSize, onSuccess, onError]);

  const loadMore = useCallback((params = {}) => {
    if (!loading && hasMore) {
      fetchPage(page + 1, params);
    }
  }, [loading, hasMore, page, fetchPage]);

  const refresh = useCallback((params = {}) => {
    setPage(1);
    setHasMore(true);
    return fetchPage(1, params);
  }, [fetchPage]);

  // Initial fetch
  useEffect(() => {
    if (immediate) {
      fetchPage(1);
    }
  }, [immediate]); // Don't include fetchPage to prevent loops

  return {
    data,
    loading,
    error,
    page,
    total,
    hasMore,
    loadMore,
    refresh,
    isFetching: loading,
    hasError: !!error,
    isEmpty: !loading && !error && data.length === 0,
  };
};

/**
 * Hook for mutations (create, update, delete)
 * 
 * @param {Function} apiFunction - The API service function
 * @param {Object} options - Hook options
 */
export const useMutation = (apiFunction, options = {}) => {
  const {
    onSuccess = null,
    onError = null,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction(...args);
      
      if (mountedRef.current) {
        if (onSuccess) {
          onSuccess(result);
        }
      }
      
      return { success: true, data: result };
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError(err.message, 'UNKNOWN_ERROR');
      
      if (mountedRef.current) {
        setError(apiError);
        
        if (onError) {
          onError(apiError);
        }
      }
      
      return { success: false, error: apiError };
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, onSuccess, onError]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    mutate,
    loading,
    error,
    reset,
    isSubmitting: loading,
    hasError: !!error,
  };
};

/**
 * useRefreshOnFocus Hook
 * Refresh data when screen comes into focus
 */
export const useRefreshOnFocus = (refreshFunction, deps = []) => {
  const { useIsFocused } = require('@react-navigation/native');
  const isFocused = useIsFocused();
  const prevFocused = useRef(false);

  useEffect(() => {
    if (isFocused && !prevFocused.current) {
      refreshFunction();
    }
    prevFocused.current = isFocused;
  }, [isFocused, ...deps]);
};

/**
 * useInfiniteScroll Hook
 * Hook for infinite scroll with FlatList
 */
export const useInfiniteScroll = (loadMore, hasMore, loading) => {
  const { ActivityIndicator } = require('react-native');
  
  const handleEndReached = useCallback(() => {
    if (!loading && hasMore) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  const onEndReachedThreshold = 0.5;

  return {
    onEndReached: handleEndReached,
    onEndReachedThreshold,
    ListFooterComponent: loading ? (
      <ActivityIndicator size="large" color="#00ff88" style={{ margin: 20 }} />
    ) : null,
  };
};

export default {
  useApi,
  usePaginatedApi,
  useMutation,
  useRefreshOnFocus,
  useInfiniteScroll,
};
