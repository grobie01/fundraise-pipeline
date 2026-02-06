import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateUniqueSlug } from '@/lib/slug';

export const dynamic = 'force-dynamic';

// GET /api/lists - Get all lists for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch lists for this user with investor counts
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select(`
        id,
        name,
        slug,
        created_at,
        updated_at,
        investors:investors(count)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (listsError) {
      console.error('Error fetching lists:', listsError);
      return NextResponse.json(
        { error: 'Failed to fetch lists' },
        { status: 500 }
      );
    }

    // Transform the data to include investor counts by status
    const listsWithCounts = await Promise.all(
      (lists || []).map(async (list) => {
        const { data: investors } = await supabase
          .from('investors')
          .select('status')
          .eq('list_id', list.id);

        const statusCounts = investors?.reduce((acc: Record<string, number>, inv) => {
          acc[inv.status] = (acc[inv.status] || 0) + 1;
          return acc;
        }, {}) || {};

        return {
          id: list.id,
          name: list.name,
          slug: list.slug,
          created_at: list.created_at,
          updated_at: list.updated_at,
          investor_count: investors?.length || 0,
          status_counts: statusCounts,
        };
      })
    );

    return NextResponse.json({ lists: listsWithCounts });
  } catch (error) {
    console.error('Error in GET /api/lists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/lists - Create a new list with investors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, investors, column_order } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get current user (required for creating lists)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - You must be logged in to create a list' },
        { status: 401 }
      );
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(name, async (testSlug) => {
      const { data } = await supabase
        .from('lists')
        .select('id')
        .eq('slug', testSlug)
        .single();
      return !!data;
    });

    // Create the list with user_id and slug
    const { data: list, error: listError } = await supabase
      .from('lists')
      .insert({
        name,
        slug,
        user_id: user.id,
        column_order: column_order || null,
      })
      .select()
      .single();

    if (listError) {
      console.error('Error creating list:', listError);
      return NextResponse.json(
        { error: 'Failed to create list' },
        { status: 500 }
      );
    }

    // Add investors if provided
    if (investors && investors.length > 0) {
      const investorsToInsert = investors.map((inv: any, index: number) => ({
        list_id: list.id,
        name: inv.name || '',
        status: inv.status || 'Lead',
        next_steps: inv.nextSteps || inv.next_steps || '',
        notes: inv.notes || '',
        amount: inv.amount || '',
        primary_contact: inv.primaryContact || inv.primary_contact || '',
        firm_contact: inv.firmContact || inv.firm_contact || '',
        fit: inv.fit ?? null,
        fund_size: inv.fundSize || inv.fund_size || '',
        sort_order: index,
      }));

      const { error: investorsError } = await supabase
        .from('investors')
        .insert(investorsToInsert);

      if (investorsError) {
        console.error('Error adding investors:', investorsError);
        // Don't fail the whole request, the list was created
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

    return NextResponse.json({
      id: list.id,
      slug: list.slug,
      url: `${baseUrl}/list/${list.slug}`,
    });
  } catch (error) {
    console.error('Error in POST /api/lists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
