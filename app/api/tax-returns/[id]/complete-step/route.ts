
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

    const { stepNumber, data } = await request.json()

    const taxReturn = await prisma.taxReturn.findFirst({
      where: { 
        id: params.id,
        userId: user.id 
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: "Tax return not found" }, { status: 404 })
    }

    // Add step to completed steps if not already there
    const completedSteps = taxReturn.completedSteps || []
    const updatedCompletedSteps = completedSteps.includes(stepNumber) 
      ? completedSteps 
      : [...completedSteps, stepNumber].sort((a, b) => a - b)

    // Update with step completion data
    const updatedTaxReturn = await prisma.taxReturn.update({
      where: { id: params.id },
      data: {
        ...data,
        completedSteps: updatedCompletedSteps,
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
      completedStep: stepNumber 
    })
  } catch (error) {
    console.error("Error completing step:", error)
    return NextResponse.json(
      { error: "Step completion failed" },
      { status: 500 }
    )
  }
}
