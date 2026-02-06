import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateUniqueSlug } from '@/lib/slug';

export const dynamic = 'force-dynamic';

// GET /api/lists/[slug] - Fetch a list with all its investors
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createServerClient();

    // Fetch the list by slug
    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('*')
      .eq('slug', slug)
      .single();

    if (listError || !list) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Fetch all investors for this list
    const { data: investors, error: investorsError } = await supabase
      .from('investors')
      .select('*')
      .eq('list_id', list.id)
      .order('sort_order', { ascending: true });

    if (investorsError) {
      console.error('Error fetching investors:', investorsError);
      return NextResponse.json(
        { error: 'Failed to fetch investors' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...list,
      investors: investors || [],
    });
  } catch (error) {
    console.error('Error in GET /api/lists/[slug]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/lists/[slug] - Update a list (name, column_order)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const supabase = await createServerClient();

    // Fetch the list to get its ID
    const { data: existingList } = await supabase
      .from('lists')
      .select('id, slug, name')
      .eq('slug', slug)
      .single();

    if (!existingList) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Build update object (only include fields that were sent)
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // If name is being updated, regenerate slug
    if (body.name !== undefined && body.name !== existingList.name) {
      updates.name = body.name;
      updates.slug = await generateUniqueSlug(body.name, async (testSlug) => {
        // Don't count current list as a collision
        if (testSlug === existingList.slug) return false;
        const { data } = await supabase
          .from('lists')
          .select('id')
          .eq('slug', testSlug)
          .single();
        return !!data;
      });
    }

    if (body.column_order !== undefined) {
      updates.column_order = body.column_order;
    }

    const { data: list, error } = await supabase
      .from('lists')
      .update(updates)
      .eq('id', existingList.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating list:', error);
      return NextResponse.json(
        { error: 'Failed to update list' },
        { status: 500 }
      );
    }

    return NextResponse.json(list);
  } catch (error) {
    console.error('Error in PATCH /api/lists/[slug]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/lists/[slug] - Delete a list (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createServerClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the list to verify ownership
    const { data: list } = await supabase
      .from('lists')
      .select('id, user_id')
      .eq('slug', slug)
      .single();

    if (!list) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Verify user owns this list
    if (list.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only delete your own lists' },
        { status: 403 }
      );
    }

    // Delete the list (investors will be cascade deleted due to FK constraint)
    const { error: deleteError } = await supabase
      .from('lists')
      .delete()
      .eq('id', list.id);

    if (deleteError) {
      console.error('Error deleting list:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete list' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/lists/[slug]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
