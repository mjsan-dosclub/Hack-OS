import { Suspense } from "react";
import { MfaChallenge } from "@/components/auth/MfaChallenge";

export default function SetupMfaPage() {
	return (
		<Suspense
			fallback={
				<p className="p-8 text-center text-sm text-slate-400">
					Loading authenticator setup…
				</p>
			}
		>
			<MfaChallenge mode="setup" />
		</Suspense>
	);
}
