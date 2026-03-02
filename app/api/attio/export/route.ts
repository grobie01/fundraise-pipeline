import { NextRequest, NextResponse } from 'next/server';
import { getAttioListEntries, getAttioListAttributes, getAttioRecordNames, AttioListEntry } from '@/lib/attio';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper function to extract value from Attio entry
function extractAttioValue(
  entry: AttioListEntry,
  slug: string,
  parentRecordNames: Record<string, string> = {}
): string {
  // Handle special __parent_record__ slug
  if (slug === '__parent_record__') {
    if (entry.parent_record_id && parentRecordNames[entry.parent_record_id]) {
      return parentRecordNames[entry.parent_record_id];
    }
    return '';
  }

  const value = entry.entry_values[slug];
  if (!value || value.length === 0) return '';

  // Handle different Attio field types
  const firstValue = value[0];

  // Text fields
  if (firstValue.value !== undefined) {
    return String(firstValue.value);
  }

  // Select fields
  if (firstValue.option?.title) {
    return firstValue.option.title;
  }

  // Status fields
  if (firstValue.status?.title) {
    return firstValue.status.title;
  }

  // Currency fields
  if (firstValue.currency_value !== undefined) {
    const amount = firstValue.currency_value;
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(0)}M`;
    }
    return `$${amount.toLocaleString()}`;
  }

  // Linked record fields (like contacts)
  if (firstValue.target_record?.name) {
    return firstValue.target_record.name;
  }

  // User fields
  if (firstValue.referenced_actor?.name) {
    return firstValue.referenced_actor.name;
  }

  // Rating fields (numeric)
  if (typeof firstValue === 'number') {
    return String(firstValue);
  }

  return '';
}

// Map Attio status values to our status types
function mapStatusFromAttio(attioStatus: string): string {
  const statusMap: Record<string, string> = {
    'lead': 'Lead',
    'first meeting': 'First Meeting',
    'first_meeting': 'First Meeting',
    'partner meeting': 'Partner Meeting',
    'partner_meeting': 'Partner Meeting',
    'term sheet': 'Term Sheet',
    'term_sheet': 'Term Sheet',
    'passed': 'Passed',
    'pass': 'Passed',
  };

  const normalized = attioStatus.toLowerCase().trim();
  return statusMap[normalized] || 'Lead';
}

// POST /api/attio/export - Export an Attio list to our app
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attioListId, listName, selectedColumns, statusColumn, columnDisplayNames, columnOrder } = body;

    if (!attioListId) {
      return NextResponse.json(
        { error: 'Attio list ID is required' },
        { status: 400 }
      );
    }

    if (!statusColumn) {
      return NextResponse.json(
        { error: 'Status column is required' },
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

    // Fetch attribute metadata to get titles for selected columns
    const attributes = await getAttioListAttributes(attioListId);
    const attributeMap = new Map(
      attributes.map(attr => [attr.api_slug, attr.title])
    );

    // Check if we need to fetch parent record names
    let parentRecordNames: Record<string, string> = {};
    if (selectedColumns.includes('__parent_record__')) {
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

    // Map Attio entries to our format with dynamic columns
    const investors = entries.map(entry => {
      const customFields: Record<string, any> = {};

      // Extract values for selected columns (except status column which is handled separately)
      for (const slug of selectedColumns) {
        // Skip the status column as it's handled separately below
        if (slug === statusColumn) continue;

        // Use custom display name if provided, otherwise fall back to default title
        const displayName = columnDisplayNames?.[slug] ||
                          (slug === '__parent_record__' ? 'Record (Company/Firm)' : attributeMap.get(slug));
        if (!displayName) continue;

        const value = extractAttioValue(entry, slug, parentRecordNames);
        if (value) {
          customFields[displayName] = value;
        }
      }

      // Extract status
      const statusValue = extractAttioValue(entry, statusColumn, parentRecordNames);
      const status = mapStatusFromAttio(statusValue || '');

      // Find name field (use first non-empty value as fallback)
      const nameValue = customFields['Record (Company/Firm)'] ||
                        Object.values(customFields).find(v => v && typeof v === 'string') ||
                        'Unknown';

      return {
        name: String(nameValue),
        status,
        custom_fields: customFields,
      };
    });

    // Create the list in our database
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
    const { generateUniqueSlug } = await import('@/lib/slug');
    const slug = await generateUniqueSlug(listName || 'Imported List', async (testSlug) => {
      const { data } = await supabase
        .from('lists')
        .select('id')
        .eq('slug', testSlug)
        .single();
      return !!data;
    });

    const { data: list, error: listError } = await supabase
      .from('lists')
      .insert({
        name: listName || 'Imported List',
        slug,
        user_id: user.id,
        column_order: columnOrder || null,
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

    // Insert all investors with custom fields
    const investorsToInsert = investors.map((inv, index) => ({
      list_id: list.id,
      name: inv.name,
      status: inv.status,
      custom_fields: inv.custom_fields,
      sort_order: index,
    }));

    const { error: investorsError } = await supabase
      .from('investors')
      .insert(investorsToInsert);

    if (investorsError) {
      console.error('Error inserting investors:', investorsError);
      // List was created, but investors failed - still return the list
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${protocol}://${host}` : request.nextUrl.origin);

    return NextResponse.json({
      id: list.id,
      slug: list.slug,
      url: `${baseUrl}/list/${list.slug}`,
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
