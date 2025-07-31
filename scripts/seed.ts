
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create test user
  const hashedPassword = await bcrypt.hash('johndoe123', 12)
  
  const testUser = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john@doe.com',
      password: hashedPassword,
    },
  })

  console.log('✅ Created test user:', testUser.email)

  // Create a sample tax return for testing
  const taxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: {
        userId: testUser.id,
        taxYear: 2024,
      },
    },
    update: {},
    create: {
      userId: testUser.id,
      taxYear: 2024,
      filingStatus: 'SINGLE',
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123-45-6789',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      totalIncome: 65000,
      adjustedGrossIncome: 65000,
      standardDeduction: 14600,
      itemizedDeduction: 0,
      taxableIncome: 50400,
      taxLiability: 5739,
      totalCredits: 0,
      refundAmount: 0,
      amountOwed: 0,
      currentStep: 1,
      isCompleted: false,
      isFiled: false,
    },
  })

  console.log('✅ Created sample tax return:', taxReturn.id)

  // Create sample income entries
  const incomeEntries = await Promise.all([
    prisma.incomeEntry.create({
      data: {
        taxReturnId: taxReturn.id,
        incomeType: 'W2_WAGES',
        amount: 65000,
        description: 'Annual salary',
        employerName: 'ABC Corporation',
        employerEIN: '12-3456789',
      },
    }),
    prisma.incomeEntry.create({
      data: {
        taxReturnId: taxReturn.id,
        incomeType: 'INTEREST',
        amount: 250,
        description: 'Savings account interest',
        payerName: 'First National Bank',
        payerTIN: '98-7654321',
      },
    }),
  ])

  console.log('✅ Created sample income entries:', incomeEntries.length)

  // Create sample deduction entries
  const deductionEntries = await Promise.all([
    prisma.deductionEntry.create({
      data: {
        taxReturnId: taxReturn.id,
        deductionType: 'CHARITABLE_CONTRIBUTIONS',
        amount: 1200,
        description: 'Annual charitable donations',
      },
    }),
    prisma.deductionEntry.create({
      data: {
        taxReturnId: taxReturn.id,
        deductionType: 'STATE_LOCAL_TAXES',
        amount: 8500,
        description: 'State income tax and property tax',
      },
    }),
  ])

  console.log('✅ Created sample deduction entries:', deductionEntries.length)

  // Create another user with a family for testing credits
  const familyUser = await prisma.user.upsert({
    where: { email: 'jane@smith.com' },
    update: {},
    create: {
      name: 'Jane Smith',
      email: 'jane@smith.com',
      password: hashedPassword,
    },
  })

  console.log('✅ Created family test user:', familyUser.email)

  // Create tax return for family user
  const familyTaxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: {
        userId: familyUser.id,
        taxYear: 2024,
      },
    },
    update: {},
    create: {
      userId: familyUser.id,
      taxYear: 2024,
      filingStatus: 'HEAD_OF_HOUSEHOLD',
      firstName: 'Jane',
      lastName: 'Smith',
      ssn: '987-65-4321',
      address: '456 Oak Ave',
      city: 'Hometown',
      state: 'TX',
      zipCode: '54321',
      totalIncome: 45000,
      adjustedGrossIncome: 45000,
      standardDeduction: 21900,
      itemizedDeduction: 0,
      taxableIncome: 23100,
      taxLiability: 2310,
      totalCredits: 4000,
      refundAmount: 1690,
      amountOwed: 0,
      currentStep: 1,
      isCompleted: false,
      isFiled: false,
    },
  })

  // Create dependents for tax credits
  const dependents = await Promise.all([
    prisma.dependent.create({
      data: {
        taxReturnId: familyTaxReturn.id,
        firstName: 'Emma',
        lastName: 'Smith',
        ssn: '111-22-3333',
        relationship: 'Child',
        birthDate: new Date('2015-06-15'),
        qualifiesForCTC: true,
        qualifiesForEITC: true,
      },
    }),
    prisma.dependent.create({
      data: {
        taxReturnId: familyTaxReturn.id,
        firstName: 'Liam',
        lastName: 'Smith',
        ssn: '444-55-6666',
        relationship: 'Child',
        birthDate: new Date('2018-03-20'),
        qualifiesForCTC: true,
        qualifiesForEITC: true,
      },
    }),
  ])

  console.log('✅ Created sample dependents:', dependents.length)

  // Create income for family user
  await prisma.incomeEntry.create({
    data: {
      taxReturnId: familyTaxReturn.id,
      incomeType: 'W2_WAGES',
      amount: 45000,
      description: 'Teaching salary',
      employerName: 'Local School District',
      employerEIN: '55-5555555',
    },
  })

  console.log('✅ Created family income entry')

  // Create 5 additional test users with diverse profiles
  console.log('🔄 Creating additional test users...')

  // User 3: Michael Johnson - Married Filing Jointly
  const michaelPassword = await bcrypt.hash('michael2024', 12)
  const michaelUser = await prisma.user.upsert({
    where: { email: 'michael@johnson.com' },
    update: {},
    create: {
      name: 'Michael Johnson',
      email: 'michael@johnson.com',
      password: michaelPassword,
    },
  })

  const michaelTaxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: {
        userId: michaelUser.id,
        taxYear: 2024,
      },
    },
    update: {},
    create: {
      userId: michaelUser.id,
      taxYear: 2024,
      filingStatus: 'MARRIED_FILING_JOINTLY',
      firstName: 'Michael',
      lastName: 'Johnson',
      ssn: '555-11-2222',
      spouseFirstName: 'Sarah',
      spouseLastName: 'Johnson',
      spouseSsn: '666-33-4444',
      address: '789 Pine Street',
      city: 'Springfield',
      state: 'FL',
      zipCode: '33101',
      totalIncome: 95000,
      adjustedGrossIncome: 95000,
      standardDeduction: 29200,
      itemizedDeduction: 0,
      taxableIncome: 65800,
      taxLiability: 7596,
      totalCredits: 0,
      refundAmount: 0,
      amountOwed: 0,
      currentStep: 1,
      isCompleted: false,
      isFiled: false,
    },
  })

  await prisma.incomeEntry.create({
    data: {
      taxReturnId: michaelTaxReturn.id,
      incomeType: 'W2_WAGES',
      amount: 95000,
      description: 'Engineering salary',
      employerName: 'Tech Solutions Inc',
      employerEIN: '77-8888999',
    },
  })

  console.log('✅ Created user: Michael Johnson')

  // User 4: Lisa Garcia - Self-employed with business income
  const lisaPassword = await bcrypt.hash('lisa@secure123', 12)
  const lisaUser = await prisma.user.upsert({
    where: { email: 'lisa@garcia.com' },
    update: {},
    create: {
      name: 'Lisa Garcia',
      email: 'lisa@garcia.com',
      password: lisaPassword,
    },
  })

  const lisaTaxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: {
        userId: lisaUser.id,
        taxYear: 2024,
      },
    },
    update: {},
    create: {
      userId: lisaUser.id,
      taxYear: 2024,
      filingStatus: 'SINGLE',
      firstName: 'Lisa',
      lastName: 'Garcia',
      ssn: '777-88-9999',
      address: '321 Business Blvd',
      city: 'Austin',
      state: 'TX',
      zipCode: '73301',
      totalIncome: 82000,
      adjustedGrossIncome: 75000,
      standardDeduction: 14600,
      itemizedDeduction: 18500,
      taxableIncome: 56500,
      taxLiability: 6435,
      totalCredits: 0,
      refundAmount: 0,
      amountOwed: 0,
      currentStep: 1,
      isCompleted: false,
      isFiled: false,
    },
  })

  await Promise.all([
    prisma.incomeEntry.create({
      data: {
        taxReturnId: lisaTaxReturn.id,
        incomeType: 'BUSINESS_INCOME',
        amount: 82000,
        description: 'Consulting business revenue',
      },
    }),
    prisma.deductionEntry.create({
      data: {
        taxReturnId: lisaTaxReturn.id,
        deductionType: 'BUSINESS_EXPENSES',
        amount: 12000,
        description: 'Home office and equipment expenses',
      },
    }),
    prisma.deductionEntry.create({
      data: {
        taxReturnId: lisaTaxReturn.id,
        deductionType: 'STATE_LOCAL_TAXES',
        amount: 6500,
        description: 'State taxes and property tax',
      },
    }),
  ])

  console.log('✅ Created user: Lisa Garcia')

  // User 5: Robert Chen - Retiree with multiple income sources
  const robertPassword = await bcrypt.hash('robert_chen_2024', 12)
  const robertUser = await prisma.user.upsert({
    where: { email: 'robert@chen.com' },
    update: {},
    create: {
      name: 'Robert Chen',
      email: 'robert@chen.com',
      password: robertPassword,
    },
  })

  const robertTaxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: {
        userId: robertUser.id,
        taxYear: 2024,
      },
    },
    update: {},
    create: {
      userId: robertUser.id,
      taxYear: 2024,
      filingStatus: 'MARRIED_FILING_SEPARATELY',
      firstName: 'Robert',
      lastName: 'Chen',
      ssn: '888-99-0000',
      address: '567 Retirement Lane',
      city: 'Phoenix',
      state: 'AZ',
      zipCode: '85001',
      totalIncome: 55000,
      adjustedGrossIncome: 55000,
      standardDeduction: 14600,
      itemizedDeduction: 0,
      taxableIncome: 40400,
      taxLiability: 4544,
      totalCredits: 0,
      refundAmount: 0,
      amountOwed: 0,
      currentStep: 1,
      isCompleted: false,
      isFiled: false,
    },
  })

  await Promise.all([
    prisma.incomeEntry.create({
      data: {
        taxReturnId: robertTaxReturn.id,
        incomeType: 'RETIREMENT_DISTRIBUTIONS',
        amount: 35000,
        description: '401k withdrawal',
        payerName: 'Vanguard Retirement Services',
        payerTIN: '11-2233445',
      },
    }),
    prisma.incomeEntry.create({
      data: {
        taxReturnId: robertTaxReturn.id,
        incomeType: 'SOCIAL_SECURITY',
        amount: 18000,
        description: 'Social Security benefits',
      },
    }),
    prisma.incomeEntry.create({
      data: {
        taxReturnId: robertTaxReturn.id,
        incomeType: 'INTEREST',
        amount: 2000,
        description: 'Investment account interest',
        payerName: 'Charles Schwab',
        payerTIN: '55-6677889',
      },
    }),
  ])

  console.log('✅ Created user: Robert Chen')

  // User 6: Amanda Williams - College student with part-time work
  const amandaPassword = await bcrypt.hash('amanda_student2024', 12)
  const amandaUser = await prisma.user.upsert({
    where: { email: 'amanda@williams.com' },
    update: {},
    create: {
      name: 'Amanda Williams',
      email: 'amanda@williams.com',
      password: amandaPassword,
    },
  })

  const amandaTaxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: {
        userId: amandaUser.id,
        taxYear: 2024,
      },
    },
    update: {},
    create: {
      userId: amandaUser.id,
      taxYear: 2024,
      filingStatus: 'SINGLE',
      firstName: 'Amanda',
      lastName: 'Williams',
      ssn: '999-00-1111',
      address: '123 College Ave',
      city: 'Denver',
      state: 'CO',
      zipCode: '80201',
      totalIncome: 15000,
      adjustedGrossIncome: 15000,
      standardDeduction: 14600,
      itemizedDeduction: 0,
      taxableIncome: 400,
      taxLiability: 40,
      totalCredits: 0,
      refundAmount: 0,
      amountOwed: 0,
      currentStep: 1,
      isCompleted: false,
      isFiled: false,
    },
  })

  await Promise.all([
    prisma.incomeEntry.create({
      data: {
        taxReturnId: amandaTaxReturn.id,
        incomeType: 'W2_WAGES',
        amount: 12000,
        description: 'Part-time retail job',
        employerName: 'Campus Bookstore',
        employerEIN: '22-3344556',
      },
    }),
    prisma.incomeEntry.create({
      data: {
        taxReturnId: amandaTaxReturn.id,
        incomeType: 'OTHER_INCOME',
        amount: 3000,
        description: 'Tutoring income',
      },
    }),
    prisma.deductionEntry.create({
      data: {
        taxReturnId: amandaTaxReturn.id,
        deductionType: 'STUDENT_LOAN_INTEREST',
        amount: 1200,
        description: 'Student loan interest paid',
      },
    }),
  ])

  console.log('✅ Created user: Amanda Williams')

  // User 7: David Brown - High earner with investments
  const davidPassword = await bcrypt.hash('david_brown_secure', 12)
  const davidUser = await prisma.user.upsert({
    where: { email: 'david@brown.com' },
    update: {},
    create: {
      name: 'David Brown',
      email: 'david@brown.com',
      password: davidPassword,
    },
  })

  const davidTaxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: {
        userId: davidUser.id,
        taxYear: 2024,
      },
    },
    update: {},
    create: {
      userId: davidUser.id,
      taxYear: 2024,
      filingStatus: 'SINGLE',
      firstName: 'David',
      lastName: 'Brown',
      ssn: '000-11-2222',
      address: '890 Executive Drive',
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
      totalIncome: 175000,
      adjustedGrossIncome: 170000,
      standardDeduction: 14600,
      itemizedDeduction: 25000,
      taxableIncome: 145000,
      taxLiability: 24975,
      totalCredits: 0,
      refundAmount: 0,
      amountOwed: 0,
      currentStep: 1,
      isCompleted: false,
      isFiled: false,
    },
  })

  await Promise.all([
    prisma.incomeEntry.create({
      data: {
        taxReturnId: davidTaxReturn.id,
        incomeType: 'W2_WAGES',
        amount: 140000,
        description: 'Software architect salary',
        employerName: 'Microsoft Corporation',
        employerEIN: '91-1144442',
      },
    }),
    prisma.incomeEntry.create({
      data: {
        taxReturnId: davidTaxReturn.id,
        incomeType: 'CAPITAL_GAINS',
        amount: 25000,
        description: 'Stock sale profits',
      },
    }),
    prisma.incomeEntry.create({
      data: {
        taxReturnId: davidTaxReturn.id,
        incomeType: 'DIVIDENDS',
        amount: 10000,
        description: 'Investment dividends',
        payerName: 'Fidelity Investments',
        payerTIN: '04-3456789',
      },
    }),
    prisma.deductionEntry.create({
      data: {
        taxReturnId: davidTaxReturn.id,
        deductionType: 'MORTGAGE_INTEREST',
        amount: 15000,
        description: 'Home mortgage interest',
      },
    }),
    prisma.deductionEntry.create({
      data: {
        taxReturnId: davidTaxReturn.id,
        deductionType: 'STATE_LOCAL_TAXES',
        amount: 10000,
        description: 'State taxes (SALT limit)',
      },
    }),
  ])

  console.log('✅ Created user: David Brown')

  console.log('🎉 Seed completed successfully!')
  console.log('\n📋 Test accounts created:')
  console.log('1. Email: john@doe.com, Password: johndoe123')
  console.log('2. Email: jane@smith.com, Password: johndoe123')
  console.log('3. Email: michael@johnson.com, Password: michael2024')
  console.log('4. Email: lisa@garcia.com, Password: lisa@secure123')
  console.log('5. Email: robert@chen.com, Password: robert_chen_2024')
  console.log('6. Email: amanda@williams.com, Password: amanda_student2024')  
  console.log('7. Email: david@brown.com, Password: david_brown_secure')
  console.log('\n🏠 Total: 7 test users with diverse tax situations.')
  console.log('📊 Scenarios covered: Single, Married, Head of Household, Self-employed, Retiree, Student, High earner')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
