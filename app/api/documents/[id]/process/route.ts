// app/api/documents/[id]/process/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { DocumentAIService, createDocumentAIConfig } from "@/lib/document-ai-service"
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
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
    jwt: ({ user, token }) => {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
  },
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
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find user by email since we know email exists
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const userId = user.id

    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
      },
      include: {
        taxReturn: {
          include: {
            user: true
          }
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check if the document belongs to the authenticated user
    if (document.taxReturn.user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized access to document" }, { status: 403 })
    }

    if (!document.filePath) {
      return NextResponse.json({ error: "No file associated with document" }, { status: 400 })
    }

    // Read the file - handle both URLs and local paths
    let fileBuffer: ArrayBuffer
    
    if (document.filePath.startsWith('http://') || document.filePath.startsWith('https://')) {
      // If it's a URL, fetch it
      const fileResponse = await fetch(document.filePath)
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.statusText}`)
      }
      fileBuffer = await fileResponse.arrayBuffer()
    } else {
      // If it's a local path, read from filesystem
      const fs = require('fs').promises
      const fileData = await fs.readFile(document.filePath)
      fileBuffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength)
    }
    
    const uint8Array = new Uint8Array(fileBuffer)
    
    // Determine file type from the document's metadata or file extension
    const isPDF = document.fileName?.toLowerCase().endsWith('.pdf') || 
                  document.filePath.toLowerCase().includes('.pdf')
    
    let extractedData: any // Use flexible type for now
    
    if (isPDF) {
      console.log("Processing PDF document with DIRECT OpenAI analysis v3...")  // NEW LOG MESSAGE
      console.log(`PDF file size: ${uint8Array.length} bytes`)
      
      // Convert PDF to base64 for direct OpenAI processing
      const base64String = Buffer.from(uint8Array).toString('base64')
      
      console.log("Sending FOCUSED PDF analysis to OpenAI GPT-4o v3...")  // NEW LOG MESSAGE
      
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",  // Use full model, not mini
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this W-2 or tax document PDF and extract the following information in JSON format:

1. Document type (W-2, 1099, etc.)
2. Tax year
3. Employer name
4. Employee name, SSN, address
5. Federal income tax withheld
6. State income tax withheld
7. Total wages/income
8. Social Security wages
9. Medicare wages

Return ONLY valid JSON with this exact structure:
{
  "documentType": "W-2",
  "taxYear": 2024,
  "employerName": "Company Name",
  "employeeInfo": {
    "name": "John Doe",
    "ssn": "123-45-6789",
    "address": "123 Main St"
  },
  "taxAmounts": {
    "federalWithheld": 5000.00,
    "stateWithheld": 1500.00,
    "totalIncome": 75000.00,
    "socialSecurityWages": 75000.00,
    "medicareWages": 75000.00
  },
  "confidence": 0.95,
  "debugInfo": "Successfully extracted W-2 data"
}`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64String.slice(0, 200000)}` // Increased limit
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.0
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
          throw new Error("No response from OpenAI")
        }

        console.log("Raw OpenAI response:", content)

        try {
          // Clean the response - remove markdown code blocks if present
          let cleanContent = content.trim()
          if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
          } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
          }
          
          extractedData = JSON.parse(cleanContent)
        } catch (parseError) {
          console.error("Failed to parse OpenAI response as JSON:", content)
          extractedData = {
            documentType: "PDF",
            content: content || "Direct processing failed",
            confidence: 0.3,
            debugInfo: "Direct PDF processing succeeded but JSON parsing failed",
            rawResponse: content
          }
        }
        
      } catch (openaiError) {
        console.error("OpenAI processing error:", openaiError)
        extractedData = {
          documentType: "PDF Processing Failed",
          content: "Could not process PDF with OpenAI",
          confidence: 0.0,
          error: openaiError instanceof Error ? openaiError.message : String(openaiError),
          debugInfo: "Direct OpenAI PDF processing failed completely"
        }
      }
      
    } else {
      console.log("Processing image document with vision API...")
      
      // For images, use the vision API
      const base64String = Buffer.from(uint8Array).toString('base64')
      const mimeType = document.fileName?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Use full model for better accuracy
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
        max_tokens: 1500,
        temperature: 0.0
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error("No response from OpenAI vision API")
      }

      try {
        // Clean the response - remove markdown code blocks if present
        let cleanContent = content.trim()
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
        }
        
        extractedData = JSON.parse(cleanContent)
      } catch (parseError) {
        console.error("Failed to parse OpenAI vision response as JSON:", content)
        // Fallback: create a simple structure that matches what we store
        extractedData = {
          documentType: "Unknown Image", 
          content: content || "No content extracted",
          confidence: 0.3,
          rawText: content
        }
      }
    }

    // Update document with processed data
    const updatedDocument = await prisma.document.update({
      where: { id: params.id },
      data: {
        processingStatus: "COMPLETED",
        extractedData: extractedData,
        updatedAt: new Date(),
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
          processingStatus: "FAILED",
          updatedAt: new Date(),
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
