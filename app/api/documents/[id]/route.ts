
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: { id: params.id },
      include: {
        taxReturn: {
          select: { userId: true }
        }
      }
    })

    if (!document || document.taxReturn.userId !== user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete the document and all related extracted entries
    await prisma.document.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
