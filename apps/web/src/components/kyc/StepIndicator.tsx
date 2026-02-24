type FlowState =
    | 'idle'
    | 'connecting'
    | 'checking_kyc'
    | 'already_verified'
    | 'needs_verification'
    | 'verifying'
    | 'submitting'
    | 'bypassing'
    | 'done'
    | 'error'

export function StepIndicator({ currentState }: { currentState: FlowState }) {
    const completedStates: FlowState[] = ['checking_kyc', 'already_verified', 'needs_verification', 'verifying', 'submitting', 'done']
    const step2DoneStates: FlowState[] = ['done', 'already_verified']

    return (
        <div className="flex items-center justify-center gap-0 mb-10 w-full max-w-md mx-auto">
            {(['Connect Wallet', 'Verify Identity', 'Complete'] as const).map((label, i) => {
                let status: 'active' | 'done' | 'pending' = 'pending'
                if (i === 0) {
                    status = ['idle', 'connecting'].includes(currentState) ? 'active' : 'done'
                } else if (i === 1) {
                    if (completedStates.includes(currentState)) status = 'active'
                    if (step2DoneStates.includes(currentState)) status = 'done'
                } else {
                    if (currentState === 'done' || currentState === 'already_verified') status = 'done'
                }

                return (
                    <div key={label} className="flex items-center">
                        <div className="flex flex-col items-center">
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                    status === 'done'
                                        ? 'bg-green-500 text-white'
                                        : status === 'active'
                                        ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                                        : 'bg-gray-200 text-gray-400'
                                }`}
                            >
                                {status === 'done' ? '✓' : i + 1}
                            </div>
                            <span
                                className={`text-xs mt-1 font-medium whitespace-nowrap ${
                                    status === 'done'
                                        ? 'text-green-600'
                                        : status === 'active'
                                        ? 'text-blue-600'
                                        : 'text-gray-400'
                                }`}
                            >
                                {label}
                            </span>
                        </div>
                        {i < 2 && (
                            <div
                                className={`h-0.5 w-16 mx-2 mb-4 transition-all ${
                                    status === 'done' ? 'bg-green-400' : 'bg-gray-200'
                                }`}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
