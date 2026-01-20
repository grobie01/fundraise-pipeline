import { NextRequest, NextResponse } from 'next/server';
import { getAttioListEntries, getAttioRecordNames } from '@/lib/attio';

export const dynamic = 'force-dynamic';

// GET /api/attio/lists/[id]/entries - Get entry count for a specific Attio list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listId } = await params;

    if (!process.env.ATTIO_API_KEY) {
      return NextResponse.json(
        { error: 'Attio API key not configured' },
        { status: 500 }
      );
    }

    const entries = await getAttioListEntries(listId);

    // Collect parent record IDs to fetch their names
    const parentRecordIds: { objectSlug: string; recordId: string }[] = [];
    for (const entry of entries.slice(0, 10)) {
      if (entry.parent_record_id && entry.parent_object) {
        parentRecordIds.push({
          objectSlug: entry.parent_object,
          recordId: entry.parent_record_id,
        });
      }
    }

    // Fetch parent record names
    const recordNames = await getAttioRecordNames(parentRecordIds);

    // Extract sample values for each attribute (first 3 unique non-empty values)
    const samplesByAttribute: Record<string, string[]> = {};

    // Add parent record samples
    samplesByAttribute['__parent_record__'] = [];
    for (const entry of entries.slice(0, 10)) {
      if (entry.parent_record_id && samplesByAttribute['__parent_record__'].length < 3) {
        const name = recordNames[entry.parent_record_id];
        if (name && !samplesByAttribute['__parent_record__'].includes(name)) {
          samplesByAttribute['__parent_record__'].push(name);
        }
      }
    }

    for (const entry of entries.slice(0, 10)) { // Only check first 10 entries for performance
      for (const [attrSlug, values] of Object.entries(entry.entry_values || {})) {
        if (!samplesByAttribute[attrSlug]) {
          samplesByAttribute[attrSlug] = [];
        }

        if (samplesByAttribute[attrSlug].length >= 3) continue;

        const valueArray = values as any[];
        if (!valueArray || valueArray.length === 0) continue;

        const firstValue = valueArray[0];
        let displayValue = '';

        // Extract display value based on field type
        if (firstValue.value !== undefined) {
          displayValue = String(firstValue.value);
        } else if (firstValue.option?.title) {
          displayValue = firstValue.option.title;
        } else if (firstValue.status?.title) {
          displayValue = firstValue.status.title;
        } else if (firstValue.currency_value !== undefined) {
          const amount = firstValue.currency_value;
          displayValue = amount >= 1000000 ? `$${(amount / 1000000).toFixed(0)}M` : `$${amount.toLocaleString()}`;
        } else if (firstValue.target_record?.name) {
          displayValue = firstValue.target_record.name;
        } else if (firstValue.referenced_actor?.name) {
          displayValue = firstValue.referenced_actor.name;
        }

        if (displayValue && !samplesByAttribute[attrSlug].includes(displayValue)) {
          samplesByAttribute[attrSlug].push(displayValue);
        }
      }
    }

    return NextResponse.json({
      count: entries.length,
      samples: samplesByAttribute,
    });
  } catch (error) {
    console.error('Error fetching Attio list entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Attio list entries' },
      { status: 500 }
    );
  }
}
