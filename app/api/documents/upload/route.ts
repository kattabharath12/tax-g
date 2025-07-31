
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const taxReturnId = formData.get('taxReturnId') as string

    if (!file || !taxReturnId) {
      return NextResponse.json({ error: "Missing file or tax return ID" }, { status: 400 })
    }

    // Verify the tax return belongs to the user
    const taxReturn = await prisma.taxReturn.findFirst({
      where: { 
        id: taxReturnId,
        userId: user.id 
      }
    })

    if (!taxReturn) {
      return NextResponse.json({ error: "Tax return not found" }, { status: 404 })
    }

    // Validate file type and size
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid file type. Supported types: PDF, PNG, JPEG, TIFF" 
      }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ 
        error: "File size exceeds 10MB limit" 
      }, { status: 400 })
    }

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads', 'documents')
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const uniqueFileName = `${uuidv4()}.${fileExtension}`
    const filePath = join(uploadDir, uniqueFileName)

    // Save file to filesystem
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Determine document type based on file name or content
    const documentType = determineDocumentType(file.name)

    // Create document record in database
    const document = await prisma.document.create({
      data: {
        taxReturnId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        filePath: filePath,
        documentType,
        processingStatus: 'PENDING'
      }
    })

    return NextResponse.json(document)
  } catch (error) {
    console.error("Document upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

function determineDocumentType(fileName: string): any {
  const lowerName = fileName.toLowerCase()
  
  if (lowerName.includes('w-2') || lowerName.includes('w2')) {
    return 'W2'
  }
  if (lowerName.includes('1099-int')) {
    return 'FORM_1099_INT'
  }
  if (lowerName.includes('1099-div')) {
    return 'FORM_1099_DIV'
  }
  if (lowerName.includes('1099-misc')) {
    return 'FORM_1099_MISC'
  }
  if (lowerName.includes('1099-nec')) {
    return 'FORM_1099_NEC'
  }
  if (lowerName.includes('1099-r')) {
    return 'FORM_1099_R'
  }
  if (lowerName.includes('1099-g')) {
    return 'FORM_1099_G'
  }
  if (lowerName.includes('1099')) {
    return 'OTHER_TAX_DOCUMENT'
  }
  
  return 'UNKNOWN'
}
