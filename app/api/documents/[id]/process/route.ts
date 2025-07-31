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
      console.log("Processing PDF document with text extraction...")
      console.log(`PDF file size: ${uint8Array.length} bytes`)
      
      // Try different approaches to extract text from PDF
      let pdfText = ""
      
      try {
        // First, try to extract text using a simple approach
        // Convert PDF to text using a basic extraction method
        const pdfData = Buffer.from(uint8Array).toString('binary')
        
        // Simple text extraction - look for text between stream markers
        const textRegex = /BT\s*(.*?)\s*ET/gs
        const matches = pdfData.match(textRegex)
        
        if (matches) {
          for (const match of matches) {
            // Extract text commands like (text) Tj or [text] TJ
            const textCommands = match.match(/\((.*?)\)/g) || []
            for (const cmd of textCommands) {
              const text = cmd.replace(/[()]/g, '')
              if (text.length > 1) {
                pdfText += text + ' '
              }
            }
          }
        }
        
        console.log("Extracted PDF text length:", pdfText.length)
        console.log("Sample text:", pdfText.substring(0, 500))
        
        // If we got some text, use it
        if (pdfText.length > 50) {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a tax document processing assistant. Extract the EXACT values from the provided PDF text content.

                CRITICAL INSTRUCTIONS:
                - Extract ONLY the actual data you can read from the text
                - Do NOT make up or hallucinate any values
                - Look for real employer names, employee names, SSNs, dollar amounts
                - Return data in this exact JSON format:
                {
                  "documentType": "string",
                  "taxYear": "number or null",
                  "employerName": "exact employer name from text or null",
                  "employeeInfo": {
                    "name": "exact employee name from text or null",
                    "ssn": "exact SSN from text or null",
                    "address": "exact address from text or null"
                  },
                  "taxAmounts": {
                    "federalWithheld": "exact dollar amount or null",
                    "stateWithheld": "exact dollar amount or null",
                    "totalIncome": "exact dollar amount or null",
                    "socialSecurityWages": "exact dollar amount or null",
                    "medicareWages": "exact dollar amount or null"
                  },
                  "confidence": "number between 0 and 1",
                  "debugInfo": "what specific text you found"
                }`
              },
              {
                role: "user",
                content: `Extract tax information from this PDF text content. Here is the extracted text from the document:

                ${pdfText.substring(0, 4000)}
                
                Find real names, real SSNs, real dollar amounts, and real company names from this text.`
              }
            ],
            max_tokens: 1500,
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
              content: content || "Text extracted but parsing failed",
              confidence: 0.3,
              rawText: pdfText.substring(0, 1000),
              debugInfo: "Text was extracted but JSON parsing failed"
            }
          }
        } else {
          // If text extraction failed, try the base64 approach as fallback
          console.log("Text extraction failed, trying base64 approach...")
          const base64String = Buffer.from(uint8Array).toString('base64')
          
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Try to extract any readable information from this PDF document.`
              },
              {
                role: "user", 
                content: `Can you extract any text or data from this PDF? data:application/pdf;base64,${base64String.substring(0, 20000)}`
              }
            ],
            max_tokens: 1000,
            temperature: 0.0
          })

          const content = response.choices[0]?.message?.content || "No content extracted"
          extractedData = {
            documentType: "PDF",
            content: content,
            confidence: 0.1,
            debugInfo: "Base64 fallback approach used - limited extraction capability"
          }
        }
        
      } catch (pdfError) {
        console.error("PDF processing error:", pdfError)
        extractedData = {
          documentType: "PDF Processing Failed",
          content: "Could not process PDF",
          confidence: 0.0,
          error: pdfError instanceof Error ? pdfError.message : String(pdfError),
          debugInfo: "PDF text extraction failed completely"
        }
      }
      
    } else {
      console.log("Processing image document with vision API...")
      
      // For images, use the vision API
      const base64String = Buffer.from(uint8Array).toString('base64')
      const mimeType = document.fileName?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Use mini version for better rate limits
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
