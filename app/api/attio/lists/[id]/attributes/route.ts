import { NextRequest, NextResponse } from 'next/server';
import { getAttioListAttributes } from '@/lib/attio';

export const dynamic = 'force-dynamic';

// GET /api/attio/lists/[id]/attributes - Fetch attributes for a specific Attio list
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

    const attributes = await getAttioListAttributes(listId);

    // Filter out system/meta attributes that aren't useful for mapping
    const systemSlugs = ['entry_id', 'created_at', 'created_by', 'entry_created_at', 'entry_created_by'];
    const filteredAttributes = attributes.filter(attr =>
      !systemSlugs.includes(attr.api_slug) &&
      !attr.api_slug.startsWith('entry_') &&
      !attr.title.toLowerCase().includes('added to list')
    );

    // Add a synthetic "Record" attribute for the parent record (company name)
    const syntheticRecord = {
      id: '__parent_record__',
      title: 'Record (Company/Firm)',
      slug: '__parent_record__',
      type: 'record',
    };

    return NextResponse.json({
      attributes: [
        syntheticRecord,
        ...filteredAttributes.map(attr => ({
          id: attr.id.attribute_id,
          title: attr.title,
          slug: attr.api_slug,
          type: attr.type,
        })),
      ],
    });
  } catch (error) {
    console.error('Error fetching Attio list attributes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Attio list attributes' },
      { status: 500 }
    );
  }
}
