'use client'
import { MetaMaskProvider } from '@metamask/sdk-react'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <MetaMaskProvider
            debug={false}
            sdkOptions={{
                dappMetadata: {
                    name: 'MaskBid',
                    url: 'https://maskbid.com',
                },
            }}
        >
            {children}
        </MetaMaskProvider>
    )
}
