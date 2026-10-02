"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowLeft,
	ArrowRight,
	BadgeCheck,
	BriefcaseBusiness,
	Check,
	ExternalLink,
	LoaderCircle,
	MapPin,
	ShieldCheck,
	Sparkles,
	UsersRound,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { memberAccessActionSchema } from "@/schemas/auth";
import {
	type SynergyMatchResponse,
	synergyMatchResponseSchema,
} from "@/schemas/synergy";
import { useWindowManager } from "@/stores/useWindowManager";

const STEPS = ["Goals", "Skills & roles", "Travel", "Matches"] as const;
const MATCH_STAGES = [
	"Initializing your member profile…",
	"Finding verified hackathons in India and online…",
	"Comparing interests, skills, and teammate roles…",
	"Checking mentor experience and preparing your shortlist…",
];

function splitList(value: string): string[] {
	return [
		...new Set(
			value
				.split(",")
				.map((part) => part.trim())
				.filter(Boolean),
		),
	];
}

type AccessAction = "sign_in" | "setup_mfa" | "verify_mfa" | null;

function ErrorPanel({ text, action }: { text: string; action: AccessAction }) {
	const href =
		action === "sign_in"
			? "/login?next=%2Fapps%2Fsynergy"
			: action === "setup_mfa"
				? "/auth/mfa/setup?next=%2F"
				: action === "verify_mfa"
					? "/auth/mfa/verify?next=%2F"
					: null;
	const opensNewTab = action === "setup_mfa" || action === "verify_mfa";
	return (
		<div className="mt-5 rounded-xl border border-amber-200/15 bg-amber-200/[0.06] p-4 text-sm text-amber-50/80">
			<p>{text}</p>
			{href && (
				<a
					href={href}
					target={opensNewTab ? "_blank" : undefined}
					rel={opensNewTab ? "noreferrer" : undefined}
					className="mt-3 inline-flex items-center gap-2 font-semibold text-cyan-100 hover:text-white"
				>
					{action === "sign_in"
						? "Sign in to member portal"
						: action === "setup_mfa"
							? "Set up authenticator"
							: "Verify authenticator"}{" "}
					<ExternalLink size={14} />
				</a>
			)}
			{opensNewTab && (
				<p className="mt-2 text-xs text-slate-400">
					Complete this step in the new tab, then return here and select Find my
					matches again.
				</p>
			)}
		</div>
	);
}

function MatchResults({ results }: { results: SynergyMatchResponse }) {
	if (!results.hackathons.length) {
		return (
			<div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-5">
				<h3 className="font-semibold">
					No reviewed events match your request yet.
				</h3>
				<p className="mt-2 text-sm leading-6 text-slate-400">
					Your profile is saved. Events appear here after an administrator
					checks their official details and approves them. Online and India
					travel options may show different results once events are published.
				</p>
			</div>
		);
	}
	return (
		<div className="mt-5 space-y-5">
			<section>
				<div className="mb-3 flex items-center justify-between">
					<h3 className="font-semibold">Hackathons for your goals</h3>
					<span className="text-xs text-slate-500">
						{results.hackathons.length} verified
					</span>
				</div>
				<div className="grid gap-3">
					{results.hackathons.map((event) => (
						<article
							key={event.id}
							className="rounded-2xl border border-white/10 bg-black/15 p-4"
						>
							<div className="flex flex-wrap items-center gap-2">
								<span className="rounded-full border border-cyan-100/15 bg-cyan-100/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-wider text-cyan-100">
									{event.matchScore}% fit
								</span>
								<span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] capitalize text-slate-400">
									{event.format}
								</span>
								{event.tags.slice(0, 2).map((tag) => (
									<span
										key={tag}
										className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400"
									>
										{tag}
									</span>
								))}
							</div>
							<h4 className="mt-3 text-base font-semibold">{event.title}</h4>
							<p className="mt-1 text-xs text-slate-500">
								{event.organizer} ·{" "}
								{event.venueCity
									? `${event.venueCity}, ${event.venueCountry}`
									: "Online / location flexible"}
							</p>
							<p className="mt-3 text-sm leading-6 text-slate-300">
								{event.matchReason}
							</p>
							<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
								<span>
									Starts{" "}
									{new Intl.DateTimeFormat("en-IN", {
										dateStyle: "medium",
										timeZone: "Asia/Kolkata",
									}).format(new Date(event.startDate))}
								</span>
								{event.registrationDeadline && (
									<span>
										Register by{" "}
										{new Intl.DateTimeFormat("en-IN", {
											dateStyle: "medium",
											timeZone: "Asia/Kolkata",
										}).format(new Date(event.registrationDeadline))}
									</span>
								)}
								{event.totalPrizeValue > 0 && (
									<span>
										{new Intl.NumberFormat("en-IN", {
											style: "currency",
											currency: event.prizeCurrency,
											maximumFractionDigits: 0,
										}).format(event.totalPrizeValue)}{" "}
										prizes
									</span>
								)}
							</div>
							<a
								href={event.websiteUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-100 hover:text-white"
							>
								Official event page <ExternalLink size={14} />
							</a>
						</article>
					))}
				</div>
			</section>
			<section>
				<div className="mb-3 flex items-center justify-between">
					<h3 className="font-semibold">Potential teammates</h3>
					<span className="text-xs text-slate-500">
						Check availability before forming a team
					</span>
				</div>
				{results.teammates.length ? (
					<div className="grid gap-3 sm:grid-cols-2">
						{results.teammates.map((member) => (
							<article
								key={member.id}
								className="rounded-2xl border border-white/10 bg-black/15 p-4"
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<h4 className="font-semibold">{member.fullName}</h4>
										<p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
											{member.membershipStatus}
										</p>
									</div>
									<UsersRound size={18} className="text-cyan-100" />
								</div>
								<p className="mt-3 text-sm leading-5 text-slate-300">
									{member.matchReason}
								</p>
								<div className="mt-3 flex flex-wrap gap-1.5">
									{member.primarySkills.slice(0, 5).map((skill) => (
										<span
											key={skill}
											className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] text-slate-400"
										>
											{skill}
										</span>
									))}
								</div>
								{member.locationCity && (
									<p className="mt-3 flex items-center gap-1 text-xs text-slate-500">
										<MapPin size={12} />
										{member.locationCity}
										{member.canTravel ? " · open to travel" : ""}
									</p>
								)}
								<div className="mt-4 flex gap-3">
									{member.linkedinUrl && (
										<a
											href={member.linkedinUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1.5 text-xs text-cyan-100 hover:text-white"
										>
											LinkedIn <ExternalLink size={12} />
										</a>
									)}
									{member.githubUrl && (
										<a
											href={member.githubUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
										>
											GitHub <ExternalLink size={12} />
										</a>
									)}
								</div>
							</article>
						))}
					</div>
				) : (
					<p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">
						No teammate can be matched from the current member profiles yet. The
						imported roster contains basic identity and education fields, but
						matching needs skills, interests, or project experience. Ask a club
						administrator to add those details to the member library.
					</p>
				)}
			</section>
			{results.mentor && (
				<section className="rounded-2xl border border-violet-200/15 bg-violet-300/[0.05] p-4">
					<div className="flex items-center gap-2 text-violet-100">
						<BriefcaseBusiness size={17} />
						<h3 className="font-semibold">Mentor suggestion</h3>
					</div>
					<h4 className="mt-3 font-semibold">{results.mentor.fullName}</h4>
					<p className="mt-1 text-sm text-slate-300">
						{results.mentor.matchReason}
					</p>
					<div className="mt-3 flex flex-wrap gap-1.5">
						{results.mentor.primarySkills.slice(0, 5).map((skill) => (
							<span
								key={skill}
								className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] text-slate-400"
							>
								{skill}
							</span>
						))}
					</div>
					{results.mentor.linkedinUrl && (
						<a
							href={results.mentor.linkedinUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-4 inline-flex items-center gap-2 text-sm text-violet-100 hover:text-white"
						>
							Contact on LinkedIn <ExternalLink size={14} />
						</a>
					)}
				</section>
			)}
			<div className="rounded-xl border border-white/10 p-4 text-xs leading-5 text-slate-400">
				<div className="flex items-center gap-2 text-slate-200">
					<ShieldCheck size={14} /> Private matching note
				</div>
				<p className="mt-2">{results.assessment.note}</p>
				{results.assessment.available && (
					<p className="mt-1">
						{results.assessment.usedForMatching
							? "Approved assessment excerpts informed team-balance suggestions; exact scores and labels are not shown."
							: "Your assessment is stored privately and was not used in this match."}
					</p>
				)}
			</div>
		</div>
	);
}

export function SynergyProfilerApp() {
	const activeWindowId = useWindowManager((state) => state.activeWindowId);
	const [step, setStep] = useState(0);
	const [fieldOfInterest, setFieldOfInterest] = useState("");
	const [concerns, setConcerns] = useState("");
	const [studentSkills, setStudentSkills] = useState("");
	const [techComfort, setTechComfort] = useState("");
	const [rolesSought, setRolesSought] = useState("");
	const [contributionSummary, setContributionSummary] = useState("");
	const [locationCity, setLocationCity] = useState("");
	const [travelFlexibility, setTravelFlexibility] = useState<
		"remote_only" | "regional" | "anywhere"
	>("remote_only");
	const [allowAiMatching, setAllowAiMatching] = useState(false);
	const [allowProfileForAiMatching, setAllowProfileForAiMatching] =
		useState(false);
	const [busy, setBusy] = useState(false);
	const [stage, setStage] = useState(0);
	const [results, setResults] = useState<SynergyMatchResponse | null>(null);
	const [error, setError] = useState("");
	const [accessAction, setAccessAction] = useState<AccessAction>(null);

	useEffect(() => {
		if (activeWindowId !== "synergy") return;
		const focusTargetIds = [
			"synergy-interest",
			"synergy-skills",
			"synergy-city",
			"synergy-ai-matching",
		] as const;
		const timer = window.setTimeout(() => {
			document.getElementById(focusTargetIds[step])?.focus();
		}, 200);
		return () => window.clearTimeout(timer);
	}, [activeWindowId, step]);

	async function generateMatches(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setAccessAction(null);
		setResults(null);
		setBusy(true);
		setStage(0);
		const interval = window.setInterval(
			() =>
				setStage((current) => Math.min(current + 1, MATCH_STAGES.length - 1)),
			1400,
		);
		try {
			const response = await fetch("/api/synergy/match", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					fieldOfInterest,
					studentSkills: splitList(studentSkills),
					techComfort: splitList(techComfort),
					rolesSought: splitList(rolesSought),
					concerns,
					contributionSummary,
					locationCity: locationCity.trim() || null,
					travelFlexibility,
					allowAiMatching,
					allowProfileForAiMatching,
				}),
			});
			const data: unknown = await response.json();
			if (!response.ok) {
				const apiError =
					typeof data === "object" &&
					data !== null &&
					"error" in data &&
					typeof data.error === "string"
						? data.error
						: "Matching is currently unavailable.";
				// A 403 means the session exists but lacks member/MFA authorization;
				// only a 401 should send the user back through email sign-in.
				const actionValue =
					typeof data === "object" && data !== null && "action" in data
						? memberAccessActionSchema.safeParse(data.action)
						: null;
				setAccessAction(
					response.status === 401
						? "sign_in"
						: response.status === 403 && actionValue?.success
							? actionValue.data
							: null,
				);
				throw new Error(apiError);
			}
			const parsed = synergyMatchResponseSchema.safeParse(data);
			if (!parsed.success)
				throw new Error(
					"The match response did not match the expected data format.",
				);
			setResults(parsed.data);
			setStep(3);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Matching is currently unavailable.",
			);
		} finally {
			window.clearInterval(interval);
			setBusy(false);
		}
	}

	const canContinue =
		step === 0
			? fieldOfInterest.trim().length >= 2
			: step === 1
				? contributionSummary.trim().length >= 8
				: true;

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#11141d] text-slate-100">
			<div className="border-b border-white/10 px-5 py-5 sm:px-7">
				<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
					<Sparkles size={14} /> DeScience Synergy Engine
				</div>
				<h2 className="mt-2 text-xl font-semibold">
					Find a hackathon and a team that fits.
				</h2>
				<p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
					Share what you want to learn, what you can contribute, and how far you
					can travel. Results use verified event information and the private
					club skill matrix.
				</p>
				<ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Profile steps">
					{STEPS.map((name, index) => (
						<li key={name} className="min-w-0">
							<div
								className={`h-1 rounded-full ${index <= step ? "bg-cyan-200" : "bg-white/10"}`}
							/>
							<p
								className={`mt-2 truncate text-xs ${index === step ? "text-cyan-100" : "text-slate-500"}`}
							>
								{index + 1}. {name}
							</p>
						</li>
					))}
				</ol>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
				{busy ? (
					<div className="mx-auto flex min-h-[340px] max-w-md flex-col items-center justify-center text-center">
						<div className="grid size-16 place-items-center rounded-full border border-cyan-100/20 bg-cyan-100/[0.06] text-cyan-100">
							<LoaderCircle size={28} className="animate-spin" />
						</div>
						<h3 className="mt-5 text-lg font-semibold">
							Building your shortlist
						</h3>
						<AnimatePresence mode="wait">
							<motion.p
								key={stage}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								className="mt-2 text-sm text-slate-400"
							>
								{MATCH_STAGES[stage]}
							</motion.p>
						</AnimatePresence>
						<p className="mt-6 max-w-sm text-xs leading-5 text-slate-500">
							{allowAiMatching
								? "Your name and contact details stay on Hack OS. The selected profile details and relevant excerpts from admin-approved files are sent to hosted JarvisLabs Ollama."
								: "Your profile stays on the Hack OS server. Local matching uses your stated interests and verified club profiles."}
						</p>
					</div>
				) : results ? (
					<>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-200">
									<BadgeCheck size={14} /> Profile matched
								</div>
								<h3 className="mt-1 text-lg font-semibold">
									Your starting shortlist
								</h3>
							</div>
							<button
								type="button"
								onClick={() => {
									setResults(null);
									setStep(0);
								}}
								className="text-xs text-slate-400 hover:text-white"
							>
								Edit profile
							</button>
						</div>
						<MatchResults results={results} />
					</>
				) : (
					<form
						onSubmit={
							step === 3
								? generateMatches
								: (event) => {
										event.preventDefault();
										if (canContinue)
											setStep((current) => Math.min(current + 1, 3));
									}
						}
					>
						<AnimatePresence mode="wait" initial={false}>
							<motion.section
								key={step}
								initial={{ opacity: 0, x: 12 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -12 }}
								transition={{ duration: 0.16 }}
								className="max-w-2xl"
							>
								{step === 0 && (
									<>
										<h3 className="text-lg font-semibold">
											What brings you to a hackathon?
										</h3>
										<p className="mt-1 text-sm text-slate-400">
											Tell us the field or problem you want to work on.
										</p>
										<label
											className="mt-5 block text-xs text-slate-400"
											htmlFor="synergy-interest"
										>
											Field of interest
										</label>
										<input
											id="synergy-interest"
											required
											minLength={2}
											maxLength={180}
											value={fieldOfInterest}
											onChange={(event) =>
												setFieldOfInterest(event.currentTarget.value)
											}
											className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none focus:border-cyan-100/40"
											placeholder="Climate tech, accessible education, civic data…"
										/>
										<label
											className="mt-5 block text-xs text-slate-400"
											htmlFor="synergy-concerns"
										>
											Questions or concerns (optional)
										</label>
										<textarea
											id="synergy-concerns"
											maxLength={800}
											value={concerns}
											onChange={(event) =>
												setConcerns(event.currentTarget.value)
											}
											className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none focus:border-cyan-100/40"
											placeholder="First event? Unsure how to pitch? Want a beginner-friendly team?"
										/>
									</>
								)}
								{step === 1 && (
									<>
										<h3 className="text-lg font-semibold">
											What can you contribute?
										</h3>
										<p className="mt-1 text-sm text-slate-400">
											Your skills help us suggest complementary teammates. Use
											comma-separated items.
										</p>
										<label
											className="mt-5 block text-xs text-slate-400"
											htmlFor="synergy-skills"
										>
											Your skills
										</label>
										<input
											id="synergy-skills"
											maxLength={500}
											value={studentSkills}
											onChange={(event) =>
												setStudentSkills(event.currentTarget.value)
											}
											className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none focus:border-cyan-100/40"
											placeholder="React, research, prototyping, pitching"
										/>
										<label
											className="mt-4 block text-xs text-slate-400"
											htmlFor="synergy-tech"
										>
											Technology you are comfortable using
										</label>
										<input
											id="synergy-tech"
											maxLength={500}
											value={techComfort}
											onChange={(event) =>
												setTechComfort(event.currentTarget.value)
											}
											className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none focus:border-cyan-100/40"
											placeholder="TypeScript, Python, Figma, Arduino"
										/>
										<label
											className="mt-4 block text-xs text-slate-400"
											htmlFor="synergy-roles"
										>
											Roles you want teammates to fill
										</label>
										<input
											id="synergy-roles"
											maxLength={500}
											value={rolesSought}
											onChange={(event) =>
												setRolesSought(event.currentTarget.value)
											}
											className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none focus:border-cyan-100/40"
											placeholder="Backend, UI/UX, data science, presenter"
										/>
										<label
											className="mt-4 block text-xs text-slate-400"
											htmlFor="synergy-contribution"
										>
											What would you like to own or learn?
										</label>
										<textarea
											id="synergy-contribution"
											required
											minLength={8}
											maxLength={800}
											value={contributionSummary}
											onChange={(event) =>
												setContributionSummary(event.currentTarget.value)
											}
											className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none focus:border-cyan-100/40"
											placeholder="I can build the interface and would like to learn user research…"
										/>
									</>
								)}
								{step === 2 && (
									<>
										<h3 className="text-lg font-semibold">
											How far can you travel?
										</h3>
										<p className="mt-1 text-sm text-slate-400">
											Physical events are currently limited to India. Online
											events are included from anywhere.
										</p>
										<label
											className="mt-5 block text-xs text-slate-400"
											htmlFor="synergy-city"
										>
											Your city (optional)
										</label>
										<input
											id="synergy-city"
											maxLength={120}
											value={locationCity}
											onChange={(event) =>
												setLocationCity(event.currentTarget.value)
											}
											className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none focus:border-cyan-100/40"
											placeholder="Chennai"
										/>
										<fieldset className="mt-5 space-y-2">
											<legend className="mb-2 text-xs text-slate-400">
												Travel flexibility
											</legend>
											{(
												[
													{
														value: "remote_only",
														label: "Remote only",
														detail: "Show online events.",
													},
													{
														value: "regional",
														label: "Near my city",
														detail:
															"Online events plus in-person events in your city.",
													},
													{
														value: "anywhere",
														label: "Anywhere in India",
														detail: "Online and in-person events across India.",
													},
												] as const
											).map((option) => (
												<label
													key={option.value}
													className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${travelFlexibility === option.value ? "border-cyan-100/40 bg-cyan-100/[0.06]" : "border-white/10 bg-black/10"}`}
												>
													<input
														type="radio"
														name="travel"
														value={option.value}
														checked={travelFlexibility === option.value}
														onChange={() => setTravelFlexibility(option.value)}
														className="mt-1 accent-cyan-200"
													/>
													<span>
														<span className="block text-sm text-slate-200">
															{option.label}
														</span>
														<span className="mt-0.5 block text-xs text-slate-500">
															{option.detail}
														</span>
													</span>
												</label>
											))}
										</fieldset>
									</>
								)}
								{step === 3 && (
									<>
										<h3 className="text-lg font-semibold">
											Ready to find your people?
										</h3>
										<p className="mt-1 text-sm text-slate-400">
											We’ll compare your profile with verified, published events
											and the club skill matrix.
										</p>
										<p className="mt-2 text-xs leading-5 text-slate-500">
											Successful teammate searches are counted for club usage
											analytics; your profile answers and match results are not
											included in that log.
										</p>
										<div className="mt-5 grid gap-3 sm:grid-cols-2">
											{[
												{
													title: "Event eligibility",
													detail:
														"Published and verified hackathons with open or upcoming registration.",
													icon: BadgeCheck,
												},
												{
													title: "Team fit",
													detail:
														"Your interests, skills, requested roles, city, and travel flexibility.",
													icon: UsersRound,
												},
												{
													title: "Mentor suggestions",
													detail:
														"Verified mentors and alumni with related skills or interests.",
													icon: BriefcaseBusiness,
												},
												{
													title: "Your OriginBI profile",
													detail:
														"May guide team balance only when the member and the admin-approved file have opted in.",
													icon: ShieldCheck,
												},
											].map(({ title, detail, icon: Icon }) => (
												<div
													key={title}
													className="rounded-xl border border-white/10 bg-black/10 p-4"
												>
													<Icon size={18} className="text-cyan-100" />
													<h4 className="mt-3 text-sm font-medium">{title}</h4>
													<p className="mt-1 text-xs leading-5 text-slate-500">
														{detail}
													</p>
												</div>
											))}
										</div>
										<label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/10 p-4">
											<input
												id="synergy-ai-matching"
												type="checkbox"
												checked={allowAiMatching}
												onChange={(event) =>
													setAllowAiMatching(event.target.checked)
												}
												className="mt-1 accent-cyan-200"
											/>
											<span>
												<span className="block text-sm font-medium text-slate-200">
													Use AI-assisted teammate suggestions (optional)
												</span>
												<span className="mt-1 block text-xs leading-5 text-slate-500">
													If selected, your interest, skills, requested roles,
													and contribution summary plus relevant excerpts from
													admin-enabled files are sent to hosted JarvisLabs
													Ollama. Your name, email, and social links are not
													included in that model request. Leave unchecked for
													local rule-based matching.
												</span>
											</span>
										</label>
										<label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/10 p-4">
											<input
												type="checkbox"
												checked={allowProfileForAiMatching}
												onChange={(event) =>
													setAllowProfileForAiMatching(event.target.checked)
												}
												className="mt-1 accent-cyan-200"
											/>
											<span>
												<span className="block text-sm font-medium text-slate-200">
													Let my de-identified profile be considered in future
													AI matches
												</span>
												<span className="mt-1 block text-xs leading-5 text-slate-500">
													This is optional and can be changed the next time you
													make a match request. Your name, email, and contact
													links stay on Hack OS.
												</span>
											</span>
										</label>
									</>
								)}
							</motion.section>
						</AnimatePresence>
						{error && <ErrorPanel text={error} action={accessAction} />}
						<div className="mt-7 flex items-center justify-between border-t border-white/10 pt-4">
							{step > 0 ? (
								<button
									type="button"
									onClick={() => setStep((current) => Math.max(current - 1, 0))}
									className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
								>
									<ArrowLeft size={15} /> Back
								</button>
							) : (
								<span className="text-xs text-slate-600">
									Your profile is only visible to verified club members.
								</span>
							)}
							{step < 3 ? (
								<button
									type="submit"
									disabled={!canContinue}
									className="inline-flex items-center gap-2 rounded-xl bg-cyan-100 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"
								>
									Continue <ArrowRight size={15} />
								</button>
							) : (
								<button
									type="submit"
									className="inline-flex items-center gap-2 rounded-xl bg-cyan-100 px-4 py-2.5 text-sm font-semibold text-slate-950"
								>
									<Check size={16} /> Find my matches
								</button>
							)}
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
