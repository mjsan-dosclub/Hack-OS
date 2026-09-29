import { Desktop } from "@/components/os/Desktop";

/** Protected deep link used by the email sign-in and MFA continuation flow. */
export default function SynergyPage() {
	return <Desktop initialApp="synergy" />;
}
