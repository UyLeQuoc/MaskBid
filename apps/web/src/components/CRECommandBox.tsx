'use client'
import { useState } from 'react'
import { env } from '@/configs/env'

const EXPLORER_URL = env.NEXT_PUBLIC_EXPLORER_URL

type CREStep = {
    label: string
    eventIndex: number
}

type Props = {
    txHash?: string
    steps?: CREStep[]
    command?: string
    onDone?: () => void
}

function CopyButton({ text, label }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <button
            type="button"
            onClick={copy}
            className="text-[10px] font-serif tracking-wider text-dim hover:text-gold border border-border hover:border-gold/30 px-2 py-0.5 transition-colors whitespace-nowrap"
        >
            {copied ? '✓ Copied' : (label ?? 'Copy')}
        </button>
    )
}

function truncateForDisplay(command: string): string {
    const match = command.match(/^(.*--http-payload ')(.+)(')$/s)
    if (!match) return command
    try {
        const json = JSON.parse(match[2]) as Record<string, unknown>
        const short = Object.fromEntries(
            Object.entries(json).map(([k, v]) => [
                k,
                typeof v === 'string' && v.length > 16 ? `${v.slice(0, 8)}...${v.slice(-4)}` : v,
            ])
        )
        return `${match[1]}${JSON.stringify(short)}${match[3]}`
    } catch {
        return command
    }
}

export function CRECommandBox({ txHash, steps, command: commandProp, onDone }: Props) {
    const command = commandProp ?? 'cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation'
    const displayCommand = truncateForDisplay(command)

    return (
        <div className="frame-ornate-dark p-5 text-sm font-mono space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-status-live animate-pulse inline-block" />
                <span className="text-status-live text-xs font-serif tracking-wider">
                    Transaction confirmed — sync with Chainlink CRE
                </span>
            </div>

            <div className="h-px bg-gold/10" />

            {/* Tx hash — only shown when provided */}
            {txHash && (
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-dim text-xs font-serif tracking-wide">Transaction hash</p>
                        <CopyButton text={txHash} />
                    </div>
                    <a
                        href={`${EXPLORER_URL}/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold/60 hover:text-gold break-all transition-colors text-xs"
                    >
                        {txHash}
                    </a>
                </div>
            )}

            {/* Command */}
            <div>
                <p className="text-dim text-xs font-serif tracking-wide mb-2">Run in terminal</p>
                <div className="relative bg-background border border-border px-4 py-3">
                    <p className="text-status-live pr-16 leading-relaxed text-xs break-all">{displayCommand}</p>
                    <div className="absolute right-3 top-3">
                        <CopyButton text={command} />
                    </div>
                </div>
            </div>

            {/* Steps — only shown when provided */}
            {steps && steps.length > 0 && (
                <div className="space-y-3">
                    <p className="text-dim text-xs font-serif tracking-wide">When prompted by the CLI, enter these values:</p>
                    {steps.map((step, i) => (
                        <div key={step.label} className="border border-border bg-background divide-y divide-border">
                            <div className="px-4 py-2 flex items-center gap-2">
                                <span className="text-gold/40 text-[6px]">&#9670;</span>
                                <p className="text-muted text-xs font-serif tracking-wider">Step {i + 1}: {step.label}</p>
                            </div>

                            <div className="px-4 py-2.5 flex items-center justify-between">
                                <div>
                                    <p className="text-dim text-[10px] font-serif tracking-wide mb-0.5">Trigger type</p>
                                    <p className="text-gold font-mono text-xs">1 <span className="text-dim font-serif">(LogTrigger)</span></p>
                                </div>
                                <CopyButton text="1" />
                            </div>

                            <div className="px-4 py-2.5 flex items-center justify-between">
                                <div className="min-w-0 flex-1 mr-3">
                                    <p className="text-dim text-[10px] font-serif tracking-wide mb-0.5">Transaction hash</p>
                                    <p className="text-gold/60 text-xs truncate">{txHash}</p>
                                </div>
                                <CopyButton text={txHash ?? ''} />
                            </div>

                            <div className="px-4 py-2.5 flex items-center justify-between">
                                <div>
                                    <p className="text-dim text-[10px] font-serif tracking-wide mb-0.5">Event index</p>
                                    <p className="text-gold font-mono text-xs">{step.eventIndex}</p>
                                </div>
                                <CopyButton text={String(step.eventIndex)} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {onDone && (
                <>
                    <div className="h-px bg-gold/10" />
                    <button
                        type="button"
                        onClick={onDone}
                        className="btn-ornate-ghost w-full text-muted hover:text-foreground font-serif tracking-wider text-xs py-2"
                    >
                        Done
                    </button>
                </>
            )}
        </div>
    )
}
