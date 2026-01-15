import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/lists - Create a new list with investors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, investors } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Create the list
    const { data: list, error: listError } = await supabase
      .from('lists')
      .insert({ name })
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
      url: `${baseUrl}/list/${list.id}`,
    });
  } catch (error) {
    console.error('Error in POST /api/lists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
