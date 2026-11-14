/**
 * Saved Searches Service for Dezignet
 * Supports saving, retrieving, executing, and deleting searches
 * for both Projects feed and Find Designers directory.
 * Enforces maximum 10 saved searches per user per type.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import type { Json } from '../types/database.types';

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  type: 'projects' | 'designers';
  params: Record<string, any>;
  notify: boolean;
  created_at: string;
  updated_at: string;
}

// In-memory fallback store for mock mode
const mockSavedSearches: SavedSearch[] = [];

export async function getSavedSearches(type: 'projects' | 'designers'): Promise<SavedSearch[]> {
  if (!USE_MOCKS.projects) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return mockSavedSearches.filter((s) => s.type === type);

      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', type)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return (data as any[]).map((row) => ({
          id: row.id,
          user_id: row.user_id,
          name: row.name,
          type: row.type,
          params: (typeof row.params === 'object' && row.params !== null ? row.params : {}) as Record<string, any>,
          notify: Boolean(row.notify),
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
      }
    } catch (err) {
      console.warn('Could not load saved searches from Supabase, using mock fallback:', err);
    }
  }

  return mockSavedSearches.filter((s) => s.type === type);
}

export async function saveSearch(
  name: string,
  type: 'projects' | 'designers',
  params: Record<string, any>,
  notify: boolean = false
): Promise<SavedSearch> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Please enter a name for your saved search.');
  }

  if (!USE_MOCKS.projects) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Enforce maximum 10 client-side before calling DB
        const existing = await getSavedSearches(type);
        if (existing.length >= 10) {
          throw new Error('You have reached the maximum limit of 10 saved searches. Please remove an existing search first.');
        }

        const { data, error } = await supabase
          .from('saved_searches')
          .insert({
            user_id: user.id,
            name: trimmedName,
            type,
            params: params as Json,
            notify
          })
          .select()
          .single();

        if (error) {
          if (error.message?.includes('10')) {
            throw new Error('You have reached the maximum limit of 10 saved searches.');
          }
          throw error;
        }

        if (data) {
          const item: SavedSearch = {
            id: (data as any).id,
            user_id: (data as any).user_id,
            name: (data as any).name,
            type: (data as any).type,
            params: ((data as any).params || {}) as Record<string, any>,
            notify: Boolean((data as any).notify),
            created_at: (data as any).created_at,
            updated_at: (data as any).updated_at
          };
          return item;
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('maximum') || err?.message?.includes('10')) {
        throw err;
      }
      console.warn('Could not save search to DB, using mock fallback:', err);
    }
  }

  // Fallback in-memory
  const existingForType = mockSavedSearches.filter((s) => s.type === type);
  if (existingForType.length >= 10) {
    throw new Error('You have reached the maximum limit of 10 saved searches. Please remove an existing search first.');
  }

  const newSaved: SavedSearch = {
    id: 'mock-search-' + Date.now(),
    user_id: 'mock-user-1',
    name: trimmedName,
    type,
    params,
    notify,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  mockSavedSearches.unshift(newSaved);
  return newSaved;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  if (!USE_MOCKS.projects) {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);

      if (!error) return;
    } catch (err) {
      console.warn('Could not delete saved search in DB, using mock fallback:', err);
    }
  }

  const idx = mockSavedSearches.findIndex((s) => s.id === id);
  if (idx !== -1) {
    mockSavedSearches.splice(idx, 1);
  }
}

export const savedSearchesService = {
  getSavedSearches,
  saveSearch,
  deleteSavedSearch
};
