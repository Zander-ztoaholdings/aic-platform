import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, posts, eq, desc } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

/**
 * AIC's public-site CMS (app/(modules)/hq/cms - "Voice of the Pioneer").
 *
 * posts.slug is unique and not-null but the composer only collects a title,
 * so a slug is derived here, deduplicated against existing rows rather than
 * left to a database unique-constraint error the editor has no way to
 * explain to whoever is drafting.
 *
 * GET's select list is explicit (rather than `select()`) so `updated_at`
 * comes back snake_case: the CMS list view reads `post.updated_at` directly,
 * matching the same snake_case convention app/(modules)/hq/subscribers and
 * the admin audits screen both already assume from their own endpoints.
 */

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200) || 'untitled';
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'manage_content');
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: manage_content' }, { status: 403 });
  }

  try {
    const db = getSystemDb();
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
        excerpt: posts.excerpt,
        category: posts.category,
        status: posts.status,
        author_id: posts.authorId,
        published_at: posts.publishedAt,
        created_at: posts.createdAt,
        updated_at: posts.updatedAt,
      })
      .from(posts)
      .orderBy(desc(posts.updatedAt));
    return NextResponse.json({ posts: rows });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'manage_content');
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: manage_content' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, content, category, excerpt, status } = body ?? {};

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const db = getSystemDb();

    let slug = slugify(title);
    const [clash] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const [row] = await db
      .insert(posts)
      .values({
        title,
        slug,
        content,
        excerpt: excerpt || null,
        category: category || 'General',
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        authorId: session.user.id,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      })
      .returning();

    return NextResponse.json({ post: row }, { status: 201 });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'manage_content');
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: manage_content' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, status, title, content, category, excerpt } = body ?? {};
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const db = getSystemDb();
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) {
      update.status = status;
      update.publishedAt = status === 'PUBLISHED' ? new Date() : null;
    }
    if (title !== undefined) update.title = title;
    if (content !== undefined) update.content = content;
    if (category !== undefined) update.category = category;
    if (excerpt !== undefined) update.excerpt = excerpt;

    const [row] = await db.update(posts).set(update).where(eq(posts.id, id)).returning();
    if (!row) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    return NextResponse.json({ post: row });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}
