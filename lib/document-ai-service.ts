
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { readFile } from 'fs/promises';

export interface DocumentAIConfig {
  projectId: string;
  location: string;
  w2ProcessorId: string;
  form1099ProcessorId?: string;
}

export interface ExtractedTaxData {
  documentType: string;
  ocrText: string;
  extractedData: any;
  confidence: number;
}

export class DocumentAIService {
  private client: DocumentProcessorServiceClient;
  private config: DocumentAIConfig;

  constructor(config: DocumentAIConfig) {
    this.config = config;
    
    // Initialize the client - will use GOOGLE_APPLICATION_CREDENTIALS env var
    this.client = new DocumentProcessorServiceClient({
      // Use regional endpoint if not US
      ...(config.location !== 'us' && {
        apiEndpoint: `${config.location}-documentai.googleapis.com`
      })
    });
  }

  async processDocument(filePath: string, documentType: string): Promise<ExtractedTaxData> {
    try {
      const processorName = this.getProcessorName(documentType);
      
      // Read and encode the document
      const imageFile = await readFile(filePath);
      const encodedImage = Buffer.from(imageFile).toString('base64');

      const request = {
        name: processorName,
        rawDocument: {
          content: encodedImage,
          mimeType: this.getMimeType(filePath),
        },
      };

      // Process the document
      const [result] = await this.client.processDocument(request);
      
      if (!result.document) {
        throw new Error('No document returned from processing');
      }

      return this.transformToTaxData(result.document, documentType);
    } catch (error) {
      console.error('Error processing document with Document AI:', error);
      throw error;
    }
  }

  private getProcessorName(documentType: string): string {
    const { projectId, location } = this.config;
    
    switch (documentType) {
      case 'W2':
        return `projects/${projectId}/locations/${location}/processors/${this.config.w2ProcessorId}`;
      case 'FORM_1099_INT':
      case 'FORM_1099_DIV':
      case 'FORM_1099_MISC':
      case 'FORM_1099_NEC':
      case 'FORM_1099_R':
      case 'FORM_1099_G':
        if (!this.config.form1099ProcessorId) {
          throw new Error(`No 1099 processor configured for ${documentType}`);
        }
        return `projects/${projectId}/locations/${location}/processors/${this.config.form1099ProcessorId}`;
      default:
        // Fallback to W2 processor for unknown types
        return `projects/${projectId}/locations/${location}/processors/${this.config.w2ProcessorId}`;
    }
  }

  private getMimeType(filePath: string): string {
    const extension = filePath.toLowerCase().split('.').pop();
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'tiff':
      case 'tif':
        return 'image/tiff';
      default:
        return 'application/pdf';
    }
  }

  private transformToTaxData(document: any, documentType: string): ExtractedTaxData {
    const fullText = document.text || '';
    let extractedData: any = {};
    let averageConfidence = 0;

    // Extract form fields and entities based on document type
    switch (documentType) {
      case 'W2':
        extractedData = this.extractW2Data(document);
        break;
      case 'FORM_1099_INT':
        extractedData = this.extract1099IntData(document);
        break;
      case 'FORM_1099_DIV':
        extractedData = this.extract1099DivData(document);
        break;
      case 'FORM_1099_MISC':
        extractedData = this.extract1099MiscData(document);
        break;
      case 'FORM_1099_NEC':
        extractedData = this.extract1099NecData(document);
        break;
      default:
        extractedData = this.extractGenericTaxData(document);
    }

    // Calculate average confidence
    averageConfidence = this.calculateAverageConfidence(document);

    return {
      documentType,
      ocrText: fullText,
      extractedData,
      confidence: averageConfidence
    };
  }

  private extractW2Data(document: any): any {
    const w2Data = {
      employerName: '',
      employerEIN: '',
      employerAddress: '',
      employeeName: '',
      employeeSSN: '',
      employeeAddress: '',
      wages: '',
      federalTaxWithheld: '',
      socialSecurityWages: '',
      socialSecurityTaxWithheld: '',
      medicareWages: '',
      medicareTaxWithheld: '',
      socialSecurityTips: '',
      allocatedTips: '',
      stateWages: '',
      stateTaxWithheld: '',
      localWages: '',
      localTaxWithheld: ''
    };

    // Extract from entities (specialized W-2 processor)
    if (document.entities) {
      document.entities.forEach((entity: any) => {
        const value = this.getText(entity.textAnchor, document.text);
        
        switch (entity.type) {
          case 'employee_name':
            w2Data.employeeName = value;
            break;
          case 'employee_ssn':
            w2Data.employeeSSN = value;
            break;
          case 'employer_name':
            w2Data.employerName = value;
            break;
          case 'employer_ein':
            w2Data.employerEIN = value;
            break;
          case 'wages_tips_other_compensation':
            w2Data.wages = value;
            break;
          case 'federal_income_tax_withheld':
            w2Data.federalTaxWithheld = value;
            break;
          case 'social_security_wages':
            w2Data.socialSecurityWages = value;
            break;
          case 'social_security_tax_withheld':
            w2Data.socialSecurityTaxWithheld = value;
            break;
          case 'medicare_wages_and_tips':
            w2Data.medicareWages = value;
            break;
          case 'medicare_tax_withheld':
            w2Data.medicareTaxWithheld = value;
            break;
        }
      });
    }

    // Extract from form fields as fallback
    if (document.pages && document.pages[0]?.formFields) {
      document.pages[0].formFields.forEach((field: any) => {
        if (!field.fieldName?.textAnchor || !field.fieldValue?.textAnchor) return;
        
        const fieldName = this.getText(field.fieldName.textAnchor, document.text).toLowerCase();
        const fieldValue = this.getText(field.fieldValue.textAnchor, document.text);
        
        if (fieldName.includes('wages') && fieldName.includes('tips')) {
          w2Data.wages = fieldValue;
        } else if (fieldName.includes('federal') && fieldName.includes('tax')) {
          w2Data.federalTaxWithheld = fieldValue;
        } else if (fieldName.includes('social security') && fieldName.includes('wages')) {
          w2Data.socialSecurityWages = fieldValue;
        } else if (fieldName.includes('medicare') && fieldName.includes('wages')) {
          w2Data.medicareWages = fieldValue;
        }
        // Add more field mappings as needed
      });
    }

    return w2Data;
  }

  private extract1099IntData(document: any): any {
    const data1099Int = {
      payerName: '',
      payerTIN: '',
      payerAddress: '',
      recipientName: '',
      recipientTIN: '',
      recipientAddress: '',
      interestIncome: '',
      earlyWithdrawalPenalty: '',
      interestOnUSavingsBonds: '',
      federalTaxWithheld: '',
      investmentExpenses: '',
      foreignTaxPaid: '',
      foreignCountry: '',
      taxExemptInterest: '',
      privateActivityBondInterest: '',
      marketDiscount: '',
      bondPremium: '',
      bondPremiumOnTaxExemptBond: '',
      stateCode: '',
      stateTaxWithheld: '',
      stateIdNumber: ''
    };

    // Extract from form fields or entities
    this.extractGenericFormFields(document, data1099Int);
    return data1099Int;
  }

  private extract1099DivData(document: any): any {
    const data1099Div = {
      payerName: '',
      payerTIN: '',
      payerAddress: '',
      recipientName: '',
      recipientTIN: '',
      recipientAddress: '',
      ordinaryDividends: '',
      qualifiedDividends: '',
      totalCapitalGain: '',
      unrecaptured1250Gain: '',
      section1202Gain: '',
      collectiblesGain: '',
      nondividendDistributions: '',
      federalTaxWithheld: '',
      section199ADividends: '',
      investmentExpenses: '',
      foreignTaxPaid: '',
      foreignCountry: '',
      cashLiquidation: '',
      noncashLiquidation: '',
      stateCode: '',
      stateTaxWithheld: '',
      stateIdNumber: ''
    };

    this.extractGenericFormFields(document, data1099Div);
    return data1099Div;
  }

  private extract1099MiscData(document: any): any {
    const data1099Misc = {
      payerName: '',
      payerTIN: '',
      payerAddress: '',
      recipientName: '',
      recipientTIN: '',
      recipientAddress: '',
      rents: '',
      royalties: '',
      otherIncome: '',
      federalTaxWithheld: '',
      fishingBoatProceeds: '',
      medicalHealthPayments: '',
      nonemployeeCompensation: '',
      substitutePayments: '',
      cropInsuranceProceeds: '',
      grossProceeds: '',
      section409ADeferrals: '',
      section409AIncome: '',
      excessGoldenParachute: '',
      nonqualifiedDeferredCompensation: '',
      stateCode: '',
      stateTaxWithheld: '',
      stateIdNumber: ''
    };

    this.extractGenericFormFields(document, data1099Misc);
    return data1099Misc;
  }

  private extract1099NecData(document: any): any {
    const data1099Nec = {
      payerName: '',
      payerTIN: '',
      payerAddress: '',
      recipientName: '',
      recipientTIN: '',
      recipientAddress: '',
      nonemployeeCompensation: '',
      federalTaxWithheld: '',
      stateCode: '',
      stateTaxWithheld: '',
      stateIdNumber: ''
    };

    this.extractGenericFormFields(document, data1099Nec);
    return data1099Nec;
  }

  private extractGenericTaxData(document: any): any {
    const genericData = {
      payerName: '',
      payerTIN: '',
      recipientName: '',
      recipientTIN: '',
      incomeAmount: '',
      taxWithheld: '',
      relevantBoxes: {}
    };

    this.extractGenericFormFields(document, genericData);
    return genericData;
  }

  private extractGenericFormFields(document: any, dataObject: any): void {
    if (document.pages && document.pages[0]?.formFields) {
      document.pages[0].formFields.forEach((field: any) => {
        if (!field.fieldName?.textAnchor || !field.fieldValue?.textAnchor) return;
        
        const fieldName = this.getText(field.fieldName.textAnchor, document.text);
        const fieldValue = this.getText(field.fieldValue.textAnchor, document.text);
        
        // Try to map common field names to data object properties
        const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
        
        // Look for matching property names in the data object
        for (const [key, value] of Object.entries(dataObject)) {
          const normalizedKey = key.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
          if (normalizedFieldName.includes(normalizedKey) || normalizedKey.includes(normalizedFieldName)) {
            dataObject[key] = fieldValue;
            break;
          }
        }
      });
    }
  }

  private getText(textAnchor: any, fullText: string): string {
    if (!textAnchor?.textSegments || textAnchor.textSegments.length === 0) {
      return '';
    }

    const segment = textAnchor.textSegments[0];
    const startIndex = segment.startIndex || 0;
    const endIndex = segment.endIndex || fullText.length;

    return fullText.substring(startIndex, endIndex).trim();
  }

  private calculateAverageConfidence(document: any): number {
    let totalConfidence = 0;
    let count = 0;

    // Calculate from entities
    if (document.entities) {
      document.entities.forEach((entity: any) => {
        if (entity.confidence !== undefined) {
          totalConfidence += entity.confidence;
          count++;
        }
      });
    }

    // Calculate from form fields
    if (document.pages) {
      document.pages.forEach((page: any) => {
        if (page.formFields) {
          page.formFields.forEach((field: any) => {
            if (field.fieldValue?.confidence !== undefined) {
              totalConfidence += field.fieldValue.confidence;
              count++;
            }
          });
        }
      });
    }

    return count > 0 ? totalConfidence / count : 0;
  }
}

// Configuration helper
export function createDocumentAIConfig(): DocumentAIConfig {
  const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us',
    w2ProcessorId: process.env.GOOGLE_CLOUD_W2_PROCESSOR_ID || '',
    form1099ProcessorId: process.env.GOOGLE_CLOUD_1099_PROCESSOR_ID || ''
  };

  if (!config.projectId || !config.w2ProcessorId) {
    throw new Error('Missing required Google Cloud configuration. Please set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_W2_PROCESSOR_ID environment variables.');
  }

  return config;
}
