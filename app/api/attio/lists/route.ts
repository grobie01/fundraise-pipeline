import { NextResponse } from 'next/server';
import { getAttioLists } from '@/lib/attio';

export const dynamic = 'force-dynamic';

// GET /api/attio/lists - Fetch all Attio lists (for the export page dropdown)
export async function GET() {
  try {
    if (!process.env.ATTIO_API_KEY) {
      return NextResponse.json(
        { error: 'Attio API key not configured' },
        { status: 500 }
      );
    }

    const lists = await getAttioLists();

    return NextResponse.json({
      lists: lists.map(list => ({
        id: list.id.list_id,
        name: list.name,
        slug: list.api_slug,
      })),
    });
  } catch (error) {
    console.error('Error fetching Attio lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Attio lists' },
      { status: 500 }
    );
  }
}
