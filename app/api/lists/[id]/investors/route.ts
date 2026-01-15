import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/lists/[id]/investors - Add a new investor to a list
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listId = params.id;
    const body = await request.json();

    const supabase = createServerClient();

    // Verify the list exists
    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('id')
      .eq('id', listId)
      .single();

    if (listError || !list) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Get the highest sort_order for this list
    const { data: maxOrderResult } = await supabase
      .from('investors')
      .select('sort_order')
      .eq('list_id', listId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (maxOrderResult?.sort_order ?? -1) + 1;

    // Create the investor
    const { data: investor, error: investorError } = await supabase
      .from('investors')
      .insert({
        list_id: listId,
        name: body.name || '',
        status: body.status || 'Lead',
        next_steps: body.nextSteps || body.next_steps || '',
        notes: body.notes || '',
        amount: body.amount || '',
        primary_contact: body.primaryContact || body.primary_contact || '',
        firm_contact: body.firmContact || body.firm_contact || '',
        fit: body.fit ?? null,
        fund_size: body.fundSize || body.fund_size || '',
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (investorError) {
      console.error('Error creating investor:', investorError);
      return NextResponse.json(
        { error: 'Failed to create investor' },
        { status: 500 }
      );
    }

    return NextResponse.json(investor);
  } catch (error) {
    console.error('Error in POST /api/lists/[id]/investors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
