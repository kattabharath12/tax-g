
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/db"
import { DocumentAIService, createDocumentAIConfig, type ExtractedTaxData } from "@/lib/document-ai-service"

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
        console.error('Document AI processing failed, falling back to LLM:', docAIError);
        // Fall back to LLM processing
        extractedTaxData = await processWithLLM(document);
      }
    } else {
      // Fall back to LLM processing
      console.log('Google Document AI not configured, using LLM fallback');
      extractedTaxData = await processWithLLM(document);
    }

    // Create streaming response to maintain frontend compatibility
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Simulate streaming by sending the complete response in chunks
          const jsonResponse = JSON.stringify({
            documentType: extractedTaxData.documentType,
            ocrText: extractedTaxData.ocrText,
            extractedData: extractedTaxData.extractedData
          });

          // Send response in chunks to simulate streaming
          const chunkSize = 100;
          for (let i = 0; i < jsonResponse.length; i += chunkSize) {
            const chunk = jsonResponse.slice(i, i + chunkSize);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({content: chunk})}\n\n`));
            // Small delay to simulate processing time
            await new Promise(resolve => setTimeout(resolve, 50));
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

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Error in streaming response:', error)
          await prisma.document.update({
            where: { id: params.id },
            data: { processingStatus: 'FAILED' }
          })
          controller.error(error)
        }
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
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

// Fallback LLM processing function
async function processWithLLM(document: any): Promise<ExtractedTaxData> {
  const { readFile } = await import("fs/promises");
  
  // Read the file and convert to base64
  const fileBuffer = await readFile(document.filePath)
  const base64String = fileBuffer.toString('base64')
  
  // Prepare the message for the LLM API
  const messages = [{
    role: "user" as const,
    content: [
      {
        type: "file",
        file: {
          filename: document.fileName,
          file_data: `data:${document.fileType};base64,${base64String}`
        }
      },
      {
        type: "text",
        text: getExtractionPrompt(document.documentType)
      }
    ]
  }]

  // Call the LLM API for document processing
  const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: messages,
      stream: false, // Don't stream for fallback
      max_tokens: 3000,
      response_format: { type: "json_object" }
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`)
  }

  const result = await response.json()
  const content = result.choices[0]?.message?.content

  if (!content) {
    throw new Error('No content returned from LLM API')
  }

  const parsedContent = JSON.parse(content)
  
  return {
    documentType: parsedContent.documentType || document.documentType,
    ocrText: parsedContent.ocrText || '',
    extractedData: parsedContent.extractedData || parsedContent,
    confidence: 0.85 // Default confidence for LLM
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
    "medicareTaxWithheld": "Box 6 - Medicare tax withheld",
    "socialSecurityTips": "Box 7 - Social security tips",
    "allocatedTips": "Box 8 - Allocated tips",
    "stateWages": "Box 16 - State wages, tips, etc.",
    "stateTaxWithheld": "Box 17 - State income tax",
    "localWages": "Box 18 - Local wages, tips, etc.",
    "localTaxWithheld": "Box 19 - Local income tax"
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
    "payerAddress": "Payer address",
    "recipientName": "Recipient name",
    "recipientTIN": "Recipient TIN",
    "recipientAddress": "Recipient address",
    "interestIncome": "Box 1 - Interest income",
    "earlyWithdrawalPenalty": "Box 2 - Early withdrawal penalty",
    "interestOnUSavingsBonds": "Box 3 - Interest on U.S. Savings Bonds",
    "federalTaxWithheld": "Box 4 - Federal income tax withheld",
    "investmentExpenses": "Box 5 - Investment expenses",
    "foreignTaxPaid": "Box 6 - Foreign tax paid",
    "foreignCountry": "Box 7 - Foreign country",
    "taxExemptInterest": "Box 8 - Tax-exempt interest",
    "privateActivityBondInterest": "Box 9 - Specified private activity bond interest",
    "marketDiscount": "Box 10 - Market discount",
    "bondPremium": "Box 11 - Bond premium",
    "bondPremiumOnTaxExemptBond": "Box 12 - Bond premium on tax-exempt bond",
    "stateCode": "Box 13 - State code",
    "stateTaxWithheld": "Box 14 - State income tax withheld",
    "stateIdNumber": "Box 15 - State/Payer's state no."
  }
}`

    case 'FORM_1099_DIV':
      return basePrompt + `For 1099-DIV forms, extract:
{
  "documentType": "FORM_1099_DIV",
  "ocrText": "Full OCR text",
  "extractedData": {
    "payerName": "Payer name",
    "payerTIN": "Payer TIN",
    "payerAddress": "Payer address",
    "recipientName": "Recipient name",
    "recipientTIN": "Recipient TIN",
    "recipientAddress": "Recipient address",
    "ordinaryDividends": "Box 1a - Ordinary dividends",
    "qualifiedDividends": "Box 1b - Qualified dividends",
    "totalCapitalGain": "Box 2a - Total capital gain distributions",
    "unrecaptured1250Gain": "Box 2b - Unrecap. Sec. 1250 gain",
    "section1202Gain": "Box 2c - Section 1202 gain",
    "collectiblesGain": "Box 2d - Collectibles (28%) gain",
    "nondividendDistributions": "Box 3 - Nondividend distributions",
    "federalTaxWithheld": "Box 4 - Federal income tax withheld",
    "section199ADividends": "Box 5 - Section 199A dividends",
    "investmentExpenses": "Box 6 - Investment expenses",
    "foreignTaxPaid": "Box 7 - Foreign tax paid",
    "foreignCountry": "Box 8 - Foreign country",
    "cashLiquidation": "Box 9 - Cash liquidation distributions",
    "noncashLiquidation": "Box 10 - Noncash liquidation distributions",
    "stateCode": "Box 11 - State code",
    "stateTaxWithheld": "Box 12 - State income tax withheld",
    "stateIdNumber": "Box 13 - State/Payer's state no."
  }
}`

    case 'FORM_1099_MISC':
      return basePrompt + `For 1099-MISC forms, extract:
{
  "documentType": "FORM_1099_MISC",
  "ocrText": "Full OCR text",
  "extractedData": {
    "payerName": "Payer name",
    "payerTIN": "Payer TIN",
    "payerAddress": "Payer address",
    "recipientName": "Recipient name",
    "recipientTIN": "Recipient TIN",
    "recipientAddress": "Recipient address",
    "rents": "Box 1 - Rents",
    "royalties": "Box 2 - Royalties",
    "otherIncome": "Box 3 - Other income",
    "federalTaxWithheld": "Box 4 - Federal income tax withheld",
    "fishingBoatProceeds": "Box 5 - Fishing boat proceeds",
    "medicalHealthPayments": "Box 6 - Medical and health care payments",
    "nonemployeeCompensation": "Box 7 - Nonemployee compensation",
    "substitutePayments": "Box 8 - Substitute payments in lieu of dividends",
    "cropInsuranceProceeds": "Box 9 - Crop insurance proceeds",
    "grossProceeds": "Box 10 - Gross proceeds paid to an attorney",
    "section409ADeferrals": "Box 11 - Section 409A deferrals",
    "section409AIncome": "Box 12 - Section 409A income",
    "excessGoldenParachute": "Box 13 - Excess golden parachute payments",
    "nonqualifiedDeferredCompensation": "Box 14 - Nonqualified deferred compensation",
    "stateCode": "Box 15 - State code",
    "stateTaxWithheld": "Box 16 - State income tax withheld",
    "stateIdNumber": "Box 17 - State/Payer's state no."
  }
}`

    case 'FORM_1099_NEC':
      return basePrompt + `For 1099-NEC forms, extract:
{
  "documentType": "FORM_1099_NEC",
  "ocrText": "Full OCR text",
  "extractedData": {
    "payerName": "Payer name",
    "payerTIN": "Payer TIN",
    "payerAddress": "Payer address",
    "recipientName": "Recipient name",
    "recipientTIN": "Recipient TIN",
    "recipientAddress": "Recipient address",
    "nonemployeeCompensation": "Box 1 - Nonemployee compensation",
    "federalTaxWithheld": "Box 4 - Federal income tax withheld",
    "stateCode": "Box 5 - State code",
    "stateTaxWithheld": "Box 6 - State income tax withheld",
    "stateIdNumber": "Box 7 - State/Payer's state no."
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
    "taxWithheld": "Any tax withheld amounts",
    "relevantBoxes": "Any other relevant tax information"
  }
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`
  }
}
