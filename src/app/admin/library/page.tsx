import { MemberLibrary } from "@/components/admin/MemberLibrary";

/** The middleware and upload APIs independently enforce verified admin access. */
export default function AdminLibraryPage() {
	return <MemberLibrary />;
}
