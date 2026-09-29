import { z } from "zod";
import { hackathonDisplaySchema } from "@/schemas/hackathon";
import type { Hackathon } from "@/types/hackathon";

/** Sample rows are clearly marked and link to real organizer/source directories. */
const baseTime = Date.now();
const hoursFromNow = (hours: number): string =>
	new Date(baseTime + hours * 3_600_000).toISOString();

const sampleRows = [
	{
		id: "10000000-0000-4000-8000-000000000001",
		slug: "demo-open-source-chennai",
		title: "Demo · Open Source Sprint Chennai",
		description:
			"Illustrative sample event for exploring directory filters, event details, calendar links, and map pins. Confirm current dates and requirements on the source directory.",
		organizer: "Hack Club (source directory)",
		websiteUrl: "https://hackathons.hackclub.com/",
		format: "in-person",
		venueCity: "Chennai",
		venueCountry: "India",
		coordinates: { latitude: 13.0827, longitude: 80.2707 },
		prizeCurrency: "INR",
		totalPrizeValue: 150000,
		startDate: hoursFromNow(24 * 12),
		endDate: hoursFromNow(24 * 14),
		registrationDeadline: hoursFromNow(24 * 8),
		applicationStatus: "open",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000001",
				title: "Community tooling",
				description: "Open source tools for local communities.",
				prizeAmount: 75000,
			},
			{
				id: "20000000-0000-4000-8000-000000000002",
				title: "Climate action",
				description: "Software that supports climate resilience.",
				prizeAmount: 75000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000001",
				slug: "open-source",
				name: "Open Source",
			},
			{
				id: "30000000-0000-4000-8000-000000000002",
				slug: "ai-ml",
				name: "AI/ML",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000002",
		slug: "demo-ai-bengaluru",
		title: "Demo · Responsible AI Build Weekend",
		description:
			"Sample record for an AI-themed student build weekend in Bengaluru. Not a live listing.",
		organizer: "MLH (source directory)",
		websiteUrl: "https://mlh.io/seasons/2026/events",
		format: "hybrid",
		venueCity: "Bengaluru",
		venueCountry: "India",
		coordinates: { latitude: 12.9716, longitude: 77.5946 },
		prizeCurrency: "INR",
		totalPrizeValue: 250000,
		startDate: hoursFromNow(24 * 30),
		endDate: hoursFromNow(24 * 32),
		registrationDeadline: hoursFromNow(24 * 21),
		applicationStatus: "open",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000003",
				title: "Accessible AI",
				description: "Build useful and inclusive AI experiences.",
				prizeAmount: 150000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000003",
				slug: "ai-ml",
				name: "AI/ML",
			},
			{
				id: "30000000-0000-4000-8000-000000000004",
				slug: "beginner-friendly",
				name: "Beginner Friendly",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000003",
		slug: "demo-web3-hyderabad",
		title: "Demo · Web3 for Public Good",
		description: "Sample Web3 event record with a Hyderabad map location.",
		organizer: "ETHGlobal (source directory)",
		websiteUrl: "https://ethglobal.com/events",
		format: "in-person",
		venueCity: "Hyderabad",
		venueCountry: "India",
		coordinates: { latitude: 17.385, longitude: 78.4867 },
		prizeCurrency: "USD",
		totalPrizeValue: 12000,
		startDate: hoursFromNow(24 * 40),
		endDate: hoursFromNow(24 * 42),
		registrationDeadline: hoursFromNow(24 * 27),
		applicationStatus: "upcoming",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000004",
				title: "Public goods",
				description: "Build transparent community infrastructure.",
				prizeAmount: 12000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000005",
				slug: "web3",
				name: "Web3",
			},
			{
				id: "30000000-0000-4000-8000-000000000006",
				slug: "fintech",
				name: "Fintech",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000004",
		slug: "demo-mobile-pune",
		title: "Demo · Mobile Makers Pune",
		description:
			"Sample mobile-first event record for demonstrating tech-tag filters.",
		organizer: "Devpost (source directory)",
		websiteUrl: "https://devpost.com/hackathons",
		format: "hybrid",
		venueCity: "Pune",
		venueCountry: "India",
		coordinates: { latitude: 18.5204, longitude: 73.8567 },
		prizeCurrency: "INR",
		totalPrizeValue: 100000,
		startDate: hoursFromNow(24 * 18),
		endDate: hoursFromNow(24 * 20),
		registrationDeadline: hoursFromNow(24 * 6),
		applicationStatus: "open",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000005",
				title: "Mobile for good",
				description: "A helpful mobile experience for a real community.",
				prizeAmount: 100000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000007",
				slug: "mobile",
				name: "Mobile",
			},
			{
				id: "30000000-0000-4000-8000-000000000008",
				slug: "beginner-friendly",
				name: "Beginner Friendly",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000005",
		slug: "demo-cyber-delhi",
		title: "Demo · Secure by Design Delhi",
		description:
			"Sample cybersecurity challenge for testing search and deadline sorting.",
		organizer: "Unstop (source directory)",
		websiteUrl: "https://unstop.com/hackathons",
		format: "in-person",
		venueCity: "Delhi",
		venueCountry: "India",
		coordinates: { latitude: 28.6139, longitude: 77.209 },
		prizeCurrency: "INR",
		totalPrizeValue: 500000,
		startDate: hoursFromNow(24 * 55),
		endDate: hoursFromNow(24 * 57),
		registrationDeadline: hoursFromNow(30),
		applicationStatus: "open",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000006",
				title: "Threat modeling",
				description: "Improve safety for people and services.",
				prizeAmount: 250000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000009",
				slug: "cybersecurity",
				name: "Cybersecurity",
			},
			{
				id: "30000000-0000-4000-8000-000000000010",
				slug: "open-source",
				name: "Open Source",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000006",
		slug: "demo-iot-sf",
		title: "Demo · Connected Communities",
		description:
			"Sample IoT challenge located in San Francisco for global map coverage.",
		organizer: "Devpost (source directory)",
		websiteUrl: "https://devpost.com/hackathons",
		format: "hybrid",
		venueCity: "San Francisco",
		venueCountry: "United States",
		coordinates: { latitude: 37.7749, longitude: -122.4194 },
		prizeCurrency: "USD",
		totalPrizeValue: 30000,
		startDate: hoursFromNow(24 * 70),
		endDate: hoursFromNow(24 * 72),
		registrationDeadline: hoursFromNow(24 * 48),
		applicationStatus: "upcoming",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000007",
				title: "IoT for resilience",
				description: "Connected devices for stronger neighborhoods.",
				prizeAmount: 30000,
			},
		],
		tags: [
			{ id: "30000000-0000-4000-8000-000000000011", slug: "iot", name: "IoT" },
			{
				id: "30000000-0000-4000-8000-000000000012",
				slug: "ai-ml",
				name: "AI/ML",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000007",
		slug: "demo-climate-london",
		title: "Demo · Climate Data Jam London",
		description:
			"Sample climate and data challenge for map and timeline views.",
		organizer: "MLH (source directory)",
		websiteUrl: "https://mlh.io/seasons/2026/events",
		format: "in-person",
		venueCity: "London",
		venueCountry: "United Kingdom",
		coordinates: { latitude: 51.5072, longitude: -0.1276 },
		prizeCurrency: "GBP",
		totalPrizeValue: 8000,
		startDate: hoursFromNow(24 * 90),
		endDate: hoursFromNow(24 * 92),
		registrationDeadline: hoursFromNow(24 * 64),
		applicationStatus: "upcoming",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000008",
				title: "Open climate data",
				description: "Make useful information accessible.",
				prizeAmount: 8000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000013",
				slug: "open-source",
				name: "Open Source",
			},
			{
				id: "30000000-0000-4000-8000-000000000014",
				slug: "fintech",
				name: "Fintech",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000008",
		slug: "demo-ai-global-online",
		title: "Demo · AI for Everyone Online",
		description:
			"Sample online AI event for demonstrating remote format filters.",
		organizer: "Devfolio (source directory)",
		websiteUrl: "https://devfolio.co/hackathons",
		format: "online",
		venueCity: null,
		venueCountry: null,
		coordinates: null,
		prizeCurrency: "USD",
		totalPrizeValue: 25000,
		startDate: hoursFromNow(24 * 25),
		endDate: hoursFromNow(24 * 27),
		registrationDeadline: hoursFromNow(24 * 18),
		applicationStatus: "open",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000009",
				title: "AI access",
				description: "Build approachable AI experiences.",
				prizeAmount: 25000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000015",
				slug: "ai-ml",
				name: "AI/ML",
			},
			{
				id: "30000000-0000-4000-8000-000000000016",
				slug: "beginner-friendly",
				name: "Beginner Friendly",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000009",
		slug: "demo-web3-online",
		title: "Demo · Open Web3 Challenge",
		description:
			"Sample worldwide Web3 event record without a physical venue pin.",
		organizer: "ETHGlobal (source directory)",
		websiteUrl: "https://ethglobal.com/events",
		format: "online",
		venueCity: null,
		venueCountry: null,
		coordinates: null,
		prizeCurrency: "USD",
		totalPrizeValue: 50000,
		startDate: hoursFromNow(24 * 110),
		endDate: hoursFromNow(24 * 112),
		registrationDeadline: hoursFromNow(24 * 82),
		applicationStatus: "upcoming",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000010",
				title: "Open finance",
				description: "Design safer and more accessible financial primitives.",
				prizeAmount: 50000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000017",
				slug: "web3",
				name: "Web3",
			},
			{
				id: "30000000-0000-4000-8000-000000000018",
				slug: "fintech",
				name: "Fintech",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000010",
		slug: "demo-iot-asia",
		title: "Demo · IoT for Campus Life",
		description:
			"Sample student IoT challenge in Bengaluru with beginner-friendly tracks.",
		organizer: "Unstop (source directory)",
		websiteUrl: "https://unstop.com/hackathons",
		format: "hybrid",
		venueCity: "Bengaluru",
		venueCountry: "India",
		coordinates: { latitude: 12.9352, longitude: 77.6245 },
		prizeCurrency: "INR",
		totalPrizeValue: 75000,
		startDate: hoursFromNow(24 * 15),
		endDate: hoursFromNow(24 * 16),
		registrationDeadline: hoursFromNow(24 * 11),
		applicationStatus: "open",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000011",
				title: "Campus sensors",
				description: "Use connected devices to make campus life better.",
				prizeAmount: 75000,
			},
		],
		tags: [
			{ id: "30000000-0000-4000-8000-000000000019", slug: "iot", name: "IoT" },
			{
				id: "30000000-0000-4000-8000-000000000020",
				slug: "mobile",
				name: "Mobile",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000011",
		slug: "demo-accessibility-remote",
		title: "Demo · Accessible by Default",
		description:
			"Sample online accessibility build challenge with a short registration window.",
		organizer: "Devpost (source directory)",
		websiteUrl: "https://devpost.com/hackathons",
		format: "online",
		venueCity: null,
		venueCountry: null,
		coordinates: null,
		prizeCurrency: "USD",
		totalPrizeValue: 2500,
		startDate: hoursFromNow(24 * 5),
		endDate: hoursFromNow(24 * 6),
		registrationDeadline: hoursFromNow(6),
		applicationStatus: "open",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000012",
				title: "Inclusive interfaces",
				description: "Make common digital tasks work for more people.",
				prizeAmount: 2500,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000021",
				slug: "beginner-friendly",
				name: "Beginner Friendly",
			},
			{
				id: "30000000-0000-4000-8000-000000000022",
				slug: "open-source",
				name: "Open Source",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000012",
		slug: "demo-fintech-delhi",
		title: "Demo · Student Fintech Lab",
		description:
			"Sample fintech hackathon for demonstrating prize thresholds and status filters.",
		organizer: "Devfolio (source directory)",
		websiteUrl: "https://devfolio.co/hackathons",
		format: "in-person",
		venueCity: "Delhi",
		venueCountry: "India",
		coordinates: { latitude: 28.6139, longitude: 77.209 },
		prizeCurrency: "INR",
		totalPrizeValue: 2500000,
		startDate: hoursFromNow(24 * 125),
		endDate: hoursFromNow(24 * 127),
		registrationDeadline: hoursFromNow(24 * 94),
		applicationStatus: "upcoming",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000013",
				title: "Financial inclusion",
				description: "Create practical tools for financial wellbeing.",
				prizeAmount: 2500000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000023",
				slug: "fintech",
				name: "Fintech",
			},
			{
				id: "30000000-0000-4000-8000-000000000024",
				slug: "ai-ml",
				name: "AI/ML",
			},
		],
	},
	{
		id: "10000000-0000-4000-8000-000000000013",
		slug: "demo-climate-hybrid",
		title: "Demo · Climate Resilience Lab",
		description:
			"Sample sustainability challenge in Pune with Web3 and open-source tracks.",
		organizer: "MLH (source directory)",
		websiteUrl: "https://mlh.io/seasons/2026/events",
		format: "hybrid",
		venueCity: "Pune",
		venueCountry: "India",
		coordinates: { latitude: 18.5074, longitude: 73.8077 },
		prizeCurrency: "INR",
		totalPrizeValue: 300000,
		startDate: hoursFromNow(24 * 80),
		endDate: hoursFromNow(24 * 82),
		registrationDeadline: hoursFromNow(24 * 53),
		applicationStatus: "upcoming",
		source: "manual",
		verified: false,
		eligibilityRules:
			"Illustrative sample only. Check the source directory for current eligibility.",
		submissionGuidelines:
			"Illustrative sample only. Confirm submission requirements on the source directory.",
		tracks: [
			{
				id: "20000000-0000-4000-8000-000000000014",
				title: "Resilient cities",
				description: "Open tools to help communities prepare and adapt.",
				prizeAmount: 150000,
			},
		],
		tags: [
			{
				id: "30000000-0000-4000-8000-000000000025",
				slug: "open-source",
				name: "Open Source",
			},
			{
				id: "30000000-0000-4000-8000-000000000026",
				slug: "web3",
				name: "Web3",
			},
		],
	},
] as const;

/** Runtime-validated demo directory. Replace this source with published DB rows when connected. */
export const MOCK_HACKATHONS: Hackathon[] = z
	.array(hackathonDisplaySchema)
	.parse(
		sampleRows.map((row, index) => ({
			...row,
			bannerUrl: null,
			createdAt: hoursFromNow(-index * 24),
		})),
	);
