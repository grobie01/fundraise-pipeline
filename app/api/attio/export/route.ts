import { NextRequest, NextResponse } from 'next/server';
import { getAttioListEntries, mapAttioEntryToInvestor, getAttioRecordNames, AttioFieldMapping } from '@/lib/attio';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/attio/export - Export an Attio list to our app
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attioListId, listName, fieldMapping } = body;

    if (!attioListId) {
      return NextResponse.json(
        { error: 'Attio list ID is required' },
        { status: 400 }
      );
    }

    if (!process.env.ATTIO_API_KEY) {
      return NextResponse.json(
        { error: 'Attio API key not configured' },
        { status: 500 }
      );
    }

    // Fetch entries from Attio
    const entries = await getAttioListEntries(attioListId);

    if (!entries || entries.length === 0) {
      return NextResponse.json(
        { error: 'No entries found in Attio list' },
        { status: 400 }
      );
    }

    // Use provided field mapping or default empty mapping
    const mapping: AttioFieldMapping = fieldMapping || {
      name: null,
      status: null,
      nextSteps: null,
      notes: null,
      amount: null,
      primaryContact: null,
      firmContact: null,
      fit: null,
      fundSize: null,
    };

    // If name is mapped to __parent_record__, fetch parent record names
    let parentRecordNames: Record<string, string> = {};
    if (mapping.name === '__parent_record__') {
      const parentRecordIds: { objectSlug: string; recordId: string }[] = [];
      for (const entry of entries) {
        if (entry.parent_record_id && entry.parent_object) {
          parentRecordIds.push({
            objectSlug: entry.parent_object,
            recordId: entry.parent_record_id,
          });
        }
      }
      parentRecordNames = await getAttioRecordNames(parentRecordIds);
    }

    // Map Attio entries to our format using the provided mapping
    const investors = entries.map(entry => mapAttioEntryToInvestor(entry, mapping, parentRecordNames));

    // Create the list in our database
    const supabase = createServerClient();

    const { data: list, error: listError } = await supabase
      .from('lists')
      .insert({ name: listName || 'Imported List' })
      .select()
      .single();

    if (listError) {
      console.error('Error creating list:', listError);
      return NextResponse.json(
        { error: 'Failed to create list' },
        { status: 500 }
      );
    }

    // Insert all investors
    const investorsToInsert = investors.map((inv, index) => ({
      list_id: list.id,
      ...inv,
      sort_order: index,
    }));

    const { error: investorsError } = await supabase
      .from('investors')
      .insert(investorsToInsert);

    if (investorsError) {
      console.error('Error inserting investors:', investorsError);
      // List was created, but investors failed - still return the list
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

    return NextResponse.json({
      id: list.id,
      url: `${baseUrl}/list/${list.id}`,
      investorCount: investors.length,
    });
  } catch (error) {
    console.error('Error in POST /api/attio/export:', error);
    return NextResponse.json(
      { error: 'Failed to export from Attio' },
      { status: 500 }
    );
  }
}
