import { notFound } from 'next/navigation';
import FundraiseTracker from '@/components/FundraiseTracker';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function getList(id: string) {
  const supabase = createServerClient();

  const { data: list, error: listError } = await supabase
    .from('lists')
    .select('*')
    .eq('id', id)
    .single();

  if (listError || !list) {
    return null;
  }

  const { data: investors } = await supabase
    .from('investors')
    .select('*')
    .eq('list_id', id)
    .order('sort_order', { ascending: true });

  return {
    ...list,
    investors: investors || [],
  };
}

export default async function ListPage({ params }: PageProps) {
  const list = await getList(params.id);

  if (!list) {
    notFound();
  }

  return (
    <FundraiseTracker
      listId={list.id}
      listName={list.name}
      initialInvestors={list.investors}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const supabase = createServerClient();
  const { data: list } = await supabase
    .from('lists')
    .select('name')
    .eq('id', params.id)
    .single();

  return {
    title: list?.name || 'Pipeline Tracker',
  };
}
