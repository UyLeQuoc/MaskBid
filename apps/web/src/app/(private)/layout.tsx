import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { KYCGate } from '@/components/layout/KYCGate'

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            <main className="min-h-screen">
                <KYCGate>{children}</KYCGate>
            </main>
            <Footer />
        </>
    )
}
