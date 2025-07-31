// app/api/documents/[id]/process/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { DocumentAIService, createDocumentAIConfig, type ExtractedTaxData } from "@/lib/document-ai-service"
import OpenAI from 'openai'

export const dynamic = "force-dynamic"

// Initialize OpenAI client (replace Abacus.AI)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    const document = await prisma.document.findFirst({
      where: { 
        id: params.id,
        taxReturn: {
          userId: user.id
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Update status to processing
    await prisma.document.update({
      where: { id: params.id },
      data: { processingStatus: 'PROCESSING' }
    })

    // Check if Google Document AI is configured
    const useDocumentAI = process.env.GOOGLE_CLOUD_PROJECT_ID && 
                          process.env.GOOGLE_CLOUD_W2_PROCESSOR_ID &&
                          process.env.GOOGLE_APPLICATION_CREDENTIALS;

    let extractedTaxData: ExtractedTaxData;

    if (useDocumentAI) {
      // Use Google Document AI
      try {
        const config = createDocumentAIConfig();
        const documentAI = new DocumentAIService(config);
        extractedTaxData = await documentAI.processDocument(document.filePath, document.documentType);
      } catch (docAIError) {
        console.error('Document AI processing failed, falling back to OpenAI:', docAIError);
        // Fall back to OpenAI processing
        extractedTaxData = await processWithOpenAI(document);
      }
    } else {
      // Use OpenAI processing (replacing Abacus.AI)
      console.log('Google Document AI not configured, using OpenAI');
      extractedTaxData = await processWithOpenAI(document);
    }

    // Save OCR text and extracted data to database
    await prisma.document.update({
      where: { id: params.id },
      data: {
        ocrText: extractedTaxData.ocrText,
        extractedData: {
          documentType: extractedTaxData.documentType,
          ocrText: extractedTaxData.ocrText,
          extractedData: extractedTaxData.extractedData,
          confidence: extractedTaxData.confidence
        },
        processingStatus: 'COMPLETED'
      }
    })

    // Return response
    return NextResponse.json({
      documentType: extractedTaxData.documentType,
      ocrText: extractedTaxData.ocrText,
      extractedData: extractedTaxData.extractedData
    })

  } catch (error) {
    console.error("Document processing error:", error)
    
    // Update document status to failed
    await prisma.document.update({
      where: { id: params.id },
      data: { processingStatus: 'FAILED' }
    })

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Replace Abacus.AI with OpenAI processing - FIXED FOR PDFs
async function processWithOpenAI(document: any): Promise<ExtractedTaxData> {
  const { readFile } = await import("fs/promises");
  
  // Read the file
  const fileBuffer = await readFile(document.filePath)
  
  // Check if it's a PDF or image
  const isPDF = document.fileType === 'application/pdf' || document.filePath.toLowerCase().endsWith('.pdf')
  
  let response: any;
  
  if (isPDF) {
    // For PDF files, use text-based processing
    // Convert PDF to text (you might need to install pdf-parse: npm install pdf-parse)
    try {
      const pdf = await import('pdf-parse');
      const pdfData = await pdf.default(fileBuffer);
      
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: `${getExtractionPrompt(document.documentType)}\n\nDocument content:\n${pdfData.text}`
          }
        ],
        max_tokens: 3000,
      });
    } catch (pdfError) {
      console.log('PDF parsing failed, trying as base64:', pdfError);
      // Fallback to base64 approach (might work for some PDFs)
      const base64String = fileBuffer.toString('base64')
      
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: getExtractionPrompt(document.documentType)
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64String}`
                }
              }
            ]
          }
        ],
        max_tokens: 3000,
      });
    }
  } else {
    // For image files, use vision API
    const base64String = fileBuffer.toString('base64')
    
    response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: getExtractionPrompt(document.documentType)
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${document.fileType};base64,${base64String}`
              }
            }
          ]
        }
      ],
      max_tokens: 3000,
    });
  }

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content returned from OpenAI API')
  }

  // Try to parse JSON, with fallback
  let parsedContent;
  try {
    parsedContent = JSON.parse(content);
  } catch (parseError) {
    console.log('JSON parsing failed, using text response');
    parsedContent = {
      documentType: document.documentType,
      ocrText: content,
      extractedData: { rawText: content }
    };
  }
  
  return {
    documentType: parsedContent.documentType || document.documentType,
    ocrText: parsedContent.ocrText || content,
    extractedData: parsedContent.extractedData || parsedContent,
    confidence: 0.85 // Default confidence for OpenAI
  }
}

function getExtractionPrompt(documentType: string): string {
  const basePrompt = `Please extract all tax-related information from this document and return it in JSON format. Focus on extracting data that would be useful for tax filing purposes.

Please respond in JSON format with the following structure:
{
  "documentType": "W2" | "FORM_1099_INT" | "FORM_1099_DIV" | "FORM_1099_MISC" | "FORM_1099_NEC" | "FORM_1099_R" | "FORM_1099_G" | "OTHER_TAX_DOCUMENT",
  "ocrText": "Full OCR text from the document",
  "extractedData": {
    // Document-specific fields based on document type
  }
}

`

  switch (documentType) {
    case 'W2':
      return basePrompt + `For W-2 forms, extract:
{
  "documentType": "W2",
  "ocrText": "Full OCR text",
  "extractedData": {
    "employerName": "Employer name",
    "employerEIN": "Employer EIN (XX-XXXXXXX format)",
    "employerAddress": "Employer address",
    "employeeName": "Employee name",
    "employeeSSN": "Employee SSN",
    "employeeAddress": "Employee address",
    "wages": "Box 1 - Wages, tips, other compensation",
    "federalTaxWithheld": "Box 2 - Federal income tax withheld",
    "socialSecurityWages": "Box 3 - Social security wages",
    "socialSecurityTaxWithheld": "Box 4 - Social security tax withheld",
    "medicareWages": "Box 5 - Medicare wages and tips",
    "medicareTaxWithheld": "Box 6 - Medicare tax withheld"
  }
}`

    case 'FORM_1099_INT':
      return basePrompt + `For 1099-INT forms, extract:
{
  "documentType": "FORM_1099_INT",
  "ocrText": "Full OCR text",
  "extractedData": {
    "payerName": "Payer name",
    "payerTIN": "Payer TIN",
    "recipientName": "Recipient name",
    "recipientTIN": "Recipient TIN",
    "interestIncome": "Box 1 - Interest income",
    "federalTaxWithheld": "Box 4 - Federal income tax withheld"
  }
}`

    default:
      return basePrompt + `For other tax documents, extract relevant information including:
{
  "documentType": "OTHER_TAX_DOCUMENT",
  "ocrText": "Full OCR text",
  "extractedData": {
    "payerName": "Payer/Employer name if applicable",
    "payerTIN": "Payer/Employer TIN if applicable",
    "recipientName": "Recipient/Employee name if applicable",
    "recipientTIN": "Recipient/Employee TIN if applicable",
    "incomeAmount": "Any income amounts",
    "taxWithheld": "Any tax withheld amounts"
  }
}

Respond with raw JSON only.`
  }
}
