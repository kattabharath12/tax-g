
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { TaxFilingInterface } from "@/components/tax-filing-interface"

export default async function TaxFilingPage({ params }: { params: { id: string } }) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    redirect("/auth/login")
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    redirect("/auth/login")
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
    redirect("/dashboard")
  }

  return <TaxFilingInterface taxReturn={taxReturn} />
}
