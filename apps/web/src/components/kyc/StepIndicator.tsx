import { Fragment } from "react";

type FlowState =
	| "idle"
	| "connecting"
	| "checking_kyc"
	| "already_verified"
	| "needs_verification"
	| "verifying"
	| "submitting"
	| "bypassing"
	| "done"
	| "error";

const STEPS = [
	{ label: "Connect Wallet", num: "I" },
	{ label: "Verify Identity", num: "II" },
	{ label: "Complete", num: "III" },
] as const;

export function StepIndicator({ currentState }: { currentState: FlowState }) {
	const completedStates: FlowState[] = [
		"checking_kyc",
		"already_verified",
		"needs_verification",
		"verifying",
		"submitting",
		"done",
	];
	const step2DoneStates: FlowState[] = ["done", "already_verified"];

	const statuses = STEPS.map((_, i) => {
		let status: "active" | "done" | "pending" = "pending";
		if (i === 0) {
			status = ["idle", "connecting"].includes(currentState) ? "active" : "done";
		} else if (i === 1) {
			if (completedStates.includes(currentState)) status = "active";
			if (step2DoneStates.includes(currentState)) status = "done";
		} else {
			if (currentState === "done" || currentState === "already_verified") status = "done";
		}
		return status;
	});

	return (
		<div className="mb-10 w-full max-w-md mx-auto">
			{/* Boxes + connectors row */}
			<div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center">
				{STEPS.map((step, i) => (
					<Fragment key={step.label}>
						<div className="flex justify-center">
							<div
								className={`flex items-center justify-center font-serif font-semibold transition-all border ${
									statuses[i] === "active"
										? "w-12 h-12 text-base border-gold/40 text-gold bg-gold-muted"
										: statuses[i] === "done"
											? "w-10 h-10 text-sm border-status-live/40 text-status-live bg-status-live/10"
											: "w-10 h-10 text-sm border-border text-dim bg-surface"
								}`}
							>
								{statuses[i] === "done" ? (
									<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
										<path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
									</svg>
								) : (
									step.num
								)}
							</div>
						</div>
						{i < 2 && (
							<div
								className={`h-px w-12 transition-all ${
									statuses[i] === "done"
										? "bg-gradient-to-r from-status-live/40 to-status-live/10"
										: "bg-border"
								}`}
							/>
						)}
					</Fragment>
				))}
			</div>
			{/* Labels row */}
			<div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start mt-2">
				{STEPS.map((step, i) => (
					<Fragment key={`label-${step.label}`}>
						<div className="flex justify-center">
							<span
								className={`font-serif tracking-wide text-center ${
									statuses[i] === "active"
										? "text-sm text-gold font-medium"
										: statuses[i] === "done"
											? "text-xs text-status-live"
											: "text-xs text-dim"
								}`}
							>
								{step.label}
							</span>
						</div>
						{i < 2 && <div className="w-12" />}
					</Fragment>
				))}
			</div>
		</div>
	);
}
