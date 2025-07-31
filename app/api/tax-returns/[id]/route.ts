
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(
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

    const taxReturn = await prisma.taxReturn.findFirst({
      where: { 
        id: params.id,
        userId: user.id 
      },
      include: {
        incomeEntries: true,
        deductionEntries: true,
        dependents: true
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: "Tax return not found" }, { status: 404 })
    }

    return NextResponse.json(taxReturn)
  } catch (error) {
    console.error("Error fetching tax return:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    // Handle step completion if currentStep is being updated
    let updateData = { ...data, updatedAt: new Date() }
    
    if (data.currentStep && data.currentStep !== taxReturn.currentStep) {
      const completedSteps = taxReturn.completedSteps || []
      const previousStep = taxReturn.currentStep
      
      // Mark previous step as completed if moving forward
      if (data.currentStep > previousStep && !completedSteps.includes(previousStep)) {
        updateData.completedSteps = [...completedSteps, previousStep].sort((a, b) => a - b)
      }
      
      updateData.lastSavedAt = new Date()
    }

    const updatedTaxReturn = await prisma.taxReturn.update({
      where: { id: params.id },
      data: updateData,
      include: {
        incomeEntries: true,
        deductionEntries: true,
        dependents: true
      }
    })

    return NextResponse.json(updatedTaxReturn)
  } catch (error) {
    console.error("Error updating tax return:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
