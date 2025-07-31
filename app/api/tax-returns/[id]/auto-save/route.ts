
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const data = await request.json()

    const taxReturn = await prisma.taxReturn.findFirst({
      where: { 
        id: params.id,
        userId: user.id 
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: "Tax return not found" }, { status: 404 })
    }

    // Update with auto-save data and timestamp
    const updatedTaxReturn = await prisma.taxReturn.update({
      where: { id: params.id },
      data: {
        ...data,
        lastSavedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        incomeEntries: true,
        deductionEntries: true,
        dependents: true
      }
    })

    return NextResponse.json({ 
      success: true, 
      taxReturn: updatedTaxReturn,
      savedAt: updatedTaxReturn.lastSavedAt 
    })
  } catch (error) {
    console.error("Error auto-saving tax return:", error)
    return NextResponse.json(
      { error: "Auto-save failed" },
      { status: 500 }
    )
  }
}
