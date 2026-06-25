import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerSession, clearCustomerSession } from "@/lib/customer-session";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) return NextResponse.json(apiSuccess({ customer: null }));

    const customer = await db.customer.findUnique({
      where: { id: session.customerId },
      select: { id: true, name: true, phone: true, email: true, blacklisted: true },
    });
    return NextResponse.json(apiSuccess({ customer }));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE() {
  try {
    await clearCustomerSession();
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
