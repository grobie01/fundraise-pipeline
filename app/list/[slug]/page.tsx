import { notFound } from 'next/navigation';
import FundraiseTracker from '@/components/FundraiseTracker';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getListBySlug(slug: string) {
  const supabase = await createServerClient();

  const { data: list, error: listError } = await supabase
    .from('lists')
    .select('*')
    .eq('slug', slug)
    .single();

  if (listError || !list) {
    return null;
  }

  const { data: investors } = await supabase
    .from('investors')
    .select('*')
    .eq('list_id', list.id)
    .order('sort_order', { ascending: true });

  return {
    ...list,
    investors: investors || [],
  };
}

export default async function ListPage({ params }: PageProps) {
  const { slug } = await params;
  const list = await getListBySlug(slug);

  if (!list) {
    notFound();
  }

  return (
    <FundraiseTracker
      listId={list.id}
      listName={list.name}
      listSlug={list.slug}
      initialInvestors={list.investors}
      initialColumnOrder={list.column_order}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: list } = await supabase
    .from('lists')
    .select('name')
    .eq('slug', slug)
    .single();

  return {
    title: list?.name || 'Pipeline Tracker',
  };
}
