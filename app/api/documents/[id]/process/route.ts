// app/api/documents/[id]/process/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { DocumentAIService, createDocumentAIConfig, type ExtractedTaxData } from "@/lib/document-ai-service"
import OpenAI from 'openai'
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { PrismaAdapter } from "@next-auth/prisma-adapter"

// Auth configuration matching your NextAuth setup
const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })
        if (!user) {
          return null
        }
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password || ""
        )
        if (!isPasswordValid) {
          return null
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/login"
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (!document.filePath) {
      return NextResponse.json({ error: "No file associated with document" }, { status: 400 })
    }

    // Read the file
    const fileResponse = await fetch(document.filePath)
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.statusText}`)
    }

    const fileBuffer = await fileResponse.arrayBuffer()
    const uint8Array = new Uint8Array(fileBuffer)
    
    // Determine file type from the document's metadata or file extension
    const isPDF = document.fileName?.toLowerCase().endsWith('.pdf') || 
                  document.filePath.toLowerCase().includes('.pdf')
    
    let extractedData: ExtractedTaxData
    
    if (isPDF) {
      console.log("Processing PDF document with text extraction...")
      
      // For PDFs, use GPT-4o with text-based processing
      // Convert to base64 for OpenAI API
      const base64String = Buffer.from(uint8Array).toString('base64')
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a tax document processing assistant. Extract key tax information from the provided document and return it as valid JSON with this exact structure:
            {
              "documentType": "string (e.g., 'W-2', '1099-NEC', 'Tax Return')",
              "taxYear": "number",
              "employerName": "string or null",
              "employeeInfo": {
                "name": "string or null",
                "ssn": "string or null",
                "address": "string or null"
              },
              "taxAmounts": {
                "federalWithheld": "number or null",
                "stateWithheld": "number or null",
                "totalIncome": "number or null",
                "socialSecurityWages": "number or null",
                "medicareWages": "number or null"
              },
              "confidence": "number between 0 and 1"
            }`
          },
          {
            role: "user",
            content: `Please extract tax information from this PDF document. The document is encoded in base64: data:application/pdf;base64,${base64String.substring(0, 100000)}` // Limit size for API
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error("No response from OpenAI")
      }

      try {
        extractedData = JSON.parse(content)
      } catch (parseError) {
        console.error("Failed to parse OpenAI response as JSON:", content)
        // Fallback: create a basic structure
        extractedData = {
          documentType: "Unknown PDF",
          taxYear: new Date().getFullYear() - 1,
          employerName: null,
          employeeInfo: {
            name: null,
            ssn: null,
            address: null
          },
          taxAmounts: {
            federalWithheld: null,
            stateWithheld: null,
            totalIncome: null,
            socialSecurityWages: null,
            medicareWages: null
          },
          confidence: 0.3
        }
      }
      
    } else {
      console.log("Processing image document with vision API...")
      
      // For images, use the vision API
      const base64String = Buffer.from(uint8Array).toString('base64')
      const mimeType = document.fileName?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",  
            content: `You are a tax document processing assistant. Extract key tax information from the provided image and return it as valid JSON with this exact structure:
            {
              "documentType": "string (e.g., 'W-2', '1099-NEC', 'Tax Return')",
              "taxYear": "number",
              "employerName": "string or null",
              "employeeInfo": {
                "name": "string or null",
                "ssn": "string or null", 
                "address": "string or null"
              },
              "taxAmounts": {
                "federalWithheld": "number or null",
                "stateWithheld": "number or null",
                "totalIncome": "number or null",
                "socialSecurityWages": "number or null",
                "medicareWages": "number or null"
              },
              "confidence": "number between 0 and 1"
            }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract tax information from this document image."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64String}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error("No response from OpenAI vision API")
      }

      try {
        extractedData = JSON.parse(content)
      } catch (parseError) {
        console.error("Failed to parse OpenAI vision response as JSON:", content)
        // Fallback: create a basic structure
        extractedData = {
          documentType: "Unknown Image",
          taxYear: new Date().getFullYear() - 1,
          employerName: null,
          employeeInfo: {
            name: null,
            ssn: null,
            address: null
          },
          taxAmounts: {
            federalWithheld: null,
            stateWithheld: null,
            totalIncome: null,
            socialSecurityWages: null,
            medicareWages: null
          },
          confidence: 0.3
        }
      }
    }

    // Update document with processed data
    const updatedDocument = await prisma.document.update({
      where: { id: params.id },
      data: {
        status: "PROCESSED",
        processedData: extractedData,
        processedAt: new Date(),
      },
    })

    console.log("Document processed successfully:", extractedData)

    return NextResponse.json({
      success: true,
      document: updatedDocument,
      extractedData,
    })

  } catch (error) {
    console.error("Document processing error:", error)
    
    // Update document status to failed
    try {
      await prisma.document.update({
        where: { id: params.id },
        data: {
          status: "FAILED",
          processedAt: new Date(),
        },
      })
    } catch (dbError) {
      console.error("Failed to update document status:", dbError)
    }

    return NextResponse.json(
      { 
        error: "Document processing failed", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    )
  }
}
