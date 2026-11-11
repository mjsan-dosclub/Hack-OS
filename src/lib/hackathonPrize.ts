import type { CashPrizeStatus } from "@/types/hackathon";

export function formatHackathonPrize(event: {
	cashPrizeStatus: CashPrizeStatus;
	prizeCurrency: string;
	totalPrizeValue: number;
}): string {
	if (event.cashPrizeStatus === "unannounced") return "Cash prize TBA";
	if (event.cashPrizeStatus === "no-cash-prize") return "No cash prize";
	try {
		return new Intl.NumberFormat("en", {
			style: "currency",
			currency: event.prizeCurrency,
			maximumFractionDigits: 0,
		}).format(event.totalPrizeValue);
	} catch {
		return `${event.prizeCurrency} ${event.totalPrizeValue.toLocaleString("en")}`;
	}
}
