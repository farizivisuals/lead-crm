import { useQuery } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

export type ClientRow = {
  id: string;
  company_name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export function useClients() {
  return useQuery({
    queryKey: qk.clients(),
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, profiles:primary_contact_profile_id(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientRow[];
    },
  });
}

export type ClientProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  target_end_date: string | null;
  project_departments:
    | { departments: { name: string; slug: string } | { name: string; slug: string }[] | null }[]
    | null;
};

export type QuoteLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
};

export type QuoteRow = {
  id: string;
  quote_number: string;
  title: string;
  valid_until: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  quote_line_items: QuoteLineItem[] | null;
};

export type ClientDetail = {
  client: ClientRow;
  projects: ClientProject[];
  quotes: QuoteRow[];
};

export function useClientDetail(clientId: string) {
  return useQuery({
    queryKey: qk.client(clientId),
    queryFn: async (): Promise<ClientDetail> => {
      const [clientRes, projectsRes, quotesRes] = await Promise.all([
        supabase
          .from('clients')
          .select('*, profiles:primary_contact_profile_id(full_name, avatar_url)')
          .eq('id', clientId)
          .single(),
        supabase
          .from('projects')
          .select('*, project_departments(*, departments(name, slug))')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('quotes')
          .select('*, quote_line_items(description, quantity, unit_price, position)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ]);
      if (clientRes.error) throw clientRes.error;
      if (!clientRes.data) throw new Error('Client not found');
      if (projectsRes.error) throw projectsRes.error;
      if (quotesRes.error) throw quotesRes.error;

      return {
        client: clientRes.data as unknown as ClientRow,
        projects: (projectsRes.data ?? []) as unknown as ClientProject[],
        quotes: (quotesRes.data ?? []) as unknown as QuoteRow[],
      };
    },
  });
}
