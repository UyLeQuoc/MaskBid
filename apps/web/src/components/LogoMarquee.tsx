"use client";
/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import Marquee from "react-fast-marquee";

type Logo = {
	name: string;
	icon: ReactNode;
};

const LOGOS: Logo[] = [
	{
		name: "Chainlink",
		icon: (
			<svg viewBox="0 0 37.8 43.6" className="h-6 w-auto" fill="currentColor">
				<path d="M18.9 0l-4 2.3L4 8.6l-4 2.3v21.8l4 2.3L14.9 41.3l4 2.3 4-2.3L33.8 35l4-2.3V10.9l-4-2.3L22.9 2.3 18.9 0zM8 28.4V15.2l10.9-6.3 10.9 6.3v13.2L18.9 34.7 8 28.4z" />
			</svg>
		),
	},
	{
		name: "World ID",
		icon: (
			<img
				src="/worldcoin.svg"
				alt="World ID"
				className="h-6 w-auto brightness-0 invert opacity-40 transition-opacity duration-300 group-hover:opacity-70"
			/>
		),
	},
	{
		name: "Ethereum",
		icon: (
			<svg viewBox="0 0 256 417" className="h-6 w-auto" fill="currentColor">
				<path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity="0.8" />
				<path d="M127.962 0L0 212.32l127.962 75.639V154.158z" opacity="0.5" />
				<path d="M127.961 312.187l-1.575 1.92V414.55l1.575 4.6L256 236.587z" opacity="0.8" />
				<path d="M127.962 419.15V312.187L0 236.587z" opacity="0.5" />
				<path d="M127.961 287.958l127.96-75.637-127.96-58.162z" opacity="0.8" />
				<path d="M0 212.32l127.96 75.639V154.159z" opacity="0.6" />
			</svg>
		),
	},
	{
		name: "Tenderly",
		icon: (
			<img
				src="/tenderly.png"
				alt="Tenderly"
				className="h-6 w-auto brightness-0 invert opacity-40 transition-opacity duration-300 group-hover:opacity-70"
			/>
		),
	},
	{
		name: "Supabase",
		icon: (
			<svg viewBox="0 0 109 113" className="h-6 w-auto" fill="currentColor">
				<path d="M63.7 110.3c-2.6 3.3-8 1.5-8.1-2.7l-1-59.7h40.2c7.3 0 11.3 8.4 6.7 14L63.7 110.3z" opacity="0.7" />
				<path d="M63.7 110.3c-2.6 3.3-8 1.5-8.1-2.7l-1-59.7h40.2c7.3 0 11.3 8.4 6.7 14L63.7 110.3z" opacity="0.4" />
				<path d="M45.3 2.7c2.6-3.3 8-1.5 8.1 2.7l.4 59.7H14c-7.3 0-11.3-8.4-6.7-14L45.3 2.7z" />
			</svg>
		),
	},
];

export function LogoMarquee() {
	return (
		<section className="border-y border-border py-6" aria-label="Technology partners">
			<Marquee speed={40} pauseOnHover gradient gradientColor="#1a1b28" gradientWidth={80}>
				{LOGOS.map((logo) => (
					<div
						key={logo.name}
						className="group flex items-center gap-3 mx-10 text-dim hover:text-muted transition-colors duration-300"
					>
						{logo.icon}
						<span className="text-sm font-medium tracking-wide whitespace-nowrap">{logo.name}</span>
					</div>
				))}
			</Marquee>
		</section>
	);
}
