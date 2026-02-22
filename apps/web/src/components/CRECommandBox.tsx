'use client'
import { useState } from 'react'
import { env } from '@/configs/env'

const EXPLORER_URL = env.NEXT_PUBLIC_EXPLORER_URL

type CREStep = {
    label: string
    eventIndex: number
}

type Props = {
    txHash: string
    steps: CREStep[]
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
            className="text-xs font-sans text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded-lg transition-colors whitespace-nowrap"
        >
            {copied ? '✓ Copied' : (label ?? 'Copy')}
        </button>
    )
}

export function CRECommandBox({ txHash, steps, onDone }: Props) {
    const command = 'cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation'

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 text-sm font-mono">
            <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-sans font-semibold tracking-wide">Transaction confirmed — sync with Chainlink CRE</span>
            </div>

            {/* Tx hash */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-slate-500 text-xs font-sans">Transaction hash (digest)</p>
                    <CopyButton text={txHash} />
                </div>
                <a
                    href={`${EXPLORER_URL}/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 break-all transition-colors text-xs"
                >
                    {txHash}
                </a>
            </div>

            {/* Command */}
            <div className="mb-4">
                <p className="text-slate-500 text-xs font-sans mb-2">Run in terminal</p>
                <div className="relative bg-slate-800 rounded-xl px-4 py-3">
                    <p className="text-green-300 pr-16 leading-relaxed text-xs">{command}</p>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CopyButton text={command} />
                    </div>
                </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
                <p className="text-slate-500 text-xs font-sans">When prompted by the CLI, enter these values:</p>
                {steps.map((step, i) => (
                    <div key={step.label} className="bg-slate-800 rounded-xl px-4 py-3 space-y-2">
                        <p className="text-slate-300 text-xs font-sans font-semibold">Step {i + 1}: {step.label}</p>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-xs font-sans">Trigger type</p>
                                <p className="text-yellow-300 text-xs">1 (LogTrigger)</p>
                            </div>
                            <CopyButton text="1" label="Copy" />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1 mr-3">
                                <p className="text-slate-500 text-xs font-sans">Transaction hash</p>
                                <p className="text-blue-300 text-xs truncate">{txHash}</p>
                            </div>
                            <CopyButton text={txHash} />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-xs font-sans">Event index</p>
                                <p className="text-yellow-300 text-xs">{step.eventIndex}</p>
                            </div>
                            <CopyButton text={String(step.eventIndex)} label="Copy" />
                        </div>
                    </div>
                ))}
            </div>

            {onDone && (
                <button
                    type="button"
                    onClick={onDone}
                    className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-sans py-2 rounded-xl transition-colors"
                >
                    Done
                </button>
            )}
        </div>
    )
}
