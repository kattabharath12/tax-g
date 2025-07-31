
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: Request,
  { params }: { params: { id: string, entryId: string } }
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

    const taxReturn = await prisma.taxReturn.findFirst({
      where: { 
        id: params.id,
        userId: user.id 
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: "Tax return not found" }, { status: 404 })
    }

    await prisma.deductionEntry.delete({
      where: {
        id: params.entryId,
        taxReturnId: params.id
      }
    })

    return NextResponse.json({ message: "Deduction entry deleted successfully" })
  } catch (error) {
    console.error("Error deleting deduction entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
