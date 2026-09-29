import { AdminDashboard } from "@/components/admin/AdminDashboard";

/** Middleware and summary API both require an admin account with MFA. */
export default function AdminHomePage() {
	return <AdminDashboard />;
}
