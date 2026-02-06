import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// PATCH /api/investors/[id] - Update an investor
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const supabase = await createServerClient();

    // Build update object (only include fields that were sent)
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.status !== undefined) updates.status = body.status;
    if (body.nextSteps !== undefined) updates.next_steps = body.nextSteps;
    if (body.next_steps !== undefined) updates.next_steps = body.next_steps;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.amount !== undefined) updates.amount = body.amount;
    if (body.primaryContact !== undefined) updates.primary_contact = body.primaryContact;
    if (body.primary_contact !== undefined) updates.primary_contact = body.primary_contact;
    if (body.firmContact !== undefined) updates.firm_contact = body.firmContact;
    if (body.firm_contact !== undefined) updates.firm_contact = body.firm_contact;
    if (body.fit !== undefined) updates.fit = body.fit;
    if (body.fundSize !== undefined) updates.fund_size = body.fundSize;
    if (body.fund_size !== undefined) updates.fund_size = body.fund_size;
    if (body.custom_fields !== undefined) updates.custom_fields = body.custom_fields;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    const { data: investor, error } = await supabase
      .from('investors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating investor:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Investor not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to update investor' },
        { status: 500 }
      );
    }

    return NextResponse.json(investor);
  } catch (error) {
    console.error('Error in PATCH /api/investors/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/investors/[id] - Delete an investor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const supabase = await createServerClient();

    const { error } = await supabase
      .from('investors')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting investor:', error);
      return NextResponse.json(
        { error: 'Failed to delete investor' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/investors/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
