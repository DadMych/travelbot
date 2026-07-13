import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteVisit, updateVisit } from "@/lib/visits";

const updateSchema = z.object({
  notes: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  visitedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = updateSchema.parse(await request.json());
    const visit = await updateVisit(id, {
      notes: body.notes,
      rating: body.rating,
      visitedAt:
        body.visitedAt === undefined
          ? undefined
          : body.visitedAt
            ? new Date(body.visitedAt)
            : null,
    });

    if (!visit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ visit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const deleted = await deleteVisit(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
